package token

import "errors"

var (
	ErrInsufficientTokens  = errors.New("insufficient available tokens")
	ErrInvalidAmount       = errors.New("amount must be positive")
	ErrBelowMinWithdrawal  = errors.New("withdrawal amount below minimum")
	ErrAboveMaxWithdrawal  = errors.New("withdrawal amount above maximum")
	ErrBalanceNotFound     = errors.New("token balance not found")
	ErrTransactionNotFound = errors.New("token transaction not found")
	ErrPurchaseNotFound    = errors.New("token purchase not found")
	ErrWithdrawalNotFound  = errors.New("token withdrawal not found")
	ErrWithdrawalNotPending = errors.New("withdrawal is not in a pending state")
)
