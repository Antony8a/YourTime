//go:build wireinject
// +build wireinject

package main

import (
	"github.com/google/wire"
	"github.com/yourtime/backend/internal/config"
	"github.com/yourtime/backend/internal/infrastructure/http/router"
	"github.com/yourtime/backend/internal/platform/logger"
)

// InitializeServer initializes the HTTP router with all dependencies
func InitializeServer(cfg *config.Config) (*router.Router, error) {
	wire.Build(
		logger.New,
		router.New,
	)
	return nil, nil
}