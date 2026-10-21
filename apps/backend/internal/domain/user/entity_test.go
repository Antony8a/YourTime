package user

import (
	"errors"
	"strings"
	"testing"

	"github.com/yourtime/backend/internal/domain/common/valueobjects"
)

func newUser(t *testing.T) *User {
	t.Helper()
	email, _ := valueobjects.NewEmail("A@Example.com ")
	u, err := NewUser(email, "hash", "  Ana  ", valueobjects.DefaultCurrency)
	if err != nil {
		t.Fatal(err)
	}
	return u
}

func TestNewUserNormalizes(t *testing.T) {
	u := newUser(t)
	if u.FullName != "Ana" || u.Email != "a@example.com" || u.Currency != "USD" || u.SearchRadiusKm != nil {
		t.Fatalf("unexpected defaults: %+v", u)
	}
	if _, err := NewUser("a@b.co", "h", strings.Repeat("x", 151), "USD"); !errors.Is(err, ErrInvalidName) {
		t.Fatalf("long name: %v", err)
	}
}

func TestRadiusPreference(t *testing.T) {
	u := newUser(t)
	ten := 10

	if err := u.ApplyProfileUpdate(ProfileUpdate{SetRadius: true, SearchRadiusKm: &ten}); err != nil || *u.SearchRadiusKm != 10 {
		t.Fatalf("set radius: %v", err)
	}
	// Not provided: the preference is untouched.
	if err := u.ApplyProfileUpdate(ProfileUpdate{FullName: ptr("Ana M")}); err != nil || u.SearchRadiusKm == nil {
		t.Fatalf("radius must survive unrelated updates: %v", err)
	}
	// Explicit null clears it: no limit.
	if err := u.ApplyProfileUpdate(ProfileUpdate{SetRadius: true, SearchRadiusKm: nil}); err != nil || u.SearchRadiusKm != nil {
		t.Fatalf("clear radius: %v", err)
	}
	for _, bad := range []int{0, -5, MaxSearchRadiusKm + 1} {
		bad := bad
		if err := u.ApplyProfileUpdate(ProfileUpdate{SetRadius: true, SearchRadiusKm: &bad}); !errors.Is(err, ErrInvalidRadius) {
			t.Errorf("radius %d: got %v", bad, err)
		}
	}
}

func TestCurrencyIsPartOfTheAccount(t *testing.T) {
	u := newUser(t)
	eur, _ := valueobjects.NewCurrency("eur")
	if err := u.ApplyProfileUpdate(ProfileUpdate{Currency: &eur}); err != nil || u.Currency != "EUR" {
		t.Fatalf("currency: %v %v", u.Currency, err)
	}
	if _, err := valueobjects.NewCurrency("XXX"); !errors.Is(err, valueobjects.ErrInvalidCurrency) {
		t.Fatalf("unsupported currency: %v", err)
	}
}

func TestFailedUpdateChangesNothing(t *testing.T) {
	u := newUser(t)
	bad := 0
	err := u.ApplyProfileUpdate(ProfileUpdate{FullName: ptr("Changed"), SetRadius: true, SearchRadiusKm: &bad})
	if err == nil || u.FullName != "Ana" {
		t.Fatalf("a rejected update must be atomic, name is %q err %v", u.FullName, err)
	}
}

func ptr[T any](v T) *T { return &v }
