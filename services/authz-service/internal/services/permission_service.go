package services

import (
	"authz-service/internal/db"
	"authz-service/internal/utils"
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
		utils.LogEvent("permission.get_all.error", map[string]interface{}{
			"error": err.Error(),
		})
		return nil, err
	}

	utils.LogEvent("permission.get_all.success", map[string]interface{}{
		"count": len(permissions),
	})

	return permissions, nil
}

// GetPermission retrieves a permission by ID
func (s *PermissionService) GetPermission(permissionID uuid.UUID) (*db.Permission, error) {
	permission, err := s.permissionRepo.GetByID(permissionID)
	if err != nil {
		utils.LogEvent("permission.get.error", map[string]interface{}{
			"permission_id": permissionID.String(),
			"error":         err.Error(),
		})
		return nil, err
	}

	if permission == nil {
		utils.LogEvent("permission.get.not_found", map[string]interface{}{
			"permission_id": permissionID.String(),
		})
		return nil, nil
	}

	utils.LogEvent("permission.get.success", map[string]interface{}{
		"permission_id": permissionID.String(),
		"name":          permission.Name,
	})

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
		utils.LogEvent("permission.create.validation_error", map[string]interface{}{
			"error": "resource and action cannot contain colon (:) character",
		})
		return nil, fmt.Errorf("resource and action cannot contain colon (:) character")
	}

	permission, err := s.permissionRepo.Create(req.Resource, req.Action, req.Description)
	if err != nil {
		utils.LogEvent("permission.create.error", map[string]interface{}{
			"resource":    req.Resource,
			"action":      req.Action,
			"description": req.Description,
			"error":       err.Error(),
		})
		return nil, err
	}

	utils.LogEvent("permission.create.success", map[string]interface{}{
		"permission_id": permission.ID.String(),
		"name":          permission.Name,
		"resource":      permission.Resource,
		"action":        permission.Action,
	})

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
		utils.LogEvent("permission.update.validation_error", map[string]interface{}{
			"permission_id": permissionID.String(),
			"error":         "resource and action cannot contain colon (:) character",
		})
		return nil, fmt.Errorf("resource and action cannot contain colon (:) character")
	}

	permission, err := s.permissionRepo.Update(permissionID, req.Resource, req.Action, req.Description)
	if err != nil {
		utils.LogEvent("permission.update.error", map[string]interface{}{
			"permission_id": permissionID.String(),
			"resource":      req.Resource,
			"action":        req.Action,
			"description":   req.Description,
			"error":         err.Error(),
		})
		return nil, err
	}

	utils.LogEvent("permission.update.success", map[string]interface{}{
		"permission_id": permission.ID.String(),
		"name":          permission.Name,
		"resource":      permission.Resource,
		"action":        permission.Action,
	})

	return permission, nil
}

// DeletePermission deletes a permission
func (s *PermissionService) DeletePermission(permissionID uuid.UUID) error {
	// Check if permission exists first
	existing, err := s.permissionRepo.GetByID(permissionID)
	if err != nil {
		utils.LogEvent("permission.delete.check_error", map[string]interface{}{
			"permission_id": permissionID.String(),
			"error":         err.Error(),
		})
		return err
	}

	if existing == nil {
		utils.LogEvent("permission.delete.not_found", map[string]interface{}{
			"permission_id": permissionID.String(),
		})
		return fmt.Errorf("permission not found")
	}

	err = s.permissionRepo.Delete(permissionID)
	if err != nil {
		utils.LogEvent("permission.delete.error", map[string]interface{}{
			"permission_id": permissionID.String(),
			"name":          existing.Name,
			"error":         err.Error(),
		})
		return err
	}

	utils.LogEvent("permission.delete.success", map[string]interface{}{
		"permission_id": permissionID.String(),
		"name":          existing.Name,
	})

	return nil
}
