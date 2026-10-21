package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
	"github.com/yourtime/backend/internal/domain/task"
)

type ApplicationRepo struct {
	pool *pgxpool.Pool
}

func NewApplicationRepo(pool *pgxpool.Pool) *ApplicationRepo { return &ApplicationRepo{pool: pool} }

var _ task.ApplicationRepository = (*ApplicationRepo)(nil)

const applicationSelect = `
	SELECT a.id, a.task_id, a.applicant_id, a.price_minor, a.message, a.status, a.created_at, a.updated_at,
		u.full_name, u.avatar_url, u.email, u.phone, u.rating_sum, u.rating_count,
		t.poster_id, t.title, t.status, t.currency, t.location_city, t.is_remote, pu.full_name,
		EXISTS (SELECT 1 FROM tasks bt WHERE bt.assigned_applicant_id = a.applicant_id
			AND bt.status IN ('assigned', 'en_route', 'in_progress'))
	FROM applications a
	JOIN users u ON u.id = a.applicant_id
	JOIN tasks t ON t.id = a.task_id
	JOIN users pu ON pu.id = t.poster_id`

func scanApplicationView(row rowScanner) (*task.ApplicationView, error) {
	var (
		v                        task.ApplicationView
		status, taskStatus, curr string
		city                     *string
	)
	err := row.Scan(&v.ID, &v.TaskID, &v.ApplicantID, &v.PriceMinor, &v.Message, &status, &v.CreatedAt, &v.UpdatedAt,
		&v.Applicant.FullName, &v.Applicant.AvatarURL, &v.Applicant.Email, &v.Applicant.Phone,
		&v.Applicant.Rating.Sum, &v.Applicant.Rating.Count,
		&v.Task.PosterID, &v.Task.Title, &taskStatus, &curr, &city, &v.Task.IsRemote, &v.Task.PosterName,
		&v.ApplicantBusy)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, task.ErrApplicationNotFound
		}
		return nil, err
	}
	v.Status = task.ApplicationStatus(status)
	v.Applicant.ID = v.ApplicantID
	v.Task.ID = v.TaskID
	v.Task.Status = task.Status(taskStatus)
	v.Task.Currency = valueobjects.Currency(curr)
	if city != nil {
		v.Task.City = *city
	}
	return &v, nil
}

func (r *ApplicationRepo) queryViews(ctx context.Context, sql string, args ...any) ([]task.ApplicationView, error) {
	rows, err := r.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []task.ApplicationView{}
	for rows.Next() {
		v, err := scanApplicationView(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *v)
	}
	return out, rows.Err()
}

func (r *ApplicationRepo) Get(ctx context.Context, id uuid.UUID) (*task.ApplicationView, error) {
	return scanApplicationView(r.pool.QueryRow(ctx, applicationSelect+` WHERE a.id = $1`, id))
}

func (r *ApplicationRepo) ListByTask(ctx context.Context, taskID uuid.UUID) ([]task.ApplicationView, error) {
	return r.queryViews(ctx, applicationSelect+`
		WHERE a.task_id = $1 AND a.status <> 'withdrawn'
		ORDER BY (a.status = 'accepted') DESC, a.created_at ASC`, taskID)
}

func (r *ApplicationRepo) ListByApplicant(ctx context.Context, applicantID uuid.UUID, limit, offset int) ([]task.ApplicationView, error) {
	return r.queryViews(ctx, applicationSelect+`
		WHERE a.applicant_id = $1 ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`, applicantID, limit, offset)
}

