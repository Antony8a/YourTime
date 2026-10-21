package handlers

import (
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/yourtime/backend/internal/application/auth"
	"github.com/yourtime/backend/internal/application/tasks"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
	"github.com/yourtime/backend/internal/domain/review"
	"github.com/yourtime/backend/internal/domain/task"
	"github.com/yourtime/backend/internal/domain/user"
)

// ---- responses ------------------------------------------------------------

// RatingDTO is a person's reviews summary: stars from 1 to 5 and how many
// people rated. Average is 0 when Count is 0.
type RatingDTO struct {
	Average float64 `json:"average"`
	Count   int     `json:"count"`
}

func toRatingDTO(r valueobjects.Rating) RatingDTO {
	return RatingDTO{Average: r.Average(), Count: r.Count}
}

// ReliabilityDTO is how a person has behaved as a worker, from the services
// they finished, so a poster can weigh it when choosing.
type ReliabilityDTO struct {
	// CompletedServices is how many services they have finished as the worker.
	CompletedServices int `json:"completed_services"`
	// ResponseSeconds is the median time from being chosen to setting out (or
	// starting, if remote). Null until they have finished a service.
	ResponseSeconds *int `json:"response_seconds"`
	// OnTimeTotal counts the on-site services with a scheduled time that could be
	// judged fairly, and OnTimeCount those started on time. OnTimePercent is null
	// when there are none.
	OnTimeCount   int  `json:"on_time_count"`
	OnTimeTotal   int  `json:"on_time_total"`
	OnTimePercent *int `json:"on_time_percent"`
}

func toReliabilityDTO(r valueobjects.Reliability) ReliabilityDTO {
	return ReliabilityDTO{
		CompletedServices: r.Completed, ResponseSeconds: r.ResponseSeconds,
		OnTimeCount: r.OnTimeCount, OnTimeTotal: r.OnTimeTotal, OnTimePercent: r.OnTimePercent(),
	}
}

type LocationDTO struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Address   string  `json:"address,omitempty"`
	City      string  `json:"city,omitempty"`
}

type UserDTO struct {
	ID             uuid.UUID    `json:"id"`
	Email          string       `json:"email"`
	FullName       string       `json:"full_name"`
	Phone          *string      `json:"phone"`
	AvatarURL      *string      `json:"avatar_url"`
	Bio            *string      `json:"bio"`
	Currency       string       `json:"currency"`
	Location       *LocationDTO `json:"location"`
	SearchRadiusKm *int         `json:"search_radius_km"`
	Rating         RatingDTO    `json:"rating"`
	CreatedAt      time.Time    `json:"created_at"`
}

func toUserDTO(u *user.User) UserDTO {
	dto := UserDTO{
		ID: u.ID, Email: u.Email.String(), FullName: u.FullName, AvatarURL: u.AvatarURL, Bio: u.Bio,
		Currency: u.Currency.String(), SearchRadiusKm: u.SearchRadiusKm, Rating: toRatingDTO(u.Rating), CreatedAt: u.CreatedAt,
	}
	if u.Phone != nil {
		p := u.Phone.String()
		dto.Phone = &p
	}
	if u.Location != nil {
		dto.Location = &LocationDTO{Latitude: u.Location.Coordinates.Lat, Longitude: u.Location.Coordinates.Lng, City: u.Location.City}
	}
	return dto
}

type SessionDTO struct {
	User         UserDTO `json:"user"`
	AccessToken  string  `json:"access_token"`
	RefreshToken string  `json:"refresh_token"`
	ExpiresIn    int     `json:"expires_in"`
}

func toSessionDTO(s *auth.Session) SessionDTO {
	return SessionDTO{
		User: toUserDTO(s.User), AccessToken: s.Tokens.AccessToken,
		RefreshToken: s.Tokens.RefreshToken, ExpiresIn: s.Tokens.ExpiresIn,
	}
}

type CategoryDTO struct {
	ID    uuid.UUID `json:"id"`
	Slug  string    `json:"slug"`
	Name  string    `json:"name"`
	Icon  string    `json:"icon"`
	Color string    `json:"color"`
}

func toCategoryDTO(c task.Category) CategoryDTO {
	return CategoryDTO{ID: c.ID, Slug: c.Slug, Name: c.Name, Icon: c.Icon, Color: c.Color}
}

type PartyDTO struct {
	ID        uuid.UUID `json:"id"`
	FullName  string    `json:"full_name"`
	AvatarURL *string   `json:"avatar_url"`
	// Email and Phone are present only when the viewer is allowed to see them.
	Email  string    `json:"email,omitempty"`
	Phone  *string   `json:"phone,omitempty"`
	Rating RatingDTO `json:"rating"`
	// Reliability appears on applicants only.
	Reliability *ReliabilityDTO `json:"reliability,omitempty"`
}

