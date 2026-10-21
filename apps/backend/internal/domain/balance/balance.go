// Package balance is the read side of money: what a person earned doing
// services and what they paid for services they requested, over a period.
// Nothing is stored here; it is derived from completed tasks and the price of
// the application that was chosen for each one.
package balance

import (
	"context"
	"time"

	"github.com/google/uuid"
	derr "github.com/yourtime/backend/internal/domain/common/errors"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
)

var ErrInvalidRange = derr.New(derr.ErrInvalidInput, "invalid_range", "the start of the period must be before its end")

// MaxEntries caps the list shown per side. Totals always cover the whole period.
const MaxEntries = 200

// Period is a half-open interval [From, To). Either end may be open, which
// means "since ever" / "until now".
type Period struct {
	From *time.Time
	To   *time.Time
}

func NewPeriod(from, to *time.Time) (Period, error) {
	if from != nil && to != nil && !from.Before(*to) {
		return Period{}, ErrInvalidRange
	}
	return Period{From: from, To: to}, nil
}

// Role is which side of the service the person was on.
type Role string

const (
	// Worker did the service and was paid for it.
	Worker Role = "worker"
	// Client requested the service and paid for it.
	Client Role = "client"
)

// Total is the sum for one currency. Currencies are never converted or mixed.
type Total struct {
	Currency   valueobjects.Currency
	TotalMinor int64
	Count      int
}

type Counterpart struct {
	ID        uuid.UUID
	FullName  string
	AvatarURL *string
}

type Category struct {
	Name  string
	Icon  string
	Color string
}

// Bucket is one currency's sum for one day. Services are converted per day, with
// the exchange rate of the day they were finished.
type Bucket struct {
	Currency   valueobjects.Currency
	Day        time.Time // UTC calendar day
	TotalMinor int64
	Count      int
}

// Converted is a side's whole total expressed in one currency (the person's).
type Converted struct {
	Currency   valueobjects.Currency
	TotalMinor int64
	// Approximate is true when some service had no rate for its own day and the
	// closest available day was used instead.
	Approximate bool
	// Partial is true when some amount could not be converted and is left out.
	Partial bool
}

// Entry is one finished service.
type Entry struct {
	TaskID      uuid.UUID
	Title       string
	Category    Category
	Counterpart Counterpart
	Currency    valueobjects.Currency
	AmountMinor int64
	CompletedAt time.Time
	// ConvertedMinor is AmountMinor in the person's currency; nil when it is
	// already in that currency or there is no rate.
	ConvertedMinor *int64
}

// Side is everything for one role in the period.
type Side struct {
	Totals  []Total
	Buckets []Bucket
	Entries []Entry
	// Converted is Totals added up in the person's currency; nil when nothing
	// could be converted.
	Converted *Converted
	// HasMore is true when the period holds more services than Entries lists.
	HasMore bool
}

type Report struct {
	// Currency is the person's account currency, which conversions are into.
	Currency valueobjects.Currency
	Period   Period
	Earned   Side
	Spent    Side
}

type Repository interface {
	Side(ctx context.Context, userID uuid.UUID, role Role, p Period, limit int) (Side, error)
}
