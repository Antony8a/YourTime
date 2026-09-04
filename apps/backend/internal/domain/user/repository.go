package user

import (
	"context"
	"github.com/google/uuid"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
)

type Repository interface {
	Create(ctx context.Context, user *User) error
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
	GetByEmail(ctx context.Context, email valueobjects.Email) (*User, error)
	GetByPhone(ctx context.Context, phone valueobjects.Phone) (*User, error)
	Update(ctx context.Context, user *User) error
	Delete(ctx context.Context, id uuid.UUID) error
	EmailExists(ctx context.Context, email valueobjects.Email) (bool, error)
	PhoneExists(ctx context.Context, phone valueobjects.Phone) (bool, error)
}