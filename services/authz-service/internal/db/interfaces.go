package db

import "github.com/google/uuid"

// UserRoleRepositoryInterface defines the interface for user role operations
type UserRoleRepositoryInterface interface {
	GetUserRoles(userID uuid.UUID) ([]Role, error)
	AssignRole(userID, roleID uuid.UUID) error
	RemoveRole(userID, roleID uuid.UUID) error
	HasRole(userID, roleID uuid.UUID) (bool, error)
}

// PermissionRepositoryInterface defines the interface for permission operations
type PermissionRepositoryInterface interface {
	GetByRoleID(roleID uuid.UUID) ([]Permission, error)
	GetByUserID(userID uuid.UUID) ([]Permission, error)
	HasPermission(userID uuid.UUID, action, resource string) (bool, error)
	GetAll() ([]Permission, error)
	GetByID(id uuid.UUID) (*Permission, error)
	GetByName(name string) (*Permission, error)
	Create(resource, action, description string) (*Permission, error)
	Update(id uuid.UUID, resource, action, description string) (*Permission, error)
	Delete(id uuid.UUID) error
	AssignToRole(roleID, permissionID uuid.UUID) error
	RemoveFromRole(roleID, permissionID uuid.UUID) error
	RemoveAllFromRole(roleID uuid.UUID) error
}

// RoleRepositoryInterface defines the interface for role operations
type RoleRepositoryInterface interface {
	GetAll() ([]Role, error)
	GetByID(id uuid.UUID) (*Role, error)
	GetByName(name string) (*Role, error)
	Create(name, description string) (*Role, error)
	Update(id uuid.UUID, name, description string) (*Role, error)
	Delete(id uuid.UUID) error
	GetPermissions(roleID uuid.UUID) ([]Permission, error)
}
