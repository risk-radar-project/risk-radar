package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"authz-service/internal/utils"
)

// HealthHandler handles health check endpoints
type HealthHandler struct {
	db *sql.DB
}

// HealthResponse represents the health check response
type HealthResponse struct {
	Status             string    `json:"status"`
	Timestamp          time.Time `json:"timestamp"`
	DatabaseConnection string    `json:"database_connection"`
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(db *sql.DB) *HealthHandler {
	return &HealthHandler{db: db}
}

// GetStatus returns the service status
func (h *HealthHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	overallStatus := "OK"
	databaseConnection := "OK"

	// Check database connection
	if err := h.db.Ping(); err != nil {
		databaseConnection = "FAIL: " + err.Error()
		overallStatus = "FAIL"
	}

	response := HealthResponse{
		Status:             overallStatus,
		Timestamp:          time.Now().UTC(),
		DatabaseConnection: databaseConnection,
	}

	status := http.StatusOK
	if overallStatus == "FAIL" {
		status = http.StatusServiceUnavailable
	}

	utils.WriteJSON(w, status, response)
}
