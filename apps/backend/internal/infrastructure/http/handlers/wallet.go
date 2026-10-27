package handlers

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	appwallet "github.com/yourtime/backend/internal/application/wallet"
	"github.com/yourtime/backend/internal/domain/wallet"
	httpx "github.com/yourtime/backend/internal/infrastructure/http"
	authmw "github.com/yourtime/backend/internal/infrastructure/http/middleware/auth"
)

// FeeQuoteFunc is how the wallet screens ask what taking a task would cost.
type FeeQuoteFunc func(r *http.Request, userID, taskID uuid.UUID, priceMinor int64) (wallet.Quote, error)

type WalletHandler struct {
	svc   *appwallet.Service
	quote FeeQuoteFunc
}

func NewWalletHandler(s *appwallet.Service, quote FeeQuoteFunc) *WalletHandler {
	return &WalletHandler{svc: s, quote: quote}
}

// ---- the person's wallet ----------------------------------------------------

type WalletDTO struct {
	Currency     string `json:"currency"`
	BalanceMinor int64  `json:"balance_minor"`
	// Established is true once the wallet has been credited. From then on its
	// currency, and so the account's, can no longer change.
	Established bool `json:"established"`
	// FeeBps is the commission in basis points of the agreed price; DiscountBps the
	// share of it waived for this person right now.
	FeeBps      int `json:"fee_bps"`
	DiscountBps int `json:"discount_bps"`
	// Test top-ups: whether they are on, the largest one and the amounts offered, in
	// the wallet currency.
	TestTopupsEnabled bool    `json:"test_topups_enabled"`
	TestTopupMaxMinor int64   `json:"test_topup_max_minor"`
	SuggestedMinor    []int64 `json:"suggested_topups_minor"`
	IsAdmin           bool    `json:"is_admin"`
}

func (h *WalletHandler) Get(w http.ResponseWriter, r *http.Request) {
	v, err := h.svc.View(r.Context(), authmw.UserID(r.Context()))
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.OK(w, WalletDTO{
		Currency: v.Wallet.Currency.String(), BalanceMinor: v.Wallet.BalanceMinor, Established: v.Wallet.Established,
		FeeBps: v.FeeBps, DiscountBps: v.DiscountBps, TestTopupsEnabled: v.TestTopupsEnabled,
		TestTopupMaxMinor: v.TestTopupMaxMinor, SuggestedMinor: v.SuggestedMinor, IsAdmin: v.IsAdmin,
	})
}

type WalletTransactionDTO struct {
	ID                uuid.UUID  `json:"id"`
	Kind              string     `json:"kind"`
	AmountMinor       int64      `json:"amount_minor"`
	BalanceAfterMinor int64      `json:"balance_after_minor"`
	Currency          string     `json:"currency"`
	TaskID            *uuid.UUID `json:"task_id"`
	TaskTitle         *string    `json:"task_title"`
	Note              *string    `json:"note"`
	CreatedAt         time.Time  `json:"created_at"`
}

func (h *WalletHandler) Transactions(w http.ResponseWriter, r *http.Request) {
	limit, ok := queryInt(w, r, "limit")
	if !ok {
		return
	}
	offset, ok := queryInt(w, r, "offset")
	if !ok {
		return
	}
	list, more, err := h.svc.Transactions(r.Context(), authmw.UserID(r.Context()), limit, offset)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	out := make([]WalletTransactionDTO, 0, len(list))
	for _, t := range list {
		d := WalletTransactionDTO{
			ID: t.ID, Kind: string(t.Kind), AmountMinor: t.AmountMinor, BalanceAfterMinor: t.BalanceAfterMinor,
			Currency: t.Currency.String(), TaskID: t.TaskID, CreatedAt: t.CreatedAt,
		}
		if t.TaskTitle != "" {
			d.TaskTitle = &t.TaskTitle
		}
		if t.Note != "" {
			d.Note = &t.Note
		}
		out = append(out, d)
	}
	if limit <= 0 {
		limit = appwallet.DefaultPageSize
	}
	httpx.OKMeta(w, out, map[string]any{"has_more": more, "limit": limit, "offset": offset})
}

type topupRequest struct {
	AmountMinor int64 `json:"amount_minor" validate:"required,gt=0"`
}

type TopupDTO struct {
	Currency     string `json:"currency"`
	BalanceMinor int64  `json:"balance_minor"`
	BonusMinor   int64  `json:"bonus_minor"`
}

func (h *WalletHandler) TestTopup(w http.ResponseWriter, r *http.Request) {
	var req topupRequest
	if !decode(w, r, &req) {
		return
	}
	res, err := h.svc.TestTopup(r.Context(), authmw.UserID(r.Context()), req.AmountMinor)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.OK(w, TopupDTO{Currency: res.Currency.String(), BalanceMinor: res.BalanceMinor, BonusMinor: res.BonusMinor})
}

type redeemRequest struct {
	Code string `json:"code" validate:"required,max=40"`
}

