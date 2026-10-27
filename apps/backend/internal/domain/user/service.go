package user

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
	"golang.org/x/crypto/bcrypt"
)

// dummyHash lets Authenticate spend the same time on unknown emails as on
// wrong passwords, so response timing does not reveal which emails exist.
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("timing-equalizer"), bcrypt.DefaultCost)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service { return &Service{repo: repo} }

type RegisterInput struct {
	Email    valueobjects.Email
	Password string
	FullName string
	Currency valueobjects.Currency
	// Language is optional; nil follows the device.
	Language *valueobjects.Language
}

func (s *Service) Register(ctx context.Context, in RegisterInput) (*User, error) {
	if err := valueobjects.ValidatePassword(in.Password); err != nil {
		return nil, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	u, err := NewUser(in.Email, string(hash), in.FullName, in.Currency)
	if err != nil {
		return nil, err
	}
	u.Language = in.Language
	if err := s.repo.Create(ctx, u); err != nil {
		return nil, err
	}
	return u, nil
}

func (s *Service) Authenticate(ctx context.Context, email valueobjects.Email, password string) (*User, error) {
	u, err := s.repo.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}
	if !u.CanLogin() {
		return nil, ErrAccountInactive
	}
	u.RecordLogin()
	if err := s.repo.Update(ctx, u); err != nil {
		return nil, err
	}
	return u, nil
}

func (s *Service) Get(ctx context.Context, id uuid.UUID) (*User, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *Service) UpdateProfile(ctx context.Context, id uuid.UUID, p ProfileUpdate) (*User, error) {
	u, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := u.ApplyProfileUpdate(p); err != nil {
		return nil, err
	}
	if err := s.repo.Update(ctx, u); err != nil {
		return nil, err
	}
	return u, nil
}
