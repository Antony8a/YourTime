// Package wallet holds the use cases of the prepaid wallet: topping it up, quoting
// and charging the platform commission, redeeming codes, and the administrator's
// tools (commission, promotions, manual credits).
package wallet

import (
	"context"
	"errors"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
	"github.com/yourtime/backend/internal/domain/rates"
	"github.com/yourtime/backend/internal/domain/user"
	"github.com/yourtime/backend/internal/domain/wallet"
)

const (
	DefaultPageSize = 20
	MaxPageSize     = 50
)

// reference is the currency amounts set by the administrator are written in, and
// the pivot of the exchange rates.
const reference valueobjects.Currency = "USD"

// suggestedUSD are the top-up amounts offered, in USD minor units, shown in the
// person's own currency.
var suggestedUSD = []int64{500, 1000, 2500, 5000}

// Rates is what the wallet needs from the exchange-rate service.
type Rates interface {
	Today(ctx context.Context) (*rates.Snapshot, bool, error)
}

type Service struct {
	repo   wallet.Repository
	users  user.Repository
	rates  Rates
	admins map[string]struct{}
	now    func() time.Time
}

// NewService builds the service. adminEmails are the accounts allowed to use the
// administrator's tools; it comes from configuration so it cannot be changed from
// the app.
func NewService(repo wallet.Repository, users user.Repository, r Rates, adminEmails []string) *Service {
	admins := make(map[string]struct{}, len(adminEmails))
	for _, e := range adminEmails {
		if e = strings.ToLower(strings.TrimSpace(e)); e != "" {
			admins[e] = struct{}{}
		}
	}
	return &Service{repo: repo, users: users, rates: r, admins: admins, now: func() time.Time { return time.Now().UTC() }}
}

// ---- conversion --------------------------------------------------------------

func (s *Service) convert(ctx context.Context, amount int64, from, to valueobjects.Currency) (int64, error) {
	if from == to {
		return amount, nil
	}
	snap, _, err := s.rates.Today(ctx)
	if err != nil {
		return 0, err
	}
	v, ok := snap.Convert(amount, from, to)
	if !ok {
		return 0, rates.ErrUnavailable
	}
	return v, nil
}

// niceMinor rounds an amount to two significant digits, so a converted suggestion
// reads "16.000" and not "15.847".
func niceMinor(minor int64, c valueobjects.Currency) int64 {
	scale := math.Pow10(c.Decimals())
	major := float64(minor) / scale
	if major < 1 {
		return minor
	}
	step := math.Pow(10, math.Floor(math.Log10(major))-1)
	if step < 1/scale {
		step = 1 / scale
	}
	return int64(math.Round(math.Round(major/step) * step * scale))
}

// ---- the person's wallet -----------------------------------------------------

type View struct {
	Wallet            wallet.Wallet
	FeeBps            int
	DiscountBps       int
	TestTopupsEnabled bool
	// TestTopupMaxMinor is the largest test top-up, in the wallet's currency.
	TestTopupMaxMinor int64
	SuggestedMinor    []int64
	IsAdmin           bool
}

func (s *Service) isAdmin(ctx context.Context, userID uuid.UUID) (bool, error) {
	if len(s.admins) == 0 {
		return false, nil
	}
	u, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return false, err
	}
	_, ok := s.admins[u.Email.String()]
	return ok, nil
}

func (s *Service) requireAdmin(ctx context.Context, userID uuid.UUID) error {
	ok, err := s.isAdmin(ctx, userID)
	if err != nil {
		return err
	}
	if !ok {
		return wallet.ErrNotAdmin
	}
	return nil
}

func (s *Service) View(ctx context.Context, userID uuid.UUID) (*View, error) {
	w, err := s.repo.Get(ctx, userID)
	if err != nil {
		return nil, err
	}
	set, err := s.repo.Settings(ctx)
	if err != nil {
		return nil, err
	}
	discounts, err := s.repo.FeeDiscounts(ctx, userID, s.now())
	if err != nil {
		return nil, err
	}
	admin, err := s.isAdmin(ctx, userID)
	if err != nil {
		return nil, err
	}
	v := &View{Wallet: *w, FeeBps: set.FeeBps, DiscountBps: wallet.BestDiscount(discounts), TestTopupsEnabled: set.TestTopupsEnabled, IsAdmin: admin}
	v.SuggestedMinor = []int64{}
	if set.TestTopupsEnabled {
		// Without rates these stay empty rather than failing the whole screen.
		if max, err := s.convert(ctx, set.TestTopupMaxUSDMinor, reference, w.Currency); err == nil {
			v.TestTopupMaxMinor = max
			seen := map[int64]bool{}
			for _, usd := range suggestedUSD {
				if usd > set.TestTopupMaxUSDMinor {
					continue
				}
				if c, err := s.convert(ctx, usd, reference, w.Currency); err == nil {
					if n := niceMinor(c, w.Currency); n > 0 && n <= max && !seen[n] {
						seen[n] = true
						v.SuggestedMinor = append(v.SuggestedMinor, n)
					}
				}
			}
		}
	}
	return v, nil
}

