//go:build integration

package app_test

import (
	"context"
	"testing"
	"time"
)

// TestWorkerReliability checks what the poster sees about an applicant: how
// quickly they set out once chosen and, fairly judged, whether they are punctual.
func TestWorkerReliability(t *testing.T) {
	a, pool := setup(t)
	ana := a.register("ana@test.dev", "Ana", "COP")
	luis := a.register("luis@test.dev", "Luis", "COP")
	ctx := context.Background()

	// Someone with no history has nothing to show, rather than a made-up score.
	empty := data(a.expect(a.call("GET", "/users/"+luis.id, ana.token, nil), 200, "profile"))
	rel := sub(empty, "reliability")
	if rel["completed_services"].(float64) != 0 || rel["response_seconds"] != nil || rel["on_time_percent"] != nil {
		t.Fatalf("no history, nothing to show: %v", rel)
	}

	// The worker's app reports a trip time; the server keeps it within what the
	// distance allows (the task is about 100 m away, so 900 s cannot stand).
	first := choose(a, ana, luis, "Trip estimate")
	a.expect(a.call("POST", "/tasks/"+first+"/start-route", luis.token,
		map[string]any{"latitude": 6.2450, "longitude": -75.5810, "eta_seconds": 900}), 200, "start route")
	var stored *int
	if err := pool.QueryRow(ctx, `SELECT route_eta_seconds FROM tasks WHERE id=$1`, first).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored == nil || *stored < 1 || *stored > 400 {
		t.Fatalf("the reported trip time should be bounded by the distance, got %v", stored)
	}
	a.expect(a.call("POST", "/tasks/"+first+"/start-service", luis.token, nil), 200, "start service")
	a.expect(a.call("POST", "/tasks/"+first+"/complete", luis.token, nil), 200, "complete")

	// Each service below is finished for real, then its clock is set to a known
	// story. S is the scheduled time; the trip estimate is 20 min.
	S := time.Date(2026, 3, 1, 15, 0, 0, 0, time.UTC)
	min := func(m int) time.Time { return S.Add(time.Duration(m) * time.Minute) }
	type story struct {
		name                 string
		scheduled            *time.Time
		assigned, out, start time.Time
		eta                  int
		remote               bool
	}
	sched := S
	stories := []story{
		// Started before the time: on time.
		{"punctual", &sched, min(-120), min(-30), min(-5), 1200, false},
		// Set out 25 min ahead for a 20 min trip, then 18 min late in traffic:
		// leaving in time forgives it (allowance is half the trip, at least 10 min).
		{"late in traffic", &sched, min(-120), min(-25), min(18), 1200, false},
		// Set out only 5 min ahead for a 20 min trip: the lateness is theirs.
		{"left late", &sched, min(-120), min(-5), min(20), 1200, false},
		// Chosen 10 min before a 20 min trip: nobody could have made it.
		{"too little notice", &sched, min(-10), min(-5), min(40), 1200, false},
		// Nothing was scheduled: says nothing about punctuality.
		{"unscheduled", nil, min(-120), min(-110), min(-60), 1200, false},
		// A remote service has no trip to be late for, however late it started.
		{"remote", &sched, min(-120), min(-100), min(60), 0, true},
	}
	for _, s := range stories {
		id := choose(a, ana, luis, s.name)
		a.expect(a.call("POST", "/tasks/"+id+"/start-route", luis.token, here), 200, "start route "+s.name)
		a.expect(a.call("POST", "/tasks/"+id+"/start-service", luis.token, nil), 200, "start service "+s.name)
		a.expect(a.call("POST", "/tasks/"+id+"/complete", luis.token, nil), 200, "complete "+s.name)
		if _, err := pool.Exec(ctx, `
			UPDATE tasks SET scheduled_at=$2, assigned_at=$3, en_route_at=$4, started_at=$5,
				route_eta_seconds=$6, is_remote=$7 WHERE id=$1`,
			id, s.scheduled, s.assigned, s.out, s.start, s.eta, s.remote); err != nil {
			t.Fatalf("%s: %v", s.name, err)
		}
	}
	// Seven services are finished: the first (trip estimate) and the six stories.
	// Judged: punctual, late in traffic and left late (3); 2 of them on time.
	// Seconds from being chosen to setting out: about 1 for the first, then 5400,
	// 5700, 6900, 300, 600 and 1200 for the remote one. The median is 1200, and
	// the check allows anything from 600 to 1200.
	check := func(who string, rel map[string]any) {
		t.Helper()
		if got := rel["completed_services"].(float64); got != 7 {
			t.Fatalf("%s: completed services: got %v, want 7", who, got)
		}
		if got := rel["on_time_total"].(float64); got != 3 {
			t.Fatalf("%s: judged services: got %v, want 3 (remote, unscheduled and too-little-notice are left out)", who, got)
		}
		if got := rel["on_time_count"].(float64); got != 2 {
			t.Fatalf("%s: on time: got %v, want 2", who, got)
		}
		if got := rel["on_time_percent"].(float64); got != 67 {
			t.Fatalf("%s: on time percent: got %v, want 67", who, got)
		}
		resp, ok := rel["response_seconds"].(float64)
		if !ok || resp < 600 || resp > 1200 {
			t.Fatalf("%s: response seconds: got %v, want the median between 600 and 1200", who, rel["response_seconds"])
		}
	}

	// On the public profile...
	profile := data(a.expect(a.call("GET", "/users/"+luis.id, ana.token, nil), 200, "profile"))
	check("profile", sub(profile, "reliability"))

	// ...and next to their offer, where the poster is deciding.
	cat := categoryID(a, ana.token)
	open := str(data(a.expect(a.call("POST", "/tasks", ana.token, onSiteTask(cat, "Open task")), 201, "create")), "id")
	a.expect(a.call("POST", "/tasks/"+open+"/applications", luis.token, map[string]any{"price_minor": 5000000}), 201, "apply")
	offers := list(a.expect(a.call("GET", "/tasks/"+open+"/applications", ana.token, nil), 200, "offers"))
	if len(offers) != 1 {
		t.Fatalf("offers: %v", offers)
	}
	check("offer", sub(sub(offers[0].(map[string]any), "applicant"), "reliability"))
}
