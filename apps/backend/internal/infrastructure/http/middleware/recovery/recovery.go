// Package recovery turns panics into a logged 500 problem response.
package recovery

import (
	"net/http"

	httpx "github.com/yourtime/backend/internal/infrastructure/http"
	"github.com/yourtime/backend/internal/platform/logger"
)

func New(log logger.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					log.Error().Interface("panic", rec).Str("path", r.URL.Path).Msg("Recovered from panic")
					httpx.Problem(w, r, http.StatusInternalServerError, "Something went wrong. Please try again.")
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}
