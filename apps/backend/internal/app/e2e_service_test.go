//go:build integration

package app_test

import (
	"context"
	"fmt"
	"sync"
	"testing"
)

// here is a point in Medellin, close to where onSiteTask puts the task.
var here = map[string]any{"latitude": 6.2450, "longitude": -75.5810}

// runService drives an assigned on-site task through its whole life as the
// worker: start the route, start the service, complete it.
func runService(a *api, taskID string, worker person) {
	a.t.Helper()
	a.expect(a.call("POST", "/tasks/"+taskID+"/start-route", worker.token, here), 200, "start route")
	a.expect(a.call("POST", "/tasks/"+taskID+"/start-service", worker.token, nil), 200, "start service")
	a.expect(a.call("POST", "/tasks/"+taskID+"/complete", worker.token, nil), 200, "complete")
}

// choose publishes a task as poster and picks worker for it, returning the task id.
func choose(a *api, poster, worker person, title string) string {
	a.t.Helper()
	cat := categoryID(a, poster.token)
	taskID := str(data(a.expect(a.call("POST", "/tasks", poster.token, onSiteTask(cat, title)), 201, "create "+title)), "id")
	app := data(a.expect(a.call("POST", "/tasks/"+taskID+"/applications", worker.token, map[string]any{"price_minor": 5000000}), 201, "apply"))
	a.expect(a.call("POST", "/applications/"+str(app, "id")+"/accept", poster.token, nil), 200, "accept "+title)
	return taskID
}

func actions(m map[string]any) []string {
	var out []string
	list, _ := m["actions"].([]any)
	for _, x := range list {
		out = append(out, x.(string))
	}
	return out
}

func sameActions(t *testing.T, who string, got []string, want ...string) {
	t.Helper()
	if fmt.Sprint(got) != fmt.Sprint(want) {
		t.Fatalf("%s actions: got %v, want %v", who, got, want)
	}
}

