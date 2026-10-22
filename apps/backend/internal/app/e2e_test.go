//go:build integration

package app_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/yourtime/backend/internal/app"
	"github.com/yourtime/backend/internal/config"
	"github.com/yourtime/backend/internal/infrastructure/http/router"
	"github.com/yourtime/backend/internal/infrastructure/persistence/postgres"
	"github.com/yourtime/backend/internal/platform/logger"
)

// Run with:
//
//	TEST_DATABASE_URL=postgres://... go test -tags integration ./internal/app/...
//
// The target database is wiped: point it at a throwaway database.

type api struct {
	t *testing.T
	r *router.Router
}

type resp struct {
	Status int
	Body   map[string]any
}

func (a *api) call(method, path, token string, body any) resp {
	a.t.Helper()
	var rd *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	} else {
		rd = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, "/api/v1"+path, rd)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	a.r.ServeHTTP(rec, req)
	out := resp{Status: rec.Code, Body: map[string]any{}}
	_ = json.Unmarshal(rec.Body.Bytes(), &out.Body)
	return out
}

func (a *api) expect(r resp, status int, what string) resp {
	a.t.Helper()
	if r.Status != status {
		a.t.Fatalf("%s: got HTTP %d, want %d, body: %v", what, r.Status, status, r.Body)
	}
	return r
}

func data(r resp) map[string]any { d, _ := r.Body["data"].(map[string]any); return d }
func list(r resp) []any          { d, _ := r.Body["data"].([]any); return d }
func str(m map[string]any, k string) string {
	s, _ := m[k].(string)
	return s
}
func sub(m map[string]any, k string) map[string]any { s, _ := m[k].(map[string]any); return s }

type person struct {
	id, token, refresh, email string
}

func (a *api) register(email, name, currency string) person {
	a.t.Helper()
	r := a.expect(a.call("POST", "/auth/register", "", map[string]any{
		"email": email, "password": "supersecret1", "full_name": name, "currency": currency,
	}), 201, "register "+email)
	d := data(r)
	return person{id: str(sub(d, "user"), "id"), token: str(d, "access_token"), refresh: str(d, "refresh_token"), email: email}
}

func (a *api) setLocation(p person, lat, lng float64, city string, radius any) {
	a.t.Helper()
	a.expect(a.call("PATCH", "/me", p.token, map[string]any{
		"location": map[string]any{"latitude": lat, "longitude": lng, "city": city}, "search_radius_km": radius,
	}), 200, "set location")
}

func setup(t *testing.T) (*api, *pgxpool.Pool) { return setupWith(t, nil) }

// setupWith is setup with a chance to change the configuration first.
func setupWith(t *testing.T, tweak func(*config.Config)) (*api, *pgxpool.Pool) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := postgres.NewPool(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if _, err := pool.Exec(ctx, `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`); err != nil {
		t.Fatal(err)
	}
	if err := postgres.Migrate(url, "up"); err != nil {
		t.Fatal(err)
	}
	cfg := &config.Config{Env: "test", RegistrationOpen: true, CORSOrigins: []string{"http://localhost"}, JWT: config.JWTConfig{
		Secret: "test-secret-test-secret-test-secret-123", AccessTTL: time.Hour, RefreshTTL: 24 * time.Hour,
	}}
	if tweak != nil {
		tweak(cfg)
	}
	rctx, cancel := context.WithCancel(ctx)
	t.Cleanup(cancel)
	r := app.NewRouter(rctx, cfg, logger.New("test"), pool, app.Overrides{GlobalPerMinute: 1_000_000, AuthPerMinute: 1_000_000, RatesProvider: testRates, NoRatesJob: true})
	return &api{t: t, r: r}, pool
}

func categoryID(a *api, tok string) string {
	r := a.expect(a.call("GET", "/categories", tok, nil), 200, "categories")
	return str(list(r)[0].(map[string]any), "id")
}

func onSiteTask(cat string, title string) map[string]any {
	return map[string]any{
		"category_id": cat, "title": title, "description": "details",
		"budget":   map[string]any{"type": "fixed", "min_minor": 8000000, "max_minor": 15000000},
		"location": map[string]any{"latitude": 6.2442, "longitude": -75.5812, "city": "Medellín", "address": "Calle 10 #20-30"},
	}
}

