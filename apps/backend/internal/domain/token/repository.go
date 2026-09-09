package token

import (
	"context"

	"github.com/google/uuid"
)

// Repository persists balances and the append-only transaction ledger.
// Implementations are expected to guarantee that Balance updates and the
// corresponding Transaction insert happen atomically (single DB transaction).
type Repository interface {
	GetBalance(ctx context.Context, userID uuid.UUID) (*Balance, error)
	SaveBalance(ctx context.Context, balance *Balance) error

	CreateTransaction(ctx context.Context, tx *Transaction) error
	ListTransactions(ctx context.Context, userID uuid.UUID, cursor string, limit int) ([]*Transaction, error)

	CreatePurchase(ctx context.Context, purchase *Purchase) error
	GetPurchase(ctx context.Context, id uuid.UUID) (*Purchase, error)
	GetPurchaseByPaymentIntent(ctx context.Context, provider, paymentIntentID string) (*Purchase, error)
	UpdatePurchase(ctx context.Context, purchase *Purchase) error

	CreateWithdrawal(ctx context.Context, withdrawal *Withdrawal) error
	GetWithdrawal(ctx context.Context, id uuid.UUID) (*Withdrawal, error)
	UpdateWithdrawal(ctx context.Context, withdrawal *Withdrawal) error
	ListWithdrawals(ctx context.Context, workerID uuid.UUID, cursor string, limit int) ([]*Withdrawal, error)
}