func (r *ApplicationRepo) Create(ctx context.Context, taskID uuid.UUID, build func(*task.Task) (*task.Application, error)) (*task.Application, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// FOR SHARE blocks concurrent cancel/accept (FOR UPDATE) until we commit,
	// so we never attach an application to a task that just stopped being open.
	t, err := scanTask(tx.QueryRow(ctx, `SELECT `+taskColumns+` FROM tasks WHERE id=$1 FOR SHARE`, taskID))
	if err != nil {
		return nil, err
	}
	app, err := build(t)
	if err != nil {
		return nil, err
	}

	// A person who withdrew may re-apply; anything else is a duplicate.
	var id uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO applications (id, task_id, applicant_id, price_minor, message, status, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT ON CONSTRAINT applications_unique_per_person DO UPDATE
			SET price_minor = EXCLUDED.price_minor, message = EXCLUDED.message,
				status = 'pending', updated_at = EXCLUDED.updated_at
			WHERE applications.status = 'withdrawn'
		RETURNING id`,
		app.ID, app.TaskID, app.ApplicantID, app.PriceMinor, app.Message, string(app.Status), app.CreatedAt, app.UpdatedAt,
	).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, task.ErrAlreadyApplied
		}
		return nil, err
	}
	app.ID = id
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return app, nil
}

func (r *ApplicationRepo) Transition(ctx context.Context, id uuid.UUID, to task.ApplicationStatus, now time.Time) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE applications SET status=$2, updated_at=$3 WHERE id=$1 AND status='pending'`, id, string(to), now)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return task.ErrApplicationNotOpen
	}
	return nil
}

func (r *ApplicationRepo) Accept(ctx context.Context, applicationID, actor uuid.UUID, now time.Time) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Lock order is always task, then applications, matching TaskRepo.Mutate.
	var taskID uuid.UUID
	if err := tx.QueryRow(ctx, `SELECT task_id FROM applications WHERE id=$1`, applicationID).Scan(&taskID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return task.ErrApplicationNotFound
		}
		return err
	}
	t, err := scanTask(tx.QueryRow(ctx, `SELECT `+taskColumns+` FROM tasks WHERE id=$1 FOR UPDATE`, taskID))
	if err != nil {
		return err
	}

	var (
		app    task.Application
		status string
	)
	err = tx.QueryRow(ctx, `
		SELECT id, task_id, applicant_id, price_minor, message, status, created_at, updated_at
		FROM applications WHERE id=$1 FOR UPDATE`, applicationID).
		Scan(&app.ID, &app.TaskID, &app.ApplicantID, &app.PriceMinor, &app.Message, &status, &app.CreatedAt, &app.UpdatedAt)
	if err != nil {
		return err
	}
	app.Status = task.ApplicationStatus(status)

	if err := t.Assign(actor, &app, now); err != nil {
		return err
	}
	if err := saveTask(ctx, tx, t); err != nil {
		// The unique indexes on active services are what stop a second concurrent
		// choice; translate them into the matching domain errors.
		return mapActiveServiceViolation(err)
	}
	if _, err := tx.Exec(ctx,
		`UPDATE applications SET status='accepted', updated_at=$2 WHERE id=$1`, app.ID, now); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE applications SET status='rejected', updated_at=$3 WHERE task_id=$1 AND id<>$2 AND status='pending'`,
		t.ID, app.ID, now); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// mapActiveServiceViolation turns a breach of "one active service at a time"
// into the domain error that tells the person which side is busy.
func mapActiveServiceViolation(err error) error {
	switch {
	case isUniqueViolation(err, "tasks_one_active_per_poster"):
		return task.ErrClientBusy
	case isUniqueViolation(err, "tasks_one_active_per_worker"):
		return task.ErrWorkerBusy
	}
	return err
}

func (r *ApplicationRepo) Release(ctx context.Context, taskID, actor uuid.UUID, now time.Time) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	t, err := scanTask(tx.QueryRow(ctx, `SELECT `+taskColumns+` FROM tasks WHERE id=$1 FOR UPDATE`, taskID))
	if err != nil {
		return err
	}
	chosen := t.AssignedApplicationID
	if err := t.Release(actor, now); err != nil {
		return err
	}
	if err := saveTask(ctx, tx, t); err != nil {
		return err
	}
	if chosen != nil {
		if _, err := tx.Exec(ctx,
			`UPDATE applications SET status='withdrawn', updated_at=$2 WHERE id=$1 AND status='accepted'`, *chosen, now); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
