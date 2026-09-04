package recovery

import (
	"net/http"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/yourtime/backend/internal/platform/logger"
)

func New(logger logger.Logger) func(http.Handler) http.Handler {
	return middleware.Recoverer(func(w http.ResponseWriter, r *http.Request, err interface{}) {
		logger.Error().
			Interface("panic", err).
			Str("path", r.URL.Path).
			Msg("Recovered from panic")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	})
}