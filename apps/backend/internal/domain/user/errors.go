package user

import (
	derr "github.com/yourtime/backend/internal/domain/common/errors"
)

var (
	ErrNotFound           = derr.New(derr.ErrNotFound, "user_not_found", "user not found")
	ErrEmailTaken         = derr.New(derr.ErrConflict, "email_taken", "email already registered")
	ErrInvalidCredentials = derr.New(derr.ErrUnauthorized, "invalid_credentials", "invalid email or password")
	ErrRegistrationClosed = derr.New(derr.ErrForbidden, "registration_closed", "new accounts are not being accepted")
	ErrAccountInactive    = derr.New(derr.ErrForbidden, "account_inactive", "account is not active")
	ErrInvalidRadius      = derr.New(derr.ErrInvalidInput, "invalid_radius", "search radius must be between 1 and 20000 km")
	ErrInvalidName        = derr.New(derr.ErrInvalidInput, "invalid_name", "full name is required (max 150 characters)")
	ErrInvalidCity        = derr.New(derr.ErrInvalidInput, "invalid_city", "city is too long (max 100 characters)")
)
