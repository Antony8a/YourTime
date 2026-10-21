// Command migrate applies or rolls back embedded database migrations.
//
//	go run ./scripts/migrate -direction up|down|status
package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/yourtime/backend/internal/config"
	"github.com/yourtime/backend/internal/infrastructure/persistence/postgres"
)

func main() {
	direction := flag.String("direction", "up", "up, down (one step) or status")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if err := postgres.Migrate(cfg.DatabaseURL, *direction); err != nil {
		fmt.Fprintln(os.Stderr, "migration failed:", err)
		os.Exit(1)
	}
}
