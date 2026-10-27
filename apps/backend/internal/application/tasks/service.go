// Package tasks holds the use cases for publishing tasks, applying to them and
// choosing an applicant.
package tasks

import (
	"context"
	"math"
	"time"

	"github.com/google/uuid"
	derr "github.com/yourtime/backend/internal/domain/common/errors"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
	"github.com/yourtime/backend/internal/domain/review"
	"github.com/yourtime/backend/internal/domain/task"
	"github.com/yourtime/backend/internal/domain/user"
	"github.com/yourtime/backend/internal/domain/wallet"
)

const (
	DefaultPageSize = 20
	MaxPageSize     = 50
)

// FeeQuoter works out the platform commission a person would owe for a task and
// whether their wallet covers it. Without one, taking a task is free.
type FeeQuoter interface {
	Quote(ctx context.Context, userID uuid.UUID, priceMinor int64, priceCur valueobjects.Currency) (wallet.Quote, error)
}

type Service struct {
	tasks   task.Repository
	apps    task.ApplicationRepository
	users   user.Repository
	reviews review.Repository
	fees    FeeQuoter
	now     func() time.Time
}

func NewService(tasks task.Repository, apps task.ApplicationRepository, users user.Repository, reviews review.Repository) *Service {
	return &Service{tasks: tasks, apps: apps, users: users, reviews: reviews, now: func() time.Time { return time.Now().UTC() }}
}

// WithFees makes taking a task cost the platform commission: applying needs a wallet
// balance that covers it, and being chosen charges it.
func (s *Service) WithFees(f FeeQuoter) *Service {
	s.fees = f
	return s
}

// ---- results --------------------------------------------------------------

// TaskResult is a task as seen by one specific person.
type TaskResult struct {
	task.View
	IsOwner bool
	// IsWorker is true for the person chosen to do the task.
	IsWorker bool
	// Actions are what the viewer may do next, straight from the domain rules.
	Actions []task.Action
	// CanReview is true when the viewer took part in this completed task and has
	// not reviewed the other person yet.
	CanReview bool
	// MyReview is the review the viewer wrote; ReviewForMe the one they received.
	MyReview    *review.Review
	ReviewForMe *review.Review
	// WithinPreferredRadius is a hint only: nil when there is nothing to
	// compare. It never affects whether the person may apply.
	WithinPreferredRadius *bool
}

type TaskPage struct {
	Items   []TaskResult
	HasMore bool
}

// ---- inputs ---------------------------------------------------------------

type TaskInput struct {
	CategoryID  uuid.UUID
	Title       string
	Description string
	BudgetType  string
	BudgetMin   *int64
	BudgetMax   *int64
	// Currency is optional on creation (defaults to the poster's account
	// currency) and on edit (keeps the task's current currency).
	Currency    string
	IsRemote    bool
	Latitude    *float64
	Longitude   *float64
	Address     string
	City        string
	ScheduledAt *time.Time
}

type SearchParams struct {
	Query      string
	CategoryID *uuid.UUID
	// Lat/Lng override the saved location as the origin for distances.
	Lat, Lng *float64
	// MaxDistanceKm filters by distance. Optional.
	MaxDistanceKm *float64
	// UsePreferredRadius applies the person's saved radius when MaxDistanceKm
	// is not given.
	UsePreferredRadius bool
	Sort               task.Sort
	Limit, Offset      int
}

// ---- tasks ----------------------------------------------------------------

func (s *Service) Categories(ctx context.Context) ([]task.Category, error) {
	return s.tasks.Categories(ctx)
}

func (s *Service) Create(ctx context.Context, posterID uuid.UUID, in TaskInput) (*TaskResult, error) {
	poster, err := s.users.GetByID(ctx, posterID)
	if err != nil {
		return nil, err
	}
	if err := s.requireCategory(ctx, in.CategoryID); err != nil {
		return nil, err
	}
	input, err := buildTaskInput(posterID, in, poster.Currency, poster.Location)
	if err != nil {
		return nil, err
	}
	t, err := task.New(input, s.now())
	if err != nil {
		return nil, err
	}
	if err := s.tasks.Create(ctx, t); err != nil {
		return nil, err
	}
	return s.Get(ctx, posterID, t.ID, nil, nil)
}

