package task

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
)

type Category struct {
	ID    uuid.UUID
	Slug  string
	Name  string
	Icon  string
	Color string
}

// Party is the public face of a person plus contact details. Contact fields
// are filled by the repository and redacted by the application layer, which
// decides who may see them.
type Party struct {
	ID        uuid.UUID
	FullName  string
	AvatarURL *string
	Email     string
	Phone     *string
	// Rating is shown next to the name so people can weigh an offer or a poster.
	Rating valueobjects.Rating
}

type ViewerApplication struct {
	ID         uuid.UUID
	Status     ApplicationStatus
	PriceMinor int64
}

// View is a task read model enriched for display.
type View struct {
	Task
	Category          Category
	Poster            Party
	AssignedApplicant *Party
	ApplicationsCount int
	// DistanceKm is from the search origin to the task; nil if unknown/remote.
	DistanceKm *float64
	// ViewerApplication is the requesting person's own application, if any.
	ViewerApplication *ViewerApplication
	// AgreedPriceMinor is the price of the chosen application, once assigned.
	AgreedPriceMinor *int64
}

type Brief struct {
	ID         uuid.UUID
	PosterID   uuid.UUID
	Title      string
	Status     Status
	Currency   valueobjects.Currency
	City       string
	IsRemote   bool
	PosterName string
}

type ApplicationView struct {
	Application
	Applicant Party
	Task      Brief
	// ApplicantBusy is true while the applicant is doing another service, so
	// the poster knows they cannot be chosen right now.
	ApplicantBusy bool
}

type Sort string

const (
	SortRecent   Sort = "recent"
	SortDistance Sort = "distance"
)

type SearchFilter struct {
	// ViewerID personalises the result (their own application per task).
	ViewerID uuid.UUID
	// Origin is where distances are measured from. Optional.
	Origin *valueobjects.Coordinates

	Statuses        []Status
	PosterID        *uuid.UUID // only tasks posted by this person
	AssigneeID      *uuid.UUID // only tasks this person was chosen for
	ExcludePosterID *uuid.UUID // hide this person's own tasks (public feed)
	Query           string
	CategoryID      *uuid.UUID
	// MaxDistanceKm hides tasks farther than this. Remote tasks always pass.
	// It is optional and only a browsing filter, never an eligibility rule.
	MaxDistanceKm *float64
	Sort          Sort
	Limit         int
	Offset        int
}

type Repository interface {
	Create(ctx context.Context, t *Task) error
	// Mutate loads the task under a row lock, applies fn and saves the result
	// atomically. fn errors abort without saving.
	Mutate(ctx context.Context, id uuid.UUID, fn func(*Task) error) error
	GetView(ctx context.Context, id, viewerID uuid.UUID, origin *valueobjects.Coordinates) (*View, error)
	Search(ctx context.Context, f SearchFilter) ([]View, error)
	Categories(ctx context.Context) ([]Category, error)
	CategoryExists(ctx context.Context, id uuid.UUID) (bool, error)
}

type ApplicationRepository interface {
	// Create inserts an application for taskID after build validated the
	// task (locked for the duration), failing with ErrAlreadyApplied on duplicates.
	Create(ctx context.Context, taskID uuid.UUID, build func(*Task) (*Application, error)) (*Application, error)
	Get(ctx context.Context, id uuid.UUID) (*ApplicationView, error)
	ListByTask(ctx context.Context, taskID uuid.UUID) ([]ApplicationView, error)
	ListByApplicant(ctx context.Context, applicantID uuid.UUID, limit, offset int) ([]ApplicationView, error)
	// Transition moves a pending application to a new status, returning
	// ErrApplicationNotOpen if it is no longer pending (lost a race).
	Transition(ctx context.Context, id uuid.UUID, to ApplicationStatus, now time.Time) error
	// Accept atomically assigns the application's task to its applicant and
	// rejects every other pending application on that task.
	Accept(ctx context.Context, applicationID, actor uuid.UUID, now time.Time) error
	// Release lets the chosen worker give the task back before starting it:
	// the task reopens and their application is withdrawn, atomically.
	Release(ctx context.Context, taskID, actor uuid.UUID, now time.Time) error
}
