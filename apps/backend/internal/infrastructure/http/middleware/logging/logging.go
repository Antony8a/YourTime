package logging

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/yourtime/backend/internal/platform/logger"
)

func New(logger logger.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

			next.ServeHTTP(ww, r)

			duration := time.Since(start)
			logger.Info().
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Int("status", ww.Status()).
				Dur("duration", duration).
				Str("request_id", middleware.GetReqID(r.Context())).
				Msg("HTTP request")
		})
	}
}