func (s *Service) Update(ctx context.Context, actor, taskID uuid.UUID, in TaskInput) (*TaskResult, error) {
	if err := s.requireCategory(ctx, in.CategoryID); err != nil {
		return nil, err
	}
	poster, err := s.users.GetByID(ctx, actor)
	if err != nil {
		return nil, err
	}
	err = s.tasks.Mutate(ctx, taskID, func(t *task.Task) error {
		input, err := buildTaskInput(actor, in, t.Budget.Currency, poster.Location)
		if err != nil {
			return err
		}
		return t.Edit(actor, input, s.now())
	})
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, actor, taskID, nil, nil)
}

func (s *Service) Cancel(ctx context.Context, actor, taskID uuid.UUID) (*TaskResult, error) {
	if err := s.tasks.Mutate(ctx, taskID, func(t *task.Task) error { return t.Cancel(actor, s.now()) }); err != nil {
		return nil, err
	}
	return s.Get(ctx, actor, taskID, nil, nil)
}

func (s *Service) Complete(ctx context.Context, actor, taskID uuid.UUID) (*TaskResult, error) {
	if err := s.tasks.Mutate(ctx, taskID, func(t *task.Task) error { return t.Complete(actor, s.now()) }); err != nil {
		return nil, err
	}
	return s.Get(ctx, actor, taskID, nil, nil)
}

// StartRoute is the chosen worker leaving. Their position is required: it is how
// the poster starts following them, and it makes sure location sharing works.
// etaSeconds is the trip time their app measured on the route; it is optional.
func (s *Service) StartRoute(ctx context.Context, actor, taskID uuid.UUID, lat, lng float64, etaSeconds *int) (*TaskResult, error) {
	at, err := valueobjects.NewCoordinates(lat, lng)
	if err != nil {
		return nil, err
	}
	if err := s.tasks.Mutate(ctx, taskID, func(t *task.Task) error { return t.StartRoute(actor, at, etaSeconds, s.now()) }); err != nil {
		return nil, err
	}
	return s.Get(ctx, actor, taskID, nil, nil)
}

// StartService is the worker beginning the job (after arriving, for on-site tasks).
func (s *Service) StartService(ctx context.Context, actor, taskID uuid.UUID) (*TaskResult, error) {
	if err := s.tasks.Mutate(ctx, taskID, func(t *task.Task) error { return t.StartService(actor, s.now()) }); err != nil {
		return nil, err
	}
	return s.Get(ctx, actor, taskID, nil, nil)
}

// Release is the worker giving the task back before starting it. The task
// reopens for the poster to choose someone else.
func (s *Service) Release(ctx context.Context, actor, taskID uuid.UUID) (*TaskResult, error) {
	if err := s.apps.Release(ctx, taskID, actor, s.now()); err != nil {
		return nil, err
	}
	return s.Get(ctx, actor, taskID, nil, nil)
}

// UpdateLocation stores where the worker is right now. The poster sees it on
// the map; it is erased when the service ends.
func (s *Service) UpdateLocation(ctx context.Context, actor, taskID uuid.UUID, lat, lng float64) error {
	at, err := valueobjects.NewCoordinates(lat, lng)
	if err != nil {
		return err
	}
	return s.tasks.Mutate(ctx, taskID, func(t *task.Task) error { return t.UpdateWorkerLocation(actor, at, s.now()) })
}

// Active returns the service the person currently has as client and as worker
// (each nil when none). It drives the "service in progress" banner.
func (s *Service) Active(ctx context.Context, viewerID uuid.UUID) (asClient, asWorker *TaskResult, err error) {
	viewer, err := s.users.GetByID(ctx, viewerID)
	if err != nil {
		return nil, nil, err
	}
	origin, _ := resolveOrigin(viewer, nil, nil)
	active := []task.Status{task.StatusAssigned, task.StatusEnRoute, task.StatusInProgress}

	find := func(f task.SearchFilter) (*TaskResult, error) {
		f.ViewerID, f.Origin, f.Statuses, f.Limit = viewerID, origin, active, 1
		views, err := s.tasks.Search(ctx, f)
		if err != nil || len(views) == 0 {
			return nil, err
		}
		return present(views[0], viewer), nil
	}
	if asClient, err = find(task.SearchFilter{PosterID: &viewerID}); err != nil {
		return nil, nil, err
	}
	if asWorker, err = find(task.SearchFilter{AssigneeID: &viewerID}); err != nil {
		return nil, nil, err
	}
	return asClient, asWorker, nil
}