func (s *Service) Transactions(ctx context.Context, userID uuid.UUID, limit, offset int) ([]wallet.Transaction, bool, error) {
	if limit <= 0 {
		limit = DefaultPageSize
	}
	if limit > MaxPageSize {
		limit = MaxPageSize
	}
	if offset < 0 {
		offset = 0
	}
	list, err := s.repo.Transactions(ctx, userID, limit+1, offset)
	if err != nil {
		return nil, false, err
	}
	more := len(list) > limit
	if more {
		list = list[:limit]
	}
	return list, more, nil
}

// Quote is what taking a task priced priceMinor (in priceCur) would cost the person
// in commission, in their wallet currency, and whether their balance covers it.
func (s *Service) Quote(ctx context.Context, userID uuid.UUID, priceMinor int64, priceCur valueobjects.Currency) (wallet.Quote, error) {
	w, err := s.repo.Get(ctx, userID)
	if err != nil {
		return wallet.Quote{}, err
	}
	set, err := s.repo.Settings(ctx)
	if err != nil {
		return wallet.Quote{}, err
	}
	discounts, err := s.repo.FeeDiscounts(ctx, userID, s.now())
	if err != nil {
		return wallet.Quote{}, err
	}
	disc := wallet.BestDiscount(discounts)
	q := wallet.Quote{Currency: w.Currency, BalanceMinor: w.BalanceMinor, Established: w.Established, FeeBps: set.FeeBps, DiscountBps: disc}
	if set.FeeBps == 0 || disc >= 10000 {
		return q, nil // nothing to convert
	}
	inWallet, err := s.convert(ctx, priceMinor, priceCur, w.Currency)
	if err != nil {
		return wallet.Quote{}, err
	}
	q.FeeMinor = wallet.FeeMinor(inWallet, set.FeeBps, disc)
	return q, nil
}

// ---- topping up and codes ----------------------------------------------------

type TopupResult struct {
	Currency     valueobjects.Currency
	BalanceMinor int64
	BonusMinor   int64
}

// creditWithRetry credits in the wallet's currency. If the account currency changed
// before the wallet existed, the amount is worked out again once.
func (s *Service) creditWithRetry(ctx context.Context, userID uuid.UUID, amountIn func(cur valueobjects.Currency) (int64, error), in wallet.CreditInput) (*wallet.CreditResult, error) {
	for attempt := 0; ; attempt++ {
		w, err := s.repo.Get(ctx, userID)
		if err != nil {
			return nil, err
		}
		amount, err := amountIn(w.Currency)
		if err != nil {
			return nil, err
		}
		in.UserID, in.AmountMinor, in.Currency, in.Now = userID, amount, w.Currency, s.now()
		res, err := s.repo.Credit(ctx, in)
		if errors.Is(err, wallet.ErrCurrencyMismatch) && attempt == 0 {
			continue
		}
		return res, err
	}
}

// TestTopup adds test credit to the person's own wallet. It exists so the app can be
// tried without real payments, and is switched off from the administrator's settings.
func (s *Service) TestTopup(ctx context.Context, userID uuid.UUID, amountMinor int64) (*TopupResult, error) {
	if amountMinor <= 0 {
		return nil, wallet.ErrInvalidAmount
	}
	set, err := s.repo.Settings(ctx)
	if err != nil {
		return nil, err
	}
	if !set.TestTopupsEnabled {
		return nil, wallet.ErrTestTopupsDisabled
	}
	res, err := s.creditWithRetry(ctx, userID, func(cur valueobjects.Currency) (int64, error) {
		max, err := s.convert(ctx, set.TestTopupMaxUSDMinor, reference, cur)
		if err != nil {
			return 0, err
		}
		if amountMinor > max {
			return 0, wallet.ErrAmountTooLarge
		}
		return amountMinor, nil
	}, wallet.CreditInput{Kind: wallet.KindTopupTest, ApplyBonus: true})
	if err != nil {
		return nil, err
	}
	return &TopupResult{Currency: res.Currency, BalanceMinor: res.BalanceMinor, BonusMinor: res.BonusMinor}, nil
}

type RedeemResult struct {
	Name          string
	Kind          wallet.PromoKind
	CreditedMinor int64
	Currency      valueobjects.Currency
	BalanceMinor  int64
	DiscountBps   int
}

