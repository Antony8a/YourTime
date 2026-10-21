package task

import (
	"errors"
	"math"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/yourtime/backend/internal/domain/common/valueobjects"
)

var now = time.Date(2026, 1, 10, 12, 0, 0, 0, time.UTC)

func i64(v int64) *int64 { return &v }

func newTask(t *testing.T, poster uuid.UUID) *Task {
	t.Helper()
	coords, _ := valueobjects.NewCoordinates(6.2442, -75.5812)
	tk, err := New(NewTaskInput{
		PosterID: poster, CategoryID: uuid.New(), Title: "Fix sink", Description: "Leaking",
		Budget: Budget{Type: BudgetFixed, MinMinor: i64(1000), MaxMinor: i64(2000), Currency: "COP"},
		Place:  &Place{Coordinates: coords, City: "Medellín"},
	}, now)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return tk
}

func TestNewValidation(t *testing.T) {
	poster := uuid.New()
	coords, _ := valueobjects.NewCoordinates(1, 1)
	base := NewTaskInput{
		PosterID: poster, CategoryID: uuid.New(), Title: "t", Description: "d",
		Budget: Budget{Type: BudgetFixed, MinMinor: i64(1), MaxMinor: i64(2), Currency: "USD"},
		Place:  &Place{Coordinates: coords},
	}
	past := now.Add(-48 * time.Hour)

	cases := []struct {
		name   string
		mutate func(*NewTaskInput)
		want   error
	}{
		{"valid", func(*NewTaskInput) {}, nil},
		{"empty title", func(in *NewTaskInput) { in.Title = "  " }, ErrInvalidTitle},
		{"empty description", func(in *NewTaskInput) { in.Description = "" }, ErrInvalidDescription},
		{"fixed needs amounts", func(in *NewTaskInput) { in.Budget.MinMinor, in.Budget.MaxMinor = nil, nil }, ErrInvalidBudget},
		{"negotiable without amounts is fine", func(in *NewTaskInput) {
			in.Budget = Budget{Type: BudgetNegotiable, Currency: "USD"}
		}, nil},
		{"max below min", func(in *NewTaskInput) { in.Budget.MinMinor, in.Budget.MaxMinor = i64(5), i64(2) }, ErrInvalidBudget},
		{"zero amount", func(in *NewTaskInput) { in.Budget.MinMinor = i64(0) }, ErrInvalidBudget},
		{"only min given", func(in *NewTaskInput) { in.Budget.MaxMinor = nil }, ErrInvalidBudget},
		{"unknown budget type", func(in *NewTaskInput) { in.Budget.Type = "weird" }, ErrInvalidBudget},
		{"on-site needs a place", func(in *NewTaskInput) { in.Place = nil }, ErrInvalidLocation},
		{"remote needs no place", func(in *NewTaskInput) { in.Place, in.IsRemote = nil, true }, nil},
		{"schedule in the past", func(in *NewTaskInput) { in.ScheduledAt = &past }, ErrPastSchedule},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			in := base
			c.mutate(&in)
			_, err := New(in, now)
			if !errors.Is(err, c.want) && !(c.want == nil && err == nil) {
				t.Fatalf("got %v, want %v", err, c.want)
			}
		})
	}
}

// assigned returns a task already assigned to worker.
func assigned(t *testing.T, poster, worker uuid.UUID) *Task {
	t.Helper()
	tk := newTask(t, poster)
	app, err := NewApplication(tk, worker, 1500, "I can do it", now)
	if err != nil {
		t.Fatal(err)
	}
	if err := tk.Assign(poster, app, now); err != nil {
		t.Fatalf("assign: %v", err)
	}
	return tk
}

func here() valueobjects.Coordinates {
	c, _ := valueobjects.NewCoordinates(6.25, -75.57)
	return c
}

func TestAssign(t *testing.T) {
	poster, worker, stranger := uuid.New(), uuid.New(), uuid.New()
	tk := newTask(t, poster)
	app, _ := NewApplication(tk, worker, 1500, "", now)

	if err := tk.Assign(stranger, app, now); !errors.Is(err, ErrNotOwner) {
		t.Fatalf("stranger assign: %v", err)
	}
	if err := tk.Assign(poster, app, now); err != nil {
		t.Fatalf("assign: %v", err)
	}
	if tk.Status != StatusAssigned || *tk.AssignedApplicantID != worker {
		t.Fatalf("unexpected state after assign: %+v", tk)
	}
	if err := tk.Assign(poster, app, now); !errors.Is(err, ErrTaskNotOpen) {
		t.Fatalf("double assign: %v", err)
	}
	if err := tk.Edit(poster, NewTaskInput{}, now); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("edit after assign: %v", err)
	}
}

