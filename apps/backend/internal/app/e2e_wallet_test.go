//go:build integration

package app_test

import (
	"sync"
	"testing"

	"github.com/yourtime/backend/internal/config"
)

// The wallet tests use the fixed test rates: 1 USD = 4000 COP = 0.8 EUR. A task
// priced COP 50.000 (5.000.000 minor) is USD 12,50, and a 10 % commission on it is
// USD 1,25 (125 minor) for a person whose wallet is in dollars.
const (
	copPrice       = 5_000_000 // COP 50.000, in minor units
	commissionUSD  = 125       // USD 1,25
	feeBpsTenth    = 1000
	adminEmailTest = "admin@test.dev"
)

func walletSetup(t *testing.T) (*api, person) {
	t.Helper()
	a, _ := setupWith(t, func(c *config.Config) { c.AdminEmails = []string{adminEmailTest} })
	admin := a.register(adminEmailTest, "Admin", "USD")
	return a, admin
}

func setSettings(a *api, admin person, feeBps int, testTopups bool, maxUSD, signupUSD int64) {
	a.t.Helper()
	a.expect(a.call("PUT", "/admin/settings", admin.token, map[string]any{
		"fee_bps": feeBps, "test_topups_enabled": testTopups,
		"test_topup_max_usd_minor": maxUSD, "signup_credit_usd_minor": signupUSD,
	}), 200, "settings")
}

func walletOf(a *api, p person) map[string]any {
	a.t.Helper()
	return data(a.expect(a.call("GET", "/me/wallet", p.token, nil), 200, "wallet of "+p.email))
}

func balanceOf(a *api, p person) int64 { return int64(walletOf(a, p)["balance_minor"].(float64)) }

func topup(a *api, p person, amount int64) map[string]any {
	a.t.Helper()
	return data(a.expect(a.call("POST", "/me/wallet/test-topup", p.token, map[string]any{"amount_minor": amount}), 200, "top up"))
}

func ledger(a *api, p person) []map[string]any {
	a.t.Helper()
	var out []map[string]any
	for _, x := range list(a.expect(a.call("GET", "/me/wallet/transactions", p.token, nil), 200, "ledger")) {
		out = append(out, x.(map[string]any))
	}
	return out
}

func errCode(r resp) string { c, _ := r.Body["code"].(string); return c }

func publish(a *api, poster person, title string) string {
	a.t.Helper()
	cat := categoryID(a, poster.token)
	return str(data(a.expect(a.call("POST", "/tasks", poster.token, onSiteTask(cat, title)), 201, "create "+title)), "id")
}

func apply(a *api, worker person, taskID string) string {
	a.t.Helper()
	return str(data(a.expect(a.call("POST", "/tasks/"+taskID+"/applications", worker.token, map[string]any{"price_minor": copPrice}), 201, "apply")), "id")
}

