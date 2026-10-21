package balance

import (
	"context"
	"time"

	"github.com/google/uuid"
	apprates "github.com/yourtime/backend/internal/application/rates"
	"github.com/yourtime/backend/internal/domain/balance"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
	"github.com/yourtime/backend/internal/domain/rates"
	"github.com/yourtime/backend/internal/domain/user"
)

type Service struct {
	repo  balance.Repository
	users user.Repository
	rates *apprates.Service
}

func NewService(repo balance.Repository, users user.Repository, rates *apprates.Service) *Service {
	return &Service{repo: repo, users: users, rates: rates}
}

// Report returns what userID earned as a worker and spent as a client between
// from (inclusive) and to (exclusive). Either may be nil for an open end.
//
// Each side also comes with its total in the person's own currency. Services are
// converted with the rate of the day they were finished, so a later swing in
// the market does not rewrite what an old service was worth. The original
// amounts, in the currency each service was agreed in, are always kept.
func (s *Service) Report(ctx context.Context, userID uuid.UUID, from, to *time.Time) (*balance.Report, error) {
	period, err := balance.NewPeriod(from, to)
	if err != nil {
		return nil, err
	}
	me, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	earned, err := s.repo.Side(ctx, userID, balance.Worker, period, balance.MaxEntries)
	if err != nil {
		return nil, err
	}
	spent, err := s.repo.Side(ctx, userID, balance.Client, period, balance.MaxEntries)
	if err != nil {
		return nil, err
	}

	lookup := s.dayLookup(ctx)
	convertSide(&earned, me.Currency, lookup)
	convertSide(&spent, me.Currency, lookup)
	return &balance.Report{Currency: me.Currency, Period: period, Earned: earned, Spent: spent}, nil
}

// dayLookup returns the rates for a day, remembering them for the rest of the
// request. It yields nil when there are no rates at all.
func (s *Service) dayLookup(ctx context.Context) func(time.Time) *rates.Snapshot {
	memo := map[time.Time]*rates.Snapshot{}
	ensured := false
	return func(day time.Time) *rates.Snapshot {
		if !ensured {
			// Make sure today's rates exist before looking up past days (a no-op
			// when the background job already stored them). A failure only means
			// older rates, or none, are used below.
			_, _, _ = s.rates.Today(ctx)
			ensured = true
		}
		day = rates.Day(day)
		if snap, ok := memo[day]; ok {
			return snap
		}
		snap, err := s.rates.ForDay(ctx, day)
		if err != nil {
			snap = nil
		}
		memo[day] = snap
		return snap
	}
}

func convertSide(side *balance.Side, target valueobjects.Currency, rateFor func(time.Time) *rates.Snapshot) {
	var total int64
	converted := &balance.Converted{Currency: target}
	foreign, done := 0, 0

	for _, b := range side.Buckets {
		if b.Currency == target {
			total += b.TotalMinor // already in the person's currency: no rate needed
			continue
		}
		foreign++
		snap := rateFor(b.Day)
		if snap == nil {
			converted.Partial = true
			continue
		}
		v, ok := snap.Convert(b.TotalMinor, b.Currency, target)
		if !ok {
			converted.Partial = true
			continue
		}
		done++
		if !snap.Date.Equal(rates.Day(b.Day)) {
			converted.Approximate = true
		}
		total += v
	}
	converted.TotalMinor = total
	// Foreign money that could not be converted at all: better to say nothing
	// than to show a total that silently leaves most of it out.
	if foreign > 0 && done == 0 {
		side.Converted = nil
	} else {
		side.Converted = converted
	}

	for i := range side.Entries {
		e := &side.Entries[i]
		if e.Currency == target {
			continue
		}
		if snap := rateFor(e.CompletedAt); snap != nil {
			if v, ok := snap.Convert(e.AmountMinor, e.Currency, target); ok {
				e.ConvertedMinor = &v
			}
		}
	}
}