func TestLiveService(t *testing.T) {
	a, _ := setup(t)
	ana := a.register("ana@test.dev", "Ana", "COP")
	luis := a.register("luis@test.dev", "Luis", "COP")
	pedro := a.register("pedro@test.dev", "Pedro", "COP")

	taskID := choose(a, ana, luis, "Servicio en vivo")
	view := func(p person) map[string]any {
		return data(a.expect(a.call("GET", "/tasks/"+taskID, p.token, nil), 200, "view"))
	}

	// --- assigned: the agreed price and the right buttons for each side -------
	asWorker := view(luis)
	if asWorker["status"] != "assigned" || asWorker["is_worker"] != true || asWorker["agreed_price_minor"].(float64) != 5000000 {
		t.Fatalf("worker view after assignment: %v", asWorker)
	}
	sameActions(t, "worker", actions(asWorker), "start_route", "release")
	sameActions(t, "poster", actions(view(ana)), "cancel")
	sameActions(t, "stranger", actions(view(pedro)))

	// --- the route cannot be skipped, and only the worker drives it -----------
	if r := a.expect(a.call("POST", "/tasks/"+taskID+"/start-service", luis.token, nil), 409, "service before route"); str(r.Body, "code") != "route_not_started" {
		t.Fatalf("code: %v", r.Body)
	}
	a.expect(a.call("POST", "/tasks/"+taskID+"/start-route", ana.token, here), 403, "poster cannot start the route")
	a.expect(a.call("POST", "/tasks/"+taskID+"/start-route", pedro.token, here), 403, "stranger cannot start the route")
	a.expect(a.call("POST", "/tasks/"+taskID+"/start-route", luis.token, nil), 400, "the route needs the worker's position")
	a.expect(a.call("POST", "/tasks/"+taskID+"/start-route", luis.token, map[string]any{"latitude": 99, "longitude": 0}), 400, "invalid position")
	a.expect(a.call("POST", "/tasks/"+taskID+"/location", luis.token, here), 409, "no tracking before the route starts")

	// --- en route: the poster can follow the worker ---------------------------
	routing := data(a.expect(a.call("POST", "/tasks/"+taskID+"/start-route", luis.token, here), 200, "start route"))
	if routing["status"] != "en_route" || routing["en_route_at"] == nil {
		t.Fatalf("after starting the route: %v", routing)
	}
	sameActions(t, "worker en route", actions(routing), "start_service", "release")
	loc := sub(view(ana), "worker_location")
	if loc == nil || loc["latitude"].(float64) != 6.2450 {
		t.Fatalf("the poster must see where the worker is: %v", loc)
	}
	if view(pedro)["worker_location"] != nil {
		t.Fatal("a stranger must never see the worker's position")
	}

	a.expect(a.call("POST", "/tasks/"+taskID+"/location", luis.token, map[string]any{"latitude": 6.2500, "longitude": -75.5700}), 204, "worker moves")
	if got := sub(view(ana), "worker_location"); got["latitude"].(float64) != 6.25 || got["longitude"].(float64) != -75.57 {
		t.Fatalf("the poster should see the new position: %v", got)
	}
	a.expect(a.call("POST", "/tasks/"+taskID+"/location", ana.token, here), 403, "the poster cannot report a position")
	a.expect(a.call("POST", "/tasks/"+taskID+"/location", luis.token, map[string]any{"latitude": 1}), 400, "incomplete position")

	// --- the service starts; from here the poster can no longer cancel --------
	a.expect(a.call("POST", "/tasks/"+taskID+"/complete", luis.token, nil), 409, "cannot complete before starting")
	working := data(a.expect(a.call("POST", "/tasks/"+taskID+"/start-service", luis.token, nil), 200, "start service"))
	if working["status"] != "in_progress" || working["started_at"] == nil {
		t.Fatalf("after starting the service: %v", working)
	}
	sameActions(t, "worker working", actions(working), "complete")
	sameActions(t, "poster while working", actions(view(ana)), "complete")
	a.expect(a.call("POST", "/tasks/"+taskID+"/cancel", ana.token, nil), 409, "cannot cancel once work started")
	a.expect(a.call("POST", "/tasks/"+taskID+"/release", luis.token, nil), 409, "cannot walk away once work started")
	a.expect(a.call("POST", "/tasks/"+taskID+"/complete", pedro.token, nil), 403, "stranger cannot complete")

	// --- the active service is what drives the banner -------------------------
	active := data(a.expect(a.call("GET", "/me/active", luis.token, nil), 200, "active as worker"))
	if sub(active, "as_worker") == nil || active["as_client"] != nil || str(sub(active, "as_worker"), "id") != taskID {
		t.Fatalf("worker active: %v", active)
	}
	active = data(a.expect(a.call("GET", "/me/active", ana.token, nil), 200, "active as client"))
	if sub(active, "as_client") == nil || active["as_worker"] != nil {
		t.Fatalf("client active: %v", active)
	}
	if none := data(a.expect(a.call("GET", "/me/active", pedro.token, nil), 200, "active for a stranger")); none["as_client"] != nil || none["as_worker"] != nil {
		t.Fatalf("someone with no service has nothing active: %v", none)
	}

	// --- finishing erases the position and frees both people ------------------
	done := data(a.expect(a.call("POST", "/tasks/"+taskID+"/complete", luis.token, nil), 200, "complete"))
	if done["status"] != "completed" || done["completed_at"] == nil || done["worker_location"] != nil {
		t.Fatalf("after completing: %v", done)
	}
	if free := data(a.expect(a.call("GET", "/me/active", luis.token, nil), 200, "active after")); free["as_worker"] != nil {
		t.Fatalf("a finished service is no longer active: %v", free)
	}
	a.expect(a.call("POST", "/tasks/"+taskID+"/location", luis.token, here), 409, "no tracking after completion")
}