// Get returns a task for viewer. lat/lng optionally override the origin used
// for the distance shown.
func (s *Service) Get(ctx context.Context, viewerID, taskID uuid.UUID, lat, lng *float64) (*TaskResult, error) {
	viewer, err := s.users.GetByID(ctx, viewerID)
	if err != nil {
		return nil, err
	}
	origin, err := resolveOrigin(viewer, lat, lng)
	if err != nil {
		return nil, err
	}
	v, err := s.tasks.GetView(ctx, taskID, viewerID, origin)
	if err != nil {
		return nil, err
	}
	res := present(*v, viewer)
	if v.Status == task.StatusCompleted {
		if err := s.attachReviews(ctx, res, viewer.ID); err != nil {
			return nil, err
		}
	}
	return res, nil
}

// attachReviews fills the review state for a completed task, only for the two
// people who took part in it.
func (s *Service) attachReviews(ctx context.Context, res *TaskResult, viewerID uuid.UUID) error {
	isParticipant := res.IsOwner || (res.AssignedApplicantID != nil && *res.AssignedApplicantID == viewerID)
	if !isParticipant {
		return nil
	}
	list, err := s.reviews.ByTask(ctx, res.ID)
	if err != nil {
		return err
	}
	for i := range list {
		switch viewerID {
		case list[i].ReviewerID:
			res.MyReview = &list[i]
		case list[i].RevieweeID:
			res.ReviewForMe = &list[i]
		}
	}
	res.CanReview = res.MyReview == nil
	return nil
}

func (s *Service) Search(ctx context.Context, viewerID uuid.UUID, p SearchParams) (*TaskPage, error) {
	viewer, err := s.users.GetByID(ctx, viewerID)
	if err != nil {
		return nil, err
	}
	origin, err := resolveOrigin(viewer, p.Lat, p.Lng)
	if err != nil {
		return nil, err
	}
	f := task.SearchFilter{
		ViewerID:        viewerID,
		Origin:          origin,
		Statuses:        []task.Status{task.StatusOpen},
		ExcludePosterID: &viewerID,
		Query:           p.Query,
		CategoryID:      p.CategoryID,
		MaxDistanceKm:   p.MaxDistanceKm,
		Sort:            p.Sort,
	}
	if f.MaxDistanceKm == nil && p.UsePreferredRadius && viewer.SearchRadiusKm != nil {
		km := float64(*viewer.SearchRadiusKm)
		f.MaxDistanceKm = &km
	}
	return s.page(ctx, f, viewer, p.Limit, p.Offset)
}

// Posted lists the tasks the viewer published, optionally by status.
func (s *Service) Posted(ctx context.Context, viewerID uuid.UUID, statuses []task.Status, limit, offset int) (*TaskPage, error) {
	viewer, err := s.users.GetByID(ctx, viewerID)
	if err != nil {
		return nil, err
	}
	if len(statuses) == 0 {
		statuses = []task.Status{task.StatusOpen, task.StatusAssigned, task.StatusEnRoute, task.StatusInProgress, task.StatusCompleted, task.StatusCancelled}
	}
	origin, _ := resolveOrigin(viewer, nil, nil)
	f := task.SearchFilter{ViewerID: viewerID, Origin: origin, Statuses: statuses, PosterID: &viewerID}
	return s.page(ctx, f, viewer, limit, offset)
}

func (s *Service) page(ctx context.Context, f task.SearchFilter, viewer *user.User, limit, offset int) (*TaskPage, error) {
	limit, offset = normalizePage(limit, offset)
	f.Limit, f.Offset = limit+1, offset
	views, err := s.tasks.Search(ctx, f)
	if err != nil {
		return nil, err
	}
	page := &TaskPage{Items: make([]TaskResult, 0, len(views))}
	if len(views) > limit {
		page.HasMore = true
		views = views[:limit]
	}
	for _, v := range views {
		page.Items = append(page.Items, *present(v, viewer))
	}
	return page, nil
}

// ---- applications ---------------------------------------------------------

