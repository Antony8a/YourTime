// Package http contains transport helpers shared by handlers and middleware:
// the JSON envelope, RFC 7807 problem responses and domain-error mapping.
package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	derr "github.com/yourtime/backend/internal/domain/common/errors"
	"github.com/yourtime/backend/internal/platform/logger"
)

type ProblemDetails struct {
	Type     string            `json:"type"`
	Code     string            `json:"code,omitempty"`
	Title    string            `json:"title"`
	Status   int               `json:"status"`
	Detail   string            `json:"detail"`
	Instance string            `json:"instance"`
	Errors   []ValidationError `json:"errors,omitempty"`
}

type ValidationError struct {
	Field   string `json:"field"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

type envelope struct {
	Data any `json:"data"`
	Meta any `json:"meta,omitempty"`
}

func WriteJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if body != nil {
		_ = json.NewEncoder(w).Encode(body)
	}
}

func OK(w http.ResponseWriter, data any)      { WriteJSON(w, http.StatusOK, envelope{Data: data}) }
func Created(w http.ResponseWriter, data any) { WriteJSON(w, http.StatusCreated, envelope{Data: data}) }
func OKMeta(w http.ResponseWriter, data, meta any) {
	WriteJSON(w, http.StatusOK, envelope{Data: data, Meta: meta})
}
func NoContent(w http.ResponseWriter) { w.WriteHeader(http.StatusNoContent) }

func Problem(w http.ResponseWriter, r *http.Request, status int, detail string, errs ...ValidationError) {
	problem(w, r, status, "", detail, errs...)
}

func problem(w http.ResponseWriter, r *http.Request, status int, code, detail string, errs ...ValidationError) {
	title := http.StatusText(status)
	WriteJSON(w, status, ProblemDetails{
		Code:     code,
		Type:     "https://yourtime.app/errors/" + strings.ToLower(strings.ReplaceAll(title, " ", "-")),
		Title:    title,
		Status:   status,
		Detail:   detail,
		Instance: r.URL.Path,
		Errors:   errs,
	})
}

// categories maps domain error categories to HTTP statuses, in match order.
var categories = []struct {
	sentinel error
	status   int
}{
	{derr.ErrNotFound, http.StatusNotFound},
	{derr.ErrInvalidInput, http.StatusBadRequest},
	{derr.ErrUnauthorized, http.StatusUnauthorized},
	{derr.ErrForbidden, http.StatusForbidden},
	{derr.ErrConflict, http.StatusConflict},
	{derr.ErrPaymentRequired, http.StatusPaymentRequired},
	{derr.ErrUnavailable, http.StatusServiceUnavailable},
}

// HandleError writes the right problem response for err. Unknown errors are
// logged and reported as a generic 500 so internals never leak.
func HandleError(w http.ResponseWriter, r *http.Request, err error) {
	for _, c := range categories {
		if errors.Is(err, c.sentinel) {
			// Domain errors read "message: category"; show only the message.
			detail := strings.TrimSuffix(err.Error(), ": "+c.sentinel.Error())
			var coded *derr.Error
			code := ""
			if errors.As(err, &coded) {
				code = coded.Code
				detail = coded.Msg
			}
			problem(w, r, c.status, code, detail)
			return
		}
	}
	logger.Error().Err(err).Str("path", r.URL.Path).Msg("Unhandled error")
	Problem(w, r, http.StatusInternalServerError, "Something went wrong. Please try again.")
}
