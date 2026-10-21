// Package review is the reputation domain: after a task is completed, the
// poster and the chosen applicant each rate the other from 1 to 5 stars with an
// optional comment, and the person who was rated may answer once.
package review

import (
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	derr "github.com/yourtime/backend/internal/domain/common/errors"
)

const (
	MinRating  = 1
	MaxRating  = 5
	MaxComment = 1000
	MaxReply   = 1000
)

var (
	ErrNotFound         = derr.New(derr.ErrNotFound, "review_not_found", "review not found")
	ErrNotParticipant   = derr.New(derr.ErrForbidden, "not_task_participant", "only the poster and the chosen applicant can review this task")
	ErrNotReviewee      = derr.New(derr.ErrForbidden, "not_reviewee", "only the person who was reviewed can reply")
	ErrTaskNotCompleted = derr.New(derr.ErrConflict, "task_not_completed", "reviews open once the task is completed")
	ErrAlreadyReviewed  = derr.New(derr.ErrConflict, "already_reviewed", "you already reviewed this task")
	ErrAlreadyReplied   = derr.New(derr.ErrConflict, "already_replied", "this review already has a reply")
	ErrInvalidRating    = derr.New(derr.ErrInvalidInput, "invalid_rating", "rating must be a whole number from 1 to 5")
	ErrInvalidComment   = derr.New(derr.ErrInvalidInput, "invalid_comment", "comment is too long (max 1000 characters)")
	ErrInvalidReply     = derr.New(derr.ErrInvalidInput, "invalid_reply", "reply is required (max 1000 characters)")
)

type Review struct {
	ID         uuid.UUID
	TaskID     uuid.UUID
	ReviewerID uuid.UUID
	RevieweeID uuid.UUID
	Rating     int
	Comment    string
	Reply      *string
	RepliedAt  *time.Time
	CreatedAt  time.Time
}

// Counterpart returns who actor must review for a task, or why they cannot.
// Only the poster and the chosen applicant take part, and only once the task is
// completed. Participation is checked first so outsiders learn nothing about
// the task's state.
func Counterpart(actor, posterID uuid.UUID, assignedApplicantID *uuid.UUID, completed bool) (uuid.UUID, error) {
	var other uuid.UUID
	switch {
	case actor == posterID && assignedApplicantID != nil:
		other = *assignedApplicantID
	case assignedApplicantID != nil && actor == *assignedApplicantID:
		other = posterID
	default:
		return uuid.Nil, ErrNotParticipant
	}
	if !completed {
		return uuid.Nil, ErrTaskNotCompleted
	}
	return other, nil
}

func New(taskID, reviewer, reviewee uuid.UUID, rating int, comment string, now time.Time) (*Review, error) {
	if rating < MinRating || rating > MaxRating {
		return nil, ErrInvalidRating
	}
	comment = strings.TrimSpace(comment)
	if utf8.RuneCountInString(comment) > MaxComment {
		return nil, ErrInvalidComment
	}
	return &Review{
		ID:         uuid.New(),
		TaskID:     taskID,
		ReviewerID: reviewer,
		RevieweeID: reviewee,
		Rating:     rating,
		Comment:    comment,
		CreatedAt:  now,
	}, nil
}

// PrepareReply checks that actor may answer this review and returns the
// cleaned text. Only the reviewee can reply, and only once.
func (r *Review) PrepareReply(actor uuid.UUID, text string) (string, error) {
	if actor != r.RevieweeID {
		return "", ErrNotReviewee
	}
	if r.Reply != nil {
		return "", ErrAlreadyReplied
	}
	text = strings.TrimSpace(text)
	if text == "" || utf8.RuneCountInString(text) > MaxReply {
		return "", ErrInvalidReply
	}
	return text, nil
}
