package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/yourtime/backend/internal/application/tasks"
	"github.com/yourtime/backend/internal/domain/task"
	httpx "github.com/yourtime/backend/internal/infrastructure/http"
	authmw "github.com/yourtime/backend/internal/infrastructure/http/middleware/auth"
)

type TaskHandler struct {
	svc *tasks.Service
}

func NewTaskHandler(s *tasks.Service) *TaskHandler { return &TaskHandler{svc: s} }

func (h *TaskHandler) Categories(w http.ResponseWriter, r *http.Request) {
	cats, err := h.svc.Categories(r.Context())
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	out := make([]CategoryDTO, 0, len(cats))
	for _, c := range cats {
		out = append(out, toCategoryDTO(c))
	}
	httpx.OK(w, out)
}

// ---- requests --------------------------------------------------------------

type taskRequest struct {
	CategoryID  uuid.UUID `json:"category_id" validate:"required"`
	Title       string    `json:"title" validate:"required,min=1,max=200"`
	Description string    `json:"description" validate:"required,min=1,max=5000"`
	Budget      struct {
		Type     string `json:"type" validate:"required,oneof=fixed hourly negotiable"`
		MinMinor *int64 `json:"min_minor" validate:"omitempty,gt=0"`
		MaxMinor *int64 `json:"max_minor" validate:"omitempty,gt=0"`
		// Currency defaults to the poster's account currency.
		Currency string `json:"currency" validate:"omitempty,len=3"`
	} `json:"budget" validate:"required"`
	IsRemote bool `json:"is_remote"`
	Location *struct {
		Latitude  *float64 `json:"latitude" validate:"required,gte=-90,lte=90"`
		Longitude *float64 `json:"longitude" validate:"required,gte=-180,lte=180"`
		Address   string   `json:"address" validate:"max=300"`
		City      string   `json:"city" validate:"max=100"`
	} `json:"location"`
	ScheduledAt *time.Time `json:"scheduled_at"`
}

func (req *taskRequest) toInput() tasks.TaskInput {
	in := tasks.TaskInput{
		CategoryID: req.CategoryID, Title: req.Title, Description: req.Description,
		BudgetType: req.Budget.Type, BudgetMin: req.Budget.MinMinor, BudgetMax: req.Budget.MaxMinor,
		Currency: req.Budget.Currency, IsRemote: req.IsRemote, ScheduledAt: req.ScheduledAt,
	}
	if req.Location != nil {
		in.Latitude, in.Longitude = req.Location.Latitude, req.Location.Longitude
		in.Address, in.City = req.Location.Address, req.Location.City
	}
	return in
}

func (h *TaskHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req taskRequest
	if !decode(w, r, &req) {
		return
	}
	res, err := h.svc.Create(r.Context(), authmw.UserID(r.Context()), req.toInput())
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.Created(w, toTaskDTO(*res))
}

func (h *TaskHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var req taskRequest
	if !decode(w, r, &req) {
		return
	}
	res, err := h.svc.Update(r.Context(), authmw.UserID(r.Context()), id, req.toInput())
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.OK(w, toTaskDTO(*res))
}

func (h *TaskHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	lat, ok := queryFloat(w, r, "lat")
	if !ok {
		return
	}
	lng, ok := queryFloat(w, r, "lng")
	if !ok {
		return
	}
	res, err := h.svc.Get(r.Context(), authmw.UserID(r.Context()), id, lat, lng)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.OK(w, toTaskDTO(*res))
}

func (h *TaskHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, h.svc.Cancel)
}

func (h *TaskHandler) Complete(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, h.svc.Complete)
}

func (h *TaskHandler) StartService(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, h.svc.StartService)
}

// Release: the chosen worker gives the task back before starting it.
func (h *TaskHandler) Release(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, h.svc.Release)
}

type positionRequest struct {
	Latitude  *float64 `json:"latitude" validate:"required,gte=-90,lte=90"`
	Longitude *float64 `json:"longitude" validate:"required,gte=-180,lte=180"`
}

type startRouteRequest struct {
	positionRequest
	// EtaSeconds is the trip time the worker's app measured on the route.
	EtaSeconds *int `json:"eta_seconds" validate:"omitempty,gte=0,lte=86400"`
}

// StartRoute: POST /tasks/{id}/start-route with the worker's current position
// and, optionally, the trip time their app measured.
func (h *TaskHandler) StartRoute(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var req startRouteRequest
	if !decode(w, r, &req) {
		return
	}
	res, err := h.svc.StartRoute(r.Context(), authmw.UserID(r.Context()), id, *req.Latitude, *req.Longitude, req.EtaSeconds)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.OK(w, toTaskDTO(*res))
}

