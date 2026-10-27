package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
	"github.com/yourtime/backend/internal/domain/user"
	"github.com/yourtime/backend/internal/domain/wallet"
)

type WalletRepo struct {
	pool *pgxpool.Pool
}

func NewWalletRepo(pool *pgxpool.Pool) *WalletRepo { return &WalletRepo{pool: pool} }

var _ wallet.Repository = (*WalletRepo)(nil)

// ---- primitives, used inside transactions ------------------------------------

// lockWallet locks the person's wallet row. With create it first makes the wallet
// if there is none, in the account's currency at this moment: from then on that is
// the wallet's currency for good, and UserRepo.Update refuses to change the
// account's. found is false when there is no wallet (and create was not asked).
func lockWallet(ctx context.Context, tx pgx.Tx, userID uuid.UUID, create bool) (currency valueobjects.Currency, balance int64, found bool, err error) {
	if create {
		// FOR SHARE keeps a concurrent currency change from slipping in between
		// reading the currency and the wallet existing (see the trigger in 00008).
		if _, err = tx.Exec(ctx, `
			INSERT INTO wallets (user_id, currency)
			SELECT id, currency FROM users WHERE id = $1 FOR SHARE
			ON CONFLICT (user_id) DO NOTHING`, userID); err != nil {
			return "", 0, false, err
		}
	}
	var c string
	err = tx.QueryRow(ctx, `SELECT currency, balance_minor FROM wallets WHERE user_id = $1 FOR UPDATE`, userID).Scan(&c, &balance)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", 0, false, nil
	}
	if err != nil {
		return "", 0, false, err
	}
	return valueobjects.Currency(c), balance, true, nil
}