func TestWalletCommission(t *testing.T) {
	a, admin := walletSetup(t)
	ana := a.register("ana@test.dev", "Ana", "COP")
	luis := a.register("luis@test.dev", "Luis", "USD")
	setSettings(a, admin, feeBpsTenth, true, 10_000, 0)

	// No wallet yet: nothing to see but the account currency, and it can still change.
	w := walletOf(a, luis)
	if w["established"] != false || w["currency"] != "USD" || w["balance_minor"].(float64) != 0 || w["fee_bps"].(float64) != 1000 {
		t.Fatalf("a new wallet: %v", w)
	}
	if w["is_admin"] != false || walletOf(a, admin)["is_admin"] != true {
		t.Fatal("only the configured account is the administrator")
	}
	if len(w["suggested_topups_minor"].([]any)) == 0 {
		t.Fatal("top-up amounts should be offered")
	}

	// Applying needs a balance that covers the commission on the offer.
	t1 := publish(a, ana, "Task one")
	quote := data(a.expect(a.call("GET", "/tasks/"+t1+"/fee-quote?price_minor=5000000", luis.token, nil), 200, "quote"))
	if quote["fee_minor"].(float64) != commissionUSD || quote["currency"] != "USD" || quote["enough"] != false || quote["established"] != false {
		t.Fatalf("quote without a wallet: %v", quote)
	}
	r := a.call("POST", "/tasks/"+t1+"/applications", luis.token, map[string]any{"price_minor": copPrice})
	a.expect(r, 402, "apply without balance")
	if errCode(r) != "insufficient_balance" {
		t.Fatalf("code: %q", errCode(r))
	}

	// Test top-ups are capped and credit the account currency.
	a.expect(a.call("POST", "/me/wallet/test-topup", luis.token, map[string]any{"amount_minor": 20_000}), 400, "above the cap")
	res := topup(a, luis, 1_000)
	if res["currency"] != "USD" || res["balance_minor"].(float64) != 1_000 || res["bonus_minor"].(float64) != 0 {
		t.Fatalf("top up: %v", res)
	}
	if !walletOf(a, luis)["established"].(bool) {
		t.Fatal("the first credit establishes the wallet")
	}

	// Applying costs nothing; only being chosen does.
	appID := apply(a, luis, t1)
	if balanceOf(a, luis) != 1_000 {
		t.Fatal("applying must not charge")
	}
	a.expect(a.call("POST", "/applications/"+appID+"/accept", ana.token, nil), 200, "accept")
	if got := balanceOf(a, luis); got != 1_000-commissionUSD {
		t.Fatalf("after being chosen: balance %d, want %d", got, 1_000-commissionUSD)
	}
	l := ledger(a, luis)
	if l[0]["kind"] != "fee" || l[0]["amount_minor"].(float64) != -commissionUSD || l[0]["task_title"] != "Task one" || l[0]["currency"] != "USD" {
		t.Fatalf("the ledger should show the commission: %v", l[0])
	}

	// The wallet's currency, and so the account's, is now fixed.
	lock := a.call("PATCH", "/me", luis.token, map[string]any{"currency": "EUR"})
	a.expect(lock, 409, "currency is locked")
	if errCode(lock) != "currency_locked" {
		t.Fatalf("code: %q", errCode(lock))
	}
	a.expect(a.call("PATCH", "/me", luis.token, map[string]any{"currency": "usd"}), 200, "the same currency is fine")
	a.expect(a.call("PATCH", "/me", ana.token, map[string]any{"currency": "EUR"}), 200, "no wallet, still free")
	a.expect(a.call("PATCH", "/me", ana.token, map[string]any{"currency": "COP"}), 200, "back to COP")

	// The poster cancels before the service starts: the commission comes back.
	a.expect(a.call("POST", "/tasks/"+t1+"/cancel", ana.token, nil), 200, "cancel")
	if balanceOf(a, luis) != 1_000 {
		t.Fatalf("a cancelled service refunds: %d", balanceOf(a, luis))
	}
	if l := ledger(a, luis); l[0]["kind"] != "fee_refund" || l[0]["amount_minor"].(float64) != commissionUSD {
		t.Fatalf("the refund is in the ledger: %v", l[0])
	}

	// The worker gives it up before starting: refunded too, and only once.
	t2 := choose(a, ana, luis, "Task two")
	if balanceOf(a, luis) != 1_000-commissionUSD {
		t.Fatal("chosen again, charged again")
	}
	a.expect(a.call("POST", "/tasks/"+t2+"/release", luis.token, nil), 200, "release")
	if balanceOf(a, luis) != 1_000 {
		t.Fatalf("a released service refunds: %d", balanceOf(a, luis))
	}
	a.expect(a.call("POST", "/tasks/"+t2+"/cancel", ana.token, nil), 200, "cancel an open task")
	if balanceOf(a, luis) != 1_000 {
		t.Fatal("nothing more to refund")
	}

	// A finished service keeps its commission.
	t3 := choose(a, ana, luis, "Task three")
	runService(a, t3, luis)
	if got := balanceOf(a, luis); got != 1_000-commissionUSD {
		t.Fatalf("a finished service keeps the commission: %d", got)
	}

	// What the platform earned: the one commission that stayed.
	ov := data(a.expect(a.call("GET", "/admin/overview", admin.token, nil), 200, "overview"))
	var usd map[string]any
	for _, x := range ov["totals"].([]any) {
		if m := x.(map[string]any); m["currency"] == "USD" {
			usd = m
		}
	}
	if usd == nil || usd["net_fees_minor"].(float64) != commissionUSD || usd["outstanding_minor"].(float64) != 1_000-commissionUSD {
		t.Fatalf("totals: %v", ov["totals"])
	}
}

