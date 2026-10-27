// Package wallet is the prepaid credit people spend to take on work. A person tops
// it up, and when they are chosen for a task the platform's commission is taken
// from it. The credit never leaves: it is only spent on commissions.
//
// A wallet lives in one currency, the account's at the moment it is first
// credited, and keeps it. All amounts are integers in minor units.
package wallet

import (
	"math/big"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	derr "github.com/yourtime/backend/internal/domain/common/errors"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
)

// ---- errors ------------------------------------------------------------------

var (
	ErrInsufficientBalance = derr.New(derr.ErrPaymentRequired, "insufficient_balance", "the wallet balance does not cover the commission")
	// ErrApplicantShort is what the poster sees when the chosen person's balance
	// fell short between applying and being chosen.
	ErrApplicantShort       = derr.New(derr.ErrConflict, "applicant_insufficient_balance", "this applicant no longer has enough balance")
	ErrInvalidAmount        = derr.New(derr.ErrInvalidInput, "invalid_amount", "the amount must be greater than zero")
	ErrAmountTooLarge       = derr.New(derr.ErrInvalidInput, "amount_too_large", "the amount is larger than allowed")
	ErrTestTopupsDisabled   = derr.New(derr.ErrForbidden, "test_topups_disabled", "test top-ups are turned off")
	ErrPromoNotFound        = derr.New(derr.ErrNotFound, "promo_code_not_found", "that code does not exist")
	ErrPromoUnavailable     = derr.New(derr.ErrConflict, "promo_code_unavailable", "that code is expired, used up or not active")
	ErrPromoAlreadyUsed     = derr.New(derr.ErrConflict, "promo_already_redeemed", "you already redeemed that code")
	ErrInvalidSettings      = derr.New(derr.ErrInvalidInput, "invalid_settings", "invalid platform settings")
	ErrInvalidPromotion     = derr.New(derr.ErrInvalidInput, "invalid_promotion", "invalid promotion")
	ErrNotAdmin             = derr.New(derr.ErrForbidden, "not_admin", "only the administrator can do this")
	ErrPromotionNotFound    = derr.New(derr.ErrNotFound, "promotion_not_found", "promotion not found")
	ErrCodeTaken            = derr.New(derr.ErrConflict, "promo_code_taken", "that code is already used by another promotion")
	ErrWalletCurrencyLocked = derr.New(derr.ErrConflict, "currency_locked", "the currency cannot be changed once the wallet exists")
)

// ---- ledger ------------------------------------------------------------------

type Kind string

const (
	KindTopupTest    Kind = "topup_test"
	KindTopupManual  Kind = "topup_manual"
	KindTopupBonus   Kind = "topup_bonus"
	KindPromoCredit  Kind = "promo_credit"
	KindSignupCredit Kind = "signup_credit"
	KindFee          Kind = "fee"
	KindFeeRefund    Kind = "fee_refund"
)

// MaxAmountMinor bounds any single movement, far above a real one, so sums
// cannot overflow.
const MaxAmountMinor int64 = 1_000_000_000_000

type Wallet struct {
	UserID       uuid.UUID
	Currency     valueobjects.Currency
	BalanceMinor int64
	// Established is false until the first credit: before it the wallet has the
	// account's currency only as a preview and the currency can still change.
	Established bool
}

type Transaction struct {
	ID                uuid.UUID
	UserID            uuid.UUID
	Kind              Kind
	AmountMinor       int64
	BalanceAfterMinor int64
	Currency          valueobjects.Currency
	TaskID            *uuid.UUID
	TaskTitle         string
	PromotionID       *uuid.UUID
	Note              string
	CreatedAt         time.Time
}

// ---- settings ----------------------------------------------------------------

type Settings struct {
	// FeeBps is the commission in basis points of the agreed price (1000 = 10 %).
	FeeBps               int
	TestTopupsEnabled    bool
	TestTopupMaxUSDMinor int64
	SignupCreditUSDMinor int64
	UpdatedAt            time.Time
}

func (s Settings) Validate() error {
	if s.FeeBps < 0 || s.FeeBps > 10000 || s.TestTopupMaxUSDMinor < 0 || s.SignupCreditUSDMinor < 0 ||
		s.TestTopupMaxUSDMinor > MaxAmountMinor || s.SignupCreditUSDMinor > MaxAmountMinor {
		return ErrInvalidSettings
	}
	return nil
}

// ---- promotions --------------------------------------------------------------

type PromoKind string

