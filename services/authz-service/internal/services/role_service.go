package services

import (
	"fmt"
	"strings"

	"authz-service/internal/db"
	"authz-service/internal/utils"

	"github.com/google/uuid"
)

// RoleService handles role business logic
type RoleService struct {
	roleRepo       db.RoleRepositoryInterface
	permissionRepo db.PermissionRepositoryInterface
}

// CreateRoleRequest represents the request to create a role
type CreateRoleRequest struct {
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Permissions []Permission `json:"permissions"`
}

// UpdateRoleRequest represents the request to update a role
type UpdateRoleRequest struct {
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Permissions []Permission `json:"permissions"`
}

// Permission represents a permission in requests
type Permission struct {
	Action   string `json:"action"`
	Resource string `json:"resource"`
}

// NewRoleService creates a new role service
func NewRoleService(roleRepo db.RoleRepositoryInterface, permissionRepo db.PermissionRepositoryInterface) *RoleService {
	return &RoleService{
		roleRepo:       roleRepo,
		permissionRepo: permissionRepo,
	}
}

// GetRoles retrieves all roles with their permissions
func (s *RoleService) GetRoles() ([]db.RoleWithPermissions, error) {
	roles, err := s.roleRepo.GetAll()
	if err != nil {
		return nil, fmt.Errorf("failed to get roles: %w", err)
	}

	// Initialize as empty slice instead of nil to ensure JSON marshals as [] not null
	result := make([]db.RoleWithPermissions, 0)
	for _, role := range roles {
		permissions, err := s.permissionRepo.GetByRoleID(role.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to get permissions for role %s: %w", role.ID, err)
		}

		result = append(result, db.RoleWithPermissions{
			Role:        role,
			Permissions: permissions,
		})
	}

	utils.LogEvent("roles.retrieved", map[string]interface{}{
		"count": len(result),
	})

	return result, nil
}

// GetRole retrieves a role by ID with its permissions
func (s *RoleService) GetRole(roleID uuid.UUID) (*db.RoleWithPermissions, error) {
	role, err := s.roleRepo.GetByID(roleID)
	if err != nil {
		return nil, fmt.Errorf("failed to get role: %w", err)
	}
	if role == nil {
		return nil, nil
	}

	permissions, err := s.permissionRepo.GetByRoleID(role.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get permissions for role: %w", err)
	}

	result := &db.RoleWithPermissions{
		Role:        *role,
		Permissions: permissions,
	}

	utils.LogEvent("role.retrieved", map[string]interface{}{
		"role_id": roleID.String(),
		"name":    role.Name,
	})

	return result, nil
}

// CreateRole creates a new role with permissions
func (s *RoleService) CreateRole(req CreateRoleRequest) (*db.RoleWithPermissions, error) {
	// Validate input
	if err := s.validateRoleRequest(req.Name, req.Permissions); err != nil {
		return nil, err
	}

	// Check if role already exists
	existingRole, err := s.roleRepo.GetByName(req.Name)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing role: %w", err)
	}
	if existingRole != nil {
		return nil, fmt.Errorf("role with name '%s' already exists", req.Name)
	}

	// Create role
	role, err := s.roleRepo.Create(req.Name, req.Description)
	if err != nil {
		return nil, fmt.Errorf("failed to create role: %w", err)
	}

	// Create permissions - assign existing permissions to the role
	var permissions []db.Permission
	for _, perm := range req.Permissions {
		// Find the permission by action and resource
		allPermissions, err := s.permissionRepo.GetAll()
		if err != nil {
			return nil, fmt.Errorf("failed to get permissions: %w", err)
		}

		var permissionID *uuid.UUID
		for _, p := range allPermissions {
			if p.Action == perm.Action && p.Resource == perm.Resource {
				permissionID = &p.ID
				permissions = append(permissions, p)
				break
			}
		}

		if permissionID == nil {
			return nil, fmt.Errorf("permission not found: %s:%s", perm.Action, perm.Resource)
		}

		// Assign permission to role
		if err := s.permissionRepo.AssignToRole(role.ID, *permissionID); err != nil {
			return nil, fmt.Errorf("failed to assign permission to role: %w", err)
		}
	}

	result := &db.RoleWithPermissions{
		Role:        *role,
		Permissions: permissions,
	}

	utils.LogEvent("role.created", map[string]interface{}{
		"role_id":     role.ID.String(),
		"name":        role.Name,
		"permissions": len(permissions),
	})

	return result, nil
}

