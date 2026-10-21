// Package handlers adapts HTTP requests to application use cases.
package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	httpx "github.com/yourtime/backend/internal/infrastructure/http"
)

const maxBodyBytes = 1 << 20

var validate = func() *validator.Validate {
	v := validator.New(validator.WithRequiredStructEnabled())
	// Report errors using JSON field names, which is what API clients know.
	v.RegisterTagNameFunc(func(f reflect.StructField) string {
		name, _, _ := strings.Cut(f.Tag.Get("json"), ",")
		if name == "-" || name == "" {
			return f.Name
		}
		return name
	})
	return v
}()

// decode parses and validates a JSON body into dst. On failure it writes the
// response and returns false.
func decode(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			httpx.Problem(w, r, http.StatusRequestEntityTooLarge, "Request body is too large")
			return false
		}
		httpx.Problem(w, r, http.StatusBadRequest, "Malformed JSON body: "+err.Error())
		return false
	}
	if err := validate.Struct(dst); err != nil {
		var verrs validator.ValidationErrors
		if errors.As(err, &verrs) {
			out := make([]httpx.ValidationError, 0, len(verrs))
			for _, fe := range verrs {
				// Namespace is "StructName.path.to.field"; clients want the path.
				_, field, _ := strings.Cut(fe.Namespace(), ".")
				out = append(out, httpx.ValidationError{
					Field:   field,
					Code:    fe.Tag(),
					Message: fmt.Sprintf("%s failed the %q rule", fe.Field(), fe.Tag()),
				})
			}
			httpx.Problem(w, r, http.StatusBadRequest, "One or more fields are invalid", out...)
			return false
		}
		httpx.HandleError(w, r, err)
		return false
	}
	return true
}

func pathUUID(w http.ResponseWriter, r *http.Request, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		httpx.Problem(w, r, http.StatusBadRequest, "Invalid "+name)
		return uuid.Nil, false
	}
	return id, true
}

// query helpers return ok=false after writing a 400 for malformed values.

func queryFloat(w http.ResponseWriter, r *http.Request, key string) (*float64, bool) {
	raw := r.URL.Query().Get(key)
	if raw == "" {
		return nil, true
	}
	f, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		httpx.Problem(w, r, http.StatusBadRequest, "Invalid number for "+key)
		return nil, false
	}
	return &f, true
}

func queryInt(w http.ResponseWriter, r *http.Request, key string) (int, bool) {
	raw := r.URL.Query().Get(key)
	if raw == "" {
		return 0, true
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		httpx.Problem(w, r, http.StatusBadRequest, "Invalid integer for "+key)
		return 0, false
	}
	return n, true
}

func queryUUID(w http.ResponseWriter, r *http.Request, key string) (*uuid.UUID, bool) {
	raw := r.URL.Query().Get(key)
	if raw == "" {
		return nil, true
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		httpx.Problem(w, r, http.StatusBadRequest, "Invalid id for "+key)
		return nil, false
	}
	return &id, true
}