func TestEndToEnd(t *testing.T) {
	a, _ := setup(t)

	// --- accounts ----------------------------------------------------------
	ana := a.register("ana@test.dev", "Ana", "COP")
	luis := a.register("luis@test.dev", "Luis", "USD")
	marta := a.register("marta@test.dev", "Marta", "EUR")

	a.expect(a.call("POST", "/auth/register", "", map[string]any{"email": "ANA@test.dev", "password": "supersecret1", "full_name": "Dup"}), 409, "duplicate email is case-insensitive")
	a.expect(a.call("POST", "/auth/register", "", map[string]any{"email": "x@test.dev", "password": "short", "full_name": "X"}), 400, "weak password")
	a.expect(a.call("POST", "/auth/register", "", map[string]any{"email": "x@test.dev", "password": "supersecret1", "full_name": "X", "currency": "ZZZ"}), 400, "unsupported currency")
	if r := a.expect(a.call("POST", "/auth/login", "", map[string]any{"email": "ana@test.dev", "password": "wrong-password"}), 401, "wrong password"); str(r.Body, "code") != "invalid_credentials" {
		t.Fatalf("errors must carry a stable code clients can translate: %v", r.Body)
	}
	a.expect(a.call("POST", "/auth/login", "", map[string]any{"email": "nobody@test.dev", "password": "wrong-password"}), 401, "unknown email")
	a.expect(a.call("GET", "/me", "", nil), 401, "no token")
	a.expect(a.call("GET", "/me", ana.refresh, nil), 401, "refresh token must not authenticate")

	me := data(a.expect(a.call("GET", "/me", ana.token, nil), 200, "me"))
	if str(me, "currency") != "COP" {
		t.Fatalf("account currency not stored: %v", me)
	}
	if me["search_radius_km"] != nil {
		t.Fatalf("radius must default to no limit: %v", me)
	}
	if r := a.expect(a.call("POST", "/auth/refresh", "", map[string]any{"refresh_token": ana.refresh}), 200, "refresh"); str(data(r), "access_token") == "" {
		t.Fatal("refresh returned no token")
	}
	a.expect(a.call("POST", "/auth/refresh", "", map[string]any{"refresh_token": ana.token}), 401, "access token cannot refresh")

	// Ana (Medellín, 10 km radius), Luis (Envigado ~8 km away, no limit), Marta (Bogotá ~240 km away, 10 km radius).
	a.setLocation(ana, 6.2442, -75.5812, "Medellín", 10)
	a.setLocation(luis, 6.1759, -75.5917, "Envigado", nil)
	a.setLocation(marta, 4.7110, -74.0721, "Bogotá", 10)
	a.expect(a.call("PATCH", "/me", ana.token, map[string]any{"search_radius_km": 0}), 400, "radius must be positive")
	if got := data(a.expect(a.call("GET", "/me", ana.token, nil), 200, "me")); got["search_radius_km"].(float64) != 10 {
		t.Fatalf("radius lost after rejected update: %v", got)
	}

	// --- publishing --------------------------------------------------------
	cat := categoryID(a, ana.token)
	a.expect(a.call("POST", "/tasks", ana.token, map[string]any{"category_id": cat, "title": "x", "description": "d", "budget": map[string]any{"type": "fixed"}, "location": map[string]any{"latitude": 1.0, "longitude": 1.0}}), 400, "fixed budget needs amounts")
	a.expect(a.call("POST", "/tasks", ana.token, onSiteTask("00000000-0000-0000-0000-000000000000", "x")), 400, "unknown category")

	t1 := data(a.expect(a.call("POST", "/tasks", ana.token, onSiteTask(cat, "Arreglar gotera")), 201, "create task"))
	if sub(t1, "budget")["currency"] != "COP" {
		t.Fatalf("task must default to the poster's account currency: %v", t1["budget"])
	}
	if t1["is_owner"] != true || t1["can_apply"] != false {
		t.Fatalf("poster flags wrong: %v", t1)
	}
	t1ID := str(t1, "id")

	remote := onSiteTask(cat, "Clases de inglés")
	delete(remote, "location")
	remote["is_remote"] = true
	remote["budget"] = map[string]any{"type": "negotiable", "currency": "EUR"}
	data(a.expect(a.call("POST", "/tasks", ana.token, remote), 201, "create remote task"))

	// --- browsing: distance informs, never blocks --------------------------
	feed := func(p person, query string) []any {
		return list(a.expect(a.call("GET", "/tasks"+query, p.token, nil), 200, "feed"+query))
	}
	if n := len(feed(ana, "")); n != 0 {
		t.Fatalf("own tasks must not appear in own feed, got %d", n)
	}
	lf := feed(luis, "")
	if len(lf) != 2 {
		t.Fatalf("luis should see 2 tasks, got %d", len(lf))
	}
	var luisView map[string]any
	for _, it := range lf {
		if str(it.(map[string]any), "id") == t1ID {
			luisView = it.(map[string]any)
		}
	}
	if d, _ := luisView["distance_km"].(float64); d < 6 || d > 10 {
		t.Fatalf("Envigado is ~8 km from Medellín, got %v", luisView["distance_km"])
	}
	if luisView["within_preferred_radius"] != nil {
		t.Fatalf("luis has no radius, so no hint is expected: %v", luisView["within_preferred_radius"])
	}

	mf := feed(marta, "")
	if len(mf) != 2 {
		t.Fatalf("marta must still see far tasks without a filter, got %d", len(mf))
	}
	for _, it := range mf {
		m := it.(map[string]any)
		if str(m, "id") == t1ID {
			if m["within_preferred_radius"] != false {
				t.Fatalf("far task should be flagged outside the radius: %v", m)
			}
			if d := m["distance_km"].(float64); d < 200 || d > 280 {
				t.Fatalf("Bogotá–Medellín distance: %v", d)
			}
		}
	}
	if n := len(feed(marta, "?preferred_radius=true")); n != 1 {
		t.Fatalf("preferred radius filter should leave only the remote task, got %d", n)
	}
	if n := len(feed(marta, "?max_distance_km=500")); n != 2 {
		t.Fatalf("a wide explicit radius should show both, got %d", n)
	}
	if n := len(feed(luis, "?max_distance_km=2")); n != 1 {
		t.Fatalf("a 2 km radius should hide the on-site task but keep remote, got %d", n)
	}
	if n := len(feed(luis, "?q=gotera")); n != 1 {
		t.Fatalf("text search: got %d", n)
	}
	if n := len(feed(luis, "?q=%25")); n != 0 {
		t.Fatalf("LIKE wildcards in the query must be escaped, got %d", n)
	}
	sorted := feed(luis, "?sort=distance")
	if str(sorted[0].(map[string]any), "id") != t1ID {
		t.Fatalf("distance sort should put the nearest first")
	}
	a.expect(a.call("GET", "/tasks?lat=abc", luis.token, nil), 400, "bad lat")
	a.expect(a.call("GET", "/tasks?sort=nope", luis.token, nil), 400, "bad sort")

	// --- applying ----------------------------------------------------------
	a.expect(a.call("POST", "/tasks/"+t1ID+"/applications", ana.token, map[string]any{"price_minor": 100}), 403, "cannot apply to own task")
	a.expect(a.call("POST", "/tasks/"+t1ID+"/applications", luis.token, map[string]any{"price_minor": 0}), 400, "price must be positive")
	luisApp := data(a.expect(a.call("POST", "/tasks/"+t1ID+"/applications", luis.token, map[string]any{"price_minor": 9000000, "message": "Puedo ir mañana"}), 201, "luis applies"))
	// Marta is 240 km away and applies anyway: distance never blocks.
	martaApp := data(a.expect(a.call("POST", "/tasks/"+t1ID+"/applications", marta.token, map[string]any{"price_minor": 9500000}), 201, "marta applies from far away"))
	if r := a.expect(a.call("POST", "/tasks/"+t1ID+"/applications", luis.token, map[string]any{"price_minor": 100}), 409, "duplicate application"); str(r.Body, "code") != "already_applied" {
		t.Fatalf("duplicate application code: %v", r.Body)
	}

	detail := data(a.expect(a.call("GET", "/tasks/"+t1ID, luis.token, nil), 200, "task detail"))
	if detail["can_apply"] != false || sub(detail, "my_application") == nil || detail["applications_count"].(float64) != 2 {
		t.Fatalf("applicant view wrong: %v", detail)
	}

	// --- choosing ----------------------------------------------------------
	a.expect(a.call("GET", "/tasks/"+t1ID+"/applications", luis.token, nil), 403, "applicants cannot list offers")
	offers := list(a.expect(a.call("GET", "/tasks/"+t1ID+"/applications", ana.token, nil), 200, "poster lists offers"))
	if len(offers) != 2 {
		t.Fatalf("expected 2 offers, got %d", len(offers))
	}
	for _, o := range offers {
		if str(sub(o.(map[string]any), "applicant"), "email") != "" {
			t.Fatalf("contact details must stay hidden before acceptance: %v", o)
		}
	}
	a.expect(a.call("POST", "/applications/"+str(luisApp, "id")+"/accept", luis.token, nil), 403, "applicant cannot accept")
	accepted := data(a.expect(a.call("POST", "/applications/"+str(luisApp, "id")+"/accept", ana.token, nil), 200, "accept"))
	if str(accepted, "status") != "accepted" || str(sub(accepted, "applicant"), "email") != "luis@test.dev" {
		t.Fatalf("accepted offer should reveal the chosen applicant's contact: %v", accepted)
	}
	a.expect(a.call("POST", "/applications/"+str(luisApp, "id")+"/accept", ana.token, nil), 409, "double accept")

	// Marta's competing offer was rejected in the same transaction.
	var martaStatus string
	for _, it := range list(a.expect(a.call("GET", "/me/applications", marta.token, nil), 200, "marta applications")) {
		if str(it.(map[string]any), "id") == str(martaApp, "id") {
			martaStatus = str(it.(map[string]any), "status")
		}
	}
	if martaStatus != "rejected" {
		t.Fatalf("competing offers must be rejected on accept, got %q", martaStatus)
	}
	a.expect(a.call("POST", "/applications/"+str(martaApp, "id")+"/accept", ana.token, nil), 409, "cannot accept after assignment")
	if n := len(feed(marta, "")); n != 1 {
		t.Fatalf("assigned task must leave the public feed, got %d tasks", n)
	}

	// Contact details are shared only between the poster and the chosen applicant.
	asAna := data(a.expect(a.call("GET", "/tasks/"+t1ID, ana.token, nil), 200, "poster detail"))
	if str(sub(asAna, "assigned_applicant"), "email") != "luis@test.dev" {
		t.Fatalf("poster should see the chosen applicant's contact: %v", asAna)
	}
	asLuis := data(a.expect(a.call("GET", "/tasks/"+t1ID, luis.token, nil), 200, "assignee detail"))
	if str(sub(asLuis, "poster"), "email") != "ana@test.dev" {
		t.Fatalf("chosen applicant should see the poster's contact: %v", asLuis)
	}
	// Location privacy: strangers get an approximate point and no address, the
	// poster and the chosen applicant get the exact one.
	exact := onSiteTask(cat, "")["location"].(map[string]any)
	if loc := sub(asAna, "location"); loc["latitude"] != exact["latitude"] || loc["longitude"] != exact["longitude"] {
		t.Fatalf("poster should see the exact location: %v", loc)
	}
	if loc := sub(asLuis, "location"); loc["latitude"] != exact["latitude"] {
		t.Fatalf("chosen applicant should see the exact location: %v", loc)
	}
	asMarta := data(a.expect(a.call("GET", "/tasks/"+t1ID, marta.token, nil), 200, "stranger detail"))
	if loc := sub(asMarta, "location"); loc["latitude"] != 6.24 || loc["longitude"] != -75.58 || loc["address"] != nil {
		t.Fatalf("strangers must only get an approximate location: %v", loc)
	}
	if str(sub(asMarta, "poster"), "email") != "" || asMarta["assigned_applicant"] != nil {
		t.Fatalf("strangers must not see contact details: %v", asMarta)
	}

	// --- finishing ---------------------------------------------------------
	a.expect(a.call("PUT", "/tasks/"+t1ID, ana.token, onSiteTask(cat, "Edited")), 409, "cannot edit after assignment")
	a.expect(a.call("POST", "/tasks/"+t1ID+"/complete", ana.token, nil), 409, "cannot complete a service that never started")
	runService(a, t1ID, luis)
	done := data(a.expect(a.call("GET", "/tasks/"+t1ID, ana.token, nil), 200, "completed task"))
	if str(done, "status") != "completed" {
		t.Fatalf("status: %v", done["status"])
	}
	a.expect(a.call("POST", "/tasks/"+t1ID+"/cancel", ana.token, nil), 409, "cannot cancel a completed task")
	if n := len(list(a.expect(a.call("GET", "/me/tasks?status=completed", ana.token, nil), 200, "my completed tasks"))); n != 1 {
		t.Fatalf("my completed tasks: %d", n)
	}
	if n := len(list(a.expect(a.call("GET", "/me/tasks", ana.token, nil), 200, "my tasks"))); n != 2 {
		t.Fatalf("my tasks: %d", n)
	}
	a.expect(a.call("GET", "/me/tasks?status=bogus", ana.token, nil), 400, "unknown status filter")

	// --- editing, withdrawing, rejecting -----------------------------------
	t2ID := str(data(a.expect(a.call("POST", "/tasks", ana.token, onSiteTask(cat, "Segunda tarea")), 201, "second task")), "id")
	a.expect(a.call("PUT", "/tasks/"+t2ID, luis.token, onSiteTask(cat, "Hijack")), 403, "only the poster edits")
	edited := data(a.expect(a.call("PUT", "/tasks/"+t2ID, ana.token, onSiteTask(cat, "Segunda tarea (editada)")), 200, "edit"))
	if str(edited, "title") != "Segunda tarea (editada)" {
		t.Fatalf("edit not applied: %v", edited["title"])
	}

	app1 := data(a.expect(a.call("POST", "/tasks/"+t2ID+"/applications", luis.token, map[string]any{"price_minor": 5}), 201, "apply"))
	a.expect(a.call("POST", "/applications/"+str(app1, "id")+"/withdraw", ana.token, nil), 403, "only the applicant withdraws")
	a.expect(a.call("POST", "/applications/"+str(app1, "id")+"/withdraw", luis.token, nil), 200, "withdraw")
	a.expect(a.call("POST", "/applications/"+str(app1, "id")+"/withdraw", luis.token, nil), 409, "withdraw twice")
	if n := len(list(a.expect(a.call("GET", "/tasks/"+t2ID+"/applications", ana.token, nil), 200, "offers"))); n != 0 {
		t.Fatalf("withdrawn offers must not be listed, got %d", n)
	}
	again := data(a.expect(a.call("POST", "/tasks/"+t2ID+"/applications", luis.token, map[string]any{"price_minor": 7}), 201, "re-apply after withdrawing"))
	a.expect(a.call("POST", "/applications/"+str(again, "id")+"/reject", luis.token, nil), 403, "only the poster rejects")
	a.expect(a.call("POST", "/applications/"+str(again, "id")+"/reject", ana.token, nil), 200, "reject")
	a.expect(a.call("POST", "/applications/"+str(again, "id")+"/reject", ana.token, nil), 409, "reject twice")
	a.expect(a.call("POST", "/tasks/"+t2ID+"/applications", luis.token, map[string]any{"price_minor": 7}), 409, "cannot re-apply after rejection")

	a.expect(a.call("POST", "/tasks/"+t2ID+"/cancel", ana.token, nil), 200, "cancel open task")
	a.expect(a.call("POST", "/tasks/"+t2ID+"/applications", marta.token, map[string]any{"price_minor": 7}), 409, "cannot apply to cancelled task")
	a.expect(a.call("GET", "/tasks/not-a-uuid", ana.token, nil), 400, "bad id")
	a.expect(a.call("GET", "/tasks/00000000-0000-0000-0000-000000000000", ana.token, nil), 404, "unknown task")
}