func TestWalletBalanceShortWhenChosen(t *testing.T) {
	a, admin := walletSetup(t)
	ana := a.register("ana@test.dev", "Ana", "COP")
	pedro := a.register("pedro@test.dev", "Pedro", "COP")
	luis := a.register("luis@test.dev", "Luis", "USD")
	setSettings(a, admin, feeBpsTenth, true, 10_000, 0)

	// Luis can pay one commission and a bit: enough to apply twice, not to be chosen twice.
	topup(a, luis, 200)
	t1, t2 := publish(a, ana, "First"), publish(a, pedro, "Second")
	app1, app2 := apply(a, luis, t1), apply(a, luis, t2)

	a.expect(a.call("POST", "/applications/"+app1+"/accept", ana.token, nil), 200, "first choice")
	runService(a, t1, luis)
	if balanceOf(a, luis) != 200-commissionUSD {
		t.Fatal("first commission charged")
	}

	r := a.call("POST", "/applications/"+app2+"/accept", pedro.token, nil)
	a.expect(r, 409, "second choice, not enough balance")
	if errCode(r) != "applicant_insufficient_balance" {
		t.Fatalf("code: %q", errCode(r))
	}
	if balanceOf(a, luis) != 200-commissionUSD {
		t.Fatal("a refused choice charges nothing")
	}
	if got := str(data(a.expect(a.call("GET", "/tasks/"+t2, pedro.token, nil), 200, "task")), "status"); got != "open" {
		t.Fatalf("the task stays open when the choice fails: %s", got)
	}
}

func TestWalletConcurrentChoicesChargeOnce(t *testing.T) {
	a, admin := walletSetup(t)
	ana := a.register("ana@test.dev", "Ana", "COP")
	pedro := a.register("pedro@test.dev", "Pedro", "COP")
	luis := a.register("luis@test.dev", "Luis", "USD")
	setSettings(a, admin, feeBpsTenth, true, 10_000, 0)

	topup(a, luis, 1_000)
	app1 := apply(a, luis, publish(a, ana, "One"))
	app2 := apply(a, luis, publish(a, pedro, "Two"))

	// Two posters choose the same worker at the same instant. One service per person
	// at a time: exactly one wins, and only that one is charged.
	var wg sync.WaitGroup
	statuses := make([]int, 2)
	for i, c := range []struct {
		app string
		who person
	}{{app1, ana}, {app2, pedro}} {
		wg.Add(1)
		go func(i int, app string, who person) {
			defer wg.Done()
			statuses[i] = a.call("POST", "/applications/"+app+"/accept", who.token, nil).Status
		}(i, c.app, c.who)
	}
	wg.Wait()
	wins := 0
	for _, s := range statuses {
		if s == 200 {
			wins++
		}
	}
	if wins != 1 {
		t.Fatalf("exactly one choice must win, got %v", statuses)
	}
	if got := balanceOf(a, luis); got != 1_000-commissionUSD {
		t.Fatalf("one commission, not two: balance %d", got)
	}
}

