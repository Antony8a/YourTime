package token

import (
	"time"

	"github.com/google/uuid"
)

// TransactionType identifies the kind of ledger movement, see DATA_MODEL.md.
type TransactionType string

const (
	TypePurchase        TransactionType = "purchase"
	TypeTaskCharge      TransactionType = "task_charge"
	TypeTaskPayment     TransactionType = "task_payment"
	TypeTaskRefund      TransactionType = "task_refund"
	TypeTaskHoldRelease TransactionType = "task_hold_release"
	TypeWithdrawal      TransactionType = "withdrawal"
	TypeWithdrawalFee   TransactionType = "withdrawal_fee"
	TypePlatformFee     TransactionType = "platform_fee"
	TypeBonus           TransactionType = "bonus"
	TypePenalty         TransactionType = "penalty"
)

// Balance is the per-user token wallet. Invariant: AvailableTokens >= 0 and
// PendingTokens >= 0 always; every mutation goes through the methods below so
// the invariant can never be broken by callers.
type Balance struct {
	UserID            uuid.UUID
	AvailableTokens   int64
	PendingTokens     int64
	LifetimeEarned    int64
	LifetimeSpent     int64
	LifetimeWithdrawn int64
	UpdatedAt         time.Time
}

func NewBalance(userID uuid.UUID) *Balance {
	return &Balance{UserID: userID, UpdatedAt: time.Now().UTC()}
}

// Hold moves tokens from available to pending (escrow), e.g. when a client
// accepts a worker's application on a task.
func (b *Balance) Hold(amount int64) error {
	if amount <= 0 {
		return ErrInvalidAmount
	}
	if b.AvailableTokens < amount {
		return ErrInsufficientTokens
	}
	b.AvailableTokens -= amount
	b.PendingTokens += amount
	b.UpdatedAt = time.Now().UTC()
	return nil
}

// ReleaseToSpent settles a hold once a task completes: pending is cleared and
// recorded as spent (the client side of the escrow).
func (b *Balance) ReleaseToSpent(amount int64) error {
	if amount <= 0 {
		return ErrInvalidAmount
	}
	if b.PendingTokens < amount {
		return ErrInsufficientTokens
	}
	b.PendingTokens -= amount
	b.LifetimeSpent += amount
	b.UpdatedAt = time.Now().UTC()
	return nil
}

// ReleaseToAvailable reverses a hold (cancellation, rejected withdrawal),
// returning tokens back to the available balance.
func (b *Balance) ReleaseToAvailable(amount int64) error {
	if amount <= 0 {
		return ErrInvalidAmount
	}
	if b.PendingTokens < amount {
		return ErrInsufficientTokens
	}
	b.PendingTokens -= amount
	b.AvailableTokens += amount
	b.UpdatedAt = time.Now().UTC()
	return nil
}

// Credit adds tokens to the available balance (purchase, task payment, bonus).
func (b *Balance) Credit(amount int64, countsAsEarned bool) error {
	if amount <= 0 {
		return ErrInvalidAmount
	}
	b.AvailableTokens += amount
	if countsAsEarned {
		b.LifetimeEarned += amount
	}
	b.UpdatedAt = time.Now().UTC()
	return nil
}

// ConfirmWithdrawal finalizes a payout: pending tokens leave the system.
func (b *Balance) ConfirmWithdrawal(amount int64) error {
	if amount <= 0 {
		return ErrInvalidAmount
	}
	if b.PendingTokens < amount {
		return ErrInsufficientTokens
	}
	b.PendingTokens -= amount
	b.LifetimeWithdrawn += amount
	b.UpdatedAt = time.Now().UTC()
	return nil
}

// Transaction is a single, immutable ledger entry (append-only).
type Transaction struct {
	ID                   uuid.UUID
	UserID               uuid.UUID
	Type                 TransactionType
	Amount               int64 // positive = credit, negative = debit
	BalanceAfter         int64
	RelatedTaskID        *uuid.UUID
	RelatedApplicationID *uuid.UUID
	RelatedWithdrawalID  *uuid.UUID
	RelatedPurchaseID    *uuid.UUID
	Description          string
	Metadata             map[string]any
	CreatedAt            time.Time
}

