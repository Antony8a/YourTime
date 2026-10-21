// Package security implements token issuing and verification.
package security

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/yourtime/backend/internal/application/auth"
)

var ErrInvalidToken = errors.New("invalid or expired token")

type tokenType string

const (
	typeAccess  tokenType = "access"
	typeRefresh tokenType = "refresh"
)

type claims struct {
	Type tokenType `json:"typ"`
	jwt.RegisteredClaims
}

// JWTManager issues and verifies HS256 tokens. Access and refresh tokens carry
// a type claim so one can never be used in place of the other.
type JWTManager struct {
	secret     []byte
	accessTTL  time.Duration
	refreshTTL time.Duration
	now        func() time.Time
}

func NewJWTManager(secret string, accessTTL, refreshTTL time.Duration) *JWTManager {
	return &JWTManager{secret: []byte(secret), accessTTL: accessTTL, refreshTTL: refreshTTL, now: time.Now}
}

func (m *JWTManager) Issue(userID uuid.UUID) (auth.TokenPair, error) {
	access, err := m.sign(userID, typeAccess, m.accessTTL)
	if err != nil {
		return auth.TokenPair{}, err
	}
	refresh, err := m.sign(userID, typeRefresh, m.refreshTTL)
	if err != nil {
		return auth.TokenPair{}, err
	}
	return auth.TokenPair{AccessToken: access, RefreshToken: refresh, ExpiresIn: int(m.accessTTL.Seconds())}, nil
}

func (m *JWTManager) sign(userID uuid.UUID, typ tokenType, ttl time.Duration) (string, error) {
	now := m.now()
	c := claims{
		Type: typ,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			ID:        uuid.NewString(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(m.secret)
}

func (m *JWTManager) ParseAccess(token string) (uuid.UUID, error) { return m.parse(token, typeAccess) }
func (m *JWTManager) ParseRefresh(token string) (uuid.UUID, error) {
	return m.parse(token, typeRefresh)
}

func (m *JWTManager) parse(raw string, want tokenType) (uuid.UUID, error) {
	var c claims
	tok, err := jwt.ParseWithClaims(raw, &c, func(*jwt.Token) (any, error) { return m.secret, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithTimeFunc(m.now),
		jwt.WithExpirationRequired(),
	)
	if err != nil || !tok.Valid || c.Type != want {
		return uuid.Nil, ErrInvalidToken
	}
	id, err := uuid.Parse(c.Subject)
	if err != nil {
		return uuid.Nil, fmt.Errorf("%w: bad subject", ErrInvalidToken)
	}
	return id, nil
}
