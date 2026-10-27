package wallet

import (
	"testing"
	"time"
)

func TestFeeMinor(t *testing.T) {
	cases := []struct {
		name                string
		price               int64
		feeBps, discountBps int
		want                int64
	}{
		{"10% of 50.000 COP (5.000.000 minor)", 5_000_000, 1000, 0, 500_000},
		{"rounds up so no commission is lost", 1_001, 1000, 0, 101},
		{"a single minor unit still costs one", 1, 1000, 0, 1},
		{"a 50% discount halves it", 5_000_000, 1000, 5000, 250_000},
		{"a full discount is free", 5_000_000, 1000, 10000, 0},
		{"no commission, no fee", 5_000_000, 0, 0, 0},
		{"nothing to charge on nothing", 0, 1000, 0, 0},
		{"a huge price does not overflow", 1_000_000_000_000, 10000, 0, 1_000_000_000_000},
		{"a negative discount is ignored", 10_000, 1000, -5, 1_000},
	}
	for _, c := range cases {
		if got := FeeMinor(c.price, c.feeBps, c.discountBps); got != c.want {
			t.Errorf("%s: got %d, want %d", c.name, got, c.want)
		}
	}
}

func TestBonusMinor(t *testing.T) {
	if got := BonusMinor(10_000, 2000); got != 2_000 {
		t.Errorf("20%% of 10.000: got %d", got)
	}
	if got := BonusMinor(999, 1000); got != 99 {
		t.Errorf("rounds down: got %d", got)
	}
	if BonusMinor(0, 2000) != 0 || BonusMinor(10_000, 0) != 0 {
		t.Error("no bonus on nothing")
	}
}

func TestQuoteEnough(t *testing.T) {
	if !(Quote{FeeMinor: 500, BalanceMinor: 500}).Enough() {
		t.Error("an exact balance is enough")
	}
	if (Quote{FeeMinor: 500, BalanceMinor: 499}).Enough() {
		t.Error("one short is not enough")
	}
	if !(Quote{FeeMinor: 0, BalanceMinor: 0}).Enough() {
		t.Error("a free task needs no balance")
	}
}

func TestPromotionValidation(t *testing.T) {
	bps := func(v int) *int { return &v }
	usd := func(v int64) *int64 { return &v }
	code := func(s string) *string { return &s }
	now := time.Now()
	later := now.Add(time.Hour)

	valid := []Promotion{
		{Name: "Double", Kind: PromoTopupBonus, ValueBps: bps(10000)},
		{Name: "Half fee", Kind: PromoFeeDiscount, ValueBps: bps(5000), Code: code("HALF")},
		{Name: "Welcome", Kind: PromoCreditGrant, AmountUSDMinor: usd(500), Code: code("HELLO"), StartsAt: &now, EndsAt: &later},
	}
	for _, p := range valid {
		p := p
		if err := p.Validate(); err != nil {
			t.Errorf("%s should be valid: %v", p.Name, err)
		}
	}

	invalid := map[string]Promotion{
		"no name":                 {Name: " ", Kind: PromoTopupBonus, ValueBps: bps(100)},
		"bonus without a value":   {Name: "x", Kind: PromoTopupBonus},
		"discount over 100%":      {Name: "x", Kind: PromoFeeDiscount, ValueBps: bps(10001)},
		"grant without a code":    {Name: "x", Kind: PromoCreditGrant, AmountUSDMinor: usd(500)},
		"grant without an amount": {Name: "x", Kind: PromoCreditGrant, Code: code("A")},
		"grant with a percentage": {Name: "x", Kind: PromoCreditGrant, Code: code("A"), AmountUSDMinor: usd(5), ValueBps: bps(5)},
		"code with a space":       {Name: "x", Kind: PromoFeeDiscount, ValueBps: bps(100), Code: code("A B")},
		"unknown kind":            {Name: "x", Kind: "free_money", ValueBps: bps(100)},
		"ends before it starts":   {Name: "x", Kind: PromoTopupBonus, ValueBps: bps(100), StartsAt: &later, EndsAt: &now},
	}
	for name, p := range invalid {
		p := p
		if err := p.Validate(); err == nil {
			t.Errorf("%s should be rejected", name)
		}
	}
}

func TestPromotionRedeemable(t *testing.T) {
	now := time.Now()
	past, future := now.Add(-time.Hour), now.Add(time.Hour)
	one := 1
	cases := []struct {
		name string
		p    Promotion
		want bool
	}{
		{"running", Promotion{Active: true}, true},
		{"switched off", Promotion{Active: false}, false},
		{"not started", Promotion{Active: true, StartsAt: &future}, false},
		{"ended", Promotion{Active: true, EndsAt: &past}, false},
		{"used up", Promotion{Active: true, MaxRedemptions: &one, RedemptionsCount: 1}, false},
		{"uses left", Promotion{Active: true, MaxRedemptions: &one, RedemptionsCount: 0}, true},
	}
	for _, c := range cases {
		if got := c.p.Redeemable(now); got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}

func TestSettingsValidate(t *testing.T) {
	if err := (Settings{FeeBps: 1000}).Validate(); err != nil {
		t.Errorf("10%% is fine: %v", err)
	}
	for _, s := range []Settings{{FeeBps: -1}, {FeeBps: 10001}, {TestTopupMaxUSDMinor: -1}, {SignupCreditUSDMinor: -5}} {
		if s.Validate() == nil {
			t.Errorf("%+v should be rejected", s)
		}
	}
}
