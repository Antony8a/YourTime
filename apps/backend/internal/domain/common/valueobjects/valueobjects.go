// Package valueobjects holds small, self-validating domain types.
package valueobjects

import (
	"regexp"
	"strings"

	derr "github.com/yourtime/backend/internal/domain/common/errors"
)

var (
	ErrInvalidEmail       = derr.New(derr.ErrInvalidInput, "invalid_email", "invalid email format")
	ErrInvalidPhone       = derr.New(derr.ErrInvalidInput, "invalid_phone", "invalid phone, expected E.164 like +573001234567")
	ErrInvalidPassword    = derr.New(derr.ErrInvalidInput, "invalid_password", "password must be between 8 and 72 characters")
	ErrInvalidCurrency    = derr.New(derr.ErrInvalidInput, "invalid_currency", "unsupported currency code")
	ErrInvalidLanguage    = derr.New(derr.ErrInvalidInput, "invalid_language", "unsupported language")
	ErrInvalidCoordinates = derr.New(derr.ErrInvalidInput, "invalid_coordinates", "invalid coordinates")
)

var (
	emailRegex = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
	phoneRegex = regexp.MustCompile(`^\+[1-9]\d{6,14}$`)
)

// Email is a trimmed, lower-cased email address.
type Email string

func NewEmail(value string) (Email, error) {
	v := strings.ToLower(strings.TrimSpace(value))
	if len(v) > 254 || !emailRegex.MatchString(v) {
		return "", ErrInvalidEmail
	}
	return Email(v), nil
}

func (e Email) String() string { return string(e) }

// Phone is an E.164 phone number.
type Phone string

func NewPhone(value string) (Phone, error) {
	v := strings.ReplaceAll(strings.TrimSpace(value), " ", "")
	if !phoneRegex.MatchString(v) {
		return "", ErrInvalidPhone
	}
	return Phone(v), nil
}

func (p Phone) String() string { return string(p) }

// ValidatePassword enforces length rules. 72 is bcrypt's input limit.
func ValidatePassword(value string) error {
	if len(value) < 8 || len(value) > 72 {
		return ErrInvalidPassword
	}
	return nil
}

// Coordinates is a WGS84 latitude/longitude pair.
type Coordinates struct {
	Lat float64
	Lng float64
}

func NewCoordinates(lat, lng float64) (Coordinates, error) {
	if lat < -90 || lat > 90 || lng < -180 || lng > 180 {
		return Coordinates{}, ErrInvalidCoordinates
	}
	return Coordinates{Lat: lat, Lng: lng}, nil
}