const (
	// PromoTopupBonus adds a share of every top-up as extra credit while it runs.
	PromoTopupBonus PromoKind = "topup_bonus"
	// PromoFeeDiscount waives a share of the commission, for everyone while it runs
	// or, if it has a code, for whoever redeemed the code.
	PromoFeeDiscount PromoKind = "fee_discount"
	// PromoCreditGrant gives a fixed credit to whoever redeems its code, once each.
	PromoCreditGrant PromoKind = "credit_grant"
)

type Promotion struct {
	ID               uuid.UUID
	Name             string
	Code             *string
	Kind             PromoKind
	ValueBps         *int
	AmountUSDMinor   *int64
	StartsAt, EndsAt *time.Time
	Active           bool
	MaxRedemptions   *int
	RedemptionsCount int
	CreatedAt        time.Time
}

// Validate checks a promotion about to be created.
func (p *Promotion) Validate() error {
	p.Name = strings.TrimSpace(p.Name)
	if p.Name == "" || utf8.RuneCountInString(p.Name) > 100 {
		return ErrInvalidPromotion
	}
	if p.Code != nil {
		c := strings.TrimSpace(*p.Code)
		if c == "" {
			p.Code = nil
		} else {
			if utf8.RuneCountInString(c) > 40 || strings.ContainsAny(c, " \t\n") {
				return ErrInvalidPromotion
			}
			p.Code = &c
		}
	}
	switch p.Kind {
	case PromoTopupBonus, PromoFeeDiscount:
		if p.ValueBps == nil || *p.ValueBps < 1 || *p.ValueBps > 10000 || p.AmountUSDMinor != nil {
			return ErrInvalidPromotion
		}
	case PromoCreditGrant:
		if p.AmountUSDMinor == nil || *p.AmountUSDMinor < 1 || *p.AmountUSDMinor > MaxAmountMinor ||
			p.ValueBps != nil || p.Code == nil {
			return ErrInvalidPromotion
		}
	default:
		return ErrInvalidPromotion
	}
	if p.StartsAt != nil && p.EndsAt != nil && !p.EndsAt.After(*p.StartsAt) {
		return ErrInvalidPromotion
	}
	if p.MaxRedemptions != nil && *p.MaxRedemptions < 1 {
		return ErrInvalidPromotion
	}
	return nil
}

// InWindow reports whether now is within the promotion's dates.
func (p Promotion) InWindow(now time.Time) bool {
	return (p.StartsAt == nil || !now.Before(*p.StartsAt)) && (p.EndsAt == nil || now.Before(*p.EndsAt))
}

// Redeemable reports whether a code can still be redeemed right now.
func (p Promotion) Redeemable(now time.Time) bool {
	return p.Active && p.InWindow(now) && (p.MaxRedemptions == nil || p.RedemptionsCount < *p.MaxRedemptions)
}

// ---- quotes ------------------------------------------------------------------

// Quote is what taking a task would cost one person in commission.
type Quote struct {
	FeeMinor int64
	Currency valueobjects.Currency
	// BalanceMinor is the wallet's balance, 0 without one.
	BalanceMinor int64
	Established  bool
	FeeBps       int
	DiscountBps  int
}

// Enough reports whether the balance covers the commission.
func (q Quote) Enough() bool { return q.BalanceMinor >= q.FeeMinor }

// ---- arithmetic --------------------------------------------------------------

// FeeMinor is the commission on a price already in the wallet's currency: feeBps of
// it, less discountBps of that fee, rounded up to a whole minor unit. Rounding up
// means a commission is never lost to rounding.
func FeeMinor(priceMinor int64, feeBps, discountBps int) int64 {
	if priceMinor <= 0 || feeBps <= 0 || discountBps >= 10000 {
		return 0
	}
	if discountBps < 0 {
		discountBps = 0
	}
	// price * feeBps * (10000 - discountBps) / 10000 / 10000, rounded up. The product
	// can exceed int64, so it is computed with big integers.
	num := new(big.Int).Mul(big.NewInt(priceMinor), big.NewInt(int64(feeBps)))
	num.Mul(num, big.NewInt(int64(10000-discountBps)))
	den := big.NewInt(100_000_000)
	q, r := new(big.Int).QuoRem(num, den, new(big.Int))
	if r.Sign() > 0 {
		q.Add(q, big.NewInt(1))
	}
	return q.Int64()
}

// BonusMinor is bps of a top-up, rounded down.
func BonusMinor(amountMinor int64, bps int) int64 {
	if amountMinor <= 0 || bps <= 0 {
		return 0
	}
	n := new(big.Int).Mul(big.NewInt(amountMinor), big.NewInt(int64(bps)))
	return n.Div(n, big.NewInt(10000)).Int64()
}

// BestDiscount is the largest fee discount among the given ones.
func BestDiscount(bps []int) int {
	best := 0
	for _, b := range bps {
		if b > best {
			best = b
		}
	}
	return best
}
