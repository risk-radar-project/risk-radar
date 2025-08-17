package utils

import (
	"authz-service/internal/audit"
	"encoding/json"
	"net/http"
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
	errorResp := ErrorResponse{
		Code:    status,
		Message: message,
	}

	if err != nil {
		errorResp.Error = err.Error()
		audit.GenericEvent("handler_error", map[string]any{
			"status":  status,
			"message": message,
			"error":   err.Error(),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(errorResp)
}
