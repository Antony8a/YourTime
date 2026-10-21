package rates

import "testing"

func TestCleanKeepsSupportedCurrenciesOnly(t *testing.T) {
	raw := map[string]float64{"USD": 1, "BTC": 0.00001, "COP": 4000, "XXX": 3, "EUR": -1}
	for _, c := range []string{"GBP", "CAD", "AUD", "NZD", "CHF", "JPY", "CNY", "HKD", "TWD", "KRW", "SGD", "INR", "IDR", "PHP", "THB", "VND", "MYR", "SEK", "NOK", "DKK", "PLN", "CZK", "TRY", "ZAR", "AED", "SAR", "MXN", "NGN", "KES"} {
		raw[c] = 2
	}
	out, err := clean(raw)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := out["BTC"]; ok {
		t.Fatal("unsupported currencies must be dropped")
	}
	if _, ok := out["EUR"]; ok {
		t.Fatal("a negative rate must be dropped")
	}
	if out["USD"] != 1 || out["COP"] != 4000 {
		t.Fatalf("rates changed: %v", out)
	}
}

func TestCleanRejectsAHalfEmptyAnswer(t *testing.T) {
	if _, err := clean(map[string]float64{"USD": 1, "COP": 4000}); err == nil {
		t.Fatal("a tiny answer must not be stored as today's rates")
	}
}
