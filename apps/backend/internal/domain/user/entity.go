package user

import (
	"time"
	"github.com/google/uuid"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
)

// Domain errors live in errors.go

type Role string

const (
	RoleUser      Role = "user"
	RoleAdmin     Role = "admin"
	RoleModerator Role = "moderator"
)

func (r Role) IsValid() bool {
	switch r {
	case RoleUser, RoleAdmin, RoleModerator:
		return true
	default:
		return false
	}
}

type Status string

const (
	StatusActive    Status = "active"
	StatusSuspended Status = "suspended"
	StatusDeleted   Status = "deleted"
)

func (s Status) IsValid() bool {
	switch s {
	case StatusActive, StatusSuspended, StatusDeleted:
		return true
	default:
		return false
	}
}

type User struct {
	ID              uuid.UUID
	Email           valueobjects.Email
	Phone           *valueobjects.Phone
	PasswordHash    string
	FullName        string
	AvatarURL       *string
	Bio             *string
	LocationLat     *float64
	LocationLng     *float64
	LocationCity    *string
	Role            Role
	Status          Status
	EmailVerified   bool
	PhoneVerified   bool
	LastLoginAt     *time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
	DeletedAt       *time.Time
}

func NewUser(email valueobjects.Email, passwordHash, fullName string) *User {
	now := time.Now().UTC()
	return &User{
		ID:            uuid.New(),
		Email:         email,
		PasswordHash:  passwordHash,
		FullName:      fullName,
		Role:          RoleUser,
		Status:        StatusActive,
		EmailVerified: false,
		PhoneVerified: false,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
}

func (u *User) UpdateProfile(fullName, bio, locationCity string, lat, lng *float64) {
	u.FullName = fullName
	u.Bio = &bio
	u.LocationCity = &locationCity
	u.LocationLat = lat
	u.LocationLng = lng
	u.UpdatedAt = time.Now().UTC()
}

func (u *User) UpdateAvatar(url string) {
	u.AvatarURL = &url
	u.UpdatedAt = time.Now().UTC()
}

func (u *User) VerifyEmail() {
	u.EmailVerified = true
	u.UpdatedAt = time.Now().UTC()
}

func (u *User) VerifyPhone() {
	u.PhoneVerified = true
	u.UpdatedAt = time.Now().UTC()
}

func (u *User) SetPhone(phone valueobjects.Phone) {
	u.Phone = &phone
	u.UpdatedAt = time.Now().UTC()
}

func (u *User) RecordLogin() {
	now := time.Now().UTC()
	u.LastLoginAt = &now
	u.UpdatedAt = now
}

func (u *User) ChangePassword(newHash string) {
	u.PasswordHash = newHash
	u.UpdatedAt = time.Now().UTC()
}

func (u *User) Suspend() {
	u.Status = StatusSuspended
	u.UpdatedAt = time.Now().UTC()
}

func (u *User) Activate() {
	u.Status = StatusActive
	u.UpdatedAt = time.Now().UTC()
}

func (u *User) SoftDelete() {
	now := time.Now().UTC()
	u.Status = StatusDeleted
	u.DeletedAt = &now
	u.UpdatedAt = now
}

func (u *User) IsActive() bool {
	return u.Status == StatusActive && u.DeletedAt == nil
}

func (u *User) CanLogin() bool {
	return u.IsActive() && u.EmailVerified
}