func TestWalletPromotionsAndCredits(t *testing.T) {
	a, admin := walletSetup(t)
	ana := a.register("ana@test.dev", "Ana", "COP")
	luis := a.register("luis@test.dev", "Luis", "USD")
	pedro := a.register("pedro@test.dev", "Pedro", "COP")
	setSettings(a, admin, feeBpsTenth, true, 10_000, 0)

	create := func(body map[string]any) resp { return a.call("POST", "/admin/promotions", admin.token, body) }

	// A top-up bonus applies by itself, to every test top-up while it runs.
	bonus := data(a.expect(create(map[string]any{"name": "Double week", "kind": "topup_bonus", "value_bps": 2000}), 201, "bonus"))
	res := topup(a, luis, 1_000)
	if res["bonus_minor"].(float64) != 200 || res["balance_minor"].(float64) != 1_200 {
		t.Fatalf("20%% bonus on a 1000 top-up: %v", res)
	}
	if l := ledger(a, luis); l[0]["kind"] != "topup_bonus" || l[1]["kind"] != "topup_test" {
		t.Fatalf("ledger of a bonus: %v", l)
	}
	a.expect(a.call("PATCH", "/admin/promotions/"+str(bonus, "id"), admin.token, map[string]any{"active": false}), 200, "switch off")
	if topup(a, luis, 1_000)["bonus_minor"].(float64) != 0 {
		t.Fatal("a switched-off bonus gives nothing")
	}

	// A code that waives half the commission.
	a.expect(create(map[string]any{"name": "Half off", "kind": "fee_discount", "value_bps": 5000, "code": "half"}), 201, "discount")
	q := func() map[string]any {
		return data(a.expect(a.call("GET", "/tasks/"+publish(a, ana, "Priced")+"/fee-quote?price_minor=5000000", luis.token, nil), 200, "quote"))
	}
	if q()["fee_minor"].(float64) != commissionUSD {
		t.Fatal("full commission before the code")
	}
	got := data(a.expect(a.call("POST", "/me/wallet/redeem", luis.token, map[string]any{"code": "HALF"}), 200, "redeem, any case"))
	if got["kind"] != "fee_discount" || got["discount_bps"].(float64) != 5000 {
		t.Fatalf("redeem: %v", got)
	}
	if fee := q()["fee_minor"].(float64); fee != 63 { // 125 / 2 = 62,5, rounded up
		t.Fatalf("half the commission, rounded up: %v", fee)
	}
	if again := a.call("POST", "/me/wallet/redeem", luis.token, map[string]any{"code": "half"}); again.Status != 409 || errCode(again) != "promo_already_redeemed" {
		t.Fatalf("a code works once per person: %d %s", again.Status, errCode(again))
	}
	if r := a.call("POST", "/me/wallet/redeem", luis.token, map[string]any{"code": "nope"}); r.Status != 404 || errCode(r) != "promo_code_not_found" {
		t.Fatalf("unknown code: %d %s", r.Status, errCode(r))
	}
	// Someone who did not redeem it still pays in full.
	topup(a, pedro, 100)
	if fee := data(a.expect(a.call("GET", "/tasks/"+publish(a, ana, "Other")+"/fee-quote?price_minor=5000000", pedro.token, nil), 200, "quote"))["fee_minor"].(float64); fee != 500_000 {
		t.Fatalf("Pedro pays the full commission in COP 5.000 (500.000 minor): %v", fee)
	}

	// A code that gives credit, in the person's own currency, and fixes it.
	a.expect(create(map[string]any{"name": "Welcome", "kind": "credit_grant", "amount_usd_minor": 500, "code": "WELCOME5", "max_redemptions": 1}), 201, "grant")
	if dup := create(map[string]any{"name": "Clash", "kind": "credit_grant", "amount_usd_minor": 100, "code": "welcome5"}); dup.Status != 409 || errCode(dup) != "promo_code_taken" {
		t.Fatalf("codes are unique: %d %s", dup.Status, errCode(dup))
	}
	grant := data(a.expect(a.call("POST", "/me/wallet/redeem", ana.token, map[string]any{"code": "WELCOME5"}), 200, "grant"))
	if grant["currency"] != "COP" || grant["credited_minor"].(float64) != 2_000_000 { // USD 5 = COP 20.000
		t.Fatalf("USD 5 in pesos: %v", grant)
	}
	a.expect(a.call("PATCH", "/me", ana.token, map[string]any{"currency": "EUR"}), 409, "a credited wallet locks the currency")
	if r := a.call("POST", "/me/wallet/redeem", pedro.token, map[string]any{"code": "WELCOME5"}); r.Status != 409 || errCode(r) != "promo_code_unavailable" {
		t.Fatalf("used up after one: %d %s", r.Status, errCode(r))
	}

	// Manual credit by the administrator, written in any currency.
	m := data(a.expect(a.call("POST", "/admin/credit", admin.token, map[string]any{
		"email": "pedro@test.dev", "amount_minor": 1_000, "currency": "USD", "note": "Paid by bank transfer",
	}), 200, "manual credit"))
	if m["currency"] != "COP" || m["balance_minor"].(float64) != 100+4_000_000 { // USD 10 = COP 40.000
		t.Fatalf("manual credit converted to the wallet currency: %v", m)
	}
	if l := ledger(a, pedro); l[0]["kind"] != "topup_manual" || l[0]["note"] != "Paid by bank transfer" {
		t.Fatalf("ledger of a manual credit: %v", l[0])
	}
	a.expect(a.call("POST", "/admin/credit", admin.token, map[string]any{"email": "ghost@test.dev", "amount_minor": 1, "currency": "USD"}), 404, "unknown person")

	// Test top-ups can be switched off.
	setSettings(a, admin, feeBpsTenth, false, 10_000, 0)
	if r := a.call("POST", "/me/wallet/test-topup", luis.token, map[string]any{"amount_minor": 100}); r.Status != 403 || errCode(r) != "test_topups_disabled" {
		t.Fatalf("switched off: %d %s", r.Status, errCode(r))
	}

	// A sign-up credit is given in the new person's currency.
	setSettings(a, admin, feeBpsTenth, true, 10_000, 1_000)
	newcomer := a.register("new@test.dev", "Newcomer", "EUR")
	w := walletOf(a, newcomer)
	if w["established"] != true || w["currency"] != "EUR" || w["balance_minor"].(float64) != 800 { // USD 10 = EUR 8
		t.Fatalf("sign-up credit: %v", w)
	}
}