// Two people racing to be chosen for one task must not both win.
func TestConcurrentAcceptChoosesExactlyOne(t *testing.T) {
	a, pool := setup(t)
	poster := a.register("poster@test.dev", "Poster", "USD")
	cat := categoryID(a, poster.token)
	taskID := str(data(a.expect(a.call("POST", "/tasks", poster.token, onSiteTask(cat, "Contended")), 201, "create")), "id")

	const n = 8
	appIDs := make([]string, n)
	for i := 0; i < n; i++ {
		p := a.register(fmt.Sprintf("worker%d@test.dev", i), "Worker", "USD")
		appIDs[i] = str(data(a.expect(a.call("POST", "/tasks/"+taskID+"/applications", p.token, map[string]any{"price_minor": 100 + i}), 201, "apply")), "id")
	}

	var wg sync.WaitGroup
	codes := make([]int, n)
	for i := range appIDs {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			codes[i] = a.call("POST", "/applications/"+appIDs[i]+"/accept", poster.token, nil).Status
		}(i)
	}
	wg.Wait()

	wins := 0
	for _, c := range codes {
		switch c {
		case 200:
			wins++
		case 409:
		default:
			t.Fatalf("unexpected status in race: %v", codes)
		}
	}
	if wins != 1 {
		t.Fatalf("exactly one accept must win, got %d (%v)", wins, codes)
	}
	var accepted, rejected int
	if err := pool.QueryRow(context.Background(),
		`SELECT count(*) FILTER (WHERE status='accepted'), count(*) FILTER (WHERE status='rejected') FROM applications WHERE task_id=$1`, taskID,
	).Scan(&accepted, &rejected); err != nil {
		t.Fatal(err)
	}
	if accepted != 1 || rejected != n-1 {
		t.Fatalf("expected 1 accepted and %d rejected, got %d and %d", n-1, accepted, rejected)
	}
}

var _ http.Handler = (*router.Router)(nil)
