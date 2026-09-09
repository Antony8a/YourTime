.PHONY: run dev test test-coverage lint generate migrate seed build clean wire mocks swagger

# Variables
BINARY_NAME=server
BUILD_DIR=bin
CMD_DIR=cmd/server
MIGRATE_CMD=go run ./scripts/migrate
SEED_CMD=go run ./scripts/seed
GENERATE_CMD=go run ./scripts/generate

# ===========================================
# DEVELOPMENT
# ===========================================
run:
	go run $(CMD_DIR)/main.go

dev:
	air -c .air.toml

# ===========================================
# TESTING
# ===========================================
test:
	go test -v -race -count=1 ./...

test-short:
	go test -v -short ./...

test-coverage:
	go test -v -race -coverprofile=coverage.out -covermode=atomic ./...
	go tool cover -func=coverage.out
	go tool cover -html=coverage.out -o coverage.html

test-integration:
	go test -v -tags=integration ./test/integration/...

test-bench:
	go test -bench=. -benchmem ./...

# ===========================================
# CODE QUALITY
# ===========================================
lint:
	golangci-lint run --timeout=5m

lint-fix:
	golangci-lint run --fix --timeout=5m

fmt:
	gofmt -w -s .
	goimports -w -local github.com/yourtime/backend .

vet:
	go vet ./...

staticcheck:
	staticcheck ./...

# ===========================================
# CODE GENERATION
# ===========================================
generate: wire mocks sqlc swagger

wire:
	cd $(CMD_DIR) && go run github.com/google/wire/cmd/wire

mocks:
	go generate ./...
	# Or use mockery: mockery --all --output=internal/mocks --outpkg=mocks

sqlc:
	sqlc generate

swagger:
	swag init -g $(CMD_DIR)/main.go -o api/docs --parseDependency --parseInternal

# ===========================================
# DATABASE
# ===========================================
migrate-up:
	$(MIGRATE_CMD) up

migrate-down:
	$(MIGRATE_CMD) down

migrate-status:
	$(MIGRATE_CMD) status

migrate-create:
	@read -p "Migration name: " name; \
	goose -dir internal/infrastructure/persistence/postgres/migrations create $$name sql

seed:
	$(SEED_CMD)

db-reset: migrate-down migrate-up seed

# ===========================================
# BUILD
# ===========================================
build:
	CGO_ENABLED=0 go build -ldflags="-s -w" -o $(BUILD_DIR)/$(BINARY_NAME) $(CMD_DIR)/main.go

build-linux:
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o $(BUILD_DIR)/$(BINARY_NAME)-linux $(CMD_DIR)/main.go

build-all: build-linux

# ===========================================
# DOCKER
# ===========================================
docker-build:
	docker build -f ../../infra/docker/Dockerfile.backend -t yourtime/backend:latest ../../

docker-run:
	docker run --rm -p 8080:8080 --env-file ../../infra/docker/.env.local yourtime/backend:latest

# ===========================================
# CLEAN
# ===========================================
clean:
	rm -rf $(BUILD_DIR) coverage.out coverage.html api/docs
	go clean -cache -testcache -modcache

# ===========================================
# HELPERS
# ===========================================
deps:
	go mod download
	go mod verify
	go mod tidy

deps-update:
	go get -u ./...
	go mod tidy

check: lint test build

ci: fmt lint test build

# ===========================================
# DEFAULT
# ===========================================
default: help

help:
	@echo "Available targets:"
	@echo "  run              - Run the server"
	@echo "  dev              - Run with hot reload (air)"
	@echo "  test             - Run all tests"
	@echo "  test-coverage    - Run tests with coverage"
	@echo "  lint             - Run golangci-lint"
	@echo "  lint-fix         - Run golangci-lint with auto-fix"
	@echo "  generate         - Generate all code (wire, mocks, sqlc, swagger)"
	@echo "  migrate-up       - Run migrations up"
	@echo "  migrate-down     - Run migrations down"
	@echo "  seed             - Seed database"
	@echo "  build            - Build binary"
	@echo "  clean            - Clean build artifacts"
	@echo "  check            - Run fmt, lint, test, build"