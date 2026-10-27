package wallet

import (
	"context"
	"time"

	"github.com/google/uuid"
	derr "github.com/yourtime/backend/internal/domain/common/errors"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
)

// ErrCurrencyMismatch means the account's currency changed between working out an
// amount and crediting it. The caller can simply try again.
var ErrCurrencyMismatch = derr.New(derr.ErrConflict, "currency_changed", "the wallet currency changed, try again")

// CreditInput is one credit to a wallet, with the bonus it may earn.
type CreditInput struct {
	UserID      uuid.UUID
	AmountMinor int64
	// Currency is what AmountMinor is expressed in: the wallet's. A different one
	// is refused with ErrCurrencyMismatch.
	Currency    valueobjects.Currency
	Kind        Kind
	Note        string
	CreatedBy   *uuid.UUID
	PromotionID *uuid.UUID
	// ApplyBonus lets a running top-up bonus add to this credit.
	ApplyBonus bool
	Now        time.Time
}

type CreditResult struct {
	Currency     valueobjects.Currency
	BalanceMinor int64
	// BonusMinor is what a top-up bonus added on top, 0 if none applied.
	BonusMinor int64
}

type RedeemInput struct {
	UserID      uuid.UUID
	PromotionID uuid.UUID
	Now         time.Time
	// GrantMinor is what a credit_grant gives, already in the wallet's Currency.
	GrantMinor int64
	Currency   valueobjects.Currency
}

// PromotionPatch changes a promotion. Nil fields are left alone.
type PromotionPatch struct {
	Name           *string
	Active         *bool
	StartsAt       *time.Time
	EndsAt         *time.Time
	ClearEnds      bool
	MaxRedemptions *int
}

// FeeTotals is what the platform has earned and holds, per currency.
type FeeTotals struct {
	Currency valueobjects.Currency
	// NetFeesMinor is commissions charged minus those refunded.
	NetFeesMinor int64
	// OutstandingMinor is the sum of every wallet's balance: credit still to be spent.
	OutstandingMinor int64
	Wallets          int
}

type Repository interface {
	// Get returns the person's wallet. Without one it returns an unestablished
	// wallet in the account's currency, with no balance.
	Get(ctx context.Context, userID uuid.UUID) (*Wallet, error)
	// Credit adds money, creating the wallet on the first credit.
	Credit(ctx context.Context, in CreditInput) (*CreditResult, error)
	Transactions(ctx context.Context, userID uuid.UUID, limit, offset int) ([]Transaction, error)

	Settings(ctx context.Context) (Settings, error)
	UpdateSettings(ctx context.Context, s Settings, by uuid.UUID, now time.Time) error

	CreatePromotion(ctx context.Context, p *Promotion) error
	Promotions(ctx context.Context) ([]Promotion, error)
	UpdatePromotion(ctx context.Context, id uuid.UUID, patch PromotionPatch) (*Promotion, error)
	// PromotionByCode finds a promotion by its code, ignoring case.
	PromotionByCode(ctx context.Context, code string) (*Promotion, error)
	// Redeem records that a person used a code, once, and gives its credit if it has one.
	Redeem(ctx context.Context, in RedeemInput) (*CreditResult, error)
	// FeeDiscounts lists the discounts, in basis points, that apply to this person now.
	FeeDiscounts(ctx context.Context, userID uuid.UUID, now time.Time) ([]int, error)

	Totals(ctx context.Context) ([]FeeTotals, error)
}
