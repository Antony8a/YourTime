// Package auth orchestrates registration, login and token refresh.
package auth

import (
	"context"

	"github.com/google/uuid"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
	"github.com/yourtime/backend/internal/domain/user"
)

// TokenPair is what a client receives after authenticating.
type TokenPair struct {
	AccessToken  string
	RefreshToken string
	// ExpiresIn is the access token lifetime in seconds.
	ExpiresIn int
}

// TokenManager is implemented by infrastructure (JWT).
type TokenManager interface {
	Issue(userID uuid.UUID) (TokenPair, error)
	ParseRefresh(token string) (uuid.UUID, error)
}

type Service struct {
	users  *user.Service
	tokens TokenManager
	// registrationClosed refuses new accounts; people who already have one still sign in.
	registrationClosed bool
}

func NewService(users *user.Service, tokens TokenManager) *Service {
	return &Service{users: users, tokens: tokens}
}

// CloseRegistration makes Register refuse every request.
func (s *Service) CloseRegistration() { s.registrationClosed = true }

type Session struct {
	User   *user.User
	Tokens TokenPair
}

type RegisterInput struct {
	Email    string
	Password string
	FullName string
	// Currency is optional; defaults to valueobjects.DefaultCurrency.
	Currency string
}

func (s *Service) Register(ctx context.Context, in RegisterInput) (*Session, error) {
	if s.registrationClosed {
		return nil, user.ErrRegistrationClosed
	}
	email, err := valueobjects.NewEmail(in.Email)
	if err != nil {
		return nil, err
	}
	currency := valueobjects.DefaultCurrency
	if in.Currency != "" {
		if currency, err = valueobjects.NewCurrency(in.Currency); err != nil {
			return nil, err
		}
	}
	u, err := s.users.Register(ctx, user.RegisterInput{
		Email: email, Password: in.Password, FullName: in.FullName, Currency: currency,
	})
	if err != nil {
		return nil, err
	}
	return s.session(u)
}

func (s *Service) Login(ctx context.Context, emailRaw, password string) (*Session, error) {
	email, err := valueobjects.NewEmail(emailRaw)
	if err != nil {
		// Same error as a wrong password: do not reveal which part was wrong.
		return nil, user.ErrInvalidCredentials
	}
	u, err := s.users.Authenticate(ctx, email, password)
	if err != nil {
		return nil, err
	}
	return s.session(u)
}

func (s *Service) Refresh(ctx context.Context, refreshToken string) (*Session, error) {
	id, err := s.tokens.ParseRefresh(refreshToken)
	if err != nil {
		return nil, user.ErrInvalidCredentials
	}
	u, err := s.users.Get(ctx, id)
	if err != nil {
		return nil, user.ErrInvalidCredentials
	}
	if !u.CanLogin() {
		return nil, user.ErrAccountInactive
	}
	return s.session(u)
}

func (s *Service) session(u *user.User) (*Session, error) {
	pair, err := s.tokens.Issue(u.ID)
	if err != nil {
		return nil, err
	}
	return &Session{User: u, Tokens: pair}, nil
}
