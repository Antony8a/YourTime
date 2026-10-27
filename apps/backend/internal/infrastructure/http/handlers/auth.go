package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/yourtime/backend/internal/application/auth"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
	"github.com/yourtime/backend/internal/domain/user"
	httpx "github.com/yourtime/backend/internal/infrastructure/http"
	authmw "github.com/yourtime/backend/internal/infrastructure/http/middleware/auth"
)

// ---- auth ------------------------------------------------------------------

type AuthHandler struct {
	auth *auth.Service
}

func NewAuthHandler(a *auth.Service) *AuthHandler { return &AuthHandler{auth: a} }

type registerRequest struct {
	Email    string `json:"email" validate:"required,email,max=254"`
	Password string `json:"password" validate:"required,min=8,max=72"`
	FullName string `json:"full_name" validate:"required,min=1,max=150"`
	Currency string `json:"currency" validate:"omitempty,len=3"`
	// Language is a base code or a device locale ("es", "pt-BR"); optional.
	Language string `json:"language" validate:"omitempty,max=10"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if !decode(w, r, &req) {
		return
	}
	s, err := h.auth.Register(r.Context(), auth.RegisterInput{
		Email: req.Email, Password: req.Password, FullName: req.FullName, Currency: req.Currency, Language: req.Language,
	})
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.Created(w, toSessionDTO(s))
}

type loginRequest struct {
	Email    string `json:"email" validate:"required,max=254"`
	Password string `json:"password" validate:"required,max=72"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if !decode(w, r, &req) {
		return
	}
	s, err := h.auth.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.OK(w, toSessionDTO(s))
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if !decode(w, r, &req) {
		return
	}
	s, err := h.auth.Refresh(r.Context(), req.RefreshToken)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.OK(w, toSessionDTO(s))
}

// ---- me --------------------------------------------------------------------

type MeHandler struct {
	users *user.Service
}

func NewMeHandler(u *user.Service) *MeHandler { return &MeHandler{users: u} }

func (h *MeHandler) Get(w http.ResponseWriter, r *http.Request) {
	u, err := h.users.Get(r.Context(), authmw.UserID(r.Context()))
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.OK(w, toUserDTO(u))
}

// nullableInt distinguishes a JSON field that is absent from one that is
// explicitly null (which means "clear the value").
type nullableInt struct {
	Set   bool
	Value *int
}

func (n *nullableInt) UnmarshalJSON(b []byte) error {
	n.Set = true
	if string(b) == "null" {
		n.Value = nil
		return nil
	}
	var v int
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	n.Value = &v
	return nil
}

type updateMeRequest struct {
	FullName  *string `json:"full_name" validate:"omitempty,min=1,max=150"`
	Bio       *string `json:"bio" validate:"omitempty,max=1000"`
	AvatarURL *string `json:"avatar_url" validate:"omitempty,url,max=500"`
	Phone     *string `json:"phone"`
	Currency  *string `json:"currency" validate:"omitempty,len=3"`
	// Language is the app language; "" goes back to following the device.
	Language *string `json:"language" validate:"omitempty,max=10"`
	Location *struct {
		Latitude  *float64 `json:"latitude" validate:"required,gte=-90,lte=90"`
		Longitude *float64 `json:"longitude" validate:"required,gte=-180,lte=180"`
		City      string   `json:"city" validate:"max=100"`
	} `json:"location"`
	// SearchRadiusKm is the preferred browsing radius; null means no limit.
	SearchRadiusKm nullableInt `json:"search_radius_km"`
}

func (h *MeHandler) Update(w http.ResponseWriter, r *http.Request) {
	var req updateMeRequest
	if !decode(w, r, &req) {
		return
	}
	upd := user.ProfileUpdate{
		FullName: req.FullName, Bio: req.Bio, AvatarURL: req.AvatarURL,
		SetRadius: req.SearchRadiusKm.Set, SearchRadiusKm: req.SearchRadiusKm.Value,
	}
	if req.Phone != nil {
		p, err := valueobjects.NewPhone(*req.Phone)
		if err != nil {
			httpx.HandleError(w, r, err)
			return
		}
		upd.Phone = &p
	}
	if req.Currency != nil {
		c, err := valueobjects.NewCurrency(*req.Currency)
		if err != nil {
			httpx.HandleError(w, r, err)
			return
		}
		upd.Currency = &c
	}
	if req.Language != nil {
		if *req.Language == "" {
			upd.ClearLanguage = true
		} else {
			l, err := valueobjects.NewLanguage(*req.Language)
			if err != nil {
				httpx.HandleError(w, r, err)
				return
			}
			upd.Language = &l
		}
	}
	if req.Location != nil {
		coords, err := valueobjects.NewCoordinates(*req.Location.Latitude, *req.Location.Longitude)
		if err != nil {
			httpx.HandleError(w, r, err)
			return
		}
		upd.Location = &user.Location{Coordinates: coords, City: req.Location.City}
	}

	u, err := h.users.UpdateProfile(r.Context(), authmw.UserID(r.Context()), upd)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.OK(w, toUserDTO(u))
}
