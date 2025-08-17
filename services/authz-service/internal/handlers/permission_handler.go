package handlers

import (
	"authz-service/internal/audit"
	"authz-service/internal/services"
	"authz-service/internal/utils"
	"authz-service/internal/validation"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// PermissionHandler handles HTTP requests for permission operations
type PermissionHandler struct {
	permissionService services.PermissionServiceInterface
}

// NewPermissionHandler creates a new permission handler
func NewPermissionHandler(permissionService services.PermissionServiceInterface) *PermissionHandler {
	return &PermissionHandler{
		permissionService: permissionService,
	}
}

// GetPermissions handles GET /permissions
func (h *PermissionHandler) GetPermissions(w http.ResponseWriter, r *http.Request) {
	permissions, err := h.permissionService.GetPermissions()
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get permissions", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, permissions)
}

// GetPermission handles GET /permissions/{permissionId}
func (h *PermissionHandler) GetPermission(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	permissionID := vars["permissionId"]

	// Validate UUID
	if err := validation.ValidateUUIDString(permissionID); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid permission ID format", err)
		return
	}

	id, _ := uuid.Parse(permissionID)
	permission, err := h.permissionService.GetPermission(id)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to get permission", err)
		return
	}

	if permission == nil {
		utils.WriteError(w, http.StatusNotFound, "Permission not found", nil)
		return
	}

	utils.WriteJSON(w, http.StatusOK, permission)
}

// CreatePermission handles POST /permissions
func (h *PermissionHandler) CreatePermission(w http.ResponseWriter, r *http.Request) {
	var req services.CreatePermissionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid JSON format", err)
		return
	}

	// Validate request
	if err := h.validateCreateRequest(req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, err.Error(), err)
		return
	}

	permission, err := h.permissionService.CreatePermission(req)
	if err != nil {
		if isConflictError(err) {
			utils.WriteError(w, http.StatusConflict, err.Error(), err)
			return
		}
		utils.WriteError(w, http.StatusInternalServerError, "Failed to create permission", err)
		return
	}

	actorID := r.Header.Get("X-User-ID")
	if actorID == "" {
		actorID = "unknown"
	}
	audit.PermissionChanged("create", actorID, permission.ID.String(), permission.Action, permission.Resource, permission.Description, nil)
	utils.WriteJSON(w, http.StatusCreated, permission)
}

// UpdatePermission handles PUT /permissions/{permissionId}
func (h *PermissionHandler) UpdatePermission(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	permissionID := vars["permissionId"]

	// Validate UUID
	if err := validation.ValidateUUIDString(permissionID); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid permission ID format", err)
		return
	}

	var req services.UpdatePermissionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid JSON format", err)
		return
	}

	// Validate request
	if err := h.validateUpdateRequest(req); err != nil {
		utils.WriteError(w, http.StatusBadRequest, err.Error(), err)
		return
	}

	id, _ := uuid.Parse(permissionID)
	permission, err := h.permissionService.UpdatePermission(id, req)
	if err != nil {
		if isNotFoundError(err) {
			utils.WriteError(w, http.StatusNotFound, "Permission not found", err)
			return
		}
		if isConflictError(err) {
			utils.WriteError(w, http.StatusConflict, err.Error(), err)
			return
		}
		utils.WriteError(w, http.StatusInternalServerError, "Failed to update permission", err)
		return
	}

	actorID := r.Header.Get("X-User-ID")
	if actorID == "" {
		actorID = "unknown"
	}
	audit.PermissionChanged("update", actorID, permission.ID.String(), permission.Action, permission.Resource, permission.Description, nil)
	utils.WriteJSON(w, http.StatusOK, permission)
}

// DeletePermission handles DELETE /permissions/{permissionId}
func (h *PermissionHandler) DeletePermission(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	permissionID := vars["permissionId"]

	// Validate UUID
	if err := validation.ValidateUUIDString(permissionID); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid permission ID format", err)
		return
	}

	id, _ := uuid.Parse(permissionID)
	err := h.permissionService.DeletePermission(id)
	if err != nil {
		if isNotFoundError(err) {
			utils.WriteError(w, http.StatusNotFound, "Permission not found", err)
			return
		}
		utils.WriteError(w, http.StatusInternalServerError, "Failed to delete permission", err)
		return
	}

	actorID := r.Header.Get("X-User-ID")
	if actorID == "" {
		actorID = "unknown"
	}
	audit.PermissionChanged("delete", actorID, id.String(), "", "", "", nil)
	w.WriteHeader(http.StatusNoContent)
}

// validateCreateRequest validates the create permission request
func (h *PermissionHandler) validateCreateRequest(req services.CreatePermissionRequest) error {
	if strings.TrimSpace(req.Resource) == "" {
		return &validationError{field: "resource", message: "resource is required"}
	}
	if strings.TrimSpace(req.Action) == "" {
		return &validationError{field: "action", message: "action is required"}
	}
	if strings.TrimSpace(req.Description) == "" {
		return &validationError{field: "description", message: "description is required"}
	}
	if len(req.Resource) > 50 {
		return &validationError{field: "resource", message: "resource must be 50 characters or less"}
	}
	if len(req.Action) > 50 {
		return &validationError{field: "action", message: "action must be 50 characters or less"}
	}
	if len(req.Description) > 255 {
		return &validationError{field: "description", message: "description must be 255 characters or less"}
	}
	return nil
}

// validateUpdateRequest validates the update permission request
func (h *PermissionHandler) validateUpdateRequest(req services.UpdatePermissionRequest) error {
	if strings.TrimSpace(req.Resource) == "" {
		return &validationError{field: "resource", message: "resource is required"}
	}
	if strings.TrimSpace(req.Action) == "" {
		return &validationError{field: "action", message: "action is required"}
	}
	if strings.TrimSpace(req.Description) == "" {
		return &validationError{field: "description", message: "description is required"}
	}
	if len(req.Resource) > 50 {
		return &validationError{field: "resource", message: "resource must be 50 characters or less"}
	}
	if len(req.Action) > 50 {
		return &validationError{field: "action", message: "action must be 50 characters or less"}
	}
	if len(req.Description) > 255 {
		return &validationError{field: "description", message: "description must be 255 characters or less"}
	}
	return nil
}

// validationError represents a validation error
type validationError struct {
	field   string
	message string
}

func (e *validationError) Error() string {
	return "validation error in field '" + e.field + "': " + e.message
}

// isConflictError checks if the error is a conflict error (already exists)
func isConflictError(err error) bool {
	return err != nil && strings.Contains(err.Error(), "already exists")
}

// isNotFoundError checks if the error is a not found error
func isNotFoundError(err error) bool {
	return err != nil && strings.Contains(err.Error(), "not found")
}
