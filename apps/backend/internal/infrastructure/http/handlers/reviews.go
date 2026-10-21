package handlers

import (
	"net/http"

	"github.com/yourtime/backend/internal/application/reviews"
	httpx "github.com/yourtime/backend/internal/infrastructure/http"
	authmw "github.com/yourtime/backend/internal/infrastructure/http/middleware/auth"
)

type ReviewHandler struct {
	svc *reviews.Service
}

func NewReviewHandler(s *reviews.Service) *ReviewHandler { return &ReviewHandler{svc: s} }

type createReviewRequest struct {
	Rating  int    `json:"rating" validate:"required,min=1,max=5"`
	Comment string `json:"comment" validate:"max=1000"`
}

// Create: POST /tasks/{id}/reviews (the poster or the chosen applicant, once completed)
func (h *ReviewHandler) Create(w http.ResponseWriter, r *http.Request) {
	taskID, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var req createReviewRequest
	if !decode(w, r, &req) {
		return
	}
	rv, err := h.svc.Create(r.Context(), authmw.UserID(r.Context()), taskID, req.Rating, req.Comment)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.Created(w, toReviewDTO(*rv))
}

type replyRequest struct {
	Text string `json:"text" validate:"required,max=1000"`
}

// Reply: POST /reviews/{id}/reply (only the reviewed person, once)
func (h *ReviewHandler) Reply(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var req replyRequest
	if !decode(w, r, &req) {
		return
	}
	rv, err := h.svc.Reply(r.Context(), authmw.UserID(r.Context()), id, req.Text)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.OK(w, toReviewDTO(*rv))
}

// Profile: GET /users/{id}
func (h *ReviewHandler) Profile(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	p, err := h.svc.Profile(r.Context(), id)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.OK(w, ProfileDTO{
		ID: p.ID, FullName: p.FullName, AvatarURL: p.AvatarURL, Bio: p.Bio,
		Rating: toRatingDTO(p.Rating), MemberSince: p.MemberSince, Reliability: toReliabilityDTO(p.Reliability),
	})
}

// ForUser: GET /users/{id}/reviews
func (h *ReviewHandler) ForUser(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	limit, ok := queryInt(w, r, "limit")
	if !ok {
		return
	}
	offset, ok := queryInt(w, r, "offset")
	if !ok {
		return
	}
	list, hasMore, err := h.svc.ForUser(r.Context(), id, limit, offset)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	if limit <= 0 {
		limit = reviews.DefaultPageSize
	}
	if limit > reviews.MaxPageSize {
		limit = reviews.MaxPageSize
	}
	out := make([]ReviewDTO, 0, len(list))
	for _, v := range list {
		out = append(out, toReviewViewDTO(v))
	}
	httpx.OKMeta(w, out, PageMeta{HasMore: hasMore, Limit: limit, Offset: max(offset, 0)})
}
