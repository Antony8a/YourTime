// Package router wires middleware and routes together.
package router

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/yourtime/backend/internal/infrastructure/http/handlers"
	"github.com/yourtime/backend/internal/infrastructure/http/middleware/auth"
	"github.com/yourtime/backend/internal/infrastructure/http/middleware/logging"
	"github.com/yourtime/backend/internal/infrastructure/http/middleware/ratelimit"
	"github.com/yourtime/backend/internal/infrastructure/http/middleware/recovery"
	"github.com/yourtime/backend/internal/platform/logger"
)

// Options carries everything the router needs. Handlers are built by the
// caller (composition root) so this package stays free of business wiring.
type Options struct {
	Logger       logger.Logger
	CORSOrigins  []string
	TrustProxy   bool
	TokenParser  auth.AccessParser
	Auth         *handlers.AuthHandler
	Me           *handlers.MeHandler
	Tasks        *handlers.TaskHandler
	Applications *handlers.ApplicationHandler
	Reviews      *handlers.ReviewHandler
	Balance      *handlers.BalanceHandler
	Rates        *handlers.RatesHandler

	// Per-IP request budgets per minute. Zero selects the defaults.
	GlobalPerMinute int
	AuthPerMinute   int
}

type Router struct {
	mux    *chi.Mux
	server *http.Server
	log    logger.Logger
}

func New(ctx context.Context, o Options) *Router {
	if o.GlobalPerMinute == 0 {
		o.GlobalPerMinute = 300
	}
	if o.AuthPerMinute == 0 {
		o.AuthPerMinute = 20
	}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	if o.TrustProxy {
		r.Use(middleware.RealIP)
	}
	r.Use(recovery.New(o.Logger))
	r.Use(logging.New(o.Logger))
	r.Use(ratelimit.New(ctx, o.GlobalPerMinute, time.Minute))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: o.CORSOrigins,
		AllowedMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type"},
		MaxAge:         300,
	}))

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	r.Route("/api/v1", func(r chi.Router) {
		// Public.
		r.Get("/categories", o.Tasks.Categories)
		r.Group(func(r chi.Router) {
			r.Use(ratelimit.New(ctx, o.AuthPerMinute, time.Minute))
			r.Post("/auth/register", o.Auth.Register)
			r.Post("/auth/login", o.Auth.Login)
			r.Post("/auth/refresh", o.Auth.Refresh)
		})

		// Authenticated.
		r.Group(func(r chi.Router) {
			r.Use(auth.New(o.TokenParser))

			r.Get("/me", o.Me.Get)
			r.Patch("/me", o.Me.Update)
			r.Get("/me/tasks", o.Tasks.Mine)
			r.Get("/me/applications", o.Applications.Mine)
			r.Get("/me/active", o.Tasks.Active)
			r.Get("/me/balance", o.Balance.Get)
			r.Get("/rates", o.Rates.Get)

			r.Get("/tasks", o.Tasks.List)
			r.Post("/tasks", o.Tasks.Create)
			r.Route("/tasks/{id}", func(r chi.Router) {
				r.Get("/", o.Tasks.Get)
				r.Put("/", o.Tasks.Update)
				r.Post("/cancel", o.Tasks.Cancel)
				r.Post("/complete", o.Tasks.Complete)
				r.Post("/start-route", o.Tasks.StartRoute)
				r.Post("/start-service", o.Tasks.StartService)
				r.Post("/release", o.Tasks.Release)
				r.Post("/location", o.Tasks.UpdateLocation)
				r.Get("/applications", o.Applications.ListForTask)
				r.Post("/applications", o.Applications.Apply)
				r.Post("/reviews", o.Reviews.Create)
			})

			r.Post("/applications/{id}/accept", o.Applications.Accept)
			r.Post("/applications/{id}/reject", o.Applications.Reject)
			r.Post("/applications/{id}/withdraw", o.Applications.Withdraw)

			r.Post("/reviews/{id}/reply", o.Reviews.Reply)
			r.Get("/users/{id}", o.Reviews.Profile)
			r.Get("/users/{id}/reviews", o.Reviews.ForUser)
		})
	})

	return &Router{
		mux: r,
		log: o.Logger,
		server: &http.Server{
			Handler:           r,
			ReadHeaderTimeout: 5 * time.Second,
			ReadTimeout:       15 * time.Second,
			WriteTimeout:      30 * time.Second,
			IdleTimeout:       60 * time.Second,
		},
	}
}

func (rt *Router) Run(addr string) error {
	rt.server.Addr = addr
	return rt.server.ListenAndServe()
}

func (rt *Router) Shutdown(ctx context.Context) error { return rt.server.Shutdown(ctx) }

// ServeHTTP lets tests drive the router with httptest.
func (rt *Router) ServeHTTP(w http.ResponseWriter, r *http.Request) { rt.mux.ServeHTTP(w, r) }
