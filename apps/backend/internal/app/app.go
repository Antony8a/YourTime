// Package app is the composition root: it builds every dependency once and
// hands back a ready-to-run router. Both the server binary and the end-to-end
// tests use it, so what is tested is what is shipped.
package app

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/yourtime/backend/internal/application/auth"
	appbalance "github.com/yourtime/backend/internal/application/balance"
	apprates "github.com/yourtime/backend/internal/application/rates"
	"github.com/yourtime/backend/internal/application/reviews"
	"github.com/yourtime/backend/internal/application/tasks"
	appwallet "github.com/yourtime/backend/internal/application/wallet"
	"github.com/yourtime/backend/internal/config"
	"github.com/yourtime/backend/internal/domain/rates"
	"github.com/yourtime/backend/internal/domain/user"
	"github.com/yourtime/backend/internal/domain/wallet"
	"github.com/yourtime/backend/internal/infrastructure/http/handlers"
	"github.com/yourtime/backend/internal/infrastructure/http/router"
	"github.com/yourtime/backend/internal/infrastructure/persistence/postgres"
	httprates "github.com/yourtime/backend/internal/infrastructure/rates"
	"github.com/yourtime/backend/internal/infrastructure/security"
	"github.com/yourtime/backend/internal/platform/logger"
)

type Overrides struct {
	// GlobalPerMinute and AuthPerMinute override rate limits (tests raise them).
	GlobalPerMinute int
	AuthPerMinute   int
	// RatesProvider replaces the public exchange-rate sources (tests use a fixed one).
	RatesProvider rates.Provider
	// NoRatesJob skips the background refresh, so nothing reaches the network.
	NoRatesJob bool
}

// ratesRefreshEvery is how often the background job asks for fresh rates. The
// sources update once a day; checking a few times a day keeps a restart or a
// failed fetch from leaving the day without rates for long.
const ratesRefreshEvery = 6 * time.Hour

func NewRouter(ctx context.Context, cfg *config.Config, log logger.Logger, pool *pgxpool.Pool, ov Overrides) *router.Router {
	userRepo := postgres.NewUserRepo(pool)
	taskRepo := postgres.NewTaskRepo(pool)
	appRepo := postgres.NewApplicationRepo(pool)
	reviewRepo := postgres.NewReviewRepo(pool)
	balanceRepo := postgres.NewBalanceRepo(pool)
	ratesRepo := postgres.NewRatesRepo(pool)
	walletRepo := postgres.NewWalletRepo(pool)

	jwt := security.NewJWTManager(cfg.JWT.Secret, cfg.JWT.AccessTTL, cfg.JWT.RefreshTTL)
	userSvc := user.NewService(userRepo)
	authSvc := auth.NewService(userSvc, jwt)
	if !cfg.RegistrationOpen {
		authSvc.CloseRegistration()
	}
	taskSvc := tasks.NewService(taskRepo, appRepo, userRepo, reviewRepo)
	reviewSvc := reviews.NewService(reviewRepo, taskRepo)
	var provider rates.Provider = httprates.NewHTTPProvider()
	if ov.RatesProvider != nil {
		provider = ov.RatesProvider
	}
	ratesSvc := apprates.NewService(ratesRepo, provider)
	if !ov.NoRatesJob {
		go ratesSvc.Run(ctx, ratesRefreshEvery)
	}
	balanceSvc := appbalance.NewService(balanceRepo, userRepo, ratesSvc)
	walletSvc := appwallet.NewService(walletRepo, userRepo, ratesSvc, cfg.AdminEmails)
	taskSvc.WithFees(walletSvc)
	authSvc.OnRegistered(func(ctx context.Context, u *user.User) {
		if err := walletSvc.GrantSignup(ctx, u); err != nil {
			log.Warn().Err(err).Str("user", u.ID.String()).Msg("Could not give the sign-up credit")
		}
	})

	return router.New(ctx, router.Options{
		Logger:       log,
		CORSOrigins:  cfg.CORSOrigins,
		TrustProxy:   cfg.TrustProxy,
		TokenParser:  jwt,
		Auth:         handlers.NewAuthHandler(authSvc),
		Me:           handlers.NewMeHandler(userSvc),
		Tasks:        handlers.NewTaskHandler(taskSvc),
		Applications: handlers.NewApplicationHandler(taskSvc),
		Reviews:      handlers.NewReviewHandler(reviewSvc),
		Balance:      handlers.NewBalanceHandler(balanceSvc),
		Rates:        handlers.NewRatesHandler(ratesSvc),
		Wallet: handlers.NewWalletHandler(walletSvc, func(r *http.Request, userID, taskID uuid.UUID, priceMinor int64) (wallet.Quote, error) {
			return taskSvc.FeeQuote(r.Context(), userID, taskID, priceMinor)
		}),
		GlobalPerMinute: ov.GlobalPerMinute,
		AuthPerMinute:   ov.AuthPerMinute,
	})
}
