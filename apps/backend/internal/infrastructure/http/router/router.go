package router

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/yourtime/backend/internal/config"
	"github.com/yourtime/backend/internal/infrastructure/http/middleware/auth"
	"github.com/yourtime/backend/internal/infrastructure/http/middleware/logging"
	"github.com/yourtime/backend/internal/infrastructure/http/middleware/ratelimit"
	"github.com/yourtime/backend/internal/infrastructure/http/middleware/recovery"
	"github.com/yourtime/backend/internal/infrastructure/http/middleware/validation"
	"github.com/yourtime/backend/internal/platform/logger"
)

type Router struct {
	router *chi.Mux
	server *http.Server
	logger logger.Logger
}

func New(cfg *config.Config, logger logger.Logger) *Router {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(recovery.New(logger))
	r.Use(logging.New(logger))
	r.Use(ratelimit.New(cfg))
	r.Use(validation.New())

	// CORS
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{cfg.App.WebURL, cfg.App.MobileURL},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// API routes
	r.Route("/api/v1", func(r chi.Router) {
		// Public routes
		r.Group(func(r chi.Router) {
			// Auth routes will be mounted here
		})

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(auth.New(cfg.JWT.Secret))
			// User, Task, Token, Message routes will be mounted here
		})
	})

	return &Router{
		router: r,
		logger: logger,
		server: &http.Server{
			Handler:      r,
			ReadTimeout:  15 * time.Second,
			WriteTimeout: 15 * time.Second,
			IdleTimeout:  60 * time.Second,
		},
	}
}

func (rt *Router) Run(addr string) error {
	rt.logger.Info().Str("addr", addr).Msg("Starting HTTP server")
	return rt.server.ListenAndServe()
}

func (rt *Router) Shutdown(ctx context.Context) error {
	rt.logger.Info().Msg("Gracefully shutting down HTTP server")
	return rt.server.Shutdown(ctx)
}

func (rt *Router) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	rt.router.ServeHTTP(w, r)
}