func (s *Service) Apply(ctx context.Context, applicantID, taskID uuid.UUID, priceMinor int64, message string) (*task.Application, error) {
	// A person can only offer to do what they could pay the commission on. The check
	// is repeated, for real, when they are chosen: the balance can change by then.
	if s.fees != nil && priceMinor > 0 {
		v, err := s.tasks.GetView(ctx, taskID, applicantID, nil)
		if err != nil {
			return nil, err
		}
		q, err := s.fees.Quote(ctx, applicantID, priceMinor, v.Budget.Currency)
		if err != nil {
			return nil, err
		}
		if !q.Enough() {
			return nil, wallet.ErrInsufficientBalance
		}
	}
	return s.apps.Create(ctx, taskID, func(t *task.Task) (*task.Application, error) {
		return task.NewApplication(t, applicantID, priceMinor, message, s.now())
	})
}

// FeeQuote is what the person would owe in commission if they were chosen for the
// task at priceMinor, and whether their wallet covers it.
func (s *Service) FeeQuote(ctx context.Context, userID, taskID uuid.UUID, priceMinor int64) (wallet.Quote, error) {
	if s.fees == nil {
		return wallet.Quote{}, nil
	}
	v, err := s.tasks.GetView(ctx, taskID, userID, nil)
	if err != nil {
		return wallet.Quote{}, err
	}
	return s.fees.Quote(ctx, userID, priceMinor, v.Budget.Currency)
}

// Applications lists the offers on a task. Only its poster may see them, and
// contact details are revealed only for the chosen applicant.
func (s *Service) Applications(ctx context.Context, actor, taskID uuid.UUID) ([]task.ApplicationView, error) {
	v, err := s.tasks.GetView(ctx, taskID, actor, nil)
	if err != nil {
		return nil, err
	}
	if v.PosterID != actor {
		return nil, task.ErrNotOwner
	}
	list, err := s.apps.ListByTask(ctx, taskID)
	if err != nil {
		return nil, err
	}
	for i := range list {
		redactApplicant(&list[i])
	}
	return list, nil
}

func (s *Service) MyApplications(ctx context.Context, applicantID uuid.UUID, limit, offset int) ([]task.ApplicationView, bool, error) {
	limit, offset = normalizePage(limit, offset)
	list, err := s.apps.ListByApplicant(ctx, applicantID, limit+1, offset)
	if err != nil {
		return nil, false, err
	}
	hasMore := len(list) > limit
	if hasMore {
		list = list[:limit]
	}
	return list, hasMore, nil
}

// Accept chooses an applicant: the task becomes assigned and every other
// pending offer is rejected, atomically.
func (s *Service) Accept(ctx context.Context, actor, applicationID uuid.UUID) (*task.ApplicationView, error) {
	var fee *task.FeeCharge
	if s.fees != nil {
		offer, err := s.apps.Get(ctx, applicationID)
		if err != nil {
			return nil, err
		}
		if offer.Task.PosterID != actor {
			return nil, task.ErrNotOwner
		}
		q, err := s.fees.Quote(ctx, offer.ApplicantID, offer.PriceMinor, offer.Task.Currency)
		if err != nil {
			return nil, err
		}
		if q.FeeMinor > 0 {
			fee = &task.FeeCharge{AmountMinor: q.FeeMinor, Currency: q.Currency}
		}
	}
	if err := s.apps.Accept(ctx, applicationID, actor, s.now(), fee); err != nil {
		return nil, err
	}
	v, err := s.apps.Get(ctx, applicationID)
	if err != nil {
		return nil, err
	}
	redactApplicant(v)
	return v, nil
}

func (s *Service) Reject(ctx context.Context, actor, applicationID uuid.UUID) (*task.ApplicationView, error) {
	v, err := s.apps.Get(ctx, applicationID)
	if err != nil {
		return nil, err
	}
	if err := v.CanBeRejectedBy(v.Task.PosterID, actor); err != nil {
		return nil, err
	}
	if err := s.apps.Transition(ctx, applicationID, task.ApplicationRejected, s.now()); err != nil {
		return nil, err
	}
	v.Status = task.ApplicationRejected
	redactApplicant(v)
	return v, nil
}

func (s *Service) Withdraw(ctx context.Context, actor, applicationID uuid.UUID) (*task.ApplicationView, error) {
	v, err := s.apps.Get(ctx, applicationID)
	if err != nil {
		return nil, err
	}
	if err := v.CanBeWithdrawnBy(actor); err != nil {
		return nil, err
	}
	if err := s.apps.Transition(ctx, applicationID, task.ApplicationWithdrawn, s.now()); err != nil {
		return nil, err
	}
	v.Status = task.ApplicationWithdrawn
	return v, nil
}

