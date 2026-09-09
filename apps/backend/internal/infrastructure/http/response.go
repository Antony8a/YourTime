package http

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

type ProblemDetails struct {
	Type     string         `json:"type"`
	Title    string         `json:"title"`
	Status   int            `json:"status"`
	Detail   string         `json:"detail"`
	Instance string         `json:"instance"`
	Errors   []ValidationError `json:"errors,omitempty"`
}

type ValidationError struct {
	Field   string      `json:"field"`
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Value   interface{} `json:"value,omitempty"`
}

type SuccessResponse struct {
	Data interface{} `json:"data"`
	Meta interface{} `json:"meta,omitempty"`
}

func WriteJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

func OK(w http.ResponseWriter, data interface{}) {
	WriteJSON(w, http.StatusOK, SuccessResponse{Data: data})
}

func Created(w http.ResponseWriter, data interface{}) {
	WriteJSON(w, http.StatusCreated, SuccessResponse{Data: data})
}

func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

func Error(w http.ResponseWriter, status int, title, detail, instance string) {
	WriteJSON(w, status, ProblemDetails{
		Type:     "https://yourtime.com/errors/" + strings.ToLower(strings.ReplaceAll(title, " ", "-")),
		Title:    title,
		Status:   status,
		Detail:   detail,
		Instance: instance,
	})
}

func ValidationErrorResponse(w http.ResponseWriter, instance string, errors []ValidationError) {
	WriteJSON(w, http.StatusBadRequest, ProblemDetails{
		Type:     "https://yourtime.com/errors/validation-failed",
		Title:    "Validation Failed",
		Status:   http.StatusBadRequest,
		Detail:   "One or more fields failed validation",
		Instance: instance,
		Errors:   errors,
	})
}

func BadRequest(w http.ResponseWriter, detail, instance string) {
	Error(w, http.StatusBadRequest, "Bad Request", detail, instance)
}

func Unauthorized(w http.ResponseWriter, detail, instance string) {
	Error(w, http.StatusUnauthorized, "Unauthorized", detail, instance)
}

func Forbidden(w http.ResponseWriter, detail, instance string) {
	Error(w, http.StatusForbidden, "Forbidden", detail, instance)
}

func NotFound(w http.ResponseWriter, detail, instance string) {
	Error(w, http.StatusNotFound, "Not Found", detail, instance)
}

func Conflict(w http.ResponseWriter, detail, instance string) {
	Error(w, http.StatusConflict, "Conflict", detail, instance)
}

func UnprocessableEntity(w http.ResponseWriter, detail, instance string) {
	Error(w, http.StatusUnprocessableEntity, "Unprocessable Entity", detail, instance)
}

func TooManyRequests(w http.ResponseWriter, detail, instance string) {
	Error(w, http.StatusTooManyRequests, "Too Many Requests", detail, instance)
}

func InternalServerError(w http.ResponseWriter, detail, instance string) {
	Error(w, http.StatusInternalServerError, "Internal Server Error", detail, instance)
}

func ServiceUnavailable(w http.ResponseWriter, detail, instance string) {
	Error(w, http.StatusServiceUnavailable, "Service Unavailable", detail, instance)
}

func GenerateRequestID() string {
	return uuid.New().String()
}