// The live service runs in a fixed order and only the worker drives it.
func TestLiveServiceOrder(t *testing.T) {
	poster, worker, stranger := uuid.New(), uuid.New(), uuid.New()
	tk := assigned(t, poster, worker)

	// Nothing can be skipped.
	if err := tk.StartService(worker, now); !errors.Is(err, ErrRouteNotStarted) {
		t.Fatalf("on-site service cannot start before the route: %v", err)
	}
	if err := tk.Complete(worker, now); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("cannot complete before starting: %v", err)
	}
	// Only the chosen worker starts the route.
	for _, who := range []uuid.UUID{poster, stranger} {
		if err := tk.StartRoute(who, here(), nil, now); !errors.Is(err, ErrNotAssignedWorker) {
			t.Fatalf("only the worker starts the route: %v", err)
		}
	}
	if err := tk.StartRoute(worker, here(), nil, now); err != nil {
		t.Fatal(err)
	}
	if tk.Status != StatusEnRoute || tk.EnRouteAt == nil || tk.WorkerLocation == nil {
		t.Fatalf("after starting the route: %+v", tk)
	}
	if err := tk.StartRoute(worker, here(), nil, now); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("route cannot start twice: %v", err)
	}
	if err := tk.StartService(poster, now); !errors.Is(err, ErrNotAssignedWorker) {
		t.Fatalf("the poster cannot start the service: %v", err)
	}
	if err := tk.StartService(worker, now); err != nil {
		t.Fatal(err)
	}
	if tk.Status != StatusInProgress || tk.StartedAt == nil {
		t.Fatalf("after starting the service: %+v", tk)
	}
	if err := tk.StartService(worker, now); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("service cannot start twice: %v", err)
	}
	if err := tk.Complete(stranger, now); !errors.Is(err, ErrNotOwner) {
		t.Fatalf("a stranger cannot complete: %v", err)
	}
	if err := tk.Complete(worker, now); err != nil || tk.Status != StatusCompleted || tk.CompletedAt == nil {
		t.Fatalf("worker completes: %v", err)
	}
	if tk.WorkerLocation != nil {
		t.Fatal("the worker's position must be erased when the service ends")
	}
	if err := tk.Cancel(poster, now); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("cancel after complete: %v", err)
	}
}

func TestPosterCanConfirmCompletion(t *testing.T) {
	poster, worker := uuid.New(), uuid.New()
	tk := assigned(t, poster, worker)
	_ = tk.StartRoute(worker, here(), nil, now)
	_ = tk.StartService(worker, now)
	if err := tk.Complete(poster, now); err != nil {
		t.Fatalf("the poster may confirm completion so a forgetful worker cannot block them: %v", err)
	}
}

func TestRemoteTaskSkipsTheRoute(t *testing.T) {
	poster, worker := uuid.New(), uuid.New()
	tk := newTask(t, poster)
	tk.IsRemote = true
	app, _ := NewApplication(tk, worker, 100, "", now)
	_ = tk.Assign(poster, app, now)

	if err := tk.StartRoute(worker, here(), nil, now); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("a remote task has no route: %v", err)
	}
	if err := tk.StartService(worker, now); err != nil || tk.Status != StatusInProgress {
		t.Fatalf("remote service starts straight from assigned: %v", err)
	}
}

func TestWorkerLocationRules(t *testing.T) {
	poster, worker := uuid.New(), uuid.New()
	tk := assigned(t, poster, worker)
	if err := tk.UpdateWorkerLocation(worker, here(), now); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("no tracking before the route starts: %v", err)
	}
	_ = tk.StartRoute(worker, here(), nil, now)
	if err := tk.UpdateWorkerLocation(poster, here(), now); !errors.Is(err, ErrNotAssignedWorker) {
		t.Fatalf("only the worker reports their position: %v", err)
	}
	moved, _ := valueobjects.NewCoordinates(6.26, -75.58)
	if err := tk.UpdateWorkerLocation(worker, moved, now.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	if tk.WorkerLocation.Coordinates != moved || !tk.WorkerLocation.At.Equal(now.Add(time.Minute)) {
		t.Fatalf("position not updated: %+v", tk.WorkerLocation)
	}
}

func TestRelease(t *testing.T) {
	poster, worker := uuid.New(), uuid.New()
	tk := assigned(t, poster, worker)
	_ = tk.StartRoute(worker, here(), nil, now)

	if err := tk.Release(poster, now); !errors.Is(err, ErrNotAssignedWorker) {
		t.Fatalf("the poster cannot release on the worker's behalf: %v", err)
	}
	if err := tk.Release(worker, now); err != nil {
		t.Fatal(err)
	}
	if tk.Status != StatusOpen || tk.AssignedApplicantID != nil || tk.AssignedApplicationID != nil || tk.EnRouteAt != nil || tk.WorkerLocation != nil {
		t.Fatalf("release must reopen the task and clear the assignment: %+v", tk)
	}

	// Once the work started it cannot be abandoned.
	started := assigned(t, poster, worker)
	_ = started.StartRoute(worker, here(), nil, now)
	_ = started.StartService(worker, now)
	if err := started.Release(worker, now); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("release after starting the service: %v", err)
	}
}

