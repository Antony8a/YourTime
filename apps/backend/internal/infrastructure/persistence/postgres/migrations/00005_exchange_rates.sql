-- +goose Up
-- +goose StatementBegin
-- One row per currency per day, quoted as units of that currency per 1 USD. Kept
-- as history so a service is converted with the rate of the day it was finished,
-- not whatever the rate happens to be when someone looks at it later.
CREATE TABLE exchange_rates (
    rate_date  DATE           NOT NULL,
    currency   CHAR(3)        NOT NULL,
    per_usd    NUMERIC(24,10) NOT NULL CHECK (per_usd > 0),
    fetched_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    PRIMARY KEY (rate_date, currency)
);
-- +goose StatementEnd

-- +goose Down
DROP TABLE IF EXISTS exchange_rates;
