package main

import (
	"database/sql"
	"flag"
	"fmt"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/yourtime/backend/internal/config"
	"github.com/yourtime/backend/internal/infrastructure/persistence/postgres"
)

func main() {
	cfg := config.Load()

	direction := flag.String("direction", "up", "Migration direction: up, down, status")
	flag.Parse()

	// goose needs database/sql, not pgxpool, so open via the pgx stdlib driver.
	db, err := sql.Open("pgx", postgres.DSN(&cfg.Database))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to connect to database: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := goose.SetDialect("postgres"); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to set dialect: %v\n", err)
		os.Exit(1)
	}

	migrationsDir := "internal/infrastructure/persistence/postgres/migrations"

	switch *direction {
	case "up":
		if err := goose.Up(db, migrationsDir); err != nil {
			fmt.Fprintf(os.Stderr, "Migration up failed: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Migrations applied successfully")
	case "down":
		if err := goose.Down(db, migrationsDir); err != nil {
			fmt.Fprintf(os.Stderr, "Migration down failed: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Migration rolled back successfully")
	case "status":
		if err := goose.Status(db, migrationsDir); err != nil {
			fmt.Fprintf(os.Stderr, "Migration status failed: %v\n", err)
			os.Exit(1)
		}
	default:
		fmt.Fprintf(os.Stderr, "Invalid direction: %s\n", *direction)
		os.Exit(1)
	}
}
