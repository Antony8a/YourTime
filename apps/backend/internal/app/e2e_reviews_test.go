//go:build integration

package app_test

import (
	"testing"
)

// completedTask runs the whole lifecycle between two people: poster publishes,
// worker applies, poster chooses and finishes. It returns the task id.
func completedTask(a *api, poster, worker person, title string) string {
	a.t.Helper()
	cat := categoryID(a, poster.token)
	taskID := str(data(a.expect(a.call("POST", "/tasks", poster.token, onSiteTask(cat, title)), 201, "create "+title)), "id")
	app := data(a.expect(a.call("POST", "/tasks/"+taskID+"/applications", worker.token, map[string]any{"price_minor": 1000}), 201, "apply"))
	a.expect(a.call("POST", "/applications/"+str(app, "id")+"/accept", poster.token, nil), 200, "accept")
	runService(a, taskID, worker)
	return taskID
}

func rating(m map[string]any) (average float64, count int) {
	r := sub(m, "rating")
	avg, _ := r["average"].(float64)
	n, _ := r["count"].(float64)
	return avg, int(n)
}

func expectRating(t *testing.T, who string, m map[string]any, wantAvg float64, wantCount int) {
	t.Helper()
	if avg, n := rating(m); avg != wantAvg || n != wantCount {
		t.Fatalf("%s rating: got %v (%d), want %v (%d): %v", who, avg, n, wantAvg, wantCount, m["rating"])
	}
}