type RedeemDTO struct {
	Name          string `json:"name"`
	Kind          string `json:"kind"`
	CreditedMinor int64  `json:"credited_minor"`
	Currency      string `json:"currency"`
	BalanceMinor  int64  `json:"balance_minor"`
	DiscountBps   int    `json:"discount_bps"`
}

func (h *WalletHandler) Redeem(w http.ResponseWriter, r *http.Request) {
	var req redeemRequest
	if !decode(w, r, &req) {
		return
	}
	res, err := h.svc.Redeem(r.Context(), authmw.UserID(r.Context()), req.Code)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.OK(w, RedeemDTO{
		Name: res.Name, Kind: string(res.Kind), CreditedMinor: res.CreditedMinor,
		Currency: res.Currency.String(), BalanceMinor: res.BalanceMinor, DiscountBps: res.DiscountBps,
	})
}

// ---- the cost of taking a task ----------------------------------------------

type FeeQuoteDTO struct {
	FeeMinor     int64  `json:"fee_minor"`
	Currency     string `json:"currency"`
	BalanceMinor int64  `json:"balance_minor"`
	Enough       bool   `json:"enough"`
	Established  bool   `json:"established"`
	FeeBps       int    `json:"fee_bps"`
	DiscountBps  int    `json:"discount_bps"`
}

// FeeQuote: GET /tasks/{id}/fee-quote?price_minor=N
func (h *WalletHandler) FeeQuote(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	price, ok := queryInt(w, r, "price_minor")
	if !ok {
		return
	}
	if price <= 0 {
		httpx.HandleError(w, r, wallet.ErrInvalidAmount)
		return
	}
	q, err := h.quote(r, authmw.UserID(r.Context()), id, int64(price))
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.OK(w, FeeQuoteDTO{
		FeeMinor: q.FeeMinor, Currency: q.Currency.String(), BalanceMinor: q.BalanceMinor, Enough: q.Enough(),
		Established: q.Established, FeeBps: q.FeeBps, DiscountBps: q.DiscountBps,
	})
}

// ---- administrator ----------------------------------------------------------

type SettingsDTO struct {
	FeeBps               int       `json:"fee_bps"`
	TestTopupsEnabled    bool      `json:"test_topups_enabled"`
	TestTopupMaxUSDMinor int64     `json:"test_topup_max_usd_minor"`
	SignupCreditUSDMinor int64     `json:"signup_credit_usd_minor"`
	UpdatedAt            time.Time `json:"updated_at"`
}

func toSettingsDTO(s wallet.Settings) SettingsDTO {
	return SettingsDTO{
		FeeBps: s.FeeBps, TestTopupsEnabled: s.TestTopupsEnabled, TestTopupMaxUSDMinor: s.TestTopupMaxUSDMinor,
		SignupCreditUSDMinor: s.SignupCreditUSDMinor, UpdatedAt: s.UpdatedAt,
	}
}

type FeeTotalsDTO struct {
	Currency         string `json:"currency"`
	NetFeesMinor     int64  `json:"net_fees_minor"`
	OutstandingMinor int64  `json:"outstanding_minor"`
	Wallets          int    `json:"wallets"`
}

type AdminDTO struct {
	Settings SettingsDTO    `json:"settings"`
	Totals   []FeeTotalsDTO `json:"totals"`
}

func (h *WalletHandler) AdminOverview(w http.ResponseWriter, r *http.Request) {
	v, err := h.svc.AdminView(r.Context(), authmw.UserID(r.Context()))
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	out := AdminDTO{Settings: toSettingsDTO(v.Settings), Totals: make([]FeeTotalsDTO, 0, len(v.Totals))}
	for _, t := range v.Totals {
		out.Totals = append(out.Totals, FeeTotalsDTO{Currency: t.Currency.String(), NetFeesMinor: t.NetFeesMinor, OutstandingMinor: t.OutstandingMinor, Wallets: t.Wallets})
	}
	httpx.OK(w, out)
}

type settingsRequest struct {
	FeeBps               *int   `json:"fee_bps" validate:"required,gte=0,lte=10000"`
	TestTopupsEnabled    *bool  `json:"test_topups_enabled" validate:"required"`
	TestTopupMaxUSDMinor *int64 `json:"test_topup_max_usd_minor" validate:"required,gte=0"`
	SignupCreditUSDMinor *int64 `json:"signup_credit_usd_minor" validate:"required,gte=0"`
}

func (h *WalletHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var req settingsRequest
	if !decode(w, r, &req) {
		return
	}
	s, err := h.svc.UpdateSettings(r.Context(), authmw.UserID(r.Context()), wallet.Settings{
		FeeBps: *req.FeeBps, TestTopupsEnabled: *req.TestTopupsEnabled,
		TestTopupMaxUSDMinor: *req.TestTopupMaxUSDMinor, SignupCreditUSDMinor: *req.SignupCreditUSDMinor,
	})
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.OK(w, toSettingsDTO(s))
}

