// Command seed creates demo people and tasks so the app has something to show.
// It is idempotent: it exits quietly if the demo accounts already exist.
//
//	go run ./scripts/seed
package main

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/yourtime/backend/internal/application/reviews"
	"github.com/yourtime/backend/internal/application/tasks"
	"github.com/yourtime/backend/internal/config"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
	"github.com/yourtime/backend/internal/domain/user"
	"github.com/yourtime/backend/internal/infrastructure/persistence/postgres"
)

const demoPassword = "yourtime123"

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "seed failed:", err)
		os.Exit(1)
	}
}

type demoUser struct {
	email, name, currency, city string
	lat, lng                    float64
	radius                      *int
}

func run() error {
	ctx := context.Background()
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	pool, err := postgres.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	userRepo := postgres.NewUserRepo(pool)
	taskRepo := postgres.NewTaskRepo(pool)
	appRepo := postgres.NewApplicationRepo(pool)
	users := user.NewService(userRepo)
	reviewRepo := postgres.NewReviewRepo(pool)
	svc := tasks.NewService(taskRepo, appRepo, userRepo, reviewRepo)
	rsvc := reviews.NewService(reviewRepo, taskRepo)

	radius := 15
	demo := []demoUser{
		{"ana@yourtime.dev", "Ana Restrepo", "COP", "Medellín", 6.2442, -75.5812, &radius},
		{"luis@yourtime.dev", "Luis Herrera", "USD", "Envigado", 6.1759, -75.5917, nil},
		{"marta@yourtime.dev", "Marta Ruiz", "EUR", "Sabaneta", 6.1515, -75.6166, &radius},
		{"carlos@yourtime.dev", "Carlos Gómez", "COP", "Medellín", 6.2518, -75.5636, &radius},
	}

	ids := make([]uuid.UUID, len(demo))
	for i, d := range demo {
		email, _ := valueobjects.NewEmail(d.email)
		cur, _ := valueobjects.NewCurrency(d.currency)
		u, err := users.Register(ctx, user.RegisterInput{Email: email, Password: demoPassword, FullName: d.name, Currency: cur})
		if errors.Is(err, user.ErrEmailTaken) {
			fmt.Println("Demo accounts already exist, nothing to do.")
			return nil
		}
		if err != nil {
			return err
		}
		coords, _ := valueobjects.NewCoordinates(d.lat, d.lng)
		if _, err := users.UpdateProfile(ctx, u.ID, user.ProfileUpdate{
			Location: &user.Location{Coordinates: coords, City: d.city}, SetRadius: true, SearchRadiusKm: d.radius,
		}); err != nil {
			return err
		}
		ids[i] = u.ID
	}

	cats, err := svc.Categories(ctx)
	if err != nil {
		return err
	}
	bySlug := map[string]uuid.UUID{}
	for _, c := range cats {
		bySlug[c.Slug] = c.ID
	}

	money := func(v int64) *int64 { return &v }
	lat := func(v float64) *float64 { return &v }
	posts := []struct {
		poster int
		in     tasks.TaskInput
	}{
		{0, tasks.TaskInput{CategoryID: bySlug["hogar"], Title: "Arreglar gotera en el baño", Description: "Hay una gotera bajo el lavamanos. Necesito a alguien con herramientas que pueda revisarla esta semana.", BudgetType: "fixed", BudgetMin: money(8000000), BudgetMax: money(15000000), Latitude: lat(6.2442), Longitude: lat(-75.5812), City: "Medellín"}},
		{0, tasks.TaskInput{CategoryID: bySlug["limpieza"], Title: "Limpieza profunda de apartamento", Description: "Apartamento de 60 m², dos habitaciones. Incluye ventanas y cocina.", BudgetType: "hourly", BudgetMin: money(2500000), BudgetMax: money(3500000), Latitude: lat(6.2086), Longitude: lat(-75.5659), City: "Medellín"}},
		{1, tasks.TaskInput{CategoryID: bySlug["tecnologia"], Title: "Configurar red WiFi y router", Description: "Tengo un router nuevo y no logro cubrir toda la casa. Busco ayuda para configurarlo.", BudgetType: "fixed", BudgetMin: money(2000), BudgetMax: money(4000), Latitude: lat(6.1759), Longitude: lat(-75.5917), City: "Envigado"}},
		{1, tasks.TaskInput{CategoryID: bySlug["clases"], Title: "Clases de inglés conversacional (online)", Description: "Busco practicar inglés dos veces por semana por videollamada.", BudgetType: "hourly", BudgetMin: money(1000), BudgetMax: money(2000), IsRemote: true}},
		{2, tasks.TaskInput{CategoryID: bySlug["mudanzas"], Title: "Ayuda para mudanza en Bogotá", Description: "Necesito dos personas para cargar un camión. Tarea lejos de Medellín, útil para probar el filtro de distancia.", BudgetType: "negotiable", Latitude: lat(4.711), Longitude: lat(-74.0721), City: "Bogotá"}},
	}
	for _, p := range posts {
		if _, err := svc.Create(ctx, ids[p.poster], p.in); err != nil {
			return fmt.Errorf("create %q: %w", p.in.Title, err)
		}
	}

	// Past work with reviews, so ratings are visible from the first screen.
	const ana, luis, marta, carlos = 0, 1, 2, 3
	history := []pastJob{
		{poster: luis, worker: ana, task: "Instalar estantes en la sala", slug: "hogar",
			posterRates: 5, posterSays: "Excelente trabajo, muy puntual y dejó todo limpio.",
			workerRates: 5, workerSays: "Muy buen trato y pago a tiempo.",
			workerReply: "¡Gracias, Luis! Fue un gusto ayudarte.",
			price:       8500, daysAgo: 4},
		{poster: marta, worker: ana, task: "Pintar sala y comedor", slug: "hogar",
			posterRates: 4, posterSays: "Buen resultado, aunque terminó un día después de lo acordado.",
			workerRates: 5, workerSays: "",
			price: 12000, daysAgo: 19},
		{poster: carlos, worker: ana, task: "Armar muebles de oficina", slug: "hogar",
			posterRates: 5, posterSays: "Rápida y cuidadosa. La recomiendo.",
			workerRates: 5, workerSays: "Todo claro desde el inicio.",
			price: 4500000, daysAgo: 52},
		{poster: ana, worker: luis, task: "Pasear al perro durante una semana", slug: "mascotas",
			posterRates: 4, posterSays: "Cumplió con los horarios.",
			workerRates: 5, workerSays: "Ana explica muy bien lo que necesita.",
			price: 3000000, daysAgo: 11},
		{poster: ana, worker: marta, task: "Traducir un documento al inglés", slug: "clases",
			posterRates: 5, posterSays: "Traducción impecable y entregada antes de tiempo.",
			workerRates: 5, workerSays: "",
			price: 2200000, daysAgo: 33},
		{poster: ana, worker: carlos, task: "Reparar computador portátil", slug: "tecnologia",
			posterRates: 5, posterSays: "Lo dejó como nuevo.",
			workerRates: 5, workerSays: "",
			price: 6000000, daysAgo: 71},
	}
	for _, j := range history {
		if err := j.run(ctx, pool, svc, rsvc, ids, bySlug); err != nil {
			return fmt.Errorf("history %q: %w", j.task, err)
		}
	}

	fmt.Printf("Seeded %d people and %d tasks. Log in with any demo email and password %q.\n", len(demo), len(posts)+len(history), demoPassword)
	return nil
}