// addToWallet moves the balance of a locked wallet by delta and writes the ledger
// row. A move that would leave the balance below zero fails.
func addToWallet(ctx context.Context, tx pgx.Tx, userID uuid.UUID, balance, delta int64, currency valueobjects.Currency,
	kind wallet.Kind, taskID, promotionID, createdBy *uuid.UUID, note string, now time.Time) (int64, error) {
	after := balance + delta
	if after < 0 {
		return 0, wallet.ErrInsufficientBalance
	}
	if _, err := tx.Exec(ctx, `UPDATE wallets SET balance_minor = $2, updated_at = $3 WHERE user_id = $1`, userID, after, now); err != nil {
		return 0, err
	}
	var noteArg *string
	if note != "" {
		noteArg = &note
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO wallet_transactions
			(user_id, kind, amount_minor, balance_after_minor, currency, task_id, promotion_id, note, created_by, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		userID, string(kind), delta, after, currency.String(), taskID, promotionID, noteArg, createdBy, now)
	if err != nil {
		return 0, err
	}
	return after, nil
}

// chargeFee takes the commission from the chosen worker's wallet, inside the
// transaction that chooses them. The wallet must exist, be in the commission's
// currency and cover it: otherwise the choice does not happen.
func chargeFee(ctx context.Context, tx pgx.Tx, userID uuid.UUID, amount int64, currency valueobjects.Currency, taskID uuid.UUID, now time.Time) error {
	if amount <= 0 {
		return nil
	}
	cur, balance, found, err := lockWallet(ctx, tx, userID, false)
	if err != nil {
		return err
	}
	if !found || cur != currency || balance < amount {
		return wallet.ErrApplicantShort
	}
	_, err = addToWallet(ctx, tx, userID, balance, -amount, currency, wallet.KindFee, &taskID, nil, nil, "", now)
	return err
}

// refundFee gives a commission back when the service falls through before it starts.
func refundFee(ctx context.Context, tx pgx.Tx, userID uuid.UUID, amount int64, currency valueobjects.Currency, taskID uuid.UUID, now time.Time) error {
	if amount <= 0 {
		return nil
	}
	cur, balance, found, err := lockWallet(ctx, tx, userID, false)
	if err != nil {
		return err
	}
	if !found || cur != currency {
		return nil // cannot happen: the fee was taken from this wallet
	}
	_, err = addToWallet(ctx, tx, userID, balance, amount, currency, wallet.KindFeeRefund, &taskID, nil, nil, "", now)
	return err
}

// ---- wallets -----------------------------------------------------------------

func (r *WalletRepo) Get(ctx context.Context, userID uuid.UUID) (*wallet.Wallet, error) {
	w := wallet.Wallet{UserID: userID, Established: true}
	var cur string
	err := r.pool.QueryRow(ctx, `SELECT currency, balance_minor FROM wallets WHERE user_id = $1`, userID).Scan(&cur, &w.BalanceMinor)
	if err == nil {
		w.Currency = valueobjects.Currency(cur)
		return &w, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	// No wallet yet: preview it in the account's currency.
	err = r.pool.QueryRow(ctx, `SELECT currency FROM users WHERE id = $1`, userID).Scan(&cur)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, user.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	w.Currency, w.Established = valueobjects.Currency(cur), false
	return &w, nil
}

func (r *WalletRepo) Credit(ctx context.Context, in wallet.CreditInput) (*wallet.CreditResult, error) {
	if in.AmountMinor <= 0 {
		return nil, wallet.ErrInvalidAmount
	}
	if in.AmountMinor > wallet.MaxAmountMinor {
		return nil, wallet.ErrAmountTooLarge
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	res, err := r.creditTx(ctx, tx, in)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return res, nil
}

func (r *WalletRepo) creditTx(ctx context.Context, tx pgx.Tx, in wallet.CreditInput) (*wallet.CreditResult, error) {
	cur, balance, found, err := lockWallet(ctx, tx, in.UserID, true)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, user.ErrNotFound
	}
	if cur != in.Currency {
		return nil, wallet.ErrCurrencyMismatch
	}
	balance, err = addToWallet(ctx, tx, in.UserID, balance, in.AmountMinor, cur, in.Kind, nil, in.PromotionID, in.CreatedBy, in.Note, in.Now)
	if err != nil {
		return nil, err
	}
	res := &wallet.CreditResult{Currency: cur}

	if in.ApplyBonus {
		var (
			promoID uuid.UUID
			bps     int
		)
		err := tx.QueryRow(ctx, `
			SELECT id, value_bps FROM promotions
			WHERE kind = 'topup_bonus' AND active
				AND (starts_at IS NULL OR starts_at <= $1) AND (ends_at IS NULL OR ends_at > $1)
				AND (max_redemptions IS NULL OR redemptions_count < max_redemptions)
			ORDER BY value_bps DESC LIMIT 1 FOR UPDATE`, in.Now).Scan(&promoID, &bps)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
		if err == nil {
			if bonus := wallet.BonusMinor(in.AmountMinor, bps); bonus > 0 {
				if _, err := tx.Exec(ctx, `UPDATE promotions SET redemptions_count = redemptions_count + 1 WHERE id = $1`, promoID); err != nil {
					return nil, err
				}
				balance, err = addToWallet(ctx, tx, in.UserID, balance, bonus, cur, wallet.KindTopupBonus, nil, &promoID, nil, "", in.Now)
				if err != nil {
					return nil, err
				}
				res.BonusMinor = bonus
			}
		}
	}
	res.BalanceMinor = balance
	return res, nil
}

func (r *WalletRepo) Transactions(ctx context.Context, userID uuid.UUID, limit, offset int) ([]wallet.Transaction, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT wt.id, wt.user_id, wt.kind, wt.amount_minor, wt.balance_after_minor, wt.currency,
			wt.task_id, COALESCE(t.title, ''), wt.promotion_id, COALESCE(wt.note, ''), wt.created_at
		FROM wallet_transactions wt
		LEFT JOIN tasks t ON t.id = wt.task_id
		WHERE wt.user_id = $1
		ORDER BY wt.seq DESC
		LIMIT $2 OFFSET $3`, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []wallet.Transaction{}
	for rows.Next() {
		var (
			t          wallet.Transaction
			kind, curr string
		)
		if err := rows.Scan(&t.ID, &t.UserID, &kind, &t.AmountMinor, &t.BalanceAfterMinor, &curr,
			&t.TaskID, &t.TaskTitle, &t.PromotionID, &t.Note, &t.CreatedAt); err != nil {
			return nil, err
		}
		t.Kind, t.Currency = wallet.Kind(kind), valueobjects.Currency(curr)
		out = append(out, t)
	}
	return out, rows.Err()
}

// ---- settings ----------------------------------------------------------------

func (r *WalletRepo) Settings(ctx context.Context) (wallet.Settings, error) {
	var s wallet.Settings
	err := r.pool.QueryRow(ctx, `
		SELECT fee_bps, test_topups_enabled, test_topup_max_usd_minor, signup_credit_usd_minor, updated_at
		FROM platform_settings WHERE id = 1`).
		Scan(&s.FeeBps, &s.TestTopupsEnabled, &s.TestTopupMaxUSDMinor, &s.SignupCreditUSDMinor, &s.UpdatedAt)
	return s, err
}

func (r *WalletRepo) UpdateSettings(ctx context.Context, s wallet.Settings, by uuid.UUID, now time.Time) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE platform_settings SET fee_bps = $1, test_topups_enabled = $2, test_topup_max_usd_minor = $3,
			signup_credit_usd_minor = $4, updated_at = $5, updated_by = $6
		WHERE id = 1`, s.FeeBps, s.TestTopupsEnabled, s.TestTopupMaxUSDMinor, s.SignupCreditUSDMinor, now, by)
	return err
}

// ---- promotions --------------------------------------------------------------

const promotionColumns = `id, name, code, kind, value_bps, amount_usd_minor, starts_at, ends_at, active,
	max_redemptions, redemptions_count, created_at`

func scanPromotion(row pgx.Row) (*wallet.Promotion, error) {
	var (
		p    wallet.Promotion
		kind string
	)
	err := row.Scan(&p.ID, &p.Name, &p.Code, &kind, &p.ValueBps, &p.AmountUSDMinor, &p.StartsAt, &p.EndsAt,
		&p.Active, &p.MaxRedemptions, &p.RedemptionsCount, &p.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, wallet.ErrPromotionNotFound
	}
	if err != nil {
		return nil, err
	}
	p.Kind = wallet.PromoKind(kind)
	return &p, nil
}

func (r *WalletRepo) CreatePromotion(ctx context.Context, p *wallet.Promotion) error {
	p.ID, p.CreatedAt = uuid.New(), time.Now().UTC()
	_, err := r.pool.Exec(ctx, `
		INSERT INTO promotions (`+promotionColumns+`)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11)`,
		p.ID, p.Name, p.Code, string(p.Kind), p.ValueBps, p.AmountUSDMinor, p.StartsAt, p.EndsAt, p.Active, p.MaxRedemptions, p.CreatedAt)
	if isUniqueViolation(err, "promotions_code_idx") {
		return wallet.ErrCodeTaken
	}
	return err
}

func (r *WalletRepo) Promotions(ctx context.Context) ([]wallet.Promotion, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+promotionColumns+` FROM promotions ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []wallet.Promotion{}
	for rows.Next() {
		p, err := scanPromotion(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *p)
	}
	return out, rows.Err()
}

func (r *WalletRepo) UpdatePromotion(ctx context.Context, id uuid.UUID, patch wallet.PromotionPatch) (*wallet.Promotion, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	p, err := scanPromotion(tx.QueryRow(ctx, `SELECT `+promotionColumns+` FROM promotions WHERE id = $1 FOR UPDATE`, id))
	if err != nil {
		return nil, err
	}
	if patch.Name != nil {
		p.Name = *patch.Name
	}
	if patch.Active != nil {
		p.Active = *patch.Active
	}
	if patch.StartsAt != nil {
		p.StartsAt = patch.StartsAt
	}
	if patch.EndsAt != nil {
		p.EndsAt = patch.EndsAt
	}
	if patch.ClearEnds {
		p.EndsAt = nil
	}
	if patch.MaxRedemptions != nil {
		p.MaxRedemptions = patch.MaxRedemptions
	}
	if err := p.Validate(); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE promotions SET name = $2, active = $3, starts_at = $4, ends_at = $5, max_redemptions = $6 WHERE id = $1`,
		id, p.Name, p.Active, p.StartsAt, p.EndsAt, p.MaxRedemptions); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return p, nil
}