// ---- helpers --------------------------------------------------------------

func (s *Service) requireCategory(ctx context.Context, id uuid.UUID) error {
	ok, err := s.tasks.CategoryExists(ctx, id)
	if err != nil {
		return err
	}
	if !ok {
		return task.ErrCategoryNotFound
	}
	return nil
}

func buildTaskInput(poster uuid.UUID, in TaskInput, defaultCurrency valueobjects.Currency, saved *user.Location) (task.NewTaskInput, error) {
	currency := defaultCurrency
	if in.Currency != "" {
		c, err := valueobjects.NewCurrency(in.Currency)
		if err != nil {
			return task.NewTaskInput{}, err
		}
		currency = c
	}

	var place *task.Place
	switch {
	case in.Latitude != nil && in.Longitude != nil:
		coords, err := valueobjects.NewCoordinates(*in.Latitude, *in.Longitude)
		if err != nil {
			return task.NewTaskInput{}, err
		}
		place = &task.Place{Coordinates: coords, Address: in.Address, City: in.City}
	case in.Latitude != nil || in.Longitude != nil:
		return task.NewTaskInput{}, task.ErrInvalidLocation
	case !in.IsRemote && saved != nil:
		// Convenience: default to the poster's saved location.
		place = &task.Place{Coordinates: saved.Coordinates, Address: in.Address, City: saved.City}
		if in.City != "" {
			place.City = in.City
		}
	}

	return task.NewTaskInput{
		PosterID:    poster,
		CategoryID:  in.CategoryID,
		Title:       in.Title,
		Description: in.Description,
		Budget: task.Budget{
			Type:     task.BudgetType(in.BudgetType),
			MinMinor: in.BudgetMin,
			MaxMinor: in.BudgetMax,
			Currency: currency,
		},
		IsRemote:    in.IsRemote,
		Place:       place,
		ScheduledAt: in.ScheduledAt,
	}, nil
}

func resolveOrigin(viewer *user.User, lat, lng *float64) (*valueobjects.Coordinates, error) {
	if (lat == nil) != (lng == nil) {
		return nil, derr.ErrInvalidInput
	}
	if lat != nil {
		c, err := valueobjects.NewCoordinates(*lat, *lng)
		if err != nil {
			return nil, err
		}
		return &c, nil
	}
	if viewer.Location != nil {
		c := viewer.Location.Coordinates
		return &c, nil
	}
	return nil, nil
}

func normalizePage(limit, offset int) (int, int) {
	if limit <= 0 {
		limit = DefaultPageSize
	}
	if limit > MaxPageSize {
		limit = MaxPageSize
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}

// present applies visibility rules for one viewer: contact details are shared
// only between the poster and the chosen applicant.
func present(v task.View, viewer *user.User) *TaskResult {
	isOwner := v.PosterID == viewer.ID
	isAssignee := v.AssignedApplicantID != nil && *v.AssignedApplicantID == viewer.ID
	// Where the worker is right now is for the two people of the service only.
	if !isOwner && !isAssignee {
		v.WorkerLocation = nil
	}

	if !isOwner && !isAssignee {
		v.Poster.Email, v.Poster.Phone = "", nil
		v.Place = approximate(v.Place)
	}
	if !isOwner {
		// Only the poster sees who was chosen; the chosen applicant knows already.
		v.AssignedApplicant = nil
	}
	return &TaskResult{
		View:                  v,
		IsOwner:               isOwner,
		IsWorker:              isAssignee,
		Actions:               v.Task.AvailableActions(viewer.ID),
		WithinPreferredRadius: task.WithinRadius(v.IsRemote, v.DistanceKm, viewer.SearchRadiusKm),
	}
}

// approximate hides the exact address and rounds coordinates to 2 decimals
// (about 1 km). Mirrors the rounding the SQL applies to distances.
func approximate(p *task.Place) *task.Place {
	if p == nil {
		return nil
	}
	round2 := func(v float64) float64 { return math.Round(v*100) / 100 }
	return &task.Place{
		Coordinates: valueobjects.Coordinates{Lat: round2(p.Coordinates.Lat), Lng: round2(p.Coordinates.Lng)},
		City:        p.City,
	}
}

func redactApplicant(a *task.ApplicationView) {
	if a.Status != task.ApplicationAccepted {
		a.Applicant.Email, a.Applicant.Phone = "", nil
	}
}
