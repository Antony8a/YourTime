//go:build integration

package app_test

import (
	"context"
	"net/url"
	"testing"
	"time"
)

func sideOf(a *api, tok, side, query string) map[string]any {
	a.t.Helper()
	body := data(a.expect(a.call("GET", "/me/balance"+query, tok, nil), 200, "balance"+query))
	return sub(body, side)
}

func totalOf(side map[string]any, currency string) (minor float64, count float64) {
	for _, x := range side["totals"].([]any) {
		m := x.(map[string]any)
		if m["currency"] == currency {
			return m["total_minor"].(float64), m["count"].(float64)
		}
	}
	return 0, 0
}

func TestBalance(t *testing.T) {
	a, pool := setup(t)
	ana := a.register("ana@test.dev", "Ana", "COP")
	luis := a.register("luis@test.dev", "Luis", "USD")
	pedro := a.register("pedro@test.dev", "Pedro", "COP")

	// Nothing finished yet: empty lists, not nulls, so clients can map over them.
	empty := sideOf(a, ana.token, "earned", "")
	if len(empty["totals"].([]any)) != 0 || len(empty["entries"].([]any)) != 0 || empty["has_more"] != false {
		t.Fatalf("empty balance: %v", empty)
	}

	// Ana (COP) hires Luis twice; Luis (USD) hires Ana once.
	first := choose(a, ana, luis, "Primero")
	runService(a, first, luis)
	second := choose(a, ana, luis, "Segundo")
	runService(a, second, luis)
	third := choose(a, luis, ana, "Tercero")
	runService(a, third, ana)
	// A service still in progress or cancelled is not money yet.
	pending := choose(a, ana, pedro, "Pendiente")
	_ = pending

	// Luis earned from Ana twice, in the currency of Ana's tasks; he spent once, in his own.
	earned := sideOf(a, luis.token, "earned", "")
	if m, c := totalOf(earned, "COP"); m != 10000000 || c != 2 {
		t.Fatalf("Luis earned COP: %v / %v (%v)", m, c, earned)
	}
	spent := sideOf(a, luis.token, "spent", "")
	if m, c := totalOf(spent, "USD"); m != 5000000 || c != 1 {
		t.Fatalf("Luis spent USD: %v / %v", m, c)
	}
	// Ana is the mirror image, and the pending service is on neither side.
	if m, c := totalOf(sideOf(a, ana.token, "spent", ""), "COP"); m != 10000000 || c != 2 {
		t.Fatalf("Ana spent: %v / %v", m, c)
	}
	if m, _ := totalOf(sideOf(a, ana.token, "earned", ""), "USD"); m != 5000000 {
		t.Fatalf("Ana earned: %v", m)
	}
	if n := len(sideOf(a, pedro.token, "earned", "")["entries"].([]any)); n != 0 {
		t.Fatalf("Pedro has not finished anything, got %d entries", n)
	}

	// Entries name the other person and the task, newest first.
	entries := earned["entries"].([]any)
	if len(entries) != 2 {
		t.Fatalf("entries: %v", entries)
	}
	top := entries[0].(map[string]any)
	if top["title"] != "Segundo" || sub(top, "counterpart")["full_name"] != "Ana" || top["amount_minor"].(float64) != 5000000 || top["currency"] != "COP" {
		t.Fatalf("newest entry: %v", top)
	}

	// --- periods: from is inclusive, to is exclusive --------------------------
	ctx := context.Background()
	now := time.Now().UTC()
	old := now.AddDate(0, 0, -40)
	if _, err := pool.Exec(ctx, `UPDATE tasks SET completed_at = $2 WHERE id = $1`, first, old); err != nil {
		t.Fatal(err)
	}
	q := func(from, to time.Time) string {
		v := url.Values{}
		if !from.IsZero() {
			v.Set("from", from.Format(time.RFC3339))
		}
		if !to.IsZero() {
			v.Set("to", to.Format(time.RFC3339))
		}
		return "?" + v.Encode()
	}
	if _, c := totalOf(sideOf(a, luis.token, "earned", q(now.AddDate(0, 0, -7), time.Time{})), "COP"); c != 1 {
		t.Fatalf("last 7 days should hold only the recent service, got %v", c)
	}
	if _, c := totalOf(sideOf(a, luis.token, "earned", q(now.AddDate(0, 0, -60), now.AddDate(0, 0, -30))), "COP"); c != 1 {
		t.Fatalf("the old window should hold the old service, got %v", c)
	}
	if _, c := totalOf(sideOf(a, luis.token, "earned", q(time.Time{}, now.AddDate(0, 0, -30))), "COP"); c != 1 {
		t.Fatalf("open start: want 1, got %v", c)
	}
	if _, c := totalOf(sideOf(a, luis.token, "earned", q(old, old.Add(time.Second))), "COP"); c != 1 {
		t.Fatalf("from is inclusive: want 1, got %v", c)
	}
	if _, c := totalOf(sideOf(a, luis.token, "earned", q(old.Add(time.Second), now.Add(time.Hour))), "COP"); c != 1 {
		t.Fatalf("a window starting just after the old one excludes it: want 1, got %v", c)
	}
	if _, c := totalOf(sideOf(a, luis.token, "earned", q(old.Add(-time.Hour), old)), "COP"); c != 0 {
		t.Fatalf("to is exclusive: want 0, got %v", c)
	}

	// --- bad input -------------------------------------------------------------
	if r := a.expect(a.call("GET", "/me/balance"+q(now, now.AddDate(0, 0, -1)), luis.token, nil), 400, "reversed range"); str(r.Body, "code") != "invalid_range" {
		t.Fatalf("code: %v", r.Body)
	}
	a.expect(a.call("GET", "/me/balance?from=ayer", luis.token, nil), 400, "unparseable date")
	a.expect(a.call("GET", "/me/balance", "", nil), 401, "balance needs a session")
}
