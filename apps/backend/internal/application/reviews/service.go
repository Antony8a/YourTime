// Package reviews holds the use cases for rating the other person once a task
// is completed, replying to a review and reading public profiles.
package reviews

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/yourtime/backend/internal/domain/review"
	"github.com/yourtime/backend/internal/domain/task"
)

const (
	DefaultPageSize = 20
	MaxPageSize     = 50
)

type Service struct {
	reviews review.Repository
	tasks   task.Repository
	now     func() time.Time
}

func NewService(reviews review.Repository, tasks task.Repository) *Service {
	return &Service{reviews: reviews, tasks: tasks, now: func() time.Time { return time.Now().UTC() }}
}

// Create lets the poster or the chosen applicant rate the other person for a
// completed task.
func (s *Service) Create(ctx context.Context, actor, taskID uuid.UUID, rating int, comment string) (*review.Review, error) {
	t, err := s.tasks.GetView(ctx, taskID, actor, nil)
	if err != nil {
		return nil, err
	}
	reviewee, err := review.Counterpart(actor, t.PosterID, t.AssignedApplicantID, t.Status == task.StatusCompleted)
	if err != nil {
		return nil, err
	}
	r, err := review.New(taskID, actor, reviewee, rating, comment, s.now())
	if err != nil {
		return nil, err
	}
	if err := s.reviews.Create(ctx, r); err != nil {
		return nil, err
	}
	return r, nil
}

// Reply lets the reviewed person answer a review once.
func (s *Service) Reply(ctx context.Context, actor, reviewID uuid.UUID, text string) (*review.Review, error) {
	r, err := s.reviews.Get(ctx, reviewID)
	if err != nil {
		return nil, err
	}
	clean, err := r.PrepareReply(actor, text)
	if err != nil {
		return nil, err
	}
	now := s.now()
	if err := s.reviews.Reply(ctx, reviewID, clean, now); err != nil {
		return nil, err
	}
	r.Reply, r.RepliedAt = &clean, &now
	return r, nil
}

func (s *Service) Profile(ctx context.Context, userID uuid.UUID) (*review.Profile, error) {
	return s.reviews.Profile(ctx, userID)
}

// ForUser lists the reviews a person received. It fails with user.ErrNotFound
// for unknown or suspended accounts, matching Profile.
func (s *Service) ForUser(ctx context.Context, userID uuid.UUID, limit, offset int) ([]review.View, bool, error) {
	if _, err := s.reviews.Profile(ctx, userID); err != nil {
		return nil, false, err
	}
	if limit <= 0 {
		limit = DefaultPageSize
	}
	if limit > MaxPageSize {
		limit = MaxPageSize
	}
	if offset < 0 {
		offset = 0
	}
	list, err := s.reviews.ListForUser(ctx, userID, limit+1, offset)
	if err != nil {
		return nil, false, err
	}
	hasMore := len(list) > limit
	if hasMore {
		list = list[:limit]
	}
	return list, hasMore, nil
}
