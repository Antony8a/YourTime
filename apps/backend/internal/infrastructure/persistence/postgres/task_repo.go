package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
	"github.com/yourtime/backend/internal/domain/task"
)

type TaskRepo struct {
	pool *pgxpool.Pool
}

func NewTaskRepo(pool *pgxpool.Pool) *TaskRepo { return &TaskRepo{pool: pool} }

var _ task.Repository = (*TaskRepo)(nil)

const taskColumns = `id, poster_id, category_id, title, description, budget_type, budget_min_minor,
	budget_max_minor, currency, is_remote, location_lat, location_lng, location_address, location_city,
	scheduled_at, status, assigned_application_id, assigned_applicant_id, assigned_at, completed_at,
	cancelled_at, created_at, updated_at, en_route_at, started_at, worker_lat, worker_lng,
	worker_location_at, route_eta_seconds`

// rowScanner abstracts pgx.Row and pgx.Rows.
type rowScanner interface {
	Scan(dest ...any) error
}

// taskScanTargets returns scan destinations for taskColumns plus a finisher
// that assembles the derived fields once the scan succeeded.
func taskScanTargets(t *task.Task) ([]any, func()) {
	var (
		budgetType, currency, status string
		lat, lng                     *float64
		address, city                *string
		wlat, wlng                   *float64
		wat                          *time.Time
	)
	dest := []any{
		&t.ID, &t.PosterID, &t.CategoryID, &t.Title, &t.Description, &budgetType, &t.Budget.MinMinor,
		&t.Budget.MaxMinor, &currency, &t.IsRemote, &lat, &lng, &address, &city,
		&t.ScheduledAt, &status, &t.AssignedApplicationID, &t.AssignedApplicantID, &t.AssignedAt,
		&t.CompletedAt, &t.CancelledAt, &t.CreatedAt, &t.UpdatedAt,
		&t.EnRouteAt, &t.StartedAt, &wlat, &wlng, &wat, &t.RouteETASeconds,
	}
	finish := func() {
		if wlat != nil && wlng != nil && wat != nil {
			t.WorkerLocation = &task.WorkerLocation{
				Coordinates: valueobjects.Coordinates{Lat: *wlat, Lng: *wlng},
				At:          *wat,
			}
		}
		t.Budget.Type = task.BudgetType(budgetType)
		t.Budget.Currency = valueobjects.Currency(currency)
		t.Status = task.Status(status)
		if lat != nil && lng != nil {
			p := &task.Place{Coordinates: valueobjects.Coordinates{Lat: *lat, Lng: *lng}}
			if address != nil {
				p.Address = *address
			}
			if city != nil {
				p.City = *city
			}
			t.Place = p
		}
	}
	return dest, finish
}

func scanTask(row rowScanner) (*task.Task, error) {
	var t task.Task
	dest, finish := taskScanTargets(&t)
	if err := row.Scan(dest...); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, task.ErrNotFound
		}
		return nil, err
	}
	finish()
	return &t, nil
}

func placeArgs(p *task.Place) (lat, lng *float64, address, city *string) {
	if p == nil {
		return nil, nil, nil, nil
	}
	return &p.Coordinates.Lat, &p.Coordinates.Lng, &p.Address, &p.City
}

// workerArgs flattens the optional worker position into nullable SQL arguments.
func workerArgs(l *task.WorkerLocation) (lat, lng *float64, at *time.Time) {
	if l == nil {
		return nil, nil, nil
	}
	return &l.Coordinates.Lat, &l.Coordinates.Lng, &l.At
}

func (r *TaskRepo) Create(ctx context.Context, t *task.Task) error {
	lat, lng, address, city := placeArgs(t.Place)
	wlat, wlng, wat := workerArgs(t.WorkerLocation)
	_, err := r.pool.Exec(ctx, `
		INSERT INTO tasks (`+taskColumns+`)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)`,
		t.ID, t.PosterID, t.CategoryID, t.Title, t.Description, string(t.Budget.Type), t.Budget.MinMinor,
		t.Budget.MaxMinor, t.Budget.Currency.String(), t.IsRemote, lat, lng, address, city,
		t.ScheduledAt, string(t.Status), t.AssignedApplicationID, t.AssignedApplicantID, t.AssignedAt,
		t.CompletedAt, t.CancelledAt, t.CreatedAt, t.UpdatedAt,
		t.EnRouteAt, t.StartedAt, wlat, wlng, wat, t.RouteETASeconds)
	return err
}

