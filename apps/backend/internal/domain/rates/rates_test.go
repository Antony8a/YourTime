package rates

import (
	"testing"
	"time"

	"github.com/yourtime/backend/internal/domain/common/valueobjects"
)

func snap() *Snapshot {
	return &Snapshot{
		Date: Day(time.Date(2026, 10, 21, 15, 0, 0, 0, time.UTC)),
		PerUSD: map[valueobjects.Currency]float64{
			"USD": 1, "COP": 4000, "EUR": 0.8, "JPY": 150,
		},
	}
}

func TestConvert(t *testing.T) {
	s := snap()
	cases := []struct {
		name     string
		amount   int64
		from, to valueobjects.Currency
		want     int64
	}{
		{"same currency is untouched", 12345, "COP", "COP", 12345},
		{"usd to cop (both two decimals)", 10000, "USD", "COP", 40000000},
		{"cop to usd", 40000000, "COP", "USD", 10000},
		{"through the pivot, eur to cop", 8000, "EUR", "COP", 40000000},
		// JPY has no minor unit: 1000 yen is 1000 minor units, and 1 USD buys 150 yen.
		{"zero-decimal source", 1000, "JPY", "USD", 667},
		{"zero-decimal target", 10000, "USD", "JPY", 15000},
		{"rounds to the nearest minor unit", 100, "USD", "EUR", 80},
	}
	for _, c := range cases {
		got, ok := s.Convert(c.amount, c.from, c.to)
		if !ok || got != c.want {
			t.Errorf("%s: got %d (ok=%v), want %d", c.name, got, ok, c.want)
		}
	}
}

func TestConvertWithoutARate(t *testing.T) {
	if _, ok := snap().Convert(100, "USD", "BOB"); ok {
		t.Fatal("a currency with no rate must not convert")
	}
	if _, ok := snap().Convert(100, "BOB", "USD"); ok {
		t.Fatal("a currency with no rate must not convert")
	}
	// Same currency never needs a rate.
	if v, ok := snap().Convert(100, "BOB", "BOB"); !ok || v != 100 {
		t.Fatalf("same currency: %d %v", v, ok)
	}
}

func TestDayTruncatesToUTC(t *testing.T) {
	// 23:30 in Bogota (UTC-5) is already the next day in UTC.
	bogota := time.FixedZone("COT", -5*3600)
	got := Day(time.Date(2026, 10, 21, 23, 30, 0, 0, bogota))
	if !got.Equal(time.Date(2026, 10, 22, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("got %v", got)
	}
}