func (r *WalletRepo) PromotionByCode(ctx context.Context, code string) (*wallet.Promotion, error) {
	return scanPromotion(r.pool.QueryRow(ctx, `SELECT `+promotionColumns+` FROM promotions WHERE lower(code) = lower($1)`, code))
}

func (r *WalletRepo) Redeem(ctx context.Context, in wallet.RedeemInput) (*wallet.CreditResult, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	p, err := scanPromotion(tx.QueryRow(ctx, `SELECT `+promotionColumns+` FROM promotions WHERE id = $1 FOR UPDATE`, in.PromotionID))
	if err != nil {
		if errors.Is(err, wallet.ErrPromotionNotFound) {
			return nil, wallet.ErrPromoNotFound
		}
		return nil, err
	}
	// Only these two kinds are redeemed with a code; a top-up bonus applies by itself.
	if p.Kind == wallet.PromoTopupBonus || !p.Redeemable(in.Now) {
		return nil, wallet.ErrPromoUnavailable
	}
	tag, err := tx.Exec(ctx, `
		INSERT INTO promotion_redemptions (promotion_id, user_id, redeemed_at) VALUES ($1,$2,$3)
		ON CONFLICT DO NOTHING`, p.ID, in.UserID, in.Now)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, wallet.ErrPromoAlreadyUsed
	}
	if _, err := tx.Exec(ctx, `UPDATE promotions SET redemptions_count = redemptions_count + 1 WHERE id = $1`, p.ID); err != nil {
		return nil, err
	}

	res := &wallet.CreditResult{}
	if p.Kind == wallet.PromoCreditGrant {
		cur, balance, found, err := lockWallet(ctx, tx, in.UserID, true)
		if err != nil {
			return nil, err
		}
		if !found {
			return nil, user.ErrNotFound
		}
		if cur != in.Currency {
			return nil, wallet.ErrCurrencyMismatch
		}
		balance, err = addToWallet(ctx, tx, in.UserID, balance, in.GrantMinor, cur, wallet.KindPromoCredit, nil, &p.ID, nil, p.Name, in.Now)
		if err != nil {
			return nil, err
		}
		res.Currency, res.BalanceMinor = cur, balance
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return res, nil
}

