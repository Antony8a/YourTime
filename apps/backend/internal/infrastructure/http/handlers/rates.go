package handlers

import (
	"net/http"
	"time"

	apprates "github.com/yourtime/backend/internal/application/rates"
	"github.com/yourtime/backend/internal/domain/rates"
	httpx "github.com/yourtime/backend/internal/infrastructure/http"
)

type RatesHandler struct {
	svc *apprates.Service
}

func NewRatesHandler(s *apprates.Service) *RatesHandler { return &RatesHandler{svc: s} }

// RatesDTO is today's exchange rates: how many units of each currency equal one
// unit of Base. Clients use it to show small conversions next to foreign prices.
type RatesDTO struct {
	// Date is the day the rates are for, YYYY-MM-DD (UTC).
	Date      string             `json:"date"`
	Base      string             `json:"base"`
	Rates     map[string]float64 `json:"rates"`
	FetchedAt time.Time          `json:"fetched_at"`
	// Stale is true when today's rates could not be fetched and older ones are served.
	Stale bool `json:"stale"`
}

// Get: GET /rates
func (h *RatesHandler) Get(w http.ResponseWriter, r *http.Request) {
	snap, stale, err := h.svc.Today(r.Context())
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	out := make(map[string]float64, len(snap.PerUSD))
	for cur, rate := range snap.PerUSD {
		out[cur.String()] = rate
	}
	// Rates change once a day, so clients may keep them for a while.
	w.Header().Set("Cache-Control", "private, max-age=3600")
	httpx.OK(w, RatesDTO{
		Date:      snap.Date.Format("2006-01-02"),
		Base:      rates.Base.String(),
		Rates:     out,
		FetchedAt: snap.FetchedAt,
		Stale:     stale,
	})
}
