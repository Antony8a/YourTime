// Package task is the core domain: people publish tasks, others apply, and the
// publisher chooses exactly one applicant.
//
// Status machine (the live service steps are in service_lifecycle.go):
//
//	open --accept--> assigned --> en_route --> in_progress --> completed
//	  |                  |            |
//	  +-----cancel-------+---cancel---+--> cancelled   (not once in progress)
package task

import (
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
)

type Status string

const (
	StatusOpen       Status = "open"
	StatusAssigned   Status = "assigned"
	StatusEnRoute    Status = "en_route"
	StatusInProgress Status = "in_progress"
	StatusCompleted  Status = "completed"
	StatusCancelled  Status = "cancelled"
)

func (s Status) IsValid() bool {
	switch s {
	case StatusOpen, StatusAssigned, StatusEnRoute, StatusInProgress, StatusCompleted, StatusCancelled:
		return true
	}
	return false
}

type BudgetType string

const (
	// BudgetFixed is a total price range for the whole job.
	BudgetFixed BudgetType = "fixed"
	// BudgetHourly is a price range per hour.
	BudgetHourly BudgetType = "hourly"
	// BudgetNegotiable means no stated price; applicants propose one.
	BudgetNegotiable BudgetType = "negotiable"
)

func (b BudgetType) IsValid() bool {
	switch b {
	case BudgetFixed, BudgetHourly, BudgetNegotiable:
		return true
	}
	return false
}

// MaxAmountMinor guards against absurd values (and int64 overflow downstream).
const MaxAmountMinor int64 = 1_000_000_000_000

const (
	maxTitleLen       = 200
	maxDescriptionLen = 5000
)

// Budget amounts are minor units (cents) of Currency, the poster's account
// currency at publication time. No conversion happens inside the platform:
// payment is settled directly between the two people.
type Budget struct {
	Type     BudgetType
	MinMinor *int64
	MaxMinor *int64
	Currency valueobjects.Currency
}

func (b Budget) validate() error {
	if !b.Type.IsValid() {
		return ErrInvalidBudget
	}
	if (b.MinMinor == nil) != (b.MaxMinor == nil) {
		return ErrInvalidBudget
	}
	if b.Type != BudgetNegotiable && b.MinMinor == nil {
		return ErrInvalidBudget
	}
	if b.MinMinor != nil {
		lo, hi := *b.MinMinor, *b.MaxMinor
		if lo <= 0 || hi < lo || hi > MaxAmountMinor {
			return ErrInvalidBudget
		}
	}
	return nil
}

// Place is where the task happens. Nil for fully remote tasks.
type Place struct {
	Coordinates valueobjects.Coordinates
	Address     string
	City        string
}

type Task struct {
	ID          uuid.UUID
	PosterID    uuid.UUID
	CategoryID  uuid.UUID
	Title       string
	Description string
	Budget      Budget
	IsRemote    bool
	Place       *Place
	ScheduledAt *time.Time
	Status      Status

	AssignedApplicationID *uuid.UUID
	AssignedApplicantID   *uuid.UUID
	AssignedAt            *time.Time
	EnRouteAt             *time.Time
	StartedAt             *time.Time
	CompletedAt           *time.Time
	// WorkerLocation is the worker's last reported position, only while active.
	WorkerLocation *WorkerLocation
	CancelledAt    *time.Time

	CreatedAt time.Time
	UpdatedAt time.Time
}

type NewTaskInput struct {
	PosterID    uuid.UUID
	CategoryID  uuid.UUID
	Title       string
	Description string
	Budget      Budget
	IsRemote    bool
	Place       *Place
	ScheduledAt *time.Time
}

func New(in NewTaskInput, now time.Time) (*Task, error) {
	t := &Task{
		ID:         uuid.New(),
		PosterID:   in.PosterID,
		CategoryID: in.CategoryID,
		Status:     StatusOpen,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := t.setContent(in, now); err != nil {
		return nil, err
	}
	return t, nil
}

func (t *Task) setContent(in NewTaskInput, now time.Time) error {
	title := strings.TrimSpace(in.Title)
	description := strings.TrimSpace(in.Description)
	if title == "" || utf8.RuneCountInString(title) > maxTitleLen {
		return ErrInvalidTitle
	}
	if description == "" || utf8.RuneCountInString(description) > maxDescriptionLen {
		return ErrInvalidDescription
	}
	if err := in.Budget.validate(); err != nil {
		return err
	}
	if !in.IsRemote && in.Place == nil {
		return ErrInvalidLocation
	}
	if in.ScheduledAt != nil && in.ScheduledAt.Before(now.Add(-time.Hour)) {
		return ErrPastSchedule
	}
	t.CategoryID = in.CategoryID
	t.Title, t.Description, t.Budget = title, description, in.Budget
	t.IsRemote, t.Place, t.ScheduledAt = in.IsRemote, in.Place, in.ScheduledAt
	t.UpdatedAt = now
	return nil
}

// Edit replaces the editable content. Only the poster, only while open.
func (t *Task) Edit(actor uuid.UUID, in NewTaskInput, now time.Time) error {
	if actor != t.PosterID {
		return ErrNotOwner
	}
	if t.Status != StatusOpen {
		return ErrInvalidTransition
	}
	return t.setContent(in, now)
}

// Cancel is the poster calling the task off. It is allowed until the service
// starts; once work is under way it must be completed instead.
func (t *Task) Cancel(actor uuid.UUID, now time.Time) error {
	if actor != t.PosterID {
		return ErrNotOwner
	}
	if t.Status != StatusOpen && t.Status != StatusAssigned && t.Status != StatusEnRoute {
		return ErrInvalidTransition
	}
	t.Status = StatusCancelled
	t.CancelledAt = &now
	t.UpdatedAt = now
	t.clearLive()
	return nil
}

// Assign records the chosen applicant. Called inside the accept transaction.
func (t *Task) Assign(actor uuid.UUID, app *Application, now time.Time) error {
	if actor != t.PosterID {
		return ErrNotOwner
	}
	if t.Status != StatusOpen {
		return ErrTaskNotOpen
	}
	if app.TaskID != t.ID {
		return ErrApplicationNotFound
	}
	if app.Status != ApplicationPending {
		return ErrApplicationNotOpen
	}
	t.Status = StatusAssigned
	t.AssignedApplicationID = &app.ID
	t.AssignedApplicantID = &app.ApplicantID
	t.AssignedAt = &now
	t.UpdatedAt = now
	return nil
}

// CanReceiveApplicationsFrom reports whether applicant may apply right now.
// Distance is deliberately absent: it informs the decision, it never gates it.
func (t *Task) CanReceiveApplicationsFrom(applicant uuid.UUID) error {
	if applicant == t.PosterID {
		return ErrOwnTask
	}
	if t.Status != StatusOpen {
		return ErrTaskNotOpen
	}
	return nil
}
