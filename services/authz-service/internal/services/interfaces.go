package services

import (
	"authz-service/internal/db"

	"github.com/google/uuid"
)

// RoleServiceInterface defines the interface for role service operations
type RoleServiceInterface interface {
	GetRoles() ([]db.RoleWithPermissions, error)
	GetRole(roleID uuid.UUID) (*db.RoleWithPermissions, error)
	CreateRole(req CreateRoleRequest) (*db.RoleWithPermissions, error)
	UpdateRole(roleID uuid.UUID, req UpdateRoleRequest) (*db.RoleWithPermissions, error)
	DeleteRole(roleID uuid.UUID) error
}

// AuthzServiceInterface defines the interface for authorization service operations
type AuthzServiceInterface interface {
	HasPermission(userID uuid.UUID, permission string) (bool, error)
	GetUserPermissions(userID uuid.UUID) ([]db.Permission, error)
	GetUserRoles(userID uuid.UUID) ([]db.Role, error)
	AssignRole(userID uuid.UUID, req AssignRoleRequest) error
	RemoveRole(userID, roleID uuid.UUID) error
}

// PermissionServiceInterface defines the interface for permission service operations
type PermissionServiceInterface interface {
	GetPermissions() ([]db.Permission, error)
	GetPermission(permissionID uuid.UUID) (*db.Permission, error)
	CreatePermission(req CreatePermissionRequest) (*db.Permission, error)
	UpdatePermission(permissionID uuid.UUID, req UpdatePermissionRequest) (*db.Permission, error)
	DeletePermission(permissionID uuid.UUID) error
}
