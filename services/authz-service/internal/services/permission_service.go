package services

import (
	"authz-service/internal/audit"
	"authz-service/internal/db"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

// PermissionService handles permission business logic
type PermissionService struct {
	permissionRepo db.PermissionRepositoryInterface
}

// NewPermissionService creates a new permission service
func NewPermissionService(permissionRepo db.PermissionRepositoryInterface) *PermissionService {
	return &PermissionService{
		permissionRepo: permissionRepo,
	}
}

// CreatePermissionRequest represents the request to create a permission
type CreatePermissionRequest struct {
	Resource    string `json:"resource" validate:"required,min=1,max=50"`
	Action      string `json:"action" validate:"required,min=1,max=50"`
	Description string `json:"description" validate:"required,min=1,max=255"`
}

// UpdatePermissionRequest represents the request to update a permission
type UpdatePermissionRequest struct {
	Resource    string `json:"resource" validate:"required,min=1,max=50"`
	Action      string `json:"action" validate:"required,min=1,max=50"`
	Description string `json:"description" validate:"required,min=1,max=255"`
}

// GetPermissions retrieves all permissions
func (s *PermissionService) GetPermissions() ([]db.Permission, error) {
	permissions, err := s.permissionRepo.GetAll()
	if err != nil {
		audit.DBError("permissions_get_all", "error")
		return nil, err
	}

	return permissions, nil
}

// GetPermission retrieves a permission by ID
func (s *PermissionService) GetPermission(permissionID uuid.UUID) (*db.Permission, error) {
	permission, err := s.permissionRepo.GetByID(permissionID)
	if err != nil {
		audit.DBError("permission_get", "error")
		return nil, err
	}
	if permission == nil {
		return nil, nil
	}
	return permission, nil
}

// CreatePermission creates a new permission
func (s *PermissionService) CreatePermission(req CreatePermissionRequest) (*db.Permission, error) {
	// Validate and normalize input
	req.Resource = strings.TrimSpace(strings.ToLower(req.Resource))
	req.Action = strings.TrimSpace(strings.ToLower(req.Action))
	req.Description = strings.TrimSpace(req.Description)

	// Validate format - no colons allowed in resource or action
	if strings.Contains(req.Resource, ":") || strings.Contains(req.Action, ":") {
		return nil, fmt.Errorf("resource and action cannot contain colon (:) character")
	}

	permission, err := s.permissionRepo.Create(req.Resource, req.Action, req.Description)
	if err != nil {
		audit.DBError("permission_create", "error")
		return nil, err
	}
	return permission, nil
}

// UpdatePermission updates an existing permission
func (s *PermissionService) UpdatePermission(permissionID uuid.UUID, req UpdatePermissionRequest) (*db.Permission, error) {
	// Validate and normalize input
	req.Resource = strings.TrimSpace(strings.ToLower(req.Resource))
	req.Action = strings.TrimSpace(strings.ToLower(req.Action))
	req.Description = strings.TrimSpace(req.Description)

	// Validate format - no colons allowed in resource or action
	if strings.Contains(req.Resource, ":") || strings.Contains(req.Action, ":") {
		return nil, fmt.Errorf("resource and action cannot contain colon (:) character")
	}

	permission, err := s.permissionRepo.Update(permissionID, req.Resource, req.Action, req.Description)
	if err != nil {
		audit.DBError("permission_update", "error")
		return nil, err
	}
	return permission, nil
}

// DeletePermission deletes a permission
func (s *PermissionService) DeletePermission(permissionID uuid.UUID) error {
	// Check if permission exists first
	existing, err := s.permissionRepo.GetByID(permissionID)
	if err != nil {
		audit.DBError("permission_delete_check", "error")
		return err
	}
	if existing == nil {
		return fmt.Errorf("permission not found")
	}
	err = s.permissionRepo.Delete(permissionID)
	if err != nil {
		audit.DBError("permission_delete", "error")
		return err
	}
	return nil
}
