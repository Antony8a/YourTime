package balance

import (
	"errors"
	"testing"
	"time"
)

func TestNewPeriod(t *testing.T) {
	a := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	b := time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)

	if _, err := NewPeriod(&a, &b); err != nil {
		t.Fatalf("a normal period: %v", err)
	}
	if _, err := NewPeriod(nil, nil); err != nil {
		t.Fatalf("an open period: %v", err)
	}
	if _, err := NewPeriod(&a, nil); err != nil {
		t.Fatalf("an open end: %v", err)
	}
	if _, err := NewPeriod(nil, &b); err != nil {
		t.Fatalf("an open start: %v", err)
	}
	if _, err := NewPeriod(&b, &a); !errors.Is(err, ErrInvalidRange) {
		t.Fatalf("reversed: got %v", err)
	}
	// The end is exclusive, so an empty interval is not a period either.
	if _, err := NewPeriod(&a, &a); !errors.Is(err, ErrInvalidRange) {
		t.Fatalf("empty: got %v", err)
	}
}