// pastJob is a finished task: published, one person chosen, completed, and
// both sides rated each other. The worker may answer the poster's review.
type pastJob struct {
	poster, worker           int
	task, slug               string
	posterRates, workerRates int
	posterSays, workerSays   string
	workerReply              string
	// price is what was agreed, in minor units of the poster's currency, and
	// daysAgo moves the completion into the past so balances span real periods.
	price   int64
	daysAgo int
}

func (j pastJob) run(ctx context.Context, pool *pgxpool.Pool, svc *tasks.Service, rsvc *reviews.Service, ids []uuid.UUID, bySlug map[string]uuid.UUID) error {
	min, max := int64(1000000), int64(2000000)
	t, err := svc.Create(ctx, ids[j.poster], tasks.TaskInput{
		CategoryID: bySlug[j.slug], Title: j.task, Description: "Trabajo ya realizado, parte del historial de demostración.",
		BudgetType: "fixed", BudgetMin: &min, BudgetMax: &max, IsRemote: true,
	})
	if err != nil {
		return err
	}
	app, err := svc.Apply(ctx, ids[j.worker], t.ID, j.price, "Puedo encargarme.")
	if err != nil {
		return err
	}
	if _, err := svc.Accept(ctx, ids[j.poster], app.ID); err != nil {
		return err
	}
	// The history jobs are remote, so there is no route to start.
	if _, err := svc.StartService(ctx, ids[j.worker], t.ID); err != nil {
		return err
	}
	if _, err := svc.Complete(ctx, ids[j.worker], t.ID); err != nil {
		return err
	}
	if _, err := pool.Exec(ctx,
		`UPDATE tasks SET completed_at = NOW() - make_interval(days => $2) WHERE id = $1`, t.ID, j.daysAgo); err != nil {
		return err
	}
	given, err := rsvc.Create(ctx, ids[j.poster], t.ID, j.posterRates, j.posterSays)
	if err != nil {
		return err
	}
	if _, err := rsvc.Create(ctx, ids[j.worker], t.ID, j.workerRates, j.workerSays); err != nil {
		return err
	}
	if j.workerReply != "" {
		if _, err := rsvc.Reply(ctx, ids[j.worker], given.ID, j.workerReply); err != nil {
			return err
		}
	}
	return nil
}