// UpdateLocation: POST /tasks/{id}/location, sent while travelling or working.
func (h *TaskHandler) UpdateLocation(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var req positionRequest
	if !decode(w, r, &req) {
		return
	}
	if err := h.svc.UpdateLocation(r.Context(), authmw.UserID(r.Context()), id, *req.Latitude, *req.Longitude); err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.NoContent(w)
}

// Active: GET /me/active returns the service the caller has as client and as worker.
func (h *TaskHandler) Active(w http.ResponseWriter, r *http.Request) {
	client, worker, err := h.svc.Active(r.Context(), authmw.UserID(r.Context()))
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	out := struct {
		AsClient *TaskDTO `json:"as_client"`
		AsWorker *TaskDTO `json:"as_worker"`
	}{}
	if client != nil {
		d := toTaskDTO(*client)
		out.AsClient = &d
	}
	if worker != nil {
		d := toTaskDTO(*worker)
		out.AsWorker = &d
	}
	httpx.OK(w, out)
}

func (h *TaskHandler) transition(w http.ResponseWriter, r *http.Request, fn func(ctx context.Context, actor, id uuid.UUID) (*tasks.TaskResult, error)) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	res, err := fn(r.Context(), authmw.UserID(r.Context()), id)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.OK(w, toTaskDTO(*res))
}

// List is the public feed of open tasks, personalised with distances.
//
//	GET /tasks?q=&category_id=&lat=&lng=&max_distance_km=&preferred_radius=true&sort=distance&limit=&offset=
func (h *TaskHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	p := tasks.SearchParams{Query: strings.TrimSpace(q.Get("q")), UsePreferredRadius: q.Get("preferred_radius") == "true"}

	var ok bool
	if p.CategoryID, ok = queryUUID(w, r, "category_id"); !ok {
		return
	}
	if p.Lat, ok = queryFloat(w, r, "lat"); !ok {
		return
	}
	if p.Lng, ok = queryFloat(w, r, "lng"); !ok {
		return
	}
	if p.MaxDistanceKm, ok = queryFloat(w, r, "max_distance_km"); !ok {
		return
	}
	if p.MaxDistanceKm != nil && *p.MaxDistanceKm <= 0 {
		p.MaxDistanceKm = nil
	}
	switch s := task.Sort(q.Get("sort")); s {
	case "", task.SortRecent:
		p.Sort = task.SortRecent
	case task.SortDistance:
		p.Sort = s
	default:
		httpx.Problem(w, r, http.StatusBadRequest, "sort must be 'recent' or 'distance'")
		return
	}
	if p.Limit, ok = queryInt(w, r, "limit"); !ok {
		return
	}
	if p.Offset, ok = queryInt(w, r, "offset"); !ok {
		return
	}

	page, err := h.svc.Search(r.Context(), authmw.UserID(r.Context()), p)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	writeTaskPage(w, page, p.Limit, p.Offset)
}

// Mine lists tasks the caller posted: GET /me/tasks?status=open,assigned
func (h *TaskHandler) Mine(w http.ResponseWriter, r *http.Request) {
	var statuses []task.Status
	if raw := r.URL.Query().Get("status"); raw != "" {
		for _, s := range strings.Split(raw, ",") {
			st := task.Status(strings.TrimSpace(s))
			if !st.IsValid() {
				httpx.Problem(w, r, http.StatusBadRequest, "Unknown status: "+s)
				return
			}
			statuses = append(statuses, st)
		}
	}
	limit, ok := queryInt(w, r, "limit")
	if !ok {
		return
	}
	offset, ok := queryInt(w, r, "offset")
	if !ok {
		return
	}
	page, err := h.svc.Posted(r.Context(), authmw.UserID(r.Context()), statuses, limit, offset)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	writeTaskPage(w, page, limit, offset)
}

func writeTaskPage(w http.ResponseWriter, page *tasks.TaskPage, limit, offset int) {
	items := make([]TaskDTO, 0, len(page.Items))
	for _, it := range page.Items {
		items = append(items, toTaskDTO(it))
	}
	if limit <= 0 {
		limit = tasks.DefaultPageSize
	}
	if limit > tasks.MaxPageSize {
		limit = tasks.MaxPageSize
	}
	httpx.OKMeta(w, items, PageMeta{HasMore: page.HasMore, Limit: limit, Offset: max(offset, 0)})
}
