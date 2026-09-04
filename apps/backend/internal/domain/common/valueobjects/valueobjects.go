package valueobjects

import (
	"errors"
	"fmt"
	"regexp"
)

var (
	ErrInvalidEmail = errors.New("invalid email format")
	ErrInvalidPhone = errors.New("invalid phone format")
)

type Email string

func NewEmail(value string) (Email, error) {
	email := Email(value)
	if !email.IsValid() {
		return "", ErrInvalidEmail
	}
	return email, nil
}

func (e Email) String() string {
	return string(e)
}

func (e Email) IsValid() bool {
	emailRegex := regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
	return emailRegex.MatchString(string(e))
}

func (e Email) Normalized() Email {
	return Email(string(e))
}

type Phone string

func NewPhone(value string) (Phone, error) {
	phone := Phone(value)
	if !phone.IsValid() {
		return "", ErrInvalidPhone
	}
	return phone, nil
}

func (p Phone) String() string {
	return string(p)
}

func (p Phone) IsValid() bool {
	phoneRegex := regexp.MustCompile(`^\+[1-9]\d{1,14}$`)
	return phoneRegex.MatchString(string(p))
}

func (p Phone) Formatted() string {
	cleaned := p.String()
	if len(cleaned) < 3 {
		return cleaned
	}
	countryCode := cleaned[:3]
	rest := cleaned[3:]
	if len(rest) == 10 {
		return fmt.Sprintf("%s %s %s %s-%s", countryCode, rest[:1], rest[1:3], rest[3:7], rest[7:])
	}
	return cleaned
}

type Password string

func NewPassword(value string) (Password, error) {
	if len(value) < 8 {
		return "", errors.New("password must be at least 8 characters")
	}
	return Password(value), nil
}

func (p Password) String() string {
	return string(p)
}

type Money int64 // in cents

func NewMoney(cents int64) Money {
	return Money(cents)
}

func MoneyFromFloat(amount float64, currency string) Money {
	return Money(int64(amount * 100))
}

func (m Money) Float64() float64 {
	return float64(m) / 100
}

func (m Money) String() string {
	return fmt.Sprintf("%.2f", m.Float64())
}

type Tokens int64

func NewTokens(amount int64) Tokens {
	return Tokens(amount)
}

func (t Tokens) Int64() int64 {
	return int64(t)
}

func (t Tokens) String() string {
	return fmt.Sprintf("%d", t.Int64())
}

type Coordinates struct {
	Lat float64
	Lng float64
}

func NewCoordinates(lat, lng float64) (Coordinates, error) {
	if lat < -90 || lat > 90 {
		return Coordinates{}, errors.New("latitude must be between -90 and 90")
	}
	if lng < -180 || lng > 180 {
		return Coordinates{}, errors.New("longitude must be between -180 and 180")
	}
	return Coordinates{Lat: lat, Lng: lng}, nil
}