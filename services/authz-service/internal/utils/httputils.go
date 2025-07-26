package utils

import (
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
		LogEvent("handler.error", map[string]interface{}{
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
		LogEvent("handler.error", map[string]interface{}{
			"status":  status,
			"message": message,
			"error":   err.Error(),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(errorResp)
}
