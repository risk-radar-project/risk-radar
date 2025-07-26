package handlers

import (
	"encoding/json"
	"net/http"

	"authz-service/internal/services"
	"authz-service/internal/utils"
	"authz-service/internal/validation"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// AuthzHandler handles authorization endpoints
type AuthzHandler struct {
	authzService services.AuthzServiceInterface
}

// HasPermissionResponse represents the has permission response
type HasPermissionResponse struct {
	HasPermission bool `json:"has_permission"`
}

// NewAuthzHandler creates a new authorization handler
func NewAuthzHandler(authzService services.AuthzServiceInterface) *AuthzHandler {
	return &AuthzHandler{authzService: authzService}
}

// HasPermission handles GET /has-permission
func (h *AuthzHandler) HasPermission(w http.ResponseWriter, r *http.Request) {
	// Get userId from X-User-ID header (set by api-gateway)
	userIDStr := r.Header.Get("X-User-ID")
	if userIDStr == "" {
		utils.WriteError(w, http.StatusBadRequest, "X-User-ID header is required", nil)
		return
	}

	// Validate UUID format before parsing
	if err := validation.ValidateUUIDString(userIDStr); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid user ID format", err)
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid user ID format", err)
		return
	}

	// Get permission from query parameter
	permission := r.URL.Query().Get("permission")
	if permission == "" {
		utils.WriteError(w, http.StatusBadRequest, "permission query parameter is required", nil)
		return
	}

	// Validate permission format and length
	if len(permission) > 200 {
		utils.WriteError(w, http.StatusBadRequest, "permission parameter too long", nil)
		return
	}

	hasPermission, err := h.authzService.HasPermission(userID, permission)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to check permission", err)
		return
	}

	response := HasPermissionResponse{
		HasPermission: hasPermission,
	}

	utils.WriteJSON(w, http.StatusOK, response)
}

// GetUserPermissions handles GET /users/{userId}/permissions
func (h *AuthzHandler) GetUserPermissions(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userIDStr := vars["userId"]

	// Validate UUID format before parsing
	if err := validation.ValidateUUIDString(userIDStr); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid user ID format", err)
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid user ID format", err)
		return
	}

	permissions, err := h.authzService.GetUserPermissions(userID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to retrieve user permissions", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, permissions)
}

// GetUserRoles handles GET /users/{userId}/roles
func (h *AuthzHandler) GetUserRoles(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userIDStr := vars["userId"]

	// Validate UUID format before parsing
	if err := validation.ValidateUUIDString(userIDStr); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid user ID format", err)
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid user ID format", err)
		return
	}

	roles, err := h.authzService.GetUserRoles(userID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to retrieve user roles", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, roles)
} // AssignRole handles POST /users/{userId}/roles
func (h *AuthzHandler) AssignRole(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userIDStr := vars["userId"]

	// Validate UUID format before parsing
	if err := validation.ValidateUUIDString(userIDStr); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid user ID format", err)
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid user ID format", err)
		return
	}

	var rawReq map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&rawReq); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Validate role_id
	roleIDRaw, exists := rawReq["role_id"]
	if !exists {
		utils.WriteError(w, http.StatusBadRequest, "role_id is required", nil)
		return
	}

	roleIDStr, ok := roleIDRaw.(string)
	if !ok {
		utils.WriteError(w, http.StatusBadRequest, "role_id must be a string", nil)
		return
	}

	if len(roleIDStr) > 36 {
		utils.WriteError(w, http.StatusBadRequest, "Invalid role ID format: too long", nil)
		return
	}

	// Validate UUID format before parsing
	if err := validation.ValidateUUIDString(roleIDStr); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid role ID format", err)
		return
	}

	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid role ID format", err)
		return
	}

	req := services.AssignRoleRequest{
		RoleID: roleID,
	}

	if err := h.authzService.AssignRole(userID, req); err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to assign role", err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// RemoveRole handles DELETE /users/{userId}/roles/{roleId}
func (h *AuthzHandler) RemoveRole(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userIDStr := vars["userId"]
	roleIDStr := vars["roleId"]

	// Validate UUID format before parsing
	if err := validation.ValidateUUIDString(userIDStr); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid user ID format", err)
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid user ID format", err)
		return
	}

	// Validate UUID format before parsing
	if err := validation.ValidateUUIDString(roleIDStr); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid role ID format", err)
		return
	}

	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid role ID format", err)
		return
	}

	if err := h.authzService.RemoveRole(userID, roleID); err != nil {
		if err.Error() == "user role assignment not found" {
			utils.WriteError(w, http.StatusNotFound, "User role assignment not found", err)
			return
		}
		utils.WriteError(w, http.StatusInternalServerError, "Failed to remove role", err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
