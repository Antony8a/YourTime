// Package user is the account domain: identity, profile and the personal
// preferences (currency, location, search radius) that shape the experience.
package user

import (
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
)

type Status string

const (
	StatusActive    Status = "active"
	StatusSuspended Status = "suspended"
)

// MaxSearchRadiusKm bounds the preferred radius. It is a UX preference, never
// an eligibility rule: distance only informs a person's decision.
const MaxSearchRadiusKm = 20000

// Location is where the person is based. It is the default origin for
// distance calculations.
type Location struct {
	Coordinates valueobjects.Coordinates
	City        string
}

type User struct {
	ID           uuid.UUID
	Email        valueobjects.Email
	PasswordHash string
	FullName     string
	Phone        *valueobjects.Phone
	AvatarURL    *string
	Bio          *string

	// Currency is the account currency (ISO 4217). Tasks a person publishes
	// default to it, and every amount they see is formatted with it.
	Currency valueobjects.Currency

	Location *Location

	// SearchRadiusKm is the preferred maximum distance for browsing tasks.
	// nil means "no limit". It never prevents applying to a task.
	SearchRadiusKm *int

	// Rating is the reviews summary. Read-only here: it changes only when a
	// review is written (see the review domain).
	Rating valueobjects.Rating

	Status      Status
	LastLoginAt *time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func NewUser(email valueobjects.Email, passwordHash, fullName string, currency valueobjects.Currency) (*User, error) {
	fullName = strings.TrimSpace(fullName)
	if fullName == "" || utf8.RuneCountInString(fullName) > 150 {
		return nil, ErrInvalidName
	}
	now := time.Now().UTC()
	return &User{
		ID:           uuid.New(),
		Email:        email,
		PasswordHash: passwordHash,
		FullName:     fullName,
		Currency:     currency,
		Status:       StatusActive,
		CreatedAt:    now,
		UpdatedAt:    now,
	}, nil
}

// ProfileUpdate is a partial update: nil fields are left untouched.
// Radius needs its own flag because "clear the radius" (no limit) is a
// legitimate value that must be distinguishable from "not provided".
type ProfileUpdate struct {
	FullName  *string
	Bio       *string
	AvatarURL *string
	Phone     *valueobjects.Phone
	Currency  *valueobjects.Currency
	Location  *Location

	SetRadius      bool
	SearchRadiusKm *int
}

// ApplyProfileUpdate validates the whole update first and applies it only if
// every part is valid, so a rejected update never leaves a half-changed user.
func (u *User) ApplyProfileUpdate(p ProfileUpdate) error {
	var name string
	if p.FullName != nil {
		name = strings.TrimSpace(*p.FullName)
		if name == "" || utf8.RuneCountInString(name) > 150 {
			return ErrInvalidName
		}
	}
	if p.Location != nil && utf8.RuneCountInString(p.Location.City) > 100 {
		return ErrInvalidCity
	}
	if p.SetRadius && p.SearchRadiusKm != nil {
		if *p.SearchRadiusKm < 1 || *p.SearchRadiusKm > MaxSearchRadiusKm {
			return ErrInvalidRadius
		}
	}

	if p.FullName != nil {
		u.FullName = name
	}
	if p.Bio != nil {
		u.Bio = p.Bio
	}
	if p.AvatarURL != nil {
		u.AvatarURL = p.AvatarURL
	}
	if p.Phone != nil {
		u.Phone = p.Phone
	}
	if p.Currency != nil {
		u.Currency = *p.Currency
	}
	if p.Location != nil {
		loc := *p.Location
		loc.City = strings.TrimSpace(loc.City)
		u.Location = &loc
	}
	if p.SetRadius {
		u.SearchRadiusKm = p.SearchRadiusKm
	}
	u.UpdatedAt = time.Now().UTC()
	return nil
}

func (u *User) RecordLogin() {
	now := time.Now().UTC()
	u.LastLoginAt = &now
}

func (u *User) CanLogin() bool { return u.Status == StatusActive }
