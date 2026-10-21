.PHONY: help install db-up db-down migrate seed backend mobile test test-backend test-shared typecheck format ci

COMPOSE = docker compose -f infra/docker/docker-compose.yml

help:
	@echo "install       Install JS dependencies (pnpm)"
	@echo "db-up         Start PostgreSQL in Docker"
	@echo "db-down       Stop PostgreSQL and delete its data"
	@echo "migrate       Apply database migrations"
	@echo "seed          Create demo people and tasks"
	@echo "backend       Run the API on :8080"
	@echo "mobile        Start the Expo dev server"
	@echo "test          Run every test suite"
	@echo "typecheck     Type-check shared packages and the mobile app"
	@echo "ci            What CI runs: typecheck + all tests"

install:
	pnpm install

db-up:
	$(COMPOSE) up -d postgres

db-down:
	$(COMPOSE) down -v

migrate:
	cd apps/backend && go run ./scripts/migrate -direction up

seed:
	cd apps/backend && go run ./scripts/seed

backend:
	cd apps/backend && go run ./cmd/server

mobile:
	pnpm --filter @yourtime/mobile start

test: test-backend test-shared

# Integration tests need a throwaway database: TEST_DATABASE_URL is wiped.
test-backend:
	cd apps/backend && go test -race -count=1 ./... && \
	  ( [ -z "$$TEST_DATABASE_URL" ] || go test -race -count=1 -tags integration ./internal/app/... )

test-shared:
	pnpm --filter @yourtime/shared-utils test

typecheck:
	pnpm typecheck

format:
	pnpm format
	cd apps/backend && gofmt -w -s .

ci: typecheck test
