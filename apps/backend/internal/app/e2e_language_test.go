//go:build integration

package app_test

import "testing"

// The language is a preference of the account: chosen at sign-up or later, and
// "" goes back to following the device.
func TestAccountLanguage(t *testing.T) {
	a, _ := setup(t)

	// A person who does not choose one follows the device: null.
	ana := a.register("ana@test.dev", "Ana", "COP")
	me := data(a.expect(a.call("GET", "/me", ana.token, nil), 200, "me"))
	if me["language"] != nil {
		t.Fatalf("no choice yet, want null, got %v", me["language"])
	}

	// A device locale sent at sign-up keeps only the language.
	r := a.expect(a.call("POST", "/auth/register", "", map[string]any{
		"email": "luis@test.dev", "password": "supersecret1", "full_name": "Luis", "currency": "BRL", "language": "pt-BR",
	}), 201, "register with a language")
	if got := sub(data(r), "user")["language"]; got != "pt" {
		t.Fatalf("register language: got %v, want pt", got)
	}

	if got := data(a.expect(a.call("PATCH", "/me", ana.token, map[string]any{"language": "en"}), 200, "choose english"))["language"]; got != "en" {
		t.Fatalf("language: got %v, want en", got)
	}
	// It survives a fresh read, and other edits do not touch it.
	a.expect(a.call("PATCH", "/me", ana.token, map[string]any{"bio": "hola"}), 200, "edit something else")
	if got := data(a.expect(a.call("GET", "/me", ana.token, nil), 200, "me again"))["language"]; got != "en" {
		t.Fatalf("language after another edit: got %v, want en", got)
	}

	// Unsupported languages are rejected with a stable code.
	bad := a.call("PATCH", "/me", ana.token, map[string]any{"language": "klingon"})
	a.expect(bad, 400, "unsupported language")
	if code, _ := bad.Body["code"].(string); code != "invalid_language" {
		t.Fatalf("code: got %q, want invalid_language", code)
	}

	// "" goes back to following the device.
	if got := data(a.expect(a.call("PATCH", "/me", ana.token, map[string]any{"language": ""}), 200, "clear"))["language"]; got != nil {
		t.Fatalf("cleared language: got %v, want null", got)
	}
}