// saveTask persists every mutable column of t inside tx.
func saveTask(ctx context.Context, tx pgx.Tx, t *task.Task) error {
	lat, lng, address, city := placeArgs(t.Place)
	wlat, wlng, wat := workerArgs(t.WorkerLocation)
	_, err := tx.Exec(ctx, `
		UPDATE tasks SET category_id=$2, title=$3, description=$4, budget_type=$5, budget_min_minor=$6,
			budget_max_minor=$7, currency=$8, is_remote=$9, location_lat=$10, location_lng=$11,
			location_address=$12, location_city=$13, scheduled_at=$14, status=$15,
			assigned_application_id=$16, assigned_applicant_id=$17, assigned_at=$18,
			completed_at=$19, cancelled_at=$20, updated_at=$21, en_route_at=$22, started_at=$23,
			worker_lat=$24, worker_lng=$25, worker_location_at=$26, route_eta_seconds=$27
		WHERE id=$1`,
		t.ID, t.CategoryID, t.Title, t.Description, string(t.Budget.Type), t.Budget.MinMinor,
		t.Budget.MaxMinor, t.Budget.Currency.String(), t.IsRemote, lat, lng,
		address, city, t.ScheduledAt, string(t.Status),
		t.AssignedApplicationID, t.AssignedApplicantID, t.AssignedAt,
		t.CompletedAt, t.CancelledAt, t.UpdatedAt, t.EnRouteAt, t.StartedAt, wlat, wlng, wat,
		t.RouteETASeconds)
	return err
}

func (r *TaskRepo) Mutate(ctx context.Context, id uuid.UUID, fn func(*task.Task) error) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	t, err := scanTask(tx.QueryRow(ctx, `SELECT `+taskColumns+` FROM tasks WHERE id=$1 FOR UPDATE`, id))
	if err != nil {
		return err
	}
	prevStatus, prevWorker := t.Status, t.AssignedApplicantID
	if err := fn(t); err != nil {
		return err
	}
	if err := saveTask(ctx, tx, t); err != nil {
		return err
	}
	// A cancelled service that had not started gives the commission back.
	if t.Status == task.StatusCancelled && prevWorker != nil &&
		(prevStatus == task.StatusAssigned || prevStatus == task.StatusEnRoute) {
		if err := refundTaskFee(ctx, tx, id, *prevWorker, time.Now().UTC()); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// ---- read model -----------------------------------------------------------

// Location privacy: only the poster and the chosen applicant see the exact
// point. Everyone else gets it rounded to 2 decimals (about 1 km), and distances
// are computed from that rounded point, so moving the search origin around
// cannot be used to triangulate the real address.
const visibleLocation = `
	SELECT CASE WHEN t.poster_id = $1 OR t.assigned_applicant_id = $1
	            THEN t.location_lat ELSE round(t.location_lat::numeric, 2)::float8 END AS lat,
	       CASE WHEN t.poster_id = $1 OR t.assigned_applicant_id = $1
	            THEN t.location_lng ELSE round(t.location_lng::numeric, 2)::float8 END AS lng`

// haversineKm mirrors task.DistanceKm over the visible location.
// $2 is the origin latitude, $3 the origin longitude.
const haversineKm = `
	CASE WHEN loc.lat IS NULL OR $2::float8 IS NULL THEN NULL ELSE
		2 * 6371.0088 * asin(sqrt(least(1,
			power(sin(radians(loc.lat - $2::float8) / 2), 2) +
			cos(radians($2::float8)) * cos(radians(loc.lat)) *
			power(sin(radians(loc.lng - $3::float8) / 2), 2)
		)))
	END`

// viewSelect expects $1 = viewer id, $2/$3 = origin lat/lng (nullable).
const viewSelect = `
	SELECT ` + `t.id, t.poster_id, t.category_id, t.title, t.description, t.budget_type, t.budget_min_minor,
		t.budget_max_minor, t.currency, t.is_remote, t.location_lat, t.location_lng, t.location_address,
		t.location_city, t.scheduled_at, t.status, t.assigned_application_id, t.assigned_applicant_id,
		t.assigned_at, t.completed_at, t.cancelled_at, t.created_at, t.updated_at,
		t.en_route_at, t.started_at, t.worker_lat, t.worker_lng, t.worker_location_at, t.route_eta_seconds,
		c.slug, c.name, c.icon, c.color,
		p.full_name, p.avatar_url, p.email, p.phone, p.rating_sum, p.rating_count,
		(SELECT count(*) FROM applications x WHERE x.task_id = t.id AND x.status IN ('pending','accepted')),
		va.id, va.status, va.price_minor,
		d.km, ag.price_minor,
		ass.full_name, ass.avatar_url, ass.email, ass.phone, ass.rating_sum, ass.rating_count
	FROM tasks t
	JOIN categories c ON c.id = t.category_id
	JOIN users p ON p.id = t.poster_id
	LEFT JOIN users ass ON ass.id = t.assigned_applicant_id
	LEFT JOIN applications ag ON ag.id = t.assigned_application_id
	LEFT JOIN applications va ON va.task_id = t.id AND va.applicant_id = $1
	CROSS JOIN LATERAL (` + visibleLocation + `) loc
	CROSS JOIN LATERAL (SELECT ` + haversineKm + ` AS km) d`

func scanView(row rowScanner) (*task.View, error) {
	var (
		v                   task.View
		vaID                *uuid.UUID
		vaStatus            *string
		vaPrice             *int64
		assName, assEmail   *string
		assSum, assCount    *int
		assAvatar, assPhone *string
		posterPhone         *string
	)
	dest, finish := taskScanTargets(&v.Task)
	dest = append(dest,
		&v.Category.Slug, &v.Category.Name, &v.Category.Icon, &v.Category.Color,
		&v.Poster.FullName, &v.Poster.AvatarURL, &v.Poster.Email, &posterPhone,
		&v.Poster.Rating.Sum, &v.Poster.Rating.Count,
		&v.ApplicationsCount,
		&vaID, &vaStatus, &vaPrice,
		&v.DistanceKm, &v.AgreedPriceMinor,
		&assName, &assAvatar, &assEmail, &assPhone, &assSum, &assCount,
	)
	if err := row.Scan(dest...); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, task.ErrNotFound
		}
		return nil, err
	}
	finish()
	v.Category.ID = v.CategoryID
	v.Poster.ID = v.PosterID
	v.Poster.Phone = posterPhone
	if vaID != nil && vaStatus != nil && vaPrice != nil {
		v.ViewerApplication = &task.ViewerApplication{ID: *vaID, Status: task.ApplicationStatus(*vaStatus), PriceMinor: *vaPrice}
	}
	if v.AssignedApplicantID != nil && assName != nil {
		v.AssignedApplicant = &task.Party{ID: *v.AssignedApplicantID, FullName: *assName, AvatarURL: assAvatar, Phone: assPhone}
		if assEmail != nil {
			v.AssignedApplicant.Email = *assEmail
		}
		if assSum != nil && assCount != nil {
			v.AssignedApplicant.Rating = valueobjects.Rating{Sum: *assSum, Count: *assCount}
		}
	}
	return &v, nil
}

