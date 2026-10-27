// Package errors defines the sentinel error categories shared by all domains.
// Domain-specific errors wrap one of these so the HTTP layer can map them to a
// status code without knowing about every domain.
package errors

import "errors"

var (
	ErrNotFound     = errors.New("resource not found")
	ErrInvalidInput = errors.New("invalid input")
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")
	ErrConflict     = errors.New("conflict")
	// ErrPaymentRequired is for something that needs funds the person does not have.
	ErrPaymentRequired = errors.New("payment required")
	// ErrUnavailable is for something outside our control (a data source) being down.
	ErrUnavailable = errors.New("temporarily unavailable")
)