func TestReviews(t *testing.T) {
	a, _ := setup(t)
	ana := a.register("ana@test.dev", "Ana", "COP")
	luis := a.register("luis@test.dev", "Luis", "COP")
	marta := a.register("marta@test.dev", "Marta", "COP")
	pedro := a.register("pedro@test.dev", "Pedro", "COP")
	cat := categoryID(a, ana.token)

	// --- nobody has a rating yet, and it is visible on an offer ------------
	t1 := str(data(a.expect(a.call("POST", "/tasks", ana.token, onSiteTask(cat, "Primera")), 201, "create")), "id")
	luisApp := data(a.expect(a.call("POST", "/tasks/"+t1+"/applications", luis.token, map[string]any{"price_minor": 1000}), 201, "luis applies"))
	a.expect(a.call("POST", "/tasks/"+t1+"/applications", marta.token, map[string]any{"price_minor": 1200}), 201, "marta applies")
	for _, o := range list(a.expect(a.call("GET", "/tasks/"+t1+"/applications", ana.token, nil), 200, "offers")) {
		expectRating(t, "new applicant", sub(o.(map[string]any), "applicant"), 0, 0)
	}

	// --- reviews are closed until the task is completed --------------------
	a.expect(a.call("POST", "/tasks/"+t1+"/reviews", ana.token, map[string]any{"rating": 5}), 403, "nobody is chosen yet")
	a.expect(a.call("POST", "/applications/"+str(luisApp, "id")+"/accept", ana.token, nil), 200, "accept luis")
	if r := a.expect(a.call("POST", "/tasks/"+t1+"/reviews", ana.token, map[string]any{"rating": 5}), 409, "task not completed"); str(r.Body, "code") != "task_not_completed" {
		t.Fatalf("code: %v", r.Body)
	}
	runService(a, t1, luis)

	// Only the two people of the task can review.
	if r := a.expect(a.call("POST", "/tasks/"+t1+"/reviews", marta.token, map[string]any{"rating": 5}), 403, "rejected applicant"); str(r.Body, "code") != "not_task_participant" {
		t.Fatalf("code: %v", r.Body)
	}
	a.expect(a.call("POST", "/tasks/"+t1+"/reviews", pedro.token, map[string]any{"rating": 5}), 403, "stranger")

	// --- review state on the task, for each side ---------------------------
	anaView := data(a.expect(a.call("GET", "/tasks/"+t1, ana.token, nil), 200, "ana view"))
	if anaView["can_review"] != true || anaView["my_review"] != nil || anaView["review_for_me"] != nil {
		t.Fatalf("before reviewing: %v", anaView)
	}
	if strangerView := data(a.expect(a.call("GET", "/tasks/"+t1, pedro.token, nil), 200, "stranger view")); strangerView["can_review"] != false {
		t.Fatalf("a stranger must not be offered a review: %v", strangerView)
	}

	// --- validation ----------------------------------------------------------
	for _, bad := range []map[string]any{{"rating": 0}, {"rating": 6}, {"rating": -2}, {"comment": "sin estrellas"}, {"rating": 3.5}} {
		a.expect(a.call("POST", "/tasks/"+t1+"/reviews", ana.token, bad), 400, "invalid review")
	}
	long := make([]byte, 1001)
	for i := range long {
		long[i] = 'x'
	}
	a.expect(a.call("POST", "/tasks/"+t1+"/reviews", ana.token, map[string]any{"rating": 5, "comment": string(long)}), 400, "comment too long")

	// --- both people review each other --------------------------------------
	anaReview := data(a.expect(a.call("POST", "/tasks/"+t1+"/reviews", ana.token, map[string]any{"rating": 5, "comment": "Excelente trabajo, muy puntual"}), 201, "ana reviews luis"))
	if str(anaReview, "comment") != "Excelente trabajo, muy puntual" || anaReview["reply"] != nil {
		t.Fatalf("created review: %v", anaReview)
	}
	if r := a.expect(a.call("POST", "/tasks/"+t1+"/reviews", ana.token, map[string]any{"rating": 1}), 409, "second review"); str(r.Body, "code") != "already_reviewed" {
		t.Fatalf("code: %v", r.Body)
	}

	anaView = data(a.expect(a.call("GET", "/tasks/"+t1, ana.token, nil), 200, "ana view after"))
	if anaView["can_review"] != false || sub(anaView, "my_review") == nil || anaView["review_for_me"] != nil {
		t.Fatalf("after reviewing: %v", anaView)
	}
	luisView := data(a.expect(a.call("GET", "/tasks/"+t1, luis.token, nil), 200, "luis view"))
	if luisView["can_review"] != true || sub(luisView, "review_for_me") == nil || luisView["my_review"] != nil {
		t.Fatalf("luis should see the review about him and still be able to review: %v", luisView)
	}
	luisReview := data(a.expect(a.call("POST", "/tasks/"+t1+"/reviews", luis.token, map[string]any{"rating": 4}), 201, "luis reviews ana"))

	// --- replies --------------------------------------------------------------
	a.expect(a.call("POST", "/reviews/"+str(anaReview, "id")+"/reply", ana.token, map[string]any{"text": "gracias a mí misma"}), 403, "the author cannot reply to their own review")
	a.expect(a.call("POST", "/reviews/"+str(anaReview, "id")+"/reply", marta.token, map[string]any{"text": "hola"}), 403, "a stranger cannot reply")
	a.expect(a.call("POST", "/reviews/"+str(anaReview, "id")+"/reply", luis.token, map[string]any{"text": "   "}), 400, "empty reply")
	reply := data(a.expect(a.call("POST", "/reviews/"+str(anaReview, "id")+"/reply", luis.token, map[string]any{"text": "¡Gracias, Ana! Fue un gusto."}), 200, "luis replies"))
	if str(reply, "reply") != "¡Gracias, Ana! Fue un gusto." || reply["replied_at"] == nil {
		t.Fatalf("reply not stored: %v", reply)
	}
	if r := a.expect(a.call("POST", "/reviews/"+str(anaReview, "id")+"/reply", luis.token, map[string]any{"text": "otra"}), 409, "second reply"); str(r.Body, "code") != "already_replied" {
		t.Fatalf("code: %v", r.Body)
	}
	a.expect(a.call("POST", "/reviews/00000000-0000-0000-0000-000000000000/reply", luis.token, map[string]any{"text": "x"}), 404, "unknown review")
	// Ana sees Luis's answer on her review.
	anaView = data(a.expect(a.call("GET", "/tasks/"+t1, ana.token, nil), 200, "ana view"))
	if str(sub(anaView, "my_review"), "reply") != "¡Gracias, Ana! Fue un gusto." {
		t.Fatalf("the reviewer should see the reply: %v", anaView["my_review"])
	}
	_ = luisReview

	// --- ratings aggregate per person ------------------------------------------
	expectRating(t, "luis profile", data(a.expect(a.call("GET", "/users/"+luis.id, ana.token, nil), 200, "luis profile")), 5, 1)
	expectRating(t, "ana profile", data(a.expect(a.call("GET", "/users/"+ana.id, luis.token, nil), 200, "ana profile")), 4, 1)
	expectRating(t, "me", data(a.expect(a.call("GET", "/me", luis.token, nil), 200, "me")), 5, 1)

	// Marta publishes and chooses Luis too: his average becomes 4.5 from 2 people.
	t2 := completedTask(a, marta, luis, "Segunda")
	a.expect(a.call("POST", "/tasks/"+t2+"/reviews", marta.token, map[string]any{"rating": 4, "comment": "Bien"}), 201, "marta reviews luis")
	expectRating(t, "luis after two reviews", data(a.expect(a.call("GET", "/users/"+luis.id, pedro.token, nil), 200, "profile")), 4.5, 2)

	// --- the rating shows on an offer, which is the point of it ------------------
	t3 := str(data(a.expect(a.call("POST", "/tasks", pedro.token, onSiteTask(cat, "Tercera")), 201, "pedro posts")), "id")
	a.expect(a.call("POST", "/tasks/"+t3+"/applications", luis.token, map[string]any{"price_minor": 900}), 201, "luis applies")
	a.expect(a.call("POST", "/tasks/"+t3+"/applications", ana.token, map[string]any{"price_minor": 950}), 201, "ana applies")
	a.expect(a.call("POST", "/tasks/"+t3+"/applications", marta.token, map[string]any{"price_minor": 970}), 201, "marta applies")
	got := map[string][2]float64{}
	for _, o := range list(a.expect(a.call("GET", "/tasks/"+t3+"/applications", pedro.token, nil), 200, "offers")) {
		app := sub(o.(map[string]any), "applicant")
		avg, n := rating(app)
		got[str(app, "full_name")] = [2]float64{avg, float64(n)}
	}
	want := map[string][2]float64{"Luis": {4.5, 2}, "Ana": {4, 1}, "Marta": {0, 0}}
	for name, w := range want {
		if got[name] != w {
			t.Fatalf("offer rating for %s: got %v, want %v (all: %v)", name, got[name], w, got)
		}
	}

	// The poster's rating is visible to people deciding whether to apply.
	for _, it := range list(a.expect(a.call("GET", "/tasks", luis.token, nil), 200, "feed")) {
		m := it.(map[string]any)
		if str(sub(m, "poster"), "full_name") == "Pedro" {
			expectRating(t, "poster in feed", sub(m, "poster"), 0, 0)
		}
	}
	expectRating(t, "poster on detail", sub(data(a.expect(a.call("GET", "/tasks/"+t3, luis.token, nil), 200, "detail")), "poster"), 0, 0)

	// --- public profile and review list ------------------------------------------
	profile := data(a.expect(a.call("GET", "/users/"+luis.id, pedro.token, nil), 200, "profile"))
	if _, leaked := profile["email"]; leaked {
		t.Fatalf("a public profile must not include contact details: %v", profile)
	}
	if str(profile, "full_name") != "Luis" {
		t.Fatalf("profile: %v", profile)
	}
	reviews := list(a.expect(a.call("GET", "/users/"+luis.id+"/reviews", pedro.token, nil), 200, "luis reviews"))
	if len(reviews) != 2 {
		t.Fatalf("luis should have 2 reviews, got %d", len(reviews))
	}
	newest := reviews[0].(map[string]any)
	oldest := reviews[1].(map[string]any)
	if str(newest, "task_title") != "Segunda" || str(sub(newest, "reviewer"), "full_name") != "Marta" {
		t.Fatalf("reviews are listed newest first with their reviewer and task: %v", newest)
	}
	if str(oldest, "reply") != "¡Gracias, Ana! Fue un gusto." {
		t.Fatalf("a listed review carries its reply: %v", oldest)
	}
	if _, leaked := sub(oldest, "reviewer")["email"]; leaked {
		t.Fatalf("a reviewer's contact details must not leak: %v", oldest["reviewer"])
	}
	a.expect(a.call("GET", "/users/00000000-0000-0000-0000-000000000000", pedro.token, nil), 404, "unknown profile")
	a.expect(a.call("GET", "/users/00000000-0000-0000-0000-000000000000/reviews", pedro.token, nil), 404, "unknown profile reviews")
	a.expect(a.call("GET", "/users/"+luis.id, "", nil), 401, "profiles need a session")
}
