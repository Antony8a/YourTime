// Package auth is the bearer-token authentication middleware.
package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
	httpx "github.com/yourtime/backend/internal/infrastructure/http"
)

type contextKey struct{}

// AccessParser verifies an access token and returns its subject.
type AccessParser interface {
	ParseAccess(token string) (uuid.UUID, error)
}

func New(parser AccessParser) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			scheme, token, ok := strings.Cut(r.Header.Get("Authorization"), " ")
			if !ok || !strings.EqualFold(scheme, "Bearer") || token == "" {
				httpx.Problem(w, r, http.StatusUnauthorized, "Missing or malformed Authorization header")
				return
			}
			id, err := parser.ParseAccess(strings.TrimSpace(token))
			if err != nil {
				httpx.Problem(w, r, http.StatusUnauthorized, "Invalid or expired token")
				return
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), contextKey{}, id)))
		})
	}
}

// UserID returns the authenticated user's id. Only valid behind New.
func UserID(ctx context.Context) uuid.UUID {
	id, _ := ctx.Value(contextKey{}).(uuid.UUID)
	return id
}