// One service at a time, as client and as worker.
func TestOneServiceAtATime(t *testing.T) {
	a, _ := setup(t)
	ana := a.register("ana@test.dev", "Ana", "COP")
	bea := a.register("bea@test.dev", "Bea", "COP")
	luis := a.register("luis@test.dev", "Luis", "COP")
	marta := a.register("marta@test.dev", "Marta", "COP")
	cat := categoryID(a, ana.token)

	post := func(p person, title string) string {
		return str(data(a.expect(a.call("POST", "/tasks", p.token, onSiteTask(cat, title)), 201, "create "+title)), "id")
	}
	apply := func(taskID string, p person) string {
		return str(data(a.expect(a.call("POST", "/tasks/"+taskID+"/applications", p.token, map[string]any{"price_minor": 1000}), 201, "apply")), "id")
	}

	first := post(ana, "Primera")
	second := post(ana, "Segunda")
	bea1 := post(bea, "De Bea")
	luisFirst := apply(first, luis)
	luisSecond := apply(second, luis)
	martaSecond := apply(second, marta)
	luisBea := apply(bea1, luis)

	// Ana hires Luis.
	a.expect(a.call("POST", "/applications/"+luisFirst+"/accept", ana.token, nil), 200, "ana hires luis")

	// As client: Ana cannot hire anyone else while that service is active.
	if r := a.expect(a.call("POST", "/applications/"+martaSecond+"/accept", ana.token, nil), 409, "ana is busy as client"); str(r.Body, "code") != "client_busy" {
		t.Fatalf("code: %v", r.Body)
	}
	// As worker: nobody else can hire Luis while he is doing that service.
	if r := a.expect(a.call("POST", "/applications/"+luisBea+"/accept", bea.token, nil), 409, "luis is busy as worker"); str(r.Body, "code") != "worker_busy" {
		t.Fatalf("code: %v", r.Body)
	}
	// A busy worker is flagged so the poster can see it before trying.
	flagged := false
	for _, o := range list(a.expect(a.call("GET", "/tasks/"+bea1+"/applications", bea.token, nil), 200, "bea's offers")) {
		flagged = o.(map[string]any)["applicant_busy"] == true
	}
	if !flagged {
		t.Fatal("an applicant who is busy must be flagged to the poster")
	}
	// The failed attempts changed nothing: Bea's task is still open and unassigned.
	if st := str(data(a.expect(a.call("GET", "/tasks/"+bea1, bea.token, nil), 200, "bea's task")), "status"); st != "open" {
		t.Fatalf("a refused hire must leave the task open, got %q", st)
	}

	// The two limits are independent: Luis can hire someone while he works, and
	// Ana can work for someone while she is a client.
	luisPosted := post(luis, "De Luis")
	martaForLuis := apply(luisPosted, marta)
	a.expect(a.call("POST", "/applications/"+martaForLuis+"/accept", luis.token, nil), 200, "luis hires marta while working for ana")
	anaForBea := apply(bea1, ana)
	a.expect(a.call("POST", "/applications/"+anaForBea+"/accept", bea.token, nil), 200, "ana works for bea while hiring luis")

	// Finishing frees the slot.
	runService(a, first, luis)
	a.expect(a.call("POST", "/applications/"+luisSecond+"/accept", ana.token, nil), 200, "ana can hire again, and luis can work again, once the service is done")
}

