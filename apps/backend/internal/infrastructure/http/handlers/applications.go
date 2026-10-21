package handlers

import (
	"context"
	"net/http"

	"github.com/google/uuid"
	"github.com/yourtime/backend/internal/application/tasks"
	"github.com/yourtime/backend/internal/domain/task"
	httpx "github.com/yourtime/backend/internal/infrastructure/http"
	authmw "github.com/yourtime/backend/internal/infrastructure/http/middleware/auth"
)

type applicationAction func(ctx context.Context, actor, id uuid.UUID) (*task.ApplicationView, error)

type ApplicationHandler struct {
	svc *tasks.Service
}

func NewApplicationHandler(s *tasks.Service) *ApplicationHandler { return &ApplicationHandler{svc: s} }

type applyRequest struct {
	// PriceMinor is the proposed price in minor units of the task's currency.
	PriceMinor int64  `json:"price_minor" validate:"required,gt=0"`
	Message    string `json:"message" validate:"max=2000"`
}

// Apply: POST /tasks/{id}/applications
func (h *ApplicationHandler) Apply(w http.ResponseWriter, r *http.Request) {
	taskID, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var req applyRequest
	if !decode(w, r, &req) {
		return
	}
	app, err := h.svc.Apply(r.Context(), authmw.UserID(r.Context()), taskID, req.PriceMinor, req.Message)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.Created(w, map[string]any{
		"id": app.ID, "task_id": app.TaskID, "price_minor": app.PriceMinor,
		"message": app.Message, "status": app.Status, "created_at": app.CreatedAt,
	})
}

// ListForTask: GET /tasks/{id}/applications (task poster only)
func (h *ApplicationHandler) ListForTask(w http.ResponseWriter, r *http.Request) {
	taskID, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	list, err := h.svc.Applications(r.Context(), authmw.UserID(r.Context()), taskID)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.OK(w, toApplicationDTOs(list))
}

// Mine: GET /me/applications
func (h *ApplicationHandler) Mine(w http.ResponseWriter, r *http.Request) {
	limit, ok := queryInt(w, r, "limit")
	if !ok {
		return
	}
	offset, ok := queryInt(w, r, "offset")
	if !ok {
		return
	}
	list, hasMore, err := h.svc.MyApplications(r.Context(), authmw.UserID(r.Context()), limit, offset)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	if limit <= 0 {
		limit = tasks.DefaultPageSize
	}
	if limit > tasks.MaxPageSize {
		limit = tasks.MaxPageSize
	}
	httpx.OKMeta(w, toApplicationDTOs(list), PageMeta{HasMore: hasMore, Limit: limit, Offset: max(offset, 0)})
}

func (h *ApplicationHandler) Accept(w http.ResponseWriter, r *http.Request) {
	h.act(w, r, h.svc.Accept)
}
func (h *ApplicationHandler) Reject(w http.ResponseWriter, r *http.Request) {
	h.act(w, r, h.svc.Reject)
}
func (h *ApplicationHandler) Withdraw(w http.ResponseWriter, r *http.Request) {
	h.act(w, r, h.svc.Withdraw)
}

func (h *ApplicationHandler) act(w http.ResponseWriter, r *http.Request, fn applicationAction) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	v, err := fn(r.Context(), authmw.UserID(r.Context()), id)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.OK(w, toApplicationDTO(*v))
}

func toApplicationDTOs(list []task.ApplicationView) []ApplicationDTO {
	out := make([]ApplicationDTO, 0, len(list))
	for _, v := range list {
		out = append(out, toApplicationDTO(v))
	}
	return out
}
