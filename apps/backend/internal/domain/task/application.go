package task

import (
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
)

type ApplicationStatus string

const (
	ApplicationPending   ApplicationStatus = "pending"
	ApplicationAccepted  ApplicationStatus = "accepted"
	ApplicationRejected  ApplicationStatus = "rejected"
	ApplicationWithdrawn ApplicationStatus = "withdrawn"
)

const maxMessageLen = 2000

// Application is a person's offer to do a task for a proposed price, expressed
// in the task's currency.
type Application struct {
	ID          uuid.UUID
	TaskID      uuid.UUID
	ApplicantID uuid.UUID
	PriceMinor  int64
	Message     string
	Status      ApplicationStatus
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func NewApplication(t *Task, applicant uuid.UUID, priceMinor int64, message string, now time.Time) (*Application, error) {
	if err := t.CanReceiveApplicationsFrom(applicant); err != nil {
		return nil, err
	}
	if priceMinor <= 0 || priceMinor > MaxAmountMinor {
		return nil, ErrInvalidPrice
	}
	message = strings.TrimSpace(message)
	if utf8.RuneCountInString(message) > maxMessageLen {
		return nil, ErrInvalidMessage
	}
	return &Application{
		ID:          uuid.New(),
		TaskID:      t.ID,
		ApplicantID: applicant,
		PriceMinor:  priceMinor,
		Message:     message,
		Status:      ApplicationPending,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

// CanBeRejectedBy checks that actor is the task poster and the offer is pending.
func (a *Application) CanBeRejectedBy(posterID, actor uuid.UUID) error {
	if actor != posterID {
		return ErrNotOwner
	}
	if a.Status != ApplicationPending {
		return ErrApplicationNotOpen
	}
	return nil
}

// CanBeWithdrawnBy checks that actor is the applicant and the offer is pending.
// An accepted offer is not withdrawable: the two people must coordinate, and
// the poster can cancel the task.
func (a *Application) CanBeWithdrawnBy(actor uuid.UUID) error {
	if actor != a.ApplicantID {
		return ErrNotApplicant
	}
	if a.Status != ApplicationPending {
		return ErrApplicationNotOpen
	}
	return nil
}
