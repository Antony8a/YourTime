package token

import (
	"context"

	"github.com/google/uuid"
)

// ExchangeConfig mirrors the `platform_config` values described in
// TOKEN_ECONOMY.md (buy/sell rate and fee percentages).
type ExchangeConfig struct {
	BuyRate               int64 // tokens per $1 when purchasing
	SellRate              int64 // tokens per $1 when withdrawing
	TaskFeePercent        int64 // platform cut of a completed task
	WithdrawalFeePercent  int64 // platform cut of a withdrawal
	MinWithdrawalTokens   int64
	MaxWithdrawalTokens   int64
}

// Service implements the core token economy rules: escrow hold/release on
// tasks, purchases and withdrawals. HTTP handlers/commands are responsible for
// opening a DB transaction around these calls so balance + ledger writes are
// atomic; this service only manipulates the domain aggregates.
type Service struct {
	repo   Repository
	config ExchangeConfig
}

func NewService(repo Repository, config ExchangeConfig) *Service {
	return &Service{repo: repo, config: config}
}

func (s *Service) GetBalance(ctx context.Context, userID uuid.UUID) (*Balance, error) {
	return s.repo.GetBalance(ctx, userID)
}

// CreatePurchase records a pending token purchase ahead of charging the user
// via Stripe/MercadoPago. The payment provider call itself belongs to the
// infrastructure/external/payments layer.
func (s *Service) CreatePurchase(ctx context.Context, userID uuid.UUID, tokensAmount, amountCents int64, provider string) (*Purchase, error) {
	if tokensAmount <= 0 || amountCents <= 0 {
		return nil, ErrInvalidAmount
	}
	exchangeRate := float64(tokensAmount) / (float64(amountCents) / 100)
	purchase := NewPurchase(userID, tokensAmount, amountCents, exchangeRate, provider)
	if err := s.repo.CreatePurchase(ctx, purchase); err != nil {
		return nil, err
	}
	return purchase, nil
}

// CompletePurchase credits the buyer once the payment provider confirms the
// charge (called from the webhook handler after signature verification).
func (s *Service) CompletePurchase(ctx context.Context, purchaseID uuid.UUID) error {
	purchase, err := s.repo.GetPurchase(ctx, purchaseID)
	if err != nil {
		return err
	}

	balance, err := s.repo.GetBalance(ctx, purchase.UserID)
	if err != nil {
		return err
	}

	if err := balance.Credit(purchase.TokensAmount, true); err != nil {
		return err
	}

	purchase.Complete()

	if err := s.repo.SaveBalance(ctx, balance); err != nil {
		return err
	}
	if err := s.repo.UpdatePurchase(ctx, purchase); err != nil {
		return err
	}

	txn := NewTransaction(purchase.UserID, TypePurchase, purchase.TokensAmount, balance.AvailableTokens,
		"Compra de tokens")
	txn.RelatedPurchaseID = &purchase.ID
	return s.repo.CreateTransaction(ctx, txn)
}

// HoldForTask escrows the client's tokens when a worker's application is
// accepted, moving them from available to pending.
func (s *Service) HoldForTask(ctx context.Context, clientID, taskID, applicationID uuid.UUID, amount int64) error {
	balance, err := s.repo.GetBalance(ctx, clientID)
	if err != nil {
		return err
	}

	if err := balance.Hold(amount); err != nil {
		return err
	}

	if err := s.repo.SaveBalance(ctx, balance); err != nil {
		return err
	}

	txn := NewTransaction(clientID, TypeTaskCharge, -amount, balance.AvailableTokens, "Reserva para task")
	txn.RelatedTaskID = &taskID
	txn.RelatedApplicationID = &applicationID
	return s.repo.CreateTransaction(ctx, txn)
}

