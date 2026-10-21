package security

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const secret = "0123456789abcdef0123456789abcdef"

func TestAccessAndRefreshAreNotInterchangeable(t *testing.T) {
	m := NewJWTManager(secret, time.Minute, time.Hour)
	id := uuid.New()
	pair, err := m.Issue(id)
	if err != nil {
		t.Fatal(err)
	}
	if got, err := m.ParseAccess(pair.AccessToken); err != nil || got != id {
		t.Fatalf("access: %v %v", got, err)
	}
	if got, err := m.ParseRefresh(pair.RefreshToken); err != nil || got != id {
		t.Fatalf("refresh: %v %v", got, err)
	}
	if _, err := m.ParseAccess(pair.RefreshToken); err == nil {
		t.Fatal("a refresh token must not authenticate API calls")
	}
	if _, err := m.ParseRefresh(pair.AccessToken); err == nil {
		t.Fatal("an access token must not be accepted for refresh")
	}
}

func TestExpiredAndTamperedTokens(t *testing.T) {
	m := NewJWTManager(secret, time.Minute, time.Hour)
	pair, _ := m.Issue(uuid.New())

	later := *m
	later.now = func() time.Time { return time.Now().Add(2 * time.Minute) }
	if _, err := later.ParseAccess(pair.AccessToken); err == nil {
		t.Fatal("expired access token accepted")
	}

	other := NewJWTManager("a-completely-different-secret-value!!", time.Minute, time.Hour)
	if _, err := other.ParseAccess(pair.AccessToken); err == nil {
		t.Fatal("token signed with another secret accepted")
	}
}

func TestRejectsNoneAlgorithm(t *testing.T) {
	m := NewJWTManager(secret, time.Minute, time.Hour)
	c := claims{Type: typeAccess, RegisteredClaims: jwt.RegisteredClaims{
		Subject: uuid.NewString(), ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}}
	raw, err := jwt.NewWithClaims(jwt.SigningMethodNone, c).SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := m.ParseAccess(raw); err == nil {
		t.Fatal("unsigned token accepted")
	}
}
