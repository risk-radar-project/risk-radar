package services

import (
	"authz-service/internal/db"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

// RoleService handles role business logic
type RoleService struct {
	roleRepo       db.RoleRepositoryInterface
	permissionRepo db.PermissionRepositoryInterface
	userRoleRepo   db.UserRoleRepositoryInterface
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

// ErrPermissionNotFound indicates that a referenced permission does not exist in the catalog.
var ErrPermissionNotFound = errors.New("permission not found")

// PermissionNotFoundError provides context about a missing permission reference.
type PermissionNotFoundError struct {
	Resource string
	Action   string
}

// Error implements the error interface.
func (e *PermissionNotFoundError) Error() string {
	return fmt.Sprintf("permission not found: %s:%s", e.Resource, e.Action)
}

// Is enables errors.Is comparisons against ErrPermissionNotFound.
func (e *PermissionNotFoundError) Is(target error) bool {
	return target == ErrPermissionNotFound
}

// Key returns the canonical permission identifier.
func (e *PermissionNotFoundError) Key() string {
	return fmt.Sprintf("%s:%s", e.Resource, e.Action)
}

// NewRoleService creates a new role service
func NewRoleService(roleRepo db.RoleRepositoryInterface, permissionRepo db.PermissionRepositoryInterface, userRoleRepo db.UserRoleRepositoryInterface) *RoleService {
	return &RoleService{
		roleRepo:       roleRepo,
		permissionRepo: permissionRepo,
		userRoleRepo:   userRoleRepo,
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

		userCount, err := s.userRoleRepo.CountByRoleID(role.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to measure usage of role %s: %w", role.ID, err)
		}

		result = append(result, db.RoleWithPermissions{
			Role:        role,
			Permissions: permissions,
			UsersCount:  userCount,
		})
	}

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

	userCount, err := s.userRoleRepo.CountByRoleID(role.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to measure usage of role: %w", err)
	}

	result := &db.RoleWithPermissions{
		Role:        *role,
		Permissions: permissions,
		UsersCount:  userCount,
	}

	return result, nil
}

// CreateRole creates a new role with permissions
func (s *RoleService) CreateRole(req CreateRoleRequest) (*db.RoleWithPermissions, error) {
	// Validate input
	if err := s.validateRoleRequest(req.Name, req.Permissions); err != nil {
		return nil, err
	}

	resolvedPermissions, err := s.resolvePermissions(req.Permissions)
	if err != nil {
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
	permissions := make([]db.Permission, 0, len(resolvedPermissions))
	for _, perm := range resolvedPermissions {
		if err := s.permissionRepo.AssignToRole(role.ID, perm.ID); err != nil {
			return nil, fmt.Errorf("failed to assign permission to role: %w", err)
		}
		permissions = append(permissions, perm)
	}

	result := &db.RoleWithPermissions{
		Role:        *role,
		Permissions: permissions,
	}

	return result, nil
}

// UpdateRole updates an existing role and its permissions
func (s *RoleService) UpdateRole(roleID uuid.UUID, req UpdateRoleRequest) (*db.RoleWithPermissions, error) {
	// Validate input
	if err := s.validateRoleRequest(req.Name, req.Permissions); err != nil {
		return nil, err
	}

	resolvedPermissions, err := s.resolvePermissions(req.Permissions)
	if err != nil {
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
	permissions := make([]db.Permission, 0, len(resolvedPermissions))
	for _, perm := range resolvedPermissions {
		if err := s.permissionRepo.AssignToRole(role.ID, perm.ID); err != nil {
			return nil, fmt.Errorf("failed to assign permission to role: %w", err)
		}
		permissions = append(permissions, perm)
	}

	userCount, err := s.userRoleRepo.CountByRoleID(roleID)
	if err != nil {
		return nil, fmt.Errorf("failed to measure usage of role post-update: %w", err)
	}

	result := &db.RoleWithPermissions{
		Role:        *role,
		Permissions: permissions,
		UsersCount:  userCount,
	}

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

	// Check if role is assigned to any user
	count, err := s.userRoleRepo.CountByRoleID(roleID)
	if err != nil {
		return fmt.Errorf("failed to check role usage: %w", err)
	}
	if count > 0 {
		return fmt.Errorf("role cannot be deleted because it is assigned to %d users", count)
	}

	// Delete role (permissions will be deleted due to CASCADE)
	if err := s.roleRepo.Delete(roleID); err != nil {
		return fmt.Errorf("failed to delete role: %w", err)
	}

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

func (s *RoleService) resolvePermissions(requested []Permission) ([]db.Permission, error) {
	if len(requested) == 0 {
		return make([]db.Permission, 0), nil
	}

	allPermissions, err := s.permissionRepo.GetAll()
	if err != nil {
		return nil, fmt.Errorf("failed to get permissions: %w", err)
	}

	catalog := make(map[string]db.Permission, len(allPermissions))
	for _, perm := range allPermissions {
		key := strings.ToLower(fmt.Sprintf("%s:%s", strings.TrimSpace(perm.Resource), strings.TrimSpace(perm.Action)))
		catalog[key] = perm
	}

	resolved := make([]db.Permission, 0, len(requested))
	seen := make(map[uuid.UUID]struct{}, len(requested))

	for _, reqPerm := range requested {
		resource := strings.TrimSpace(reqPerm.Resource)
		action := strings.TrimSpace(reqPerm.Action)
		key := strings.ToLower(fmt.Sprintf("%s:%s", resource, action))

		perm, ok := catalog[key]
		if !ok {
			return nil, &PermissionNotFoundError{Resource: resource, Action: action}
		}

		if _, exists := seen[perm.ID]; exists {
			continue
		}

		resolved = append(resolved, perm)
		seen[perm.ID] = struct{}{}
	}

	return resolved, nil
}