func TestWalletAdminOnly(t *testing.T) {
	a, admin := walletSetup(t)
	ana := a.register("ana@test.dev", "Ana", "COP")

	for _, c := range []struct{ method, path string }{
		{"GET", "/admin/overview"}, {"PUT", "/admin/settings"}, {"GET", "/admin/promotions"},
		{"POST", "/admin/promotions"}, {"POST", "/admin/credit"},
	} {
		var body any
		switch c.path {
		case "/admin/settings":
			body = map[string]any{"fee_bps": 0, "test_topups_enabled": true, "test_topup_max_usd_minor": 1, "signup_credit_usd_minor": 0}
		case "/admin/promotions":
			body = map[string]any{"name": "x", "kind": "topup_bonus", "value_bps": 100}
		case "/admin/credit":
			body = map[string]any{"email": "ana@test.dev", "amount_minor": 100, "currency": "USD"}
		}
		r := a.call(c.method, c.path, ana.token, body)
		if r.Status != 403 || errCode(r) != "not_admin" {
			t.Errorf("%s %s as a regular person: %d %s", c.method, c.path, r.Status, errCode(r))
		}
	}

	// Settings are validated.
	bad := a.call("PUT", "/admin/settings", admin.token, map[string]any{"fee_bps": 10_001, "test_topups_enabled": true, "test_topup_max_usd_minor": 1, "signup_credit_usd_minor": 0})
	a.expect(bad, 400, "commission above 100 %")
	a.expect(a.call("POST", "/admin/promotions", admin.token, map[string]any{"name": "x", "kind": "credit_grant", "amount_usd_minor": 5}), 400, "a grant needs a code")
}