func NewTransaction(userID uuid.UUID, txType TransactionType, amount, balanceAfter int64, description string) *Transaction {
	return &Transaction{
		ID:           uuid.New(),
		UserID:       userID,
		Type:         txType,
		Amount:       amount,
		BalanceAfter: balanceAfter,
		Description:  description,
		Metadata:     map[string]any{},
		CreatedAt:    time.Now().UTC(),
	}
}

type PurchaseStatus string

const (
	PurchaseStatusPending   PurchaseStatus = "pending"
	PurchaseStatusCompleted PurchaseStatus = "completed"
	PurchaseStatusFailed    PurchaseStatus = "failed"
	PurchaseStatusRefunded  PurchaseStatus = "refunded"
)

// Purchase represents a real-money -> tokens conversion via Stripe/MercadoPago.
type Purchase struct {
	ID              uuid.UUID
	UserID          uuid.UUID
	TokensAmount    int64
	Currency        string
	AmountCents     int64
	ExchangeRate    float64
	PaymentProvider string
	PaymentIntentID string
	Status          PurchaseStatus
	CompletedAt     *time.Time
	CreatedAt       time.Time
}

func NewPurchase(userID uuid.UUID, tokensAmount, amountCents int64, exchangeRate float64, provider string) *Purchase {
	return &Purchase{
		ID:              uuid.New(),
		UserID:          userID,
		TokensAmount:    tokensAmount,
		Currency:        "USD",
		AmountCents:     amountCents,
		ExchangeRate:    exchangeRate,
		PaymentProvider: provider,
		Status:          PurchaseStatusPending,
		CreatedAt:       time.Now().UTC(),
	}
}

func (p *Purchase) Complete() {
	now := time.Now().UTC()
	p.Status = PurchaseStatusCompleted
	p.CompletedAt = &now
}

func (p *Purchase) Fail() {
	p.Status = PurchaseStatusFailed
}

type WithdrawalStatus string

const (
	WithdrawalStatusPending    WithdrawalStatus = "pending"
	WithdrawalStatusProcessing WithdrawalStatus = "processing"
	WithdrawalStatusCompleted  WithdrawalStatus = "completed"
	WithdrawalStatusFailed     WithdrawalStatus = "failed"
	WithdrawalStatusCancelled  WithdrawalStatus = "cancelled"
)

// Withdrawal represents a tokens -> real-money cash-out request from a worker.
type Withdrawal struct {
	ID                       uuid.UUID
	WorkerID                 uuid.UUID
	TokensAmount             int64
	Currency                 string
	AmountCents              int64 // net amount the worker receives
	GrossAmountCents         int64
	PlatformFeeCents         int64
	PaymentProcessorFeeCents int64
	ExchangeRate             float64
	PayoutMethod             string
	Status                   WithdrawalStatus
	FailureReason            string
	ProcessedAt              *time.Time
	CreatedAt                time.Time
	UpdatedAt                time.Time
}

func NewWithdrawal(workerID uuid.UUID, tokensAmount, grossCents, platformFeeCents, processorFeeCents int64, exchangeRate float64, payoutMethod string) *Withdrawal {
	now := time.Now().UTC()
	return &Withdrawal{
		ID:                       uuid.New(),
		WorkerID:                 workerID,
		TokensAmount:             tokensAmount,
		Currency:                 "USD",
		GrossAmountCents:         grossCents,
		PlatformFeeCents:         platformFeeCents,
		PaymentProcessorFeeCents: processorFeeCents,
		AmountCents:              grossCents - platformFeeCents - processorFeeCents,
		ExchangeRate:             exchangeRate,
		PayoutMethod:             payoutMethod,
		Status:                   WithdrawalStatusPending,
		CreatedAt:                now,
		UpdatedAt:                now,
	}
}

func (w *Withdrawal) Complete() {
	now := time.Now().UTC()
	w.Status = WithdrawalStatusCompleted
	w.ProcessedAt = &now
	w.UpdatedAt = now
}

func (w *Withdrawal) Fail(reason string) {
	w.Status = WithdrawalStatusFailed
	w.FailureReason = reason
	w.UpdatedAt = time.Now().UTC()
}

func (w *Withdrawal) Cancel() {
	w.Status = WithdrawalStatusCancelled
	w.UpdatedAt = time.Now().UTC()
}
