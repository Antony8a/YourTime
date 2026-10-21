package task

import (
	"time"

	"github.com/google/uuid"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
)

// The live service: once a task is assigned, the chosen applicant performs it
// step by step, like a ride. The poster follows along.
//
//	assigned --start route--> en_route --start service--> in_progress --complete--> completed
//	   (on-site tasks only)       |
//	   remote tasks skip the route: assigned --start service--> in_progress
//
// A person can have at most one active service as client and one as worker;
// the database enforces it (see migration 00003), so concurrent choices cannot
// break it.

// WorkerLocation is where the person doing the service last reported being.
// It exists only while the service is active and is erased afterwards.
type WorkerLocation struct {
	Coordinates valueobjects.Coordinates
	At          time.Time
}

// Action is something a person may do next on a task. The API sends the list so
// clients do not have to re-implement the rules.
type Action string

const (
	ActionEdit         Action = "edit"
	ActionCancel       Action = "cancel"
	ActionStartRoute   Action = "start_route"
	ActionStartService Action = "start_service"
	ActionComplete     Action = "complete"
	ActionRelease      Action = "release"
)

// IsActive reports whether a service is under way or about to start.
func (s Status) IsActive() bool {
	return s == StatusAssigned || s == StatusEnRoute || s == StatusInProgress
}

func (t *Task) isWorker(id uuid.UUID) bool {
	return t.AssignedApplicantID != nil && *t.AssignedApplicantID == id
}

func (t *Task) clearLive() { t.WorkerLocation = nil }

// StartRoute is the worker leaving for the task. It needs their position, which
// is how the poster starts seeing them on the map. Remote tasks have no route.
func (t *Task) StartRoute(actor uuid.UUID, at valueobjects.Coordinates, now time.Time) error {
	if !t.isWorker(actor) {
		return ErrNotAssignedWorker
	}
	if t.Status != StatusAssigned || t.IsRemote {
		return ErrInvalidTransition
	}
	t.Status = StatusEnRoute
	t.EnRouteAt = &now
	t.WorkerLocation = &WorkerLocation{Coordinates: at, At: now}
	t.UpdatedAt = now
	return nil
}

// StartService is the worker beginning the job. On-site tasks require the route
// to have started first; remote tasks start straight from assigned.
func (t *Task) StartService(actor uuid.UUID, now time.Time) error {
	if !t.isWorker(actor) {
		return ErrNotAssignedWorker
	}
	switch {
	case t.Status == StatusAssigned && !t.IsRemote:
		return ErrRouteNotStarted
	case t.Status != StatusEnRoute && !(t.Status == StatusAssigned && t.IsRemote):
		return ErrInvalidTransition
	}
	t.Status = StatusInProgress
	t.StartedAt = &now
	t.UpdatedAt = now
	return nil
}

// UpdateWorkerLocation records the worker's current position while travelling
// or working. Only the worker can report it.
func (t *Task) UpdateWorkerLocation(actor uuid.UUID, at valueobjects.Coordinates, now time.Time) error {
	if !t.isWorker(actor) {
		return ErrNotAssignedWorker
	}
	if t.Status != StatusEnRoute && t.Status != StatusInProgress {
		return ErrInvalidTransition
	}
	t.WorkerLocation = &WorkerLocation{Coordinates: at, At: now}
	return nil
}

// Complete ends the service. The worker normally does it; the poster may also
// confirm, so a worker who forgets cannot keep the poster blocked forever.
func (t *Task) Complete(actor uuid.UUID, now time.Time) error {
	if actor != t.PosterID && !t.isWorker(actor) {
		return ErrNotOwner
	}
	if t.Status != StatusInProgress {
		return ErrInvalidTransition
	}
	t.Status = StatusCompleted
	t.CompletedAt = &now
	t.UpdatedAt = now
	t.clearLive()
	return nil
}

// Release is the worker giving the task back before starting it. The task goes
// back to open so the poster can choose someone else, and the worker is free.
func (t *Task) Release(actor uuid.UUID, now time.Time) error {
	if !t.isWorker(actor) {
		return ErrNotAssignedWorker
	}
	if t.Status != StatusAssigned && t.Status != StatusEnRoute {
		return ErrInvalidTransition
	}
	t.Status = StatusOpen
	t.AssignedApplicationID, t.AssignedApplicantID, t.AssignedAt = nil, nil, nil
	t.EnRouteAt = nil
	t.clearLive()
	t.UpdatedAt = now
	return nil
}

// AvailableActions lists what viewer can do right now, from the rules above.
func (t *Task) AvailableActions(viewer uuid.UUID) []Action {
	actions := []Action{}
	switch {
	case viewer == t.PosterID:
		switch t.Status {
		case StatusOpen:
			actions = append(actions, ActionEdit, ActionCancel)
		case StatusAssigned, StatusEnRoute:
			actions = append(actions, ActionCancel)
		case StatusInProgress:
			actions = append(actions, ActionComplete)
		}
	case t.isWorker(viewer):
		switch t.Status {
		case StatusAssigned:
			if t.IsRemote {
				actions = append(actions, ActionStartService, ActionRelease)
			} else {
				actions = append(actions, ActionStartRoute, ActionRelease)
			}
		case StatusEnRoute:
			actions = append(actions, ActionStartService, ActionRelease)
		case StatusInProgress:
			actions = append(actions, ActionComplete)
		}
	}
	return actions
}
