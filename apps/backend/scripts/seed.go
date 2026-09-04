package main

import (
	"context"
	"fmt"
	"os"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/yourtime/backend/internal/config"
	"github.com/yourtime/backend/internal/infrastructure/persistence/postgres"
)

func main() {
	cfg := config.Load()

	pool, err := postgres.NewPool(&cfg.Database)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to connect to database: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	ctx := context.Background()
	tx, err := pool.Begin(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to begin transaction: %v\n", err)
		os.Exit(1)
	}
	defer tx.Rollback(ctx)

	// Seed categories
	categories := []struct {
		ID      uuid.UUID
		Name    string
		Slug    string
		Icon    string
		Color   string
		Sort    int
	}{
		{uuid.New(), "Reparaciones del Hogar", "reparaciones-hogar", "home", "#3B82F6", 1},
		{uuid.New(), "Limpieza", "limpieza", "sparkles", "#10B981", 2},
		{uuid.New(), "Jardinería", "jardineria", "leaf", "#84CC16", 3},
		{uuid.New(), "Mudanzas y Transporte", "mudanzas", "truck", "#F59E0B", 4},
		{uuid.New(), "Tecnología", "tecnologia", "laptop", "#8B5CF6", 5},
		{uuid.New(), "Clases y Tutorías", "clases", "graduation-cap", "#EC4899", 6},
		{uuid.New(), "Eventos y Fotografía", "eventos", "camera", "#EF4444", 7},
		{uuid.New(), "Otros Servicios", "otros", "tool", "#6B7280", 8},
	}

	for _, cat := range categories {
		_, err := tx.Exec(ctx, `
			INSERT INTO categories (id, name, slug, icon, color, sort_order, is_active, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
			ON CONFLICT (slug) DO NOTHING
		`, cat.ID, cat.Name, cat.Slug, cat.Icon, cat.Color, cat.Sort)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to seed category %s: %v\n", cat.Name, err)
			os.Exit(1)
		}
	}

	// Seed platform config
	configs := []struct {
		Key       string
		Value     string
		Desc      string
	}{
		{"token_exchange_rate", `{"buy": 100, "sell": 90}`, "Tokens por dólar: compra 100, venta 90"},
		{"platform_fee_percent", `{"task": 10, "withdrawal": 5}`, "Comisión plataforma: 10% tareas, 5% retiros"},
		{"min_withdrawal_tokens", `1000`, "Mínimo tokens para retirar"},
		{"max_withdrawal_tokens", `100000`, "Máximo tokens por retiro"},
		{"token_packages", `[{"tokens": 500, "price_cents": 500, "bonus": 0}, {"tokens": 1100, "price_cents": 1000, "bonus": 100}, {"tokens": 5500, "price_cents": 5000, "bonus": 500}]`, "Paquetes de tokens con bonus"},
	}

	for _, c := range configs {
		_, err := tx.Exec(ctx, `
			INSERT INTO platform_config (key, value, description, updated_at)
			VALUES ($1, $2, $3, NOW())
			ON CONFLICT (key) DO UPDATE SET value = $2, description = $3, updated_at = NOW()
		`, c.Key, c.Value, c.Desc)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to seed config %s: %v\n", c.Key, err)
			os.Exit(1)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to commit seed: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("Database seeded successfully")
}