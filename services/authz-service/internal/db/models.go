package db

import (
	"time"

	"github.com/google/uuid"
)

// Role represents a role in the system
type Role struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// Permission represents a global permission in the system
type Permission struct {
	ID          uuid.UUID `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"` // e.g., "users:ban", "reports:read"
	Description string    `json:"description" db:"description"`
	Resource    string    `json:"resource" db:"resource"` // e.g., "users", "reports"
	Action      string    `json:"action" db:"action"`     // e.g., "read", "create", "ban"
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// RolePermission represents the assignment of a permission to a role
type RolePermission struct {
	RoleID       uuid.UUID  `json:"role_id" db:"role_id"`
	PermissionID uuid.UUID  `json:"permission_id" db:"permission_id"`
	AssignedAt   time.Time  `json:"assigned_at" db:"assigned_at"`
	AssignedBy   *uuid.UUID `json:"assigned_by,omitempty" db:"assigned_by"`
}

// UserRole represents the assignment of a role to a user
type UserRole struct {
	UserID     uuid.UUID `json:"user_id" db:"user_id"`
	RoleID     uuid.UUID `json:"role_id" db:"role_id"`
	AssignedAt time.Time `json:"assigned_at" db:"assigned_at"`
}

// RoleWithPermissions represents a role with its permissions
type RoleWithPermissions struct {
	Role        Role         `json:"role"`
	Permissions []Permission `json:"permissions"`
}
