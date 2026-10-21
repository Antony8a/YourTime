package handlers

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	appbalance "github.com/yourtime/backend/internal/application/balance"
	"github.com/yourtime/backend/internal/domain/balance"
	httpx "github.com/yourtime/backend/internal/infrastructure/http"
	authmw "github.com/yourtime/backend/internal/infrastructure/http/middleware/auth"
)

type BalanceHandler struct {
	svc *appbalance.Service
}

func NewBalanceHandler(s *appbalance.Service) *BalanceHandler { return &BalanceHandler{svc: s} }

type BalanceTotalDTO struct {
	Currency   string `json:"currency"`
	TotalMinor int64  `json:"total_minor"`
	Count      int    `json:"count"`
}

type BalanceCategoryDTO struct {
	Name  string `json:"name"`
	Icon  string `json:"icon"`
	Color string `json:"color"`
}

type BalanceCounterpartDTO struct {
	ID        uuid.UUID `json:"id"`
	FullName  string    `json:"full_name"`
	AvatarURL *string   `json:"avatar_url"`
}

type BalanceEntryDTO struct {
	TaskID      uuid.UUID             `json:"task_id"`
	Title       string                `json:"title"`
	Category    BalanceCategoryDTO    `json:"category"`
	Counterpart BalanceCounterpartDTO `json:"counterpart"`
	Currency    string                `json:"currency"`
	AmountMinor int64                 `json:"amount_minor"`
	CompletedAt time.Time             `json:"completed_at"`
	// ConvertedMinor is the amount in the person's currency, at the rate of the
	// day it was finished. Null when it already is in that currency.
	ConvertedMinor *int64 `json:"converted_minor"`
}

// BalanceConvertedDTO is a side added up in the person's own currency.
type BalanceConvertedDTO struct {
	Currency    string `json:"currency"`
	TotalMinor  int64  `json:"total_minor"`
	Approximate bool   `json:"approximate"`
	Partial     bool   `json:"partial"`
}

type BalanceSideDTO struct {
	Totals  []BalanceTotalDTO `json:"totals"`
	Entries []BalanceEntryDTO `json:"entries"`
	HasMore bool              `json:"has_more"`
	// Converted adds every currency up in the account currency; null when none could be converted.
	Converted *BalanceConvertedDTO `json:"converted"`
}

type BalanceDTO struct {
	// Currency is the account currency that conversions are into.
	Currency string         `json:"currency"`
	From     *time.Time     `json:"from"`
	To       *time.Time     `json:"to"`
	Earned   BalanceSideDTO `json:"earned"`
	Spent    BalanceSideDTO `json:"spent"`
}

func toBalanceSideDTO(s balance.Side) BalanceSideDTO {
	out := BalanceSideDTO{
		Totals:  make([]BalanceTotalDTO, 0, len(s.Totals)),
		Entries: make([]BalanceEntryDTO, 0, len(s.Entries)),
		HasMore: s.HasMore,
	}
	for _, t := range s.Totals {
		out.Totals = append(out.Totals, BalanceTotalDTO{Currency: t.Currency.String(), TotalMinor: t.TotalMinor, Count: t.Count})
	}
	for _, e := range s.Entries {
		out.Entries = append(out.Entries, BalanceEntryDTO{
			TaskID:         e.TaskID,
			Title:          e.Title,
			Category:       BalanceCategoryDTO{Name: e.Category.Name, Icon: e.Category.Icon, Color: e.Category.Color},
			Counterpart:    BalanceCounterpartDTO{ID: e.Counterpart.ID, FullName: e.Counterpart.FullName, AvatarURL: e.Counterpart.AvatarURL},
			Currency:       e.Currency.String(),
			AmountMinor:    e.AmountMinor,
			CompletedAt:    e.CompletedAt,
			ConvertedMinor: e.ConvertedMinor,
		})
	}
	if c := s.Converted; c != nil {
		out.Converted = &BalanceConvertedDTO{Currency: c.Currency.String(), TotalMinor: c.TotalMinor, Approximate: c.Approximate, Partial: c.Partial}
	}
	return out
}

func queryTime(w http.ResponseWriter, r *http.Request, key string) (*time.Time, bool) {
	raw := r.URL.Query().Get(key)
	if raw == "" {
		return nil, true
	}
	t, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		httpx.Problem(w, r, http.StatusBadRequest, "Invalid date for "+key+" (use RFC 3339, e.g. 2026-01-31T05:00:00Z)")
		return nil, false
	}
	return &t, true
}

// Get: GET /me/balance?from=...&to=...
// What the caller earned doing services and paid for services they requested,
// between from (inclusive) and to (exclusive). Both are optional RFC 3339 times.
func (h *BalanceHandler) Get(w http.ResponseWriter, r *http.Request) {
	from, ok := queryTime(w, r, "from")
	if !ok {
		return
	}
	to, ok := queryTime(w, r, "to")
	if !ok {
		return
	}
	rep, err := h.svc.Report(r.Context(), authmw.UserID(r.Context()), from, to)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.OK(w, BalanceDTO{
		Currency: rep.Currency.String(),
		From:     rep.Period.From,
		To:       rep.Period.To,
		Earned:   toBalanceSideDTO(rep.Earned),
		Spent:    toBalanceSideDTO(rep.Spent),
	})
}
