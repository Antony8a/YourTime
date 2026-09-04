.PHONY: dev build test lint typecheck format clean db:up db:down db:migrate db:seed db:reset generate help

# ===========================================
# DESARROLLO
# ===========================================
dev:
	turbo run dev --parallel

dev-backend:
	cd apps/backend && air -c .air.toml

dev-web:
	cd apps/web && ng serve

dev-mobile:
	cd apps/mobile && npx expo start

# ===========================================
# BUILD
# ===========================================
build:
	turbo run build

build-backend:
	cd apps/backend && go build -o bin/server ./cmd/server

build-web:
	cd apps/web && ng build --configuration production

build-mobile:
	cd apps/mobile && npx expo export --platform web

# ===========================================
# TESTING
# ===========================================
test:
	turbo run test

test-coverage:
	turbo run test:coverage

test-watch:
	turbo run test:watch --parallel

# ===========================================
# CODE QUALITY
# ===========================================
lint:
	turbo run lint

lint-fix:
	turbo run lint:fix

typecheck:
	turbo run typecheck

format:
	prettier --write "**/*.{ts,tsx,js,json,html,scss,css,md,yaml,yml}"

format-check:
	prettier --check "**/*.{ts,tsx,js,json,html,scss,css,md,yaml,yml}"

# ===========================================
# DATABASE
# ===========================================
db:up:
	docker compose -f infra/docker/docker-compose.yml up -d

db:down:
	docker compose -f infra/docker/docker-compose.yml down -v

db:migrate:
	cd apps/backend && go run scripts/migrate.go up

db:migrate-down:
	cd apps/backend && go run scripts/migrate.go down

db:seed:
	cd apps/backend && go run scripts/seed.go

db:reset:
	pnpm run db:down && pnpm run db:up && sleep 3 && pnpm run db:migrate && pnpm run db:seed

# ===========================================
# CODE GENERATION
# ===========================================
generate:
	turbo run generate

generate-backend:
	cd apps/backend && go run scripts/generate.go

generate-types:
	cd packages/shared-types && npm run build

# ===========================================
# CLEANUP
# ===========================================
clean:
	turbo run clean
	rm -rf node_modules apps/*/node_modules packages/*/node_modules dist build coverage .turbo

# ===========================================
# CI
# ===========================================
ci: format-check lint typecheck test build

# ===========================================
# HELP
# ===========================================
help:
	@echo "YourTime - Makefile Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev              - Start all apps (backend, web, mobile)"
	@echo "  make dev-backend      - Start Go backend with hot reload"
	@echo "  make dev-web          - Start Angular dev server"
	@echo "  make dev-mobile       - Start Expo dev server"
	@echo ""
	@echo "Database:"
	@echo "  make db:up            - Start Docker Compose stack"
	@echo "  make db:down          - Stop and remove containers/volumes"
	@echo "  make db:migrate       - Run Goose migrations up"
	@echo "  make db:seed          - Seed database"
	@echo "  make db:reset         - Full DB reset (down + up + migrate + seed)"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint             - Run all linters"
	@echo "  make lint-fix         - Auto-fix lint issues"
	@echo "  make typecheck        - TypeScript + Go type checking"
	@echo "  make format           - Format with Prettier"
	@echo "  make format-check     - Check formatting"
	@echo ""
	@echo "Testing:"
	@echo "  make test             - Run all tests"
	@echo "  make test-coverage    - Run tests with coverage"
	@echo "  make test-watch       - Watch mode"
	@echo ""
	@echo "Build:"
	@echo "  make build            - Build all apps"
	@echo "  make build-backend    - Build Go binary"
	@echo "  make build-web        - Build Angular for production"
	@echo "  make build-mobile     - Build Expo for web"
	@echo ""
	@echo "Generation:"
	@echo "  make generate         - Generate all code (sqlc, wire, types)"
	@echo "  make generate-backend - Generate Go code only"
	@echo "  make generate-types   - Build shared-types package"
	@echo ""
	@echo "CI/CD:"
	@echo "  make ci               - Full CI pipeline (format, lint, typecheck, test, build)"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean            - Clean all build artifacts and node_modules"