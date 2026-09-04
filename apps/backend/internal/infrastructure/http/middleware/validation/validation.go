package validation

import (
	"net/http"

	"github.com/yourtime/backend/internal/platform/logger"
)

func New() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Basic validation middleware
			// Content-Type validation for POST/PUT/PATCH
			if r.Method == "POST" || r.Method == "PUT" || r.Method == "PATCH" {
				contentType := r.Header.Get("Content-Type")
				if contentType == "" {
					logger.Warn().
						Str("method", r.Method).
						Str("path", r.URL.Path).
						Msg("Missing Content-Type header")
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}