func TestCancelStopsOnceWorkStarts(t *testing.T) {
	poster, worker := uuid.New(), uuid.New()
	for _, step := range []string{"assigned", "en_route"} {
		tk := assigned(t, poster, worker)
		if step == "en_route" {
			_ = tk.StartRoute(worker, here(), nil, now)
		}
		if err := tk.Cancel(poster, now); err != nil || tk.Status != StatusCancelled || tk.WorkerLocation != nil {
			t.Fatalf("poster may cancel while %s: %v", step, err)
		}
	}
	tk := assigned(t, poster, worker)
	_ = tk.StartRoute(worker, here(), nil, now)
	_ = tk.StartService(worker, now)
	if err := tk.Cancel(poster, now); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("cancel once work is under way: %v", err)
	}
}

func TestAvailableActions(t *testing.T) {
	poster, worker, stranger := uuid.New(), uuid.New(), uuid.New()
	has := func(got []Action, want ...Action) bool {
		if len(got) != len(want) {
			return false
		}
		for i := range want {
			if got[i] != want[i] {
				return false
			}
		}
		return true
	}

	open := newTask(t, poster)
	if got := open.AvailableActions(poster); !has(got, ActionEdit, ActionCancel) {
		t.Fatalf("poster on open: %v", got)
	}
	if got := open.AvailableActions(stranger); len(got) != 0 {
		t.Fatalf("stranger gets no actions: %v", got)
	}

	tk := assigned(t, poster, worker)
	if got := tk.AvailableActions(worker); !has(got, ActionStartRoute, ActionRelease) {
		t.Fatalf("worker on assigned: %v", got)
	}
	if got := tk.AvailableActions(poster); !has(got, ActionCancel) {
		t.Fatalf("poster on assigned: %v", got)
	}
	_ = tk.StartRoute(worker, here(), nil, now)
	if got := tk.AvailableActions(worker); !has(got, ActionStartService, ActionRelease) {
		t.Fatalf("worker en route: %v", got)
	}
	_ = tk.StartService(worker, now)
	if got := tk.AvailableActions(worker); !has(got, ActionComplete) {
		t.Fatalf("worker in progress: %v", got)
	}
	if got := tk.AvailableActions(poster); !has(got, ActionComplete) {
		t.Fatalf("poster in progress: %v", got)
	}
	_ = tk.Complete(worker, now)
	if got := tk.AvailableActions(worker); len(got) != 0 {
		t.Fatalf("nothing to do after completion: %v", got)
	}

	remote := newTask(t, poster)
	remote.IsRemote = true
	app, _ := NewApplication(remote, worker, 100, "", now)
	_ = remote.Assign(poster, app, now)
	if got := remote.AvailableActions(worker); !has(got, ActionStartService, ActionRelease) {
		t.Fatalf("remote tasks go straight to the service: %v", got)
	}
}

func TestStatusIsActive(t *testing.T) {
	for s, want := range map[Status]bool{
		StatusOpen: false, StatusAssigned: true, StatusEnRoute: true, StatusInProgress: true,
		StatusCompleted: false, StatusCancelled: false,
	} {
		if s.IsActive() != want {
			t.Errorf("%s: IsActive = %v, want %v", s, !want, want)
		}
	}
}

func TestCancel(t *testing.T) {
	poster := uuid.New()
	tk := newTask(t, poster)
	if err := tk.Cancel(uuid.New(), now); !errors.Is(err, ErrNotOwner) {
		t.Fatalf("stranger cancel: %v", err)
	}
	if err := tk.Cancel(poster, now); err != nil || tk.Status != StatusCancelled || tk.CancelledAt == nil {
		t.Fatalf("cancel: %v", err)
	}
	if _, err := NewApplication(tk, uuid.New(), 100, "", now); !errors.Is(err, ErrTaskNotOpen) {
		t.Fatalf("apply to cancelled: %v", err)
	}
}

