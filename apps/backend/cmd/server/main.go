package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/yourtime/backend/internal/app"
	"github.com/yourtime/backend/internal/config"
	"github.com/yourtime/backend/internal/infrastructure/persistence/postgres"
	"github.com/yourtime/backend/internal/platform/logger"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "fatal:", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	log := logger.New(cfg.Env)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if cfg.AutoMigrate {
		log.Info().Msg("Applying database migrations")
		if err := postgres.Migrate(cfg.DatabaseURL, "up"); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
	}

	pool, err := postgres.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	r := app.NewRouter(ctx, cfg, log, pool, app.Overrides{})

	addr := ":" + cfg.Port
	serverErr := make(chan error, 1)
	go func() {
		log.Info().Str("addr", addr).Str("env", cfg.Env).Msg("YourTime API listening")
		if err := r.Run(addr); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	select {
	case err := <-serverErr:
		return err
	case <-ctx.Done():
	}

	log.Info().Msg("Shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return r.Shutdown(shutdownCtx)
}
