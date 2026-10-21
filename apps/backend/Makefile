.PHONY: run dev test test-integration vet fmt build migrate seed

run:
	go run ./cmd/server

# Hot reload (requires https://github.com/air-verse/air).
dev:
	air -c .air.toml

test:
	go test -race -count=1 ./...

# TEST_DATABASE_URL must point at a throwaway database: it is wiped.
test-integration:
	go test -race -count=1 -tags integration ./internal/app/...

vet:
	go vet -tags integration ./...

fmt:
	gofmt -w -s .

build:
	CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/server ./cmd/server

migrate:
	go run ./scripts/migrate -direction up

seed:
	go run ./scripts/seed
