//go:build integration

package app_test

import (
	"testing"

	"github.com/yourtime/backend/internal/config"
)

// A server on the internet can be closed to new accounts once the people who
// should have one do.
func TestClosedRegistration(t *testing.T) {
	a, _ := setupWith(t, func(c *config.Config) { c.RegistrationOpen = false })

	r := a.call("POST", "/auth/register", "", map[string]any{
		"email": "stranger@test.dev", "password": "supersecret1", "full_name": "Stranger", "currency": "COP",
	})
	a.expect(r, 403, "registration is closed")
	if got, _ := r.Body["code"].(string); got != "registration_closed" {
		t.Fatalf("code: got %q, want registration_closed", got)
	}
}
