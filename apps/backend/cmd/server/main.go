package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/yourtime/backend/internal/config"
	"github.com/yourtime/backend/internal/infrastructure/http/router"
	"github.com/yourtime/backend/internal/platform/logger"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize logger
	log := logger.New(cfg.App.Env)

	log.Info().
		Str("version", "0.0.1-dev").
		Str("env", cfg.App.Env).
		Msg("Starting YourTime API server")

	// Initialize router with all routes and middleware
	r := router.New(cfg, log)

	// Start server
	addr := ":" + cfg.App.Port
	log.Info().Str("addr", addr).Msg("HTTP server listening")

	go func() {
		if err := r.Run(addr); err != nil {
			log.Fatal().Err(err).Msg("Server failed")
		}
	}()

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := r.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("Server forced to shutdown")
	}

	log.Info().Msg("Server exited")
}