package task

import (
	derr "github.com/yourtime/backend/internal/domain/common/errors"
)

var (
	ErrNotFound            = derr.New(derr.ErrNotFound, "task_not_found", "task not found")
	ErrApplicationNotFound = derr.New(derr.ErrNotFound, "application_not_found", "application not found")
	ErrCategoryNotFound    = derr.New(derr.ErrInvalidInput, "category_not_found", "category not found")

	ErrNotOwner           = derr.New(derr.ErrForbidden, "not_owner", "only the person who posted the task can do this")
	ErrNotApplicant       = derr.New(derr.ErrForbidden, "not_applicant", "only the applicant can do this")
	ErrOwnTask            = derr.New(derr.ErrForbidden, "own_task", "you cannot apply to your own task")
	ErrTaskNotOpen        = derr.New(derr.ErrConflict, "task_not_open", "task is not open for applications")
	ErrInvalidTransition  = derr.New(derr.ErrConflict, "invalid_transition", "action not allowed in the current task status")
	ErrAlreadyApplied     = derr.New(derr.ErrConflict, "already_applied", "you already applied to this task")
	ErrNotAssignedWorker  = derr.New(derr.ErrForbidden, "not_assigned_worker", "only the person doing this service can do this")
	ErrClientBusy         = derr.New(derr.ErrConflict, "client_busy", "you already have a service in progress; finish it before hiring another")
	ErrWorkerBusy         = derr.New(derr.ErrConflict, "worker_busy", "this person is already doing another service")
	ErrRouteNotStarted    = derr.New(derr.ErrConflict, "route_not_started", "start the route before starting the service")
	ErrApplicationNotOpen = derr.New(derr.ErrConflict, "application_not_open", "application is no longer pending")

	ErrInvalidTitle       = derr.New(derr.ErrInvalidInput, "invalid_title", "title is required (max 200 characters)")
	ErrInvalidDescription = derr.New(derr.ErrInvalidInput, "invalid_description", "description is required (max 5000 characters)")
	ErrInvalidBudget      = derr.New(derr.ErrInvalidInput, "invalid_budget", "invalid budget: amounts must be positive and max >= min")
	ErrInvalidLocation    = derr.New(derr.ErrInvalidInput, "invalid_location", "a location is required unless the task is remote")
	ErrInvalidPrice       = derr.New(derr.ErrInvalidInput, "invalid_price", "proposed price must be greater than zero")
	ErrInvalidMessage     = derr.New(derr.ErrInvalidInput, "invalid_message", "message is too long (max 2000 characters)")
	ErrPastSchedule       = derr.New(derr.ErrInvalidInput, "past_schedule", "scheduled date cannot be in the past")
)
