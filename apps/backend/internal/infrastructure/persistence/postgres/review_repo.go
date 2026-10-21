package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/yourtime/backend/internal/domain/review"
	"github.com/yourtime/backend/internal/domain/user"
)

type ReviewRepo struct {
	pool *pgxpool.Pool
}

func NewReviewRepo(pool *pgxpool.Pool) *ReviewRepo { return &ReviewRepo{pool: pool} }

var _ review.Repository = (*ReviewRepo)(nil)

const reviewColumns = `id, task_id, reviewer_id, reviewee_id, rating, comment, reply, replied_at, created_at`

func scanReview(row rowScanner) (*review.Review, error) {
	var r review.Review
	var rating int16
	if err := row.Scan(&r.ID, &r.TaskID, &r.ReviewerID, &r.RevieweeID, &rating, &r.Comment, &r.Reply, &r.RepliedAt, &r.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, review.ErrNotFound
		}
		return nil, err
	}
	r.Rating = int(rating)
	return &r, nil
}

func (r *ReviewRepo) Create(ctx context.Context, rv *review.Review) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	_, err = tx.Exec(ctx, `
		INSERT INTO reviews (`+reviewColumns+`)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		rv.ID, rv.TaskID, rv.ReviewerID, rv.RevieweeID, int16(rv.Rating), rv.Comment, rv.Reply, rv.RepliedAt, rv.CreatedAt)
	if err != nil {
		if isUniqueViolation(err, "reviews_one_per_reviewer") {
			return review.ErrAlreadyReviewed
		}
		return err
	}
	// Same transaction: the totals can never disagree with the reviews.
	if _, err := tx.Exec(ctx,
		`UPDATE users SET rating_sum = rating_sum + $2, rating_count = rating_count + 1 WHERE id = $1`,
		rv.RevieweeID, rv.Rating); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *ReviewRepo) Get(ctx context.Context, id uuid.UUID) (*review.Review, error) {
	return scanReview(r.pool.QueryRow(ctx, `SELECT `+reviewColumns+` FROM reviews WHERE id = $1`, id))
}

func (r *ReviewRepo) Reply(ctx context.Context, id uuid.UUID, text string, now time.Time) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE reviews SET reply = $2, replied_at = $3 WHERE id = $1 AND reply IS NULL`, id, text, now)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return review.ErrAlreadyReplied
	}
	return nil
}

func (r *ReviewRepo) ByTask(ctx context.Context, taskID uuid.UUID) ([]review.Review, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+reviewColumns+` FROM reviews WHERE task_id = $1 ORDER BY created_at`, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []review.Review
	for rows.Next() {
		rv, err := scanReview(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *rv)
	}
	return out, rows.Err()
}

func (r *ReviewRepo) ListForUser(ctx context.Context, userID uuid.UUID, limit, offset int) ([]review.View, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT rv.id, rv.task_id, rv.reviewer_id, rv.reviewee_id, rv.rating, rv.comment, rv.reply, rv.replied_at, rv.created_at,
			u.full_name, u.avatar_url, u.rating_sum, u.rating_count, t.title
		FROM reviews rv
		JOIN users u ON u.id = rv.reviewer_id
		JOIN tasks t ON t.id = rv.task_id
		WHERE rv.reviewee_id = $1
		ORDER BY rv.created_at DESC, rv.id
		LIMIT $2 OFFSET $3`, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []review.View{}
	for rows.Next() {
		var (
			v      review.View
			rating int16
		)
		if err := rows.Scan(&v.ID, &v.TaskID, &v.ReviewerID, &v.RevieweeID, &rating, &v.Comment, &v.Reply, &v.RepliedAt, &v.CreatedAt,
			&v.Reviewer.FullName, &v.Reviewer.AvatarURL, &v.Reviewer.Rating.Sum, &v.Reviewer.Rating.Count, &v.TaskTitle); err != nil {
			return nil, err
		}
		v.Rating = int(rating)
		v.Reviewer.ID = v.ReviewerID
		out = append(out, v)
	}
	return out, rows.Err()
}

func (r *ReviewRepo) Profile(ctx context.Context, userID uuid.UUID) (*review.Profile, error) {
	var (
		p      review.Profile
		status string
		rel    reliabilityScan
	)
	dest := []any{&p.ID, &p.FullName, &p.AvatarURL, &p.Bio, &p.Rating.Sum, &p.Rating.Count, &p.MemberSince, &status}
	err := r.pool.QueryRow(ctx,
		`SELECT u.id, u.full_name, u.avatar_url, u.bio, u.rating_sum, u.rating_count, u.created_at, u.status, `+
			reliabilityColumns+` FROM users u`+reliabilityJoin("u.id")+` WHERE u.id = $1`, userID,
	).Scan(append(dest, rel.dest()...)...)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, user.ErrNotFound
		}
		return nil, err
	}
	// A suspended account has no public profile.
	if user.Status(status) != user.StatusActive {
		return nil, user.ErrNotFound
	}
	p.Reliability = rel.value()
	return &p, nil
}
