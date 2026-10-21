// Package rates fetches exchange rates from public sources over HTTP.
package rates

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/yourtime/backend/internal/domain/common/valueobjects"
	domain "github.com/yourtime/backend/internal/domain/rates"
)

// HTTPProvider asks open.er-api.com first (free, no key, updated daily; its terms
// ask for attribution, which the app shows) and falls back to a community mirror
// of daily rates. For production traffic consider a paid provider with an SLA.
type HTTPProvider struct {
	client *http.Client
}

func NewHTTPProvider() *HTTPProvider {
	return &HTTPProvider{client: &http.Client{Timeout: 12 * time.Second}}
}

var _ domain.Provider = (*HTTPProvider)(nil)

func (p *HTTPProvider) Latest(ctx context.Context) (map[valueobjects.Currency]float64, error) {
	primary, err := p.openERAPI(ctx)
	if err == nil {
		return primary, nil
	}
	fallback, ferr := p.currencyAPI(ctx)
	if ferr == nil {
		return fallback, nil
	}
	return nil, fmt.Errorf("open.er-api.com: %v; currency-api: %w", err, ferr)
}

func (p *HTTPProvider) get(ctx context.Context, url string, dst any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("status %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(dst)
}

func (p *HTTPProvider) openERAPI(ctx context.Context) (map[valueobjects.Currency]float64, error) {
	var body struct {
		Result string             `json:"result"`
		Rates  map[string]float64 `json:"rates"`
	}
	if err := p.get(ctx, "https://open.er-api.com/v6/latest/USD", &body); err != nil {
		return nil, err
	}
	if body.Result != "success" {
		return nil, fmt.Errorf("result %q", body.Result)
	}
	return clean(body.Rates)
}

func (p *HTTPProvider) currencyAPI(ctx context.Context) (map[valueobjects.Currency]float64, error) {
	var body struct {
		USD map[string]float64 `json:"usd"`
	}
	if err := p.get(ctx, "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json", &body); err != nil {
		return nil, err
	}
	upper := make(map[string]float64, len(body.USD))
	for k, v := range body.USD {
		upper[strings.ToUpper(k)] = v
	}
	return clean(upper)
}

// minimumCurrencies guards against a half-empty answer being stored as "today".
const minimumCurrencies = 30

// clean keeps only the currencies the app supports, with sane rates.
func clean(raw map[string]float64) (map[valueobjects.Currency]float64, error) {
	out := make(map[valueobjects.Currency]float64, len(raw))
	for code, rate := range raw {
		cur, err := valueobjects.NewCurrency(code)
		if err != nil || rate <= 0 {
			continue
		}
		out[cur] = rate
	}
	out[domain.Base] = 1
	if len(out) < minimumCurrencies {
		return nil, fmt.Errorf("only %d supported currencies in the answer", len(out))
	}
	return out, nil
}