func originArgs(o *valueobjects.Coordinates) (lat, lng *float64) {
	if o == nil {
		return nil, nil
	}
	return &o.Lat, &o.Lng
}

func (r *TaskRepo) GetView(ctx context.Context, id, viewerID uuid.UUID, origin *valueobjects.Coordinates) (*task.View, error) {
	lat, lng := originArgs(origin)
	return scanView(r.pool.QueryRow(ctx, viewSelect+` WHERE t.id = $4`, viewerID, lat, lng, id))
}

// likePattern escapes LIKE wildcards in user input.
func likePattern(q string) string {
	r := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return "%" + r.Replace(q) + "%"
}

func (r *TaskRepo) Search(ctx context.Context, f task.SearchFilter) ([]task.View, error) {
	lat, lng := originArgs(f.Origin)
	args := []any{f.ViewerID, lat, lng}
	var where []string
	add := func(cond string, v any) {
		args = append(args, v)
		where = append(where, strings.ReplaceAll(cond, "?", fmt.Sprintf("$%d", len(args))))
	}

	statuses := f.Statuses
	if len(statuses) == 0 {
		statuses = []task.Status{task.StatusOpen}
	}
	names := make([]string, len(statuses))
	for i, s := range statuses {
		names[i] = string(s)
	}
	add("t.status = ANY(?)", names)

	if f.PosterID != nil {
		add("t.poster_id = ?", *f.PosterID)
	}
	if f.AssigneeID != nil {
		add("t.assigned_applicant_id = ?", *f.AssigneeID)
	}
	if f.ExcludePosterID != nil {
		add("t.poster_id <> ?", *f.ExcludePosterID)
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		add(`(t.title ILIKE ? OR t.description ILIKE ?)`, likePattern(q))
	}
	if f.CategoryID != nil {
		add("t.category_id = ?", *f.CategoryID)
	}
	if f.MaxDistanceKm != nil && f.Origin != nil {
		add("(t.is_remote OR d.km <= ?)", *f.MaxDistanceKm)
	}

	order := `t.created_at DESC, t.id`
	if f.Sort == task.SortDistance && f.Origin != nil {
		order = `d.km ASC NULLS LAST, t.created_at DESC, t.id`
	}

	args = append(args, f.Limit, f.Offset)
	sql := viewSelect + ` WHERE ` + strings.Join(where, " AND ") +
		` ORDER BY ` + order +
		fmt.Sprintf(` LIMIT $%d OFFSET $%d`, len(args)-1, len(args))

	rows, err := r.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	views := make([]task.View, 0, f.Limit)
	for rows.Next() {
		v, err := scanView(rows)
		if err != nil {
			return nil, err
		}
		views = append(views, *v)
	}
	return views, rows.Err()
}

func (r *TaskRepo) Categories(ctx context.Context) ([]task.Category, error) {
	rows, err := r.pool.Query(ctx, `SELECT id, slug, name, icon, color FROM categories WHERE is_active ORDER BY sort_order`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []task.Category
	for rows.Next() {
		var c task.Category
		if err := rows.Scan(&c.ID, &c.Slug, &c.Name, &c.Icon, &c.Color); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *TaskRepo) CategoryExists(ctx context.Context, id uuid.UUID) (bool, error) {
	var ok bool
	err := r.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM categories WHERE id=$1 AND is_active)`, id).Scan(&ok)
	return ok, err
}