// SettleTask releases the client's hold and pays the worker (minus platform
// fee) once a task is completed.
func (s *Service) SettleTask(ctx context.Context, clientID, workerID, taskID uuid.UUID, amount int64) error {
	clientBalance, err := s.repo.GetBalance(ctx, clientID)
	if err != nil {
		return err
	}
	if err := clientBalance.ReleaseToSpent(amount); err != nil {
		return err
	}
	if err := s.repo.SaveBalance(ctx, clientBalance); err != nil {
		return err
	}

	platformFee := amount * s.config.TaskFeePercent / 100
	workerReceives := amount - platformFee

	workerBalance, err := s.repo.GetBalance(ctx, workerID)
	if err != nil {
		return err
	}
	if err := workerBalance.Credit(workerReceives, true); err != nil {
		return err
	}
	if err := s.repo.SaveBalance(ctx, workerBalance); err != nil {
		return err
	}

	releaseTx := NewTransaction(clientID, TypeTaskHoldRelease, 0, clientBalance.AvailableTokens, "Task completado")
	releaseTx.RelatedTaskID = &taskID
	if err := s.repo.CreateTransaction(ctx, releaseTx); err != nil {
		return err
	}

	paymentTx := NewTransaction(workerID, TypeTaskPayment, workerReceives, workerBalance.AvailableTokens, "Pago por task")
	paymentTx.RelatedTaskID = &taskID
	paymentTx.Metadata["gross"] = amount
	paymentTx.Metadata["platform_fee"] = platformFee
	return s.repo.CreateTransaction(ctx, paymentTx)
}

// RequestWithdrawal validates limits and holds the worker's tokens pending
// admin approval and payout.
func (s *Service) RequestWithdrawal(ctx context.Context, workerID uuid.UUID, tokensAmount int64, payoutMethod string) (*Withdrawal, error) {
	if tokensAmount < s.config.MinWithdrawalTokens {
		return nil, ErrBelowMinWithdrawal
	}
	if tokensAmount > s.config.MaxWithdrawalTokens {
		return nil, ErrAboveMaxWithdrawal
	}

	balance, err := s.repo.GetBalance(ctx, workerID)
	if err != nil {
		return nil, err
	}
	if err := balance.Hold(tokensAmount); err != nil {
		return nil, err
	}

	grossCents := tokensAmount * 100 / s.config.SellRate
	platformFeeCents := grossCents * s.config.WithdrawalFeePercent / 100

	withdrawal := NewWithdrawal(workerID, tokensAmount, grossCents, platformFeeCents, 0, float64(s.config.SellRate), payoutMethod)

	if err := s.repo.SaveBalance(ctx, balance); err != nil {
		return nil, err
	}
	if err := s.repo.CreateWithdrawal(ctx, withdrawal); err != nil {
		return nil, err
	}

	txn := NewTransaction(workerID, TypeWithdrawal, -tokensAmount, balance.AvailableTokens, "Solicitud de retiro")
	txn.RelatedWithdrawalID = &withdrawal.ID
	if err := s.repo.CreateTransaction(ctx, txn); err != nil {
		return nil, err
	}

	return withdrawal, nil
}

// ApproveWithdrawal is called after the payout provider confirms the transfer
// succeeded: pending tokens leave the system permanently.
func (s *Service) ApproveWithdrawal(ctx context.Context, withdrawalID uuid.UUID) error {
	withdrawal, err := s.repo.GetWithdrawal(ctx, withdrawalID)
	if err != nil {
		return err
	}
	if withdrawal.Status != WithdrawalStatusPending {
		return ErrWithdrawalNotPending
	}

	balance, err := s.repo.GetBalance(ctx, withdrawal.WorkerID)
	if err != nil {
		return err
	}
	if err := balance.ConfirmWithdrawal(withdrawal.TokensAmount); err != nil {
		return err
	}

	withdrawal.Complete()

	if err := s.repo.SaveBalance(ctx, balance); err != nil {
		return err
	}
	return s.repo.UpdateWithdrawal(ctx, withdrawal)
}

// RejectWithdrawal returns the held tokens to the worker's available balance.
func (s *Service) RejectWithdrawal(ctx context.Context, withdrawalID uuid.UUID) error {
	withdrawal, err := s.repo.GetWithdrawal(ctx, withdrawalID)
	if err != nil {
		return err
	}
	if withdrawal.Status != WithdrawalStatusPending {
		return ErrWithdrawalNotPending
	}

	balance, err := s.repo.GetBalance(ctx, withdrawal.WorkerID)
	if err != nil {
		return err
	}
	if err := balance.ReleaseToAvailable(withdrawal.TokensAmount); err != nil {
		return err
	}

	withdrawal.Cancel()

	if err := s.repo.SaveBalance(ctx, balance); err != nil {
		return err
	}
	return s.repo.UpdateWithdrawal(ctx, withdrawal)
}
