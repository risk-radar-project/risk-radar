package handlers

import (
	"net/http"
	"strings"

	"authz-service/internal/services"
	"authz-service/internal/utils"
	"authz-service/internal/validation"

	"github.com/google/uuid"
)

const (
	permissionRolesEdit         = "roles:edit"
	permissionRolesAssign       = "roles:assign"
	permissionPermissionsManage = "permissions:manage"
)

// authorizeMutation validates the caller identity and ensures they hold the required permission.
// Returns the actor ID when authorization succeeds; otherwise writes the error response and returns false.
func authorizeMutation(r *http.Request, w http.ResponseWriter, authz services.AuthzServiceInterface, requiredPermission string) (uuid.UUID, bool) {
	if authz == nil {
		utils.WriteError(w, http.StatusInternalServerError, "Authorization service unavailable", nil)
		return uuid.Nil, false
	}

	actorIDStr := strings.TrimSpace(r.Header.Get("X-User-ID"))
	if actorIDStr == "" {
		utils.WriteError(w, http.StatusBadRequest, "X-User-ID header is required", nil)
		return uuid.Nil, false
	}

	if err := validation.ValidateUUIDString(actorIDStr); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid X-User-ID format", err)
		return uuid.Nil, false
	}

	actorID, err := uuid.Parse(actorIDStr)
	if err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid X-User-ID format", err)
		return uuid.Nil, false
	}

	hasPermission, err := authz.HasPermission(actorID, requiredPermission)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Unable to authorize request", err)
		return uuid.Nil, false
	}

	if !hasPermission {
		utils.WriteError(w, http.StatusForbidden, "Insufficient permissions", nil)
		return uuid.Nil, false
	}

	return actorID, true
}
