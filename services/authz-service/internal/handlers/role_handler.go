package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"authz-service/internal/audit"
	"authz-service/internal/services"
	"authz-service/internal/utils"
	"authz-service/internal/validation"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// RoleHandler handles role management endpoints
type RoleHandler struct {
	roleService  services.RoleServiceInterface
	authzService services.AuthzServiceInterface
}

// NewRoleHandler creates a new role handler
func NewRoleHandler(roleService services.RoleServiceInterface, authzService services.AuthzServiceInterface) *RoleHandler {
	return &RoleHandler{roleService: roleService, authzService: authzService}
}

// GetRoles handles GET /roles
func (h *RoleHandler) GetRoles(w http.ResponseWriter, r *http.Request) {
	roles, err := h.roleService.GetRoles()
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to retrieve roles", err)
		return
	}

	utils.WriteJSON(w, http.StatusOK, roles)
}

// GetRole handles GET /roles/{roleId}
func (h *RoleHandler) GetRole(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	roleIDStr := vars["roleId"]

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

	role, err := h.roleService.GetRole(roleID)
	if err != nil {
		utils.WriteError(w, http.StatusInternalServerError, "Failed to retrieve role", err)
		return
	}

	if role == nil {
		utils.WriteError(w, http.StatusNotFound, "Role not found", nil)
		return
	}

	utils.WriteJSON(w, http.StatusOK, role)
}

// CreateRole handles POST /roles
func (h *RoleHandler) CreateRole(w http.ResponseWriter, r *http.Request) {
	actorID, ok := authorizeMutation(r, w, h.authzService, permissionRolesEdit)
	if !ok {
		return
	}

	var rawReq map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&rawReq); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Validate name
	name, ok := rawReq["name"].(string)
	if !ok {
		utils.WriteError(w, http.StatusBadRequest, "name must be a string", nil)
		return
	}
	if err := validation.ValidateRoleName(name); err != nil {
		utils.WriteError(w, http.StatusBadRequest, err.Error(), err)
		return
	}

	// Validate description
	description := ""
	if desc, exists := rawReq["description"]; exists {
		if descStr, ok := desc.(string); ok {
			if err := validation.ValidateRoleDescription(descStr); err != nil {
				utils.WriteError(w, http.StatusBadRequest, err.Error(), err)
				return
			}
			description = descStr
		} else {
			utils.WriteError(w, http.StatusBadRequest, "description must be a string", nil)
			return
		}
	}

	// Validate permissions
	var permissions []services.Permission
	if perms, exists := rawReq["permissions"]; exists {
		if permsList, ok := perms.([]interface{}); ok {
			if err := validation.ValidatePermissions(permsList); err != nil {
				utils.WriteError(w, http.StatusBadRequest, err.Error(), err)
				return
			}

			// Convert to services.Permission slice
			for _, perm := range permsList {
				permMap := perm.(map[string]interface{})
				permissions = append(permissions, services.Permission{
					Action:   permMap["action"].(string),
					Resource: permMap["resource"].(string),
				})
			}
		} else {
			utils.WriteError(w, http.StatusBadRequest, "permissions must be an array", nil)
			return
		}
	}

	req := services.CreateRoleRequest{
		Name:        name,
		Description: description,
		Permissions: permissions,
	}

	role, err := h.roleService.CreateRole(req)
	if err != nil {
		switch {
		case err.Error() == fmt.Sprintf("role with name '%s' already exists", req.Name):
			utils.WriteError(w, http.StatusConflict, err.Error(), err)
			return
		case errors.Is(err, services.ErrPermissionNotFound):
			var permErr *services.PermissionNotFoundError
			if errors.As(err, &permErr) {
				utils.WriteError(w, http.StatusBadRequest, fmt.Sprintf("Permission not found: %s", permErr.Key()), err)
			} else {
				utils.WriteError(w, http.StatusBadRequest, "Permission not found", err)
			}
			return
		default:
			utils.WriteError(w, http.StatusInternalServerError, "Failed to create role", err)
			return
		}
	}

	audit.RoleChanged("create", actorID.String(), role.Role.ID.String(), role.Role.Name, nil, map[string]any{"description": role.Role.Description, "permissions": len(role.Permissions)})
	utils.WriteJSON(w, http.StatusCreated, role)
}