// Two posters choosing the same worker at the same moment: exactly one wins.
func TestConcurrentHiringOfOneWorker(t *testing.T) {
	a, pool := setup(t)
	luis := a.register("luis@test.dev", "Luis", "COP")
	cat := categoryID(a, luis.token)

	const n = 6
	apps := make([]string, n)
	posters := make([]person, n)
	for i := 0; i < n; i++ {
		posters[i] = a.register(fmt.Sprintf("poster%d@test.dev", i), "Poster", "COP")
		taskID := str(data(a.expect(a.call("POST", "/tasks", posters[i].token, onSiteTask(cat, fmt.Sprintf("Tarea %d", i))), 201, "create")), "id")
		apps[i] = str(data(a.expect(a.call("POST", "/tasks/"+taskID+"/applications", luis.token, map[string]any{"price_minor": 1000}), 201, "apply")), "id")
	}

	var wg sync.WaitGroup
	codes := make([]int, n)
	for i := range apps {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			codes[i] = a.call("POST", "/applications/"+apps[i]+"/accept", posters[i].token, nil).Status
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
		t.Fatalf("exactly one poster may hire the same worker, got %d (%v)", wins, codes)
	}
	var active int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM tasks WHERE assigned_applicant_id = $1 AND status IN ('assigned','en_route','in_progress')`, luis.id).Scan(&active); err != nil {
		t.Fatal(err)
	}
	if active != 1 {
		t.Fatalf("the database must hold exactly one active service for the worker, got %d", active)
	}
}

// Giving a task back, and cancelling before the service starts.
func TestReleaseAndCancelBeforeStart(t *testing.T) {
	a, _ := setup(t)
	ana := a.register("ana@test.dev", "Ana", "COP")
	luis := a.register("luis@test.dev", "Luis", "COP")
	marta := a.register("marta@test.dev", "Marta", "COP")

	taskID := choose(a, ana, luis, "Para devolver")
	a.expect(a.call("POST", "/tasks/"+taskID+"/release", ana.token, nil), 403, "the poster cannot release for the worker")
	a.expect(a.call("POST", "/tasks/"+taskID+"/start-route", luis.token, here), 200, "start route")
	released := data(a.expect(a.call("POST", "/tasks/"+taskID+"/release", luis.token, nil), 200, "worker gives it back"))
	if released["status"] != "open" || released["worker_location"] != nil || released["assigned_applicant"] != nil {
		t.Fatalf("a released task reopens clean: %v", released)
	}
	sameActions(t, "worker after giving it back", actions(released))
	sameActions(t, "poster after release", actions(data(a.expect(a.call("GET", "/tasks/"+taskID, ana.token, nil), 200, "poster view"))), "edit", "cancel")

	// Both are free again, and Luis may re-apply because his application was withdrawn.
	if free := data(a.expect(a.call("GET", "/me/active", luis.token, nil), 200, "active")); free["as_worker"] != nil {
		t.Fatalf("the worker is free after giving the task back: %v", free)
	}
	a.expect(a.call("POST", "/tasks/"+taskID+"/applications", luis.token, map[string]any{"price_minor": 1}), 201, "luis can apply again")

	// The poster can choose someone else.
	martaApp := str(data(a.expect(a.call("POST", "/tasks/"+taskID+"/applications", marta.token, map[string]any{"price_minor": 2000}), 201, "marta applies")), "id")
	a.expect(a.call("POST", "/applications/"+martaApp+"/accept", ana.token, nil), 200, "poster chooses marta")

	// Cancelling before the service starts frees both people.
	cancelled := data(a.expect(a.call("POST", "/tasks/"+taskID+"/cancel", ana.token, nil), 200, "cancel while assigned"))
	if cancelled["status"] != "cancelled" || cancelled["worker_location"] != nil {
		t.Fatalf("cancelled: %v", cancelled)
	}
	if free := data(a.expect(a.call("GET", "/me/active", marta.token, nil), 200, "active")); free["as_worker"] != nil {
		t.Fatalf("cancelling frees the worker: %v", free)
	}
}

// Tasks done remotely have no route to drive.
func TestRemoteServiceSkipsTheRoute(t *testing.T) {
	a, _ := setup(t)
	ana := a.register("ana@test.dev", "Ana", "COP")
	luis := a.register("luis@test.dev", "Luis", "COP")
	cat := categoryID(a, ana.token)

	remote := onSiteTask(cat, "Clases por videollamada")
	delete(remote, "location")
	remote["is_remote"] = true
	taskID := str(data(a.expect(a.call("POST", "/tasks", ana.token, remote), 201, "create remote")), "id")
	app := str(data(a.expect(a.call("POST", "/tasks/"+taskID+"/applications", luis.token, map[string]any{"price_minor": 1000}), 201, "apply")), "id")
	a.expect(a.call("POST", "/applications/"+app+"/accept", ana.token, nil), 200, "accept")

	view := data(a.expect(a.call("GET", "/tasks/"+taskID, luis.token, nil), 200, "view"))
	sameActions(t, "remote worker", actions(view), "start_service", "release")
	a.expect(a.call("POST", "/tasks/"+taskID+"/start-route", luis.token, here), 409, "a remote task has no route")
	a.expect(a.call("POST", "/tasks/"+taskID+"/start-service", luis.token, nil), 200, "remote service starts directly")
	a.expect(a.call("POST", "/tasks/"+taskID+"/complete", luis.token, nil), 200, "complete")
}
