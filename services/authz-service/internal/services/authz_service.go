package services

import (
	"authz-service/internal/db"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

// AuthzService handles authorization business logic
type AuthzService struct {
	userRoleRepo   db.UserRoleRepositoryInterface
	permissionRepo db.PermissionRepositoryInterface
}

// AssignRoleRequest represents the request to assign a role to a user
type AssignRoleRequest struct {
	RoleID uuid.UUID `json:"role_id"`
}

// NewAuthzService creates a new authorization service
func NewAuthzService(userRoleRepo db.UserRoleRepositoryInterface, permissionRepo db.PermissionRepositoryInterface) *AuthzService {
	return &AuthzService{
		userRoleRepo:   userRoleRepo,
		permissionRepo: permissionRepo,
	}
}

// HasPermission checks if a user has a specific permission
func (s *AuthzService) HasPermission(userID uuid.UUID, permission string) (bool, error) {
	// Parse permission format "resource:action"
	resource, action, err := s.parsePermission(permission)
	if err != nil {
		return false, err
	}

	hasPermission, err := s.permissionRepo.HasPermission(userID, action, resource)
	if err != nil {
		return false, fmt.Errorf("failed to check permission: %w", err)
	}

	return hasPermission, nil
}

// GetUserPermissions retrieves all permissions for a user
func (s *AuthzService) GetUserPermissions(userID uuid.UUID) ([]db.Permission, error) {
	permissions, err := s.permissionRepo.GetByUserID(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user permissions: %w", err)
	}

	return permissions, nil
}

// GetUserRoles retrieves all roles for a user
func (s *AuthzService) GetUserRoles(userID uuid.UUID) ([]db.Role, error) {
	roles, err := s.userRoleRepo.GetUserRoles(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user roles: %w", err)
	}

	return roles, nil
}

// AssignRole assigns a role to a user
func (s *AuthzService) AssignRole(userID uuid.UUID, req AssignRoleRequest) error {
	if err := s.userRoleRepo.AssignRole(userID, req.RoleID); err != nil {
		return fmt.Errorf("failed to assign role: %w", err)
	}

	return nil
}

// RemoveRole removes a role from a user
func (s *AuthzService) RemoveRole(userID, roleID uuid.UUID) error {
	if err := s.userRoleRepo.RemoveRole(userID, roleID); err != nil {
		return fmt.Errorf("failed to remove role: %w", err)
	}

	return nil
}

// parsePermission parses permission string in format "resource:action"
func (s *AuthzService) parsePermission(permission string) (string, string, error) {
	parts := strings.Split(permission, ":")
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid permission format, expected 'resource:action', got '%s'", permission)
	}

	resource := strings.TrimSpace(parts[0])
	action := strings.TrimSpace(parts[1])

	if resource == "" {
		return "", "", fmt.Errorf("resource cannot be empty in permission '%s'", permission)
	}
	if action == "" {
		return "", "", fmt.Errorf("action cannot be empty in permission '%s'", permission)
	}

	return resource, action, nil
}
