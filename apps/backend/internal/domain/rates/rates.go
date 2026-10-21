// Package rates holds exchange rates and converts money between currencies.
//
// Prices stay in the currency a task was published in; that is what is agreed
// and paid. Conversion is only ever informative: so a person can compare what
// they earned or spent across currencies, or get a feel for a foreign price.
package rates

import (
	"context"
	"math"
	"time"

	derr "github.com/yourtime/backend/internal/domain/common/errors"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
)

var ErrUnavailable = derr.New(derr.ErrUnavailable, "rates_unavailable", "exchange rates are not available right now")

// Base is the pivot every rate is quoted against. Any pair converts through it.
const Base valueobjects.Currency = "USD"

// Snapshot is one day's rates: how many units of each currency equal 1 USD.
type Snapshot struct {
	// Date is the day the rates are for (UTC, time of day zero).
	Date      time.Time
	PerUSD    map[valueobjects.Currency]float64
	FetchedAt time.Time
}

// Provider fetches today's rates from an outside source.
type Provider interface {
	Latest(ctx context.Context) (map[valueobjects.Currency]float64, error)
}

type Repository interface {
	// Save stores the rates for a day, replacing that day's earlier snapshot.
	Save(ctx context.Context, s Snapshot) error
	// Latest returns the newest snapshot, or ErrUnavailable if there is none.
	Latest(ctx context.Context) (*Snapshot, error)
	// ForDay returns the snapshot for the day, else the closest earlier one, else
	// the closest later one (history from before rates were kept). ErrUnavailable
	// if there are none at all.
	ForDay(ctx context.Context, day time.Time) (*Snapshot, error)
}

// Day truncates a time to its UTC calendar day.
func Day(t time.Time) time.Time {
	y, m, d := t.UTC().Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// Convert turns an amount in minor units of `from` into minor units of `to`.
// ok is false when either currency has no rate in the snapshot.
func (s *Snapshot) Convert(amountMinor int64, from, to valueobjects.Currency) (int64, bool) {
	if from == to {
		return amountMinor, true
	}
	rf, okf := s.PerUSD[from]
	rt, okt := s.PerUSD[to]
	if !okf || !okt || rf <= 0 || rt <= 0 {
		return 0, false
	}
	major := float64(amountMinor) / math.Pow10(from.Decimals())
	converted := major / rf * rt
	return int64(math.Round(converted * math.Pow10(to.Decimals()))), true
}
