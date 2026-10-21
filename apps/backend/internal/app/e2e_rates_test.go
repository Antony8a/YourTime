//go:build integration

package app_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/yourtime/backend/internal/domain/common/valueobjects"
)

// fakeRates is a fixed exchange-rate source so tests never touch the network.
type fakeRates struct {
	fail  bool
	calls int
}

var testRates = &fakeRates{}

func (f *fakeRates) Latest(context.Context) (map[valueobjects.Currency]float64, error) {
	f.calls++
	if f.fail {
		return nil, errors.New("source is down")
	}
	return map[valueobjects.Currency]float64{"USD": 1, "COP": 4000, "EUR": 0.8, "JPY": 150}, nil
}

func TestRatesEndpoint(t *testing.T) {
	testRates.fail, testRates.calls = false, 0
	a, _ := setup(t)
	ana := a.register("ana@test.dev", "Ana", "COP")

	a.expect(a.call("GET", "/rates", "", nil), 401, "rates need a session")

	r := data(a.expect(a.call("GET", "/rates", ana.token, nil), 200, "rates"))
	if r["base"] != "USD" || r["stale"] != false || str(r, "date") != time.Now().UTC().Format("2006-01-02") {
		t.Fatalf("rates header: %v", r)
	}
	if sub(r, "rates")["COP"].(float64) != 4000 || sub(r, "rates")["USD"].(float64) != 1 {
		t.Fatalf("rates: %v", r["rates"])
	}

	// The day already has its rates: asking again must not call the source.
	a.expect(a.call("GET", "/rates", ana.token, nil), 200, "rates again")
	if testRates.calls != 1 {
		t.Fatalf("the source was called %d times, want 1", testRates.calls)
	}
}

func TestRatesUnavailableWithoutAnyStoredRates(t *testing.T) {
	testRates.fail = true
	t.Cleanup(func() { testRates.fail = false })
	a, _ := setup(t)
	ana := a.register("ana@test.dev", "Ana", "COP")

	r := a.expect(a.call("GET", "/rates", ana.token, nil), 503, "no rates ever stored")
	if str(r.Body, "code") != "rates_unavailable" {
		t.Fatalf("code: %v", r.Body)
	}
	// The rest of the app still works. Money in another currency simply has no
	// conversion, rather than a total that silently leaves it out.
	luis := a.register("luis@test.dev", "Luis", "USD")
	runService(a, choose(a, luis, ana, "Trabajo en dolares"), ana)
	earned := sub(data(a.expect(a.call("GET", "/me/balance", ana.token, nil), 200, "balance without rates")), "earned")
	if earned["converted"] != nil {
		t.Fatalf("USD money cannot be converted without rates: %v", earned["converted"])
	}
	if m, c := totalOf(earned, "USD"); m != 5000000 || c != 1 {
		t.Fatalf("the original USD total is still there: %v / %v", m, c)
	}
}

func TestStaleRatesAreServedWhenTheSourceIsDown(t *testing.T) {
	testRates.fail = false
	t.Cleanup(func() { testRates.fail = false })
	a, pool := setup(t)
	ana := a.register("ana@test.dev", "Ana", "COP")

	a.expect(a.call("GET", "/rates", ana.token, nil), 200, "store today's rates")
	// Make the stored snapshot look like yesterday's, then take the source down.
	if _, err := pool.Exec(context.Background(), `UPDATE exchange_rates SET rate_date = rate_date - 1`); err != nil {
		t.Fatal(err)
	}
	testRates.fail = true
	r := data(a.expect(a.call("GET", "/rates", ana.token, nil), 200, "stale rates"))
	if r["stale"] != true || sub(r, "rates")["COP"].(float64) != 4000 {
		t.Fatalf("expected yesterday's rates marked stale: %v", r)
	}
}

func TestBalanceConvertsToTheAccountCurrency(t *testing.T) {
	testRates.fail = false
	a, pool := setup(t)
	ana := a.register("ana@test.dev", "Ana", "COP")
	luis := a.register("luis@test.dev", "Luis", "USD")

	// Ana (COP) hires Luis (USD) twice: each is COP 50.000 (5 000 000 minor units).
	first := choose(a, ana, luis, "Primero")
	runService(a, first, luis)
	second := choose(a, ana, luis, "Segundo")
	runService(a, second, luis)

	// At 4000 COP per USD, COP 50.000 is USD 12.50 = 1250 minor units.
	luisBal := data(a.expect(a.call("GET", "/me/balance", luis.token, nil), 200, "Luis balance"))
	if luisBal["currency"] != "USD" {
		t.Fatalf("currency: %v", luisBal["currency"])
	}
	earned := sub(luisBal, "earned")
	conv := sub(earned, "converted")
	if conv["currency"] != "USD" || conv["total_minor"].(float64) != 2500 || conv["partial"] != false {
		t.Fatalf("Luis earned, in USD: %v", conv)
	}
	// The original amounts are untouched: Luis earned in COP.
	if m, c := totalOf(earned, "COP"); m != 10000000 || c != 2 {
		t.Fatalf("original totals: %v / %v", m, c)
	}
	top := earned["entries"].([]any)[0].(map[string]any)
	if top["converted_minor"].(float64) != 1250 {
		t.Fatalf("entry conversion: %v", top)
	}

	// Ana's spending is already in her currency: no conversion on the entries,
	// and the total is exactly what she paid.
	anaBal := data(a.expect(a.call("GET", "/me/balance", ana.token, nil), 200, "Ana balance"))
	spent := sub(anaBal, "spent")
	if sub(spent, "converted")["total_minor"].(float64) != 10000000 {
		t.Fatalf("Ana spent: %v", spent["converted"])
	}
	if spent["entries"].([]any)[0].(map[string]any)["converted_minor"] != nil {
		t.Fatalf("same-currency entries carry no conversion: %v", spent["entries"])
	}

	// A service finished before any rates were kept uses the closest day we have,
	// and says so.
	if _, err := pool.Exec(context.Background(), `UPDATE tasks SET completed_at = NOW() - INTERVAL '30 days' WHERE id = $1`, first); err != nil {
		t.Fatal(err)
	}
	older := sub(data(a.expect(a.call("GET", "/me/balance", luis.token, nil), 200, "older")), "earned")
	oc := sub(older, "converted")
	if oc["total_minor"].(float64) != 2500 || oc["approximate"] != true {
		t.Fatalf("older service uses the closest rates and is flagged: %v", oc)
	}
}
