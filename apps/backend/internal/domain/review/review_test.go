package review

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
)

var now = time.Date(2026, 1, 10, 12, 0, 0, 0, time.UTC)

func TestCounterpart(t *testing.T) {
	poster, worker, stranger := uuid.New(), uuid.New(), uuid.New()

	cases := []struct {
		name      string
		actor     uuid.UUID
		assigned  *uuid.UUID
		completed bool
		want      uuid.UUID
		wantErr   error
	}{
		{"poster reviews the chosen applicant", poster, &worker, true, worker, nil},
		{"chosen applicant reviews the poster", worker, &worker, true, poster, nil},
		{"outsider cannot review", stranger, &worker, true, uuid.Nil, ErrNotParticipant},
		{"nobody was chosen, nobody to review", poster, nil, true, uuid.Nil, ErrNotParticipant},
		{"not completed yet", poster, &worker, false, uuid.Nil, ErrTaskNotCompleted},
		// An outsider must not learn whether the task is completed.
		{"outsider on an open task still sees forbidden", stranger, &worker, false, uuid.Nil, ErrNotParticipant},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := Counterpart(c.actor, poster, c.assigned, c.completed)
			if !errors.Is(err, c.wantErr) && !(c.wantErr == nil && err == nil) {
				t.Fatalf("error: got %v, want %v", err, c.wantErr)
			}
			if got != c.want {
				t.Fatalf("counterpart: got %v, want %v", got, c.want)
			}
		})
	}
}

func TestNewValidatesRatingAndComment(t *testing.T) {
	task, a, b := uuid.New(), uuid.New(), uuid.New()

	for _, bad := range []int{0, -1, 6, 100} {
		if _, err := New(task, a, b, bad, "", now); !errors.Is(err, ErrInvalidRating) {
			t.Errorf("rating %d: got %v", bad, err)
		}
	}
	for good := MinRating; good <= MaxRating; good++ {
		if _, err := New(task, a, b, good, "", now); err != nil {
			t.Errorf("rating %d rejected: %v", good, err)
		}
	}
	if _, err := New(task, a, b, 5, strings.Repeat("x", MaxComment+1), now); !errors.Is(err, ErrInvalidComment) {
		t.Errorf("long comment: %v", err)
	}
	r, err := New(task, a, b, 4, "  Muy puntual  ", now)
	if err != nil || r.Comment != "Muy puntual" || r.Reply != nil {
		t.Fatalf("comment must be trimmed and start without a reply: %+v %v", r, err)
	}
}

func TestReplyRules(t *testing.T) {
	reviewer, reviewee, stranger := uuid.New(), uuid.New(), uuid.New()
	r, _ := New(uuid.New(), reviewer, reviewee, 3, "", now)

	if _, err := r.PrepareReply(reviewer, "gracias"); !errors.Is(err, ErrNotReviewee) {
		t.Fatalf("the author cannot reply to their own review: %v", err)
	}
	if _, err := r.PrepareReply(stranger, "hola"); !errors.Is(err, ErrNotReviewee) {
		t.Fatalf("a stranger cannot reply: %v", err)
	}
	for _, bad := range []string{"", "   ", strings.Repeat("x", MaxReply+1)} {
		if _, err := r.PrepareReply(reviewee, bad); !errors.Is(err, ErrInvalidReply) {
			t.Errorf("reply %q: %v", bad, err)
		}
	}
	text, err := r.PrepareReply(reviewee, "  Gracias por el comentario  ")
	if err != nil || text != "Gracias por el comentario" {
		t.Fatalf("valid reply: %q %v", text, err)
	}

	answered := "ya respondí"
	r.Reply = &answered
	if _, err := r.PrepareReply(reviewee, "otra vez"); !errors.Is(err, ErrAlreadyReplied) {
		t.Fatalf("only one reply allowed: %v", err)
	}
}

func TestRatingAverage(t *testing.T) {
	cases := []struct {
		sum, count int
		want       float64
	}{
		{0, 0, 0},
		{5, 1, 5},
		{14, 3, 4.7}, // 4.666… rounds up
		{13, 3, 4.3}, // 4.333… rounds down
		{9, 2, 4.5},
		{1, 1, 1},
	}
	for _, c := range cases {
		if got := (valueobjects.Rating{Sum: c.sum, Count: c.count}).Average(); got != c.want {
			t.Errorf("%d/%d: got %v, want %v", c.sum, c.count, got, c.want)
		}
	}
}