func (r *WalletRepo) FeeDiscounts(ctx context.Context, userID uuid.UUID, now time.Time) ([]int, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT p.value_bps FROM promotions p
		WHERE p.kind = 'fee_discount' AND p.active
			AND (p.starts_at IS NULL OR p.starts_at <= $2) AND (p.ends_at IS NULL OR p.ends_at > $2)
			AND (p.code IS NULL OR EXISTS (
				SELECT 1 FROM promotion_redemptions x WHERE x.promotion_id = p.id AND x.user_id = $1))`, userID, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []int
	for rows.Next() {
		var bps int
		if err := rows.Scan(&bps); err != nil {
			return nil, err
		}
		out = append(out, bps)
	}
	return out, rows.Err()
}

// ---- totals ------------------------------------------------------------------

func (r *WalletRepo) Totals(ctx context.Context) ([]wallet.FeeTotals, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT c.currency, COALESCE(f.net, 0)::bigint, COALESCE(w.outstanding, 0)::bigint, COALESCE(w.n, 0)::int
		FROM (SELECT currency FROM wallets UNION SELECT currency FROM wallet_transactions) c
		LEFT JOIN (
			SELECT currency, -SUM(amount_minor) AS net FROM wallet_transactions
			WHERE kind IN ('fee', 'fee_refund') GROUP BY currency) f USING (currency)
		LEFT JOIN (
			SELECT currency, SUM(balance_minor) AS outstanding, COUNT(*) AS n FROM wallets GROUP BY currency) w USING (currency)
		ORDER BY c.currency`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []wallet.FeeTotals{}
	for rows.Next() {
		var (
			t   wallet.FeeTotals
			cur string
		)
		if err := rows.Scan(&cur, &t.NetFeesMinor, &t.OutstandingMinor, &t.Wallets); err != nil {
			return nil, err
		}
		t.Currency = valueobjects.Currency(cur)
		out = append(out, t)
	}
	return out, rows.Err()
}

// refundTaskFee gives back the commission taken for a task, if any, and forgets it.
// It runs inside the transaction that undoes the assignment, with the task row locked.
func refundTaskFee(ctx context.Context, tx pgx.Tx, taskID, workerID uuid.UUID, now time.Time) error {
	var (
		amount *int64
		cur    *string
	)
	if err := tx.QueryRow(ctx, `SELECT platform_fee_minor, platform_fee_currency FROM tasks WHERE id = $1`, taskID).Scan(&amount, &cur); err != nil {
		return err
	}
	if amount == nil || cur == nil {
		return nil
	}
	if _, err := tx.Exec(ctx, `UPDATE tasks SET platform_fee_minor = NULL, platform_fee_currency = NULL WHERE id = $1`, taskID); err != nil {
		return err
	}
	return refundFee(ctx, tx, workerID, *amount, valueobjects.Currency(*cur), taskID, now)
}
