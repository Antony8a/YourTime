package user

import "errors"

var (
	ErrUserNotFound     = errors.New("user not found")
	ErrEmailTaken       = errors.New("email already registered")
	ErrPhoneTaken       = errors.New("phone already registered")
	ErrInvalidRole      = errors.New("invalid user role")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrAccountInactive  = errors.New("account not active or email not verified")
)