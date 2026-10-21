package postgres

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
	"github.com/yourtime/backend/internal/domain/rates"
)

type RatesRepo struct {
	pool *pgxpool.Pool
}

func NewRatesRepo(pool *pgxpool.Pool) *RatesRepo { return &RatesRepo{pool: pool} }

var _ rates.Repository = (*RatesRepo)(nil)

func (r *RatesRepo) Save(ctx context.Context, s rates.Snapshot) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	batch := &pgx.Batch{}
	for cur, rate := range s.PerUSD {
		batch.Queue(`
			INSERT INTO exchange_rates (rate_date, currency, per_usd, fetched_at)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (rate_date, currency)
			DO UPDATE SET per_usd = EXCLUDED.per_usd, fetched_at = EXCLUDED.fetched_at`,
			s.Date, string(cur), rate, s.FetchedAt)
	}
	results := tx.SendBatch(ctx, batch)
	for range s.PerUSD {
		if _, err := results.Exec(); err != nil {
			_ = results.Close()
			return err
		}
	}
	if err := results.Close(); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *RatesRepo) Latest(ctx context.Context) (*rates.Snapshot, error) {
	var day *time.Time
	if err := r.pool.QueryRow(ctx, `SELECT MAX(rate_date) FROM exchange_rates`).Scan(&day); err != nil {
		return nil, err
	}
	if day == nil {
		return nil, rates.ErrUnavailable
	}
	return r.load(ctx, *day)
}

func (r *RatesRepo) ForDay(ctx context.Context, day time.Time) (*rates.Snapshot, error) {
	var earlier *time.Time
	if err := r.pool.QueryRow(ctx, `SELECT MAX(rate_date) FROM exchange_rates WHERE rate_date <= $1`, day).Scan(&earlier); err != nil {
		return nil, err
	}
	if earlier != nil {
		return r.load(ctx, *earlier)
	}
	// Nothing on or before that day (history from before rates were kept):
	// use the closest later one.
	var later *time.Time
	if err := r.pool.QueryRow(ctx, `SELECT MIN(rate_date) FROM exchange_rates WHERE rate_date > $1`, day).Scan(&later); err != nil {
		return nil, err
	}
	if later == nil {
		return nil, rates.ErrUnavailable
	}
	return r.load(ctx, *later)
}

func (r *RatesRepo) load(ctx context.Context, day time.Time) (*rates.Snapshot, error) {
	rows, err := r.pool.Query(ctx, `SELECT currency, per_usd::float8, fetched_at FROM exchange_rates WHERE rate_date = $1`, day)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	snap := &rates.Snapshot{Date: rates.Day(day), PerUSD: map[valueobjects.Currency]float64{}}
	for rows.Next() {
		var cur string
		var rate float64
		var fetched time.Time
		if err := rows.Scan(&cur, &rate, &fetched); err != nil {
			return nil, err
		}
		snap.PerUSD[valueobjects.Currency(cur)] = rate
		if fetched.After(snap.FetchedAt) {
			snap.FetchedAt = fetched
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(snap.PerUSD) == 0 {
		return nil, rates.ErrUnavailable
	}
	return snap, nil
}