// UpdateRole handles PUT /roles/{roleId}
func (h *RoleHandler) UpdateRole(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	roleIDStr := vars["roleId"]

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

	var rawReq map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&rawReq); err != nil {
		utils.WriteError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Validate name
	name, ok := rawReq["name"].(string)
	if !ok {
		utils.WriteError(w, http.StatusBadRequest, "name must be a string", nil)
		return
	}
	if err := validation.ValidateRoleName(name); err != nil {
		utils.WriteError(w, http.StatusBadRequest, err.Error(), err)
		return
	}

	// Validate description
	description := ""
	if desc, exists := rawReq["description"]; exists {
		if descStr, ok := desc.(string); ok {
			if err := validation.ValidateRoleDescription(descStr); err != nil {
				utils.WriteError(w, http.StatusBadRequest, err.Error(), err)
				return
			}
			description = descStr
		} else {
			utils.WriteError(w, http.StatusBadRequest, "description must be a string", nil)
			return
		}
	}

	// Validate permissions
	var permissions []services.Permission
	if perms, exists := rawReq["permissions"]; exists {
		if permsList, ok := perms.([]interface{}); ok {
			if err := validation.ValidatePermissions(permsList); err != nil {
				utils.WriteError(w, http.StatusBadRequest, err.Error(), err)
				return
			}

			// Convert to services.Permission slice
			for _, perm := range permsList {
				permMap := perm.(map[string]interface{})
				permissions = append(permissions, services.Permission{
					Action:   permMap["action"].(string),
					Resource: permMap["resource"].(string),
				})
			}
		} else {
			utils.WriteError(w, http.StatusBadRequest, "permissions must be an array", nil)
			return
		}
	}

	req := services.UpdateRoleRequest{
		Name:        name,
		Description: description,
		Permissions: permissions,
	}

	actorID, ok := authorizeMutation(r, w, h.authzService, permissionRolesEdit)
	if !ok {
		return
	}
	oldRole, _ := h.roleService.GetRole(roleID)
	role, err := h.roleService.UpdateRole(roleID, req)
	if err != nil {
		if errors.Is(err, services.ErrPermissionNotFound) {
			var permErr *services.PermissionNotFoundError
			if errors.As(err, &permErr) {
				utils.WriteError(w, http.StatusBadRequest, fmt.Sprintf("Permission not found: %s", permErr.Key()), err)
			} else {
				utils.WriteError(w, http.StatusBadRequest, "Permission not found", err)
			}
			return
		}
		utils.WriteError(w, http.StatusInternalServerError, "Failed to update role", err)
		return
	}

	if role == nil {
		utils.WriteError(w, http.StatusNotFound, "Role not found", nil)
		return
	}

	changed := []string{}
	if oldRole != nil {
		if oldRole.Role.Name != role.Role.Name {
			changed = append(changed, "name")
		}
		if oldRole.Role.Description != role.Role.Description {
			changed = append(changed, "description")
		}
		if len(oldRole.Permissions) != len(role.Permissions) {
			changed = append(changed, "permissions")
		}
	}
	audit.RoleChanged("update", actorID.String(), role.Role.ID.String(), role.Role.Name, changed, map[string]any{"description": role.Role.Description, "permissions": len(role.Permissions)})
	utils.WriteJSON(w, http.StatusOK, role)
}

// DeleteRole handles DELETE /roles/{roleId}
func (h *RoleHandler) DeleteRole(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	roleIDStr := vars["roleId"]

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

	actorID, ok := authorizeMutation(r, w, h.authzService, permissionRolesEdit)
	if !ok {
		return
	}
	roleBefore, _ := h.roleService.GetRole(roleID)
	if err := h.roleService.DeleteRole(roleID); err != nil {
		if strings.Contains(err.Error(), "role not found") {
			utils.WriteError(w, http.StatusNotFound, "Role not found", err)
		} else {
			utils.WriteError(w, http.StatusInternalServerError, "Failed to delete role", err)
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
	if roleBefore != nil {
		audit.RoleChanged("delete", actorID.String(), roleID.String(), roleBefore.Role.Name, nil, map[string]any{"description": roleBefore.Role.Description})
	}
}
