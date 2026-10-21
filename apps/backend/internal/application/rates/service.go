// Package rates keeps today's exchange rates fresh and serves them.
package rates

import (
	"context"
	"sync"
	"time"

	"github.com/yourtime/backend/internal/domain/rates"
	"github.com/yourtime/backend/internal/platform/logger"
)

type Service struct {
	repo     rates.Repository
	provider rates.Provider
	now      func() time.Time

	mu sync.Mutex // one refresh at a time
}

func NewService(repo rates.Repository, provider rates.Provider) *Service {
	return &Service{repo: repo, provider: provider, now: time.Now}
}

// Refresh fetches the current rates and stores them as today's snapshot.
func (s *Service) Refresh(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.refreshLocked(ctx)
}

func (s *Service) refreshLocked(ctx context.Context) error {
	fetched, err := s.provider.Latest(ctx)
	if err != nil {
		return err
	}
	now := s.now()
	return s.repo.Save(ctx, rates.Snapshot{Date: rates.Day(now), PerUSD: fetched, FetchedAt: now})
}

// Today returns today's rates, fetching them first if the day has none yet. If
// the source is down it falls back to the newest snapshot (stale is then true),
// and only fails when no rates were ever stored.
func (s *Service) Today(ctx context.Context) (snap *rates.Snapshot, stale bool, err error) {
	latest, err := s.repo.Latest(ctx)
	if err == nil && latest.Date.Equal(rates.Day(s.now())) {
		return latest, false, nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	// Someone else may have refreshed while this call waited for the lock.
	if again, aerr := s.repo.Latest(ctx); aerr == nil && again.Date.Equal(rates.Day(s.now())) {
		return again, false, nil
	}
	if rerr := s.refreshLocked(ctx); rerr == nil {
		if fresh, ferr := s.repo.Latest(ctx); ferr == nil {
			return fresh, false, nil
		}
	} else {
		logger.Warn().Err(rerr).Msg("Could not refresh exchange rates")
	}
	if latest != nil {
		return latest, true, nil
	}
	return nil, false, rates.ErrUnavailable
}

// ForDay returns the rates that apply to a past day (see rates.Repository.ForDay).
func (s *Service) ForDay(ctx context.Context, day time.Time) (*rates.Snapshot, error) {
	return s.repo.ForDay(ctx, rates.Day(day))
}

// Run keeps today's rates fresh until ctx ends: once at start, then every few hours.
func (s *Service) Run(ctx context.Context, every time.Duration) {
	if _, _, err := s.Today(ctx); err != nil {
		logger.Warn().Err(err).Msg("No exchange rates yet")
	}
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := s.Refresh(ctx); err != nil {
				logger.Warn().Err(err).Msg("Could not refresh exchange rates")
			}
		}
	}
}
