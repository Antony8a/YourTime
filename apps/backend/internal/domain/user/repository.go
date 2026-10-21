package user

import (
	"context"

	"github.com/google/uuid"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
)

type Repository interface {
	// Create returns ErrEmailTaken when the email is already registered.
	Create(ctx context.Context, u *User) error
	// GetByID and GetByEmail return ErrNotFound when no user matches.
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
	GetByEmail(ctx context.Context, email valueobjects.Email) (*User, error)
	Update(ctx context.Context, u *User) error
}
