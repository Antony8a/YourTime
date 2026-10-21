package review

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
)

// Person is the public face of a reviewer or a reviewed person.
type Person struct {
	ID        uuid.UUID
	FullName  string
	AvatarURL *string
	Rating    valueobjects.Rating
}

// View is a review enriched for display.
type View struct {
	Review
	Reviewer  Person
	TaskTitle string
}

// Profile is what anyone can see about a person: no contact details.
type Profile struct {
	Person
	Bio         *string
	MemberSince time.Time
}

type Repository interface {
	// Create stores the review and updates the reviewee's rating totals in one
	// transaction. It returns ErrAlreadyReviewed on a duplicate.
	Create(ctx context.Context, r *Review) error
	// Get returns ErrNotFound when the review does not exist.
	Get(ctx context.Context, id uuid.UUID) (*Review, error)
	// Reply stores the reviewee's answer, returning ErrAlreadyReplied if one exists.
	Reply(ctx context.Context, id uuid.UUID, text string, now time.Time) error
	// ByTask lists the (at most two) reviews written about a task.
	ByTask(ctx context.Context, taskID uuid.UUID) ([]Review, error)
	// ListForUser pages through the reviews a person received, newest first.
	ListForUser(ctx context.Context, userID uuid.UUID, limit, offset int) ([]View, error)
	// Profile returns the public profile, or user.ErrNotFound.
	Profile(ctx context.Context, userID uuid.UUID) (*Profile, error)
}