func TestApplicationRules(t *testing.T) {
	poster, worker := uuid.New(), uuid.New()
	tk := newTask(t, poster)

	if _, err := NewApplication(tk, poster, 100, "", now); !errors.Is(err, ErrOwnTask) {
		t.Fatalf("own task: %v", err)
	}
	if _, err := NewApplication(tk, worker, 0, "", now); !errors.Is(err, ErrInvalidPrice) {
		t.Fatalf("zero price: %v", err)
	}
	app, err := NewApplication(tk, worker, 100, "  hi  ", now)
	if err != nil || app.Message != "hi" || app.Status != ApplicationPending {
		t.Fatalf("valid application: %+v %v", app, err)
	}

	if err := app.CanBeWithdrawnBy(poster); !errors.Is(err, ErrNotApplicant) {
		t.Fatalf("poster withdrawing: %v", err)
	}
	if err := app.CanBeRejectedBy(tk.PosterID, worker); !errors.Is(err, ErrNotOwner) {
		t.Fatalf("worker rejecting: %v", err)
	}
	app.Status = ApplicationAccepted
	if err := app.CanBeWithdrawnBy(worker); !errors.Is(err, ErrApplicationNotOpen) {
		t.Fatalf("withdraw accepted: %v", err)
	}
}

func TestDistanceKm(t *testing.T) {
	medellin, _ := valueobjects.NewCoordinates(6.2442, -75.5812)
	bogota, _ := valueobjects.NewCoordinates(4.7110, -74.0721)
	if d := DistanceKm(medellin, medellin); d != 0 {
		t.Fatalf("same point: %v", d)
	}
	d := DistanceKm(medellin, bogota)
	if math.Abs(d-240) > 10 {
		t.Fatalf("Medellín–Bogotá should be about 240 km, got %.1f", d)
	}
	if back := DistanceKm(bogota, medellin); math.Abs(back-d) > 1e-9 {
		t.Fatalf("distance must be symmetric: %v vs %v", d, back)
	}
	// Antipodal points must not blow up (asin domain).
	a, _ := valueobjects.NewCoordinates(0, 0)
	b, _ := valueobjects.NewCoordinates(0, 180)
	if got := DistanceKm(a, b); math.IsNaN(got) || math.Abs(got-20015) > 20 {
		t.Fatalf("antipodal: %v", got)
	}
}

func TestWithinRadius(t *testing.T) {
	km := func(v float64) *float64 { return &v }
	r := func(v int) *int { return &v }
	cases := []struct {
		name     string
		remote   bool
		distance *float64
		radius   *int
		want     *bool // nil = no hint
	}{
		{"near", false, km(5), r(10), ptr(true)},
		{"far", false, km(50), r(10), ptr(false)},
		{"exactly on the limit", false, km(10), r(10), ptr(true)},
		{"no preference", false, km(50), nil, nil},
		{"unknown distance", false, nil, r(10), nil},
		{"remote is always within reach", true, nil, r(10), ptr(true)},
	}
	for _, c := range cases {
		got := WithinRadius(c.remote, c.distance, c.radius)
		if (got == nil) != (c.want == nil) || (got != nil && *got != *c.want) {
			t.Errorf("%s: got %v, want %v", c.name, deref(got), deref(c.want))
		}
	}
}

func ptr(b bool) *bool { return &b }
func deref(b *bool) any {
	if b == nil {
		return nil
	}
	return *b
}

func TestRouteETASeconds(t *testing.T) {
	const km = 10.0 // straight line
	// Between 90 km/h (400 s) and 12 km/h (3000 s) plus 300 s of slack.
	lo, hi := 400, 3300
	typical := 1800 + 300 // 20 km/h plus slack
	sec := func(v int) *int { return &v }

	cases := []struct {
		name     string
		reported *int
		want     int
	}{
		{"no estimate falls back to a typical urban one", nil, typical},
		{"a believable estimate is kept", sec(1500), 1500},
		{"an inflated estimate cannot excuse a late arrival", sec(20000), hi},
		{"an impossibly short one cannot look punctual", sec(30), lo},
	}
	for _, c := range cases {
		if got := RouteETASeconds(km, c.reported); got != c.want {
			t.Errorf("%s: got %d, want %d", c.name, got, c.want)
		}
	}
	if got := RouteETASeconds(0, sec(600)); got != 300 {
		t.Errorf("at the destination only the slack remains, got %d", got)
	}
}

func TestStartRouteStoresTheTripEstimateAndReleaseClearsIt(t *testing.T) {
	poster, worker := uuid.New(), uuid.New()
	tk := assigned(t, poster, worker)
	eta := 900
	if err := tk.StartRoute(worker, here(), &eta, now); err != nil {
		t.Fatal(err)
	}
	if tk.RouteETASeconds == nil {
		t.Fatal("the trip estimate should be kept")
	}
	if err := tk.Release(worker, now); err != nil {
		t.Fatal(err)
	}
	if tk.RouteETASeconds != nil || tk.EnRouteAt != nil {
		t.Fatal("giving the task back clears the trip")
	}
}
