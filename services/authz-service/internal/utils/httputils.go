package utils

import (
	"encoding/json"
	"net/http"
	"strings"

	"authz-service/internal/audit"
)

// ErrorResponse represents an error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// WriteJSON writes JSON response
func WriteJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		audit.GenericEvent("handler_error", map[string]any{
			"error":   "failed to encode JSON response",
			"details": err.Error(),
		})
	}
}

// WriteError writes error response
func WriteError(w http.ResponseWriter, status int, message string, err error) {
	if message == "" {
		message = http.StatusText(status)
	}

	errorResp := ErrorResponse{
		Code:    status,
		Message: message,
		Error:   sanitizeErrorCode(status),
	}

	fields := map[string]any{
		"status":  status,
		"message": message,
	}
	if err != nil {
		fields["details"] = err.Error()
	}
	audit.GenericEvent("handler_error", fields)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if encodeErr := json.NewEncoder(w).Encode(errorResp); encodeErr != nil {
		audit.GenericEvent("handler_error", map[string]any{
			"error":   "failed to encode JSON response",
			"details": encodeErr.Error(),
		})
	}
}

func sanitizeErrorCode(status int) string {
	switch status {
	case http.StatusBadRequest:
		return "invalid_request"
	case http.StatusUnauthorized:
		return "unauthorized"
	case http.StatusForbidden:
		return "forbidden"
	case http.StatusNotFound:
		return "not_found"
	case http.StatusConflict:
		return "conflict"
	}

	if status >= 500 {
		return "internal_server_error"
	}

	text := strings.TrimSpace(http.StatusText(status))
	if text == "" {
		if status >= 400 {
			return "client_error"
		}
		return "error"
	}

	sanitized := strings.ToLower(strings.ReplaceAll(text, " ", "_"))
	return sanitized
}