func toPartyDTO(p task.Party) PartyDTO {
	dto := PartyDTO{ID: p.ID, FullName: p.FullName, AvatarURL: p.AvatarURL, Email: p.Email, Phone: p.Phone, Rating: toRatingDTO(p.Rating)}
	if p.Reliability != nil {
		r := toReliabilityDTO(*p.Reliability)
		dto.Reliability = &r
	}
	return dto
}

type BudgetDTO struct {
	Type     string `json:"type"`
	MinMinor *int64 `json:"min_minor"`
	MaxMinor *int64 `json:"max_minor"`
	Currency string `json:"currency"`
}

type MyApplicationDTO struct {
	ID         uuid.UUID `json:"id"`
	Status     string    `json:"status"`
	PriceMinor int64     `json:"price_minor"`
}

// WorkerLocationDTO is where the person doing the service last reported being.
// Only the poster and the worker receive it, and only while the service is active.
type WorkerLocationDTO struct {
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	UpdatedAt time.Time `json:"updated_at"`
}

type TaskDTO struct {
	ID          uuid.UUID    `json:"id"`
	Title       string       `json:"title"`
	Description string       `json:"description"`
	Category    CategoryDTO  `json:"category"`
	Budget      BudgetDTO    `json:"budget"`
	IsRemote    bool         `json:"is_remote"`
	Location    *LocationDTO `json:"location"`
	ScheduledAt *time.Time   `json:"scheduled_at"`
	Status      string       `json:"status"`

	Poster            PartyDTO  `json:"poster"`
	AssignedApplicant *PartyDTO `json:"assigned_applicant"`
	ApplicationsCount int       `json:"applications_count"`

	// DistanceKm is measured from the viewer's chosen origin; null when unknown.
	DistanceKm *float64 `json:"distance_km"`
	// WithinPreferredRadius is a hint relative to the viewer's saved radius.
	// It never prevents applying.
	WithinPreferredRadius *bool `json:"within_preferred_radius"`

	IsOwner  bool `json:"is_owner"`
	IsWorker bool `json:"is_worker"`
	// Actions are what the viewer can do next ("start_route", "start_service",
	// "complete", "release", "cancel", "edit"). Clients render from this list.
	Actions []string `json:"actions"`

	// The live service.
	EnRouteAt        *time.Time         `json:"en_route_at"`
	StartedAt        *time.Time         `json:"started_at"`
	CompletedAt      *time.Time         `json:"completed_at"`
	AgreedPriceMinor *int64             `json:"agreed_price_minor"`
	WorkerLocation   *WorkerLocationDTO `json:"worker_location"`

	CanApply      bool              `json:"can_apply"`
	MyApplication *MyApplicationDTO `json:"my_application"`

	// Review state, only for the two people of a completed task.
	CanReview   bool       `json:"can_review"`
	MyReview    *ReviewDTO `json:"my_review"`
	ReviewForMe *ReviewDTO `json:"review_for_me"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func toTaskDTO(r tasks.TaskResult) TaskDTO {
	dto := TaskDTO{
		ID: r.ID, Title: r.Title, Description: r.Description, Category: toCategoryDTO(r.Category),
		Budget: BudgetDTO{
			Type: string(r.Budget.Type), MinMinor: r.Budget.MinMinor, MaxMinor: r.Budget.MaxMinor,
			Currency: r.Budget.Currency.String(),
		},
		IsRemote: r.IsRemote, ScheduledAt: r.ScheduledAt, Status: string(r.Status),
		Poster: toPartyDTO(r.Poster), ApplicationsCount: r.ApplicationsCount,
		WithinPreferredRadius: r.WithinPreferredRadius, IsOwner: r.IsOwner,
		CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}
	if r.Place != nil {
		dto.Location = &LocationDTO{
			Latitude: r.Place.Coordinates.Lat, Longitude: r.Place.Coordinates.Lng,
			Address: r.Place.Address, City: r.Place.City,
		}
	}
	if r.DistanceKm != nil {
		d := math.Round(*r.DistanceKm*10) / 10
		dto.DistanceKm = &d
	}
	if r.AssignedApplicant != nil {
		p := toPartyDTO(*r.AssignedApplicant)
		dto.AssignedApplicant = &p
	}
	if r.ViewerApplication != nil {
		dto.MyApplication = &MyApplicationDTO{
			ID: r.ViewerApplication.ID, Status: string(r.ViewerApplication.Status), PriceMinor: r.ViewerApplication.PriceMinor,
		}
	}
	dto.IsWorker = r.IsWorker
	dto.Actions = make([]string, 0, len(r.Actions))
	for _, a := range r.Actions {
		dto.Actions = append(dto.Actions, string(a))
	}
	dto.EnRouteAt, dto.StartedAt, dto.CompletedAt = r.EnRouteAt, r.StartedAt, r.CompletedAt
	dto.AgreedPriceMinor = r.AgreedPriceMinor
	if r.WorkerLocation != nil {
		dto.WorkerLocation = &WorkerLocationDTO{
			Latitude:  r.WorkerLocation.Coordinates.Lat,
			Longitude: r.WorkerLocation.Coordinates.Lng,
			UpdatedAt: r.WorkerLocation.At,
		}
	}
	dto.CanReview = r.CanReview
	if r.MyReview != nil {
		d := toReviewDTO(*r.MyReview)
		dto.MyReview = &d
	}
	if r.ReviewForMe != nil {
		d := toReviewDTO(*r.ReviewForMe)
		dto.ReviewForMe = &d
	}
	canReapply := dto.MyApplication == nil || dto.MyApplication.Status == string(task.ApplicationWithdrawn)
	dto.CanApply = !r.IsOwner && r.Status == task.StatusOpen && canReapply
	return dto
}

type TaskBriefDTO struct {
	ID         uuid.UUID `json:"id"`
	Title      string    `json:"title"`
	Status     string    `json:"status"`
	Currency   string    `json:"currency"`
	City       string    `json:"city,omitempty"`
	IsRemote   bool      `json:"is_remote"`
	PosterName string    `json:"poster_name"`
}

type ApplicationDTO struct {
	ID         uuid.UUID `json:"id"`
	TaskID     uuid.UUID `json:"task_id"`
	PriceMinor int64     `json:"price_minor"`
	Currency   string    `json:"currency"`
	Message    string    `json:"message"`
	Status     string    `json:"status"`
	Applicant  PartyDTO  `json:"applicant"`
	// ApplicantBusy: they are doing another service now and cannot be chosen.
	ApplicantBusy bool         `json:"applicant_busy"`
	Task          TaskBriefDTO `json:"task"`
	CreatedAt     time.Time    `json:"created_at"`
}

func toApplicationDTO(v task.ApplicationView) ApplicationDTO {
	return ApplicationDTO{
		ID: v.ID, TaskID: v.TaskID, PriceMinor: v.PriceMinor, Currency: v.Task.Currency.String(),
		Message: v.Message, Status: string(v.Status), Applicant: toPartyDTO(v.Applicant), ApplicantBusy: v.ApplicantBusy,
		Task: TaskBriefDTO{
			ID: v.Task.ID, Title: v.Task.Title, Status: string(v.Task.Status), Currency: v.Task.Currency.String(),
			City: v.Task.City, IsRemote: v.Task.IsRemote, PosterName: v.Task.PosterName,
		},
		CreatedAt: v.CreatedAt,
	}
}

type PageMeta struct {
	HasMore bool `json:"has_more"`
	Limit   int  `json:"limit"`
	Offset  int  `json:"offset"`
}

// ---- reviews ----------------------------------------------------------------

type ReviewDTO struct {
	ID         uuid.UUID  `json:"id"`
	TaskID     uuid.UUID  `json:"task_id"`
	ReviewerID uuid.UUID  `json:"reviewer_id"`
	RevieweeID uuid.UUID  `json:"reviewee_id"`
	Rating     int        `json:"rating"`
	Comment    string     `json:"comment"`
	Reply      *string    `json:"reply"`
	RepliedAt  *time.Time `json:"replied_at"`
	CreatedAt  time.Time  `json:"created_at"`

	// Only present when listing a person's reviews.
	Reviewer  *PartyDTO `json:"reviewer,omitempty"`
	TaskTitle string    `json:"task_title,omitempty"`
}

func toReviewDTO(r review.Review) ReviewDTO {
	return ReviewDTO{
		ID: r.ID, TaskID: r.TaskID, ReviewerID: r.ReviewerID, RevieweeID: r.RevieweeID,
		Rating: r.Rating, Comment: r.Comment, Reply: r.Reply, RepliedAt: r.RepliedAt, CreatedAt: r.CreatedAt,
	}
}

func toReviewViewDTO(v review.View) ReviewDTO {
	dto := toReviewDTO(v.Review)
	dto.Reviewer = &PartyDTO{ID: v.Reviewer.ID, FullName: v.Reviewer.FullName, AvatarURL: v.Reviewer.AvatarURL, Rating: toRatingDTO(v.Reviewer.Rating)}
	dto.TaskTitle = v.TaskTitle
	return dto
}

// ProfileDTO is the public profile: no contact details.
type ProfileDTO struct {
	ID          uuid.UUID `json:"id"`
	FullName    string    `json:"full_name"`
	AvatarURL   *string   `json:"avatar_url"`
	Bio         *string   `json:"bio"`
	Rating      RatingDTO `json:"rating"`
	MemberSince time.Time `json:"member_since"`
	// Reliability is how they have behaved as a worker.
	Reliability ReliabilityDTO `json:"reliability"`
}