type PromotionDTO struct {
	ID               uuid.UUID  `json:"id"`
	Name             string     `json:"name"`
	Code             *string    `json:"code"`
	Kind             string     `json:"kind"`
	ValueBps         *int       `json:"value_bps"`
	AmountUSDMinor   *int64     `json:"amount_usd_minor"`
	StartsAt         *time.Time `json:"starts_at"`
	EndsAt           *time.Time `json:"ends_at"`
	Active           bool       `json:"active"`
	MaxRedemptions   *int       `json:"max_redemptions"`
	RedemptionsCount int        `json:"redemptions_count"`
	CreatedAt        time.Time  `json:"created_at"`
}

func toPromotionDTO(p wallet.Promotion) PromotionDTO {
	return PromotionDTO{
		ID: p.ID, Name: p.Name, Code: p.Code, Kind: string(p.Kind), ValueBps: p.ValueBps, AmountUSDMinor: p.AmountUSDMinor,
		StartsAt: p.StartsAt, EndsAt: p.EndsAt, Active: p.Active, MaxRedemptions: p.MaxRedemptions,
		RedemptionsCount: p.RedemptionsCount, CreatedAt: p.CreatedAt,
	}
}

func (h *WalletHandler) Promotions(w http.ResponseWriter, r *http.Request) {
	list, err := h.svc.Promotions(r.Context(), authmw.UserID(r.Context()))
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	out := make([]PromotionDTO, 0, len(list))
	for _, p := range list {
		out = append(out, toPromotionDTO(p))
	}
	httpx.OK(w, out)
}

type createPromotionRequest struct {
	Name           string     `json:"name" validate:"required,max=100"`
	Code           *string    `json:"code" validate:"omitempty,max=40"`
	Kind           string     `json:"kind" validate:"required,oneof=topup_bonus fee_discount credit_grant"`
	ValueBps       *int       `json:"value_bps" validate:"omitempty,gte=1,lte=10000"`
	AmountUSDMinor *int64     `json:"amount_usd_minor" validate:"omitempty,gt=0"`
	StartsAt       *time.Time `json:"starts_at"`
	EndsAt         *time.Time `json:"ends_at"`
	MaxRedemptions *int       `json:"max_redemptions" validate:"omitempty,gte=1"`
}

func (h *WalletHandler) CreatePromotion(w http.ResponseWriter, r *http.Request) {
	var req createPromotionRequest
	if !decode(w, r, &req) {
		return
	}
	p, err := h.svc.CreatePromotion(r.Context(), authmw.UserID(r.Context()), wallet.Promotion{
		Name: req.Name, Code: req.Code, Kind: wallet.PromoKind(req.Kind), ValueBps: req.ValueBps,
		AmountUSDMinor: req.AmountUSDMinor, StartsAt: req.StartsAt, EndsAt: req.EndsAt, MaxRedemptions: req.MaxRedemptions,
	})
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.Created(w, toPromotionDTO(*p))
}

type patchPromotionRequest struct {
	Name           *string    `json:"name" validate:"omitempty,max=100"`
	Active         *bool      `json:"active"`
	StartsAt       *time.Time `json:"starts_at"`
	EndsAt         *time.Time `json:"ends_at"`
	ClearEnds      bool       `json:"clear_ends"`
	MaxRedemptions *int       `json:"max_redemptions" validate:"omitempty,gte=1"`
}

func (h *WalletHandler) UpdatePromotion(w http.ResponseWriter, r *http.Request) {
	id, ok := pathUUID(w, r, "id")
	if !ok {
		return
	}
	var req patchPromotionRequest
	if !decode(w, r, &req) {
		return
	}
	p, err := h.svc.UpdatePromotion(r.Context(), authmw.UserID(r.Context()), id, wallet.PromotionPatch{
		Name: req.Name, Active: req.Active, StartsAt: req.StartsAt, EndsAt: req.EndsAt,
		ClearEnds: req.ClearEnds, MaxRedemptions: req.MaxRedemptions,
	})
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.OK(w, toPromotionDTO(*p))
}

type manualCreditRequest struct {
	Email       string `json:"email" validate:"required,email,max=254"`
	AmountMinor int64  `json:"amount_minor" validate:"required,gt=0"`
	Currency    string `json:"currency" validate:"required,len=3"`
	Note        string `json:"note" validate:"max=200"`
}

func (h *WalletHandler) ManualCredit(w http.ResponseWriter, r *http.Request) {
	var req manualCreditRequest
	if !decode(w, r, &req) {
		return
	}
	res, err := h.svc.ManualCredit(r.Context(), authmw.UserID(r.Context()), req.Email, req.AmountMinor, req.Currency, req.Note)
	if err != nil {
		httpx.HandleError(w, r, err)
		return
	}
	httpx.OK(w, TopupDTO{Currency: res.Currency.String(), BalanceMinor: res.BalanceMinor})
}