// Redeem uses a promotional code: credit goes straight to the wallet, a fee discount
// applies from then on.
func (s *Service) Redeem(ctx context.Context, userID uuid.UUID, code string) (*RedeemResult, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return nil, wallet.ErrPromoNotFound
	}
	p, err := s.repo.PromotionByCode(ctx, code)
	if err != nil {
		if errors.Is(err, wallet.ErrPromotionNotFound) {
			return nil, wallet.ErrPromoNotFound
		}
		return nil, err
	}
	now := s.now()
	if p.Kind == wallet.PromoTopupBonus || !p.Redeemable(now) {
		return nil, wallet.ErrPromoUnavailable
	}
	out := &RedeemResult{Name: p.Name, Kind: p.Kind}
	for attempt := 0; ; attempt++ {
		w, err := s.repo.Get(ctx, userID)
		if err != nil {
			return nil, err
		}
		in := wallet.RedeemInput{UserID: userID, PromotionID: p.ID, Now: now, Currency: w.Currency}
		if p.Kind == wallet.PromoCreditGrant {
			if in.GrantMinor, err = s.convert(ctx, *p.AmountUSDMinor, reference, w.Currency); err != nil {
				return nil, err
			}
			out.CreditedMinor = in.GrantMinor
		}
		res, err := s.repo.Redeem(ctx, in)
		if errors.Is(err, wallet.ErrCurrencyMismatch) && attempt == 0 {
			continue
		}
		if err != nil {
			return nil, err
		}
		out.Currency, out.BalanceMinor = res.Currency, res.BalanceMinor
		break
	}
	if p.Kind == wallet.PromoFeeDiscount {
		out.DiscountBps = *p.ValueBps
	}
	return out, nil
}

// GrantSignup gives the sign-up credit, if the administrator set one. It is best
// effort: failing to give it must not fail the sign-up, so the caller only logs.
func (s *Service) GrantSignup(ctx context.Context, u *user.User) error {
	set, err := s.repo.Settings(ctx)
	if err != nil || set.SignupCreditUSDMinor <= 0 {
		return err
	}
	_, err = s.creditWithRetry(ctx, u.ID, func(cur valueobjects.Currency) (int64, error) {
		return s.convert(ctx, set.SignupCreditUSDMinor, reference, cur)
	}, wallet.CreditInput{Kind: wallet.KindSignupCredit})
	return err
}

// ---- administrator -----------------------------------------------------------

type AdminView struct {
	Settings wallet.Settings
	Totals   []wallet.FeeTotals
}

func (s *Service) AdminView(ctx context.Context, actor uuid.UUID) (*AdminView, error) {
	if err := s.requireAdmin(ctx, actor); err != nil {
		return nil, err
	}
	set, err := s.repo.Settings(ctx)
	if err != nil {
		return nil, err
	}
	totals, err := s.repo.Totals(ctx)
	if err != nil {
		return nil, err
	}
	return &AdminView{Settings: set, Totals: totals}, nil
}

func (s *Service) UpdateSettings(ctx context.Context, actor uuid.UUID, set wallet.Settings) (wallet.Settings, error) {
	if err := s.requireAdmin(ctx, actor); err != nil {
		return wallet.Settings{}, err
	}
	if err := set.Validate(); err != nil {
		return wallet.Settings{}, err
	}
	if err := s.repo.UpdateSettings(ctx, set, actor, s.now()); err != nil {
		return wallet.Settings{}, err
	}
	return s.repo.Settings(ctx)
}

func (s *Service) Promotions(ctx context.Context, actor uuid.UUID) ([]wallet.Promotion, error) {
	if err := s.requireAdmin(ctx, actor); err != nil {
		return nil, err
	}
	return s.repo.Promotions(ctx)
}

func (s *Service) CreatePromotion(ctx context.Context, actor uuid.UUID, p wallet.Promotion) (*wallet.Promotion, error) {
	if err := s.requireAdmin(ctx, actor); err != nil {
		return nil, err
	}
	p.Active = true
	if err := p.Validate(); err != nil {
		return nil, err
	}
	if err := s.repo.CreatePromotion(ctx, &p); err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *Service) UpdatePromotion(ctx context.Context, actor, id uuid.UUID, patch wallet.PromotionPatch) (*wallet.Promotion, error) {
	if err := s.requireAdmin(ctx, actor); err != nil {
		return nil, err
	}
	return s.repo.UpdatePromotion(ctx, id, patch)
}

// ManualCredit credits a person after they paid by some other means. The amount is
// written in any currency and converted into the person's wallet currency.
func (s *Service) ManualCredit(ctx context.Context, actor uuid.UUID, email string, amountMinor int64, currency, note string) (*TopupResult, error) {
	if err := s.requireAdmin(ctx, actor); err != nil {
		return nil, err
	}
	if amountMinor <= 0 {
		return nil, wallet.ErrInvalidAmount
	}
	cur, err := valueobjects.NewCurrency(currency)
	if err != nil {
		return nil, err
	}
	addr, err := valueobjects.NewEmail(email)
	if err != nil {
		return nil, err
	}
	target, err := s.users.GetByEmail(ctx, addr)
	if err != nil {
		return nil, err
	}
	res, err := s.creditWithRetry(ctx, target.ID, func(walletCur valueobjects.Currency) (int64, error) {
		return s.convert(ctx, amountMinor, cur, walletCur)
	}, wallet.CreditInput{Kind: wallet.KindTopupManual, Note: strings.TrimSpace(note), CreatedBy: &actor})
	if err != nil {
		return nil, err
	}
	return &TopupResult{Currency: res.Currency, BalanceMinor: res.BalanceMinor}, nil
}
