package valueobjects

import "strings"

// Currency is an ISO 4217 code. Amounts are always stored in minor units
// (cents); how many decimals a currency has is a presentation concern handled
// by clients (see packages/shared-utils/src/currency).
type Currency string

// DefaultCurrency is assigned to new accounts that do not choose one.
const DefaultCurrency Currency = "USD"

var supportedCurrencies = map[string]struct{}{}

func init() {
	codes := "USD EUR GBP CAD AUD NZD CHF JPY CNY HKD TWD KRW SGD INR IDR PHP THB VND MYR " +
		"SEK NOK DKK PLN CZK TRY ZAR AED SAR ILS EGP NGN KES " +
		"MXN ARS BRL CLP COP PEN UYU PYG BOB VES DOP CRC GTQ HNL NIO PAB"
	for _, c := range strings.Fields(codes) {
		supportedCurrencies[c] = struct{}{}
	}
}

func NewCurrency(code string) (Currency, error) {
	c := strings.ToUpper(strings.TrimSpace(code))
	if _, ok := supportedCurrencies[c]; !ok {
		return "", ErrInvalidCurrency
	}
	return Currency(c), nil
}

func (c Currency) String() string { return string(c) }

// zeroDecimal are the supported currencies whose minor unit is the unit itself.
// Keep in sync with packages/shared-utils/src/currency.ts.
var zeroDecimal = map[Currency]struct{}{"JPY": {}, "KRW": {}, "VND": {}, "CLP": {}, "PYG": {}, "IDR": {}}

// Decimals is how many decimal places the currency has (its minor-unit exponent).
func (c Currency) Decimals() int {
	if _, ok := zeroDecimal[c]; ok {
		return 0
	}
	return 2
}
