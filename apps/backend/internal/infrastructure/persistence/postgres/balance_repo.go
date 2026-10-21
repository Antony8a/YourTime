package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/yourtime/backend/internal/domain/balance"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
)

type BalanceRepo struct {
	pool *pgxpool.Pool
}

func NewBalanceRepo(pool *pgxpool.Pool) *BalanceRepo { return &BalanceRepo{pool: pool} }

var _ balance.Repository = (*BalanceRepo)(nil)

// columns says which task column holds the person and which holds the other side.
// They are constants, never user input, so formatting them into SQL is safe.
var roleColumns = map[balance.Role]struct{ own, other string }{
	balance.Worker: {own: "t.assigned_applicant_id", other: "t.poster_id"},
	balance.Client: {own: "t.poster_id", other: "t.assigned_applicant_id"},
}

// The amount is the price of the application that was chosen, in the task's currency.
const periodFilter = `
	t.status = 'completed'
	AND ($2::timestamptz IS NULL OR t.completed_at >= $2)
	AND ($3::timestamptz IS NULL OR t.completed_at < $3)`

func (r *BalanceRepo) Side(ctx context.Context, userID uuid.UUID, role balance.Role, p balance.Period, limit int) (balance.Side, error) {
	cols, ok := roleColumns[role]
	if !ok {
		return balance.Side{}, fmt.Errorf("unknown balance role %q", role)
	}
	var side balance.Side

	// Sums per currency and day: the service converts each day with its own rate.
	buckets, err := r.pool.Query(ctx, fmt.Sprintf(`
		SELECT t.currency, (t.completed_at AT TIME ZONE 'UTC')::date AS day,
		       COALESCE(SUM(a.price_minor), 0)::bigint, COUNT(*)::int
		FROM tasks t
		JOIN applications a ON a.id = t.assigned_application_id
		WHERE %s = $1 AND %s
		GROUP BY t.currency, day
		ORDER BY t.currency, day`, cols.own, periodFilter), userID, p.From, p.To)
	if err != nil {
		return side, err
	}
	defer buckets.Close()
	for buckets.Next() {
		var cur string
		var b balance.Bucket
		if err := buckets.Scan(&cur, &b.Day, &b.TotalMinor, &b.Count); err != nil {
			return side, err
		}
		b.Currency = valueobjects.Currency(cur)
		side.Buckets = append(side.Buckets, b)
		// Rows come ordered by currency, so each currency's days are contiguous.
		if n := len(side.Totals); n == 0 || side.Totals[n-1].Currency != b.Currency {
			side.Totals = append(side.Totals, balance.Total{Currency: b.Currency})
		}
		last := &side.Totals[len(side.Totals)-1]
		last.TotalMinor += b.TotalMinor
		last.Count += b.Count
	}
	if err := buckets.Err(); err != nil {
		return side, err
	}
	buckets.Close()

	// One extra row tells whether the list was cut off.
	rows, err := r.pool.Query(ctx, fmt.Sprintf(`
		SELECT t.id, t.title, t.currency, a.price_minor, t.completed_at,
		       c.name, c.icon, c.color,
		       u.id, u.full_name, u.avatar_url
		FROM tasks t
		JOIN applications a ON a.id = t.assigned_application_id
		JOIN categories c ON c.id = t.category_id
		JOIN users u ON u.id = %s
		WHERE %s = $1 AND %s
		ORDER BY t.completed_at DESC, t.id
		LIMIT $4`, cols.other, cols.own, periodFilter), userID, p.From, p.To, limit+1)
	if err != nil {
		return side, err
	}
	defer rows.Close()
	for rows.Next() {
		var e balance.Entry
		var cur string
		if err := rows.Scan(&e.TaskID, &e.Title, &cur, &e.AmountMinor, &e.CompletedAt,
			&e.Category.Name, &e.Category.Icon, &e.Category.Color,
			&e.Counterpart.ID, &e.Counterpart.FullName, &e.Counterpart.AvatarURL); err != nil {
			return side, err
		}
		e.Currency = valueobjects.Currency(cur)
		side.Entries = append(side.Entries, e)
	}
	if err := rows.Err(); err != nil {
		return side, err
	}
	if len(side.Entries) > limit {
		side.Entries = side.Entries[:limit]
		side.HasMore = true
	}
	return side, nil
}
