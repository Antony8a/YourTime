-- +goose Up
-- +goose StatementBegin

-- Platform-wide settings, edited by the owner from the app. One row.
CREATE TABLE platform_settings (
    id                        SMALLINT PRIMARY KEY CHECK (id = 1),
    -- The commission, in basis points of the agreed price (1000 = 10 %).
    fee_bps                   INT     NOT NULL DEFAULT 1000 CHECK (fee_bps BETWEEN 0 AND 10000),
    test_topups_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
    -- Largest test top-up and sign-up credit, in USD minor units; converted to the
    -- person's wallet currency when granted.
    test_topup_max_usd_minor  BIGINT  NOT NULL DEFAULT 10000 CHECK (test_topup_max_usd_minor >= 0),
    signup_credit_usd_minor   BIGINT  NOT NULL DEFAULT 0 CHECK (signup_credit_usd_minor >= 0),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by                UUID REFERENCES users(id) ON DELETE SET NULL
);
INSERT INTO platform_settings (id) VALUES (1);

-- A wallet is created the first time it is credited, in the account's currency at
-- that moment, and the currency never changes after that. While it exists the
-- account currency is locked (enforced in UserRepo.Update).
CREATE TABLE wallets (
    user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    currency       CHAR(3) NOT NULL,
    balance_minor  BIGINT  NOT NULL DEFAULT 0 CHECK (balance_minor >= 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Once a wallet exists the account currency is frozen. A trigger, not application
-- code, so it holds even if two requests race: the first credit takes a share lock
-- on the user row before reading its currency, and this trigger runs after the
-- update has the row lock and sees any wallet that committed meanwhile.
CREATE FUNCTION users_currency_locked() RETURNS trigger AS $$
BEGIN
    IF NEW.currency IS DISTINCT FROM OLD.currency
       AND EXISTS (SELECT 1 FROM wallets WHERE user_id = OLD.id) THEN
        RAISE EXCEPTION 'currency_locked' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_currency_locked_trg
    BEFORE UPDATE OF currency ON users
    FOR EACH ROW EXECUTE FUNCTION users_currency_locked();

CREATE TABLE promotions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(100) NOT NULL,
    -- Redeemable code, matched without regard to case. Optional for the kinds that
    -- apply by themselves.
    code              VARCHAR(40),
    kind              VARCHAR(20) NOT NULL CHECK (kind IN ('topup_bonus', 'fee_discount', 'credit_grant')),
    -- topup_bonus: extra credit as basis points of each top-up.
    -- fee_discount: share of the commission waived, in basis points (10000 = free).
    value_bps         INT CHECK (value_bps IS NULL OR value_bps BETWEEN 1 AND 10000),
    -- credit_grant: amount credited when the code is redeemed, in USD minor units.
    amount_usd_minor  BIGINT CHECK (amount_usd_minor IS NULL OR amount_usd_minor > 0),
    starts_at         TIMESTAMPTZ,
    ends_at           TIMESTAMPTZ,
    active            BOOLEAN NOT NULL DEFAULT TRUE,
    max_redemptions   INT CHECK (max_redemptions IS NULL OR max_redemptions > 0),
    redemptions_count INT NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT promotions_value_by_kind CHECK (
        (kind IN ('topup_bonus', 'fee_discount') AND value_bps IS NOT NULL AND amount_usd_minor IS NULL)
        OR (kind = 'credit_grant' AND amount_usd_minor IS NOT NULL AND value_bps IS NULL AND code IS NOT NULL)
    ),
    CONSTRAINT promotions_window CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);
CREATE UNIQUE INDEX promotions_code_idx ON promotions (lower(code)) WHERE code IS NOT NULL;

CREATE TABLE promotion_redemptions (
    promotion_id  UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    redeemed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (promotion_id, user_id)
);

-- Every movement of a wallet. amount_minor is signed: credits positive, the
-- commission negative. The balance is the sum, kept in wallets for speed.
CREATE TABLE wallet_transactions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Orders movements that share a timestamp (a top-up and its bonus).
    seq                  BIGINT GENERATED ALWAYS AS IDENTITY,
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind                 VARCHAR(20) NOT NULL CHECK (kind IN (
        'topup_test', 'topup_manual', 'topup_bonus', 'promo_credit', 'signup_credit', 'fee', 'fee_refund')),
    amount_minor         BIGINT NOT NULL CHECK (amount_minor <> 0),
    balance_after_minor  BIGINT NOT NULL CHECK (balance_after_minor >= 0),
    currency             CHAR(3) NOT NULL,
    task_id              UUID REFERENCES tasks(id) ON DELETE SET NULL,
    promotion_id         UUID REFERENCES promotions(id) ON DELETE SET NULL,
    note                 VARCHAR(200),
    created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX wallet_transactions_user_idx ON wallet_transactions (user_id, seq DESC);
CREATE INDEX wallet_transactions_fee_idx ON wallet_transactions (kind, currency) WHERE kind IN ('fee', 'fee_refund');

-- The commission charged to the chosen worker, kept on the task so it can be
-- shown and refunded if the service falls through before it starts.
ALTER TABLE tasks
    ADD COLUMN platform_fee_minor    BIGINT,
    ADD COLUMN platform_fee_currency CHAR(3),
    ADD CONSTRAINT tasks_platform_fee_pair CHECK ((platform_fee_minor IS NULL) = (platform_fee_currency IS NULL));
-- +goose StatementEnd

-- +goose Down
DROP TRIGGER IF EXISTS users_currency_locked_trg ON users;
DROP FUNCTION IF EXISTS users_currency_locked();
ALTER TABLE tasks
    DROP CONSTRAINT IF EXISTS tasks_platform_fee_pair,
    DROP COLUMN IF EXISTS platform_fee_currency,
    DROP COLUMN IF EXISTS platform_fee_minor;
DROP TABLE IF EXISTS wallet_transactions;
DROP TABLE IF EXISTS promotion_redemptions;
DROP TABLE IF EXISTS promotions;
DROP TABLE IF EXISTS wallets;
DROP TABLE IF EXISTS platform_settings;