// UpdateRole updates an existing role and its permissions
func (s *RoleService) UpdateRole(roleID uuid.UUID, req UpdateRoleRequest) (*db.RoleWithPermissions, error) {
	// Validate input
	if err := s.validateRoleRequest(req.Name, req.Permissions); err != nil {
		return nil, err
	}

	// Check if role exists
	existingRole, err := s.roleRepo.GetByID(roleID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing role: %w", err)
	}
	if existingRole == nil {
		return nil, nil
	}

	// Update role
	role, err := s.roleRepo.Update(roleID, req.Name, req.Description)
	if err != nil {
		return nil, fmt.Errorf("failed to update role: %w", err)
	}

	// Remove existing role-permission assignments
	if err := s.permissionRepo.RemoveAllFromRole(roleID); err != nil {
		return nil, fmt.Errorf("failed to remove existing permissions: %w", err)
	}

	// Assign new permissions - assign existing permissions to the role
	var permissions []db.Permission
	for _, perm := range req.Permissions {
		// Find the permission by action and resource
		allPermissions, err := s.permissionRepo.GetAll()
		if err != nil {
			return nil, fmt.Errorf("failed to get permissions: %w", err)
		}

		var permissionID *uuid.UUID
		for _, p := range allPermissions {
			if p.Action == perm.Action && p.Resource == perm.Resource {
				permissionID = &p.ID
				permissions = append(permissions, p)
				break
			}
		}

		if permissionID == nil {
			return nil, fmt.Errorf("permission not found: %s:%s", perm.Action, perm.Resource)
		}

		// Assign permission to role
		if err := s.permissionRepo.AssignToRole(role.ID, *permissionID); err != nil {
			return nil, fmt.Errorf("failed to assign permission to role: %w", err)
		}
	}

	result := &db.RoleWithPermissions{
		Role:        *role,
		Permissions: permissions,
	}

	utils.LogEvent("role.updated", map[string]interface{}{
		"role_id":     role.ID.String(),
		"name":        role.Name,
		"permissions": len(permissions),
	})

	return result, nil
}

// DeleteRole deletes a role and its permissions
func (s *RoleService) DeleteRole(roleID uuid.UUID) error {
	// Check if role exists
	role, err := s.roleRepo.GetByID(roleID)
	if err != nil {
		return fmt.Errorf("failed to check existing role: %w", err)
	}
	if role == nil {
		return fmt.Errorf("role not found")
	}

	// Delete role (permissions will be deleted due to CASCADE)
	if err := s.roleRepo.Delete(roleID); err != nil {
		return fmt.Errorf("failed to delete role: %w", err)
	}

	utils.LogEvent("role.deleted", map[string]interface{}{
		"role_id": roleID.String(),
		"name":    role.Name,
	})

	return nil
}

// validateRoleRequest validates role creation/update request
func (s *RoleService) validateRoleRequest(name string, permissions []Permission) error {
	if strings.TrimSpace(name) == "" {
		return fmt.Errorf("role name is required")
	}

	for i, perm := range permissions {
		if strings.TrimSpace(perm.Action) == "" {
			return fmt.Errorf("permission %d: action is required", i+1)
		}
		if strings.TrimSpace(perm.Resource) == "" {
			return fmt.Errorf("permission %d: resource is required", i+1)
		}
	}

	return nil
}
