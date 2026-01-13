package db

import (
	"database/sql"
	"fmt"

	"github.com/google/uuid"
)

// PermissionRepository handles permission database operations
type PermissionRepository struct {
	db *sql.DB
}

// NewPermissionRepository creates a new permission repository
func NewPermissionRepository(db *sql.DB) *PermissionRepository {
	return &PermissionRepository{db: db}
}

// GetByRoleID retrieves all permissions for a role
func (r *PermissionRepository) GetByRoleID(roleID uuid.UUID) ([]Permission, error) {
	query := `
        SELECT p.id, p.name, p.description, p.resource, p.action, p.created_at
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = $1
        ORDER BY p.resource, p.action
    `

	rows, err := r.db.Query(query, roleID)
	if err != nil {
		return nil, fmt.Errorf("failed to query permissions: %w", err)
	}
	defer rows.Close()

	permissions := make([]Permission, 0)
	for rows.Next() {
		var perm Permission
		err := rows.Scan(&perm.ID, &perm.Name, &perm.Description, &perm.Resource, &perm.Action, &perm.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan permission: %w", err)
		}
		permissions = append(permissions, perm)
	}

	return permissions, rows.Err()
}

// GetByUserID retrieves all permissions for a user through their roles
func (r *PermissionRepository) GetByUserID(userID uuid.UUID) ([]Permission, error) {
	query := `
        SELECT DISTINCT p.id, p.name, p.description, p.resource, p.action, p.created_at
        FROM permissions p
        INNER JOIN role_permissions rp ON p.id = rp.permission_id
        INNER JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = $1
        ORDER BY p.resource, p.action
    `

	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query user permissions: %w", err)
	}
	defer rows.Close()

	permissions := make([]Permission, 0)
	for rows.Next() {
		var perm Permission
		err := rows.Scan(&perm.ID, &perm.Name, &perm.Description, &perm.Resource, &perm.Action, &perm.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan permission: %w", err)
		}
		permissions = append(permissions, perm)
	}

	return permissions, rows.Err()
}

// HasPermission checks if a user has a specific permission
// Supports wildcards (*) for action and/or resource:
// - "users:*" matches any action on users resource
// - "*:reports" matches any resource with reports action
// - "*:*" matches everything
func (r *PermissionRepository) HasPermission(userID uuid.UUID, action, resource string) (bool, error) {
	query := `
        SELECT 1
        FROM permissions p
        INNER JOIN role_permissions rp ON p.id = rp.permission_id
        INNER JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = $1 AND (
            (p.action = $2 AND p.resource = $3) OR          -- exact match
            (p.action = '*' AND p.resource = $3) OR         -- wildcard action
            (p.action = $2 AND p.resource = '*') OR         -- wildcard resource
            (p.action = '*' AND p.resource = '*')           -- wildcard both
        )
        LIMIT 1
    `

	var exists int
	err := r.db.QueryRow(query, userID, action, resource).Scan(&exists)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, fmt.Errorf("failed to check permission: %w", err)
	}

	return true, nil
}

// AssignToRole assigns an existing permission to a role
func (r *PermissionRepository) AssignToRole(roleID, permissionID uuid.UUID) error {
	query := `
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
        ON CONFLICT (role_id, permission_id) DO NOTHING
    `

	_, err := r.db.Exec(query, roleID, permissionID)
	if err != nil {
		return fmt.Errorf("failed to assign permission to role: %w", err)
	}

	return nil
}

// RemoveFromRole removes a permission from a role
func (r *PermissionRepository) RemoveFromRole(roleID, permissionID uuid.UUID) error {
	query := `DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2`

	_, err := r.db.Exec(query, roleID, permissionID)
	if err != nil {
		return fmt.Errorf("failed to remove permission from role: %w", err)
	}

	return nil
}

// GetAll retrieves all available permissions from the global catalog
func (r *PermissionRepository) GetAll() ([]Permission, error) {
	query := `
        SELECT id, name, description, resource, action, created_at
        FROM permissions
        ORDER BY resource, action
    `

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query permissions: %w", err)
	}
	defer rows.Close()

	permissions := make([]Permission, 0)
	for rows.Next() {
		var perm Permission
		err := rows.Scan(&perm.ID, &perm.Name, &perm.Description, &perm.Resource, &perm.Action, &perm.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan permission: %w", err)
		}
		permissions = append(permissions, perm)
	}

	return permissions, rows.Err()
}

// RemoveAllFromRole removes all permissions from a role
func (r *PermissionRepository) RemoveAllFromRole(roleID uuid.UUID) error {
	query := `DELETE FROM role_permissions WHERE role_id = $1`

	_, err := r.db.Exec(query, roleID)
	if err != nil {
		return fmt.Errorf("failed to remove all permissions from role: %w", err)
	}

	return nil
}

// GetByID retrieves a permission by its ID
func (r *PermissionRepository) GetByID(id uuid.UUID) (*Permission, error) {
	query := `
        SELECT id, name, description, resource, action, created_at
        FROM permissions
        WHERE id = $1
    `

	var perm Permission
	err := r.db.QueryRow(query, id).Scan(
		&perm.ID, &perm.Name, &perm.Description,
		&perm.Resource, &perm.Action, &perm.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query permission: %w", err)
	}

	return &perm, nil
}

// GetByName retrieves a permission by its name
func (r *PermissionRepository) GetByName(name string) (*Permission, error) {
	query := `
        SELECT id, name, description, resource, action, created_at
        FROM permissions
        WHERE name = $1
    `

	var perm Permission
	err := r.db.QueryRow(query, name).Scan(
		&perm.ID, &perm.Name, &perm.Description,
		&perm.Resource, &perm.Action, &perm.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query permission: %w", err)
	}

	return &perm, nil
}

// Create creates a new permission
func (r *PermissionRepository) Create(resource, action, description string) (*Permission, error) {
	// Generate name in format "resource:action"
	name := fmt.Sprintf("%s:%s", resource, action)

	// Check if permission already exists
	existing, err := r.GetByName(name)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing permission: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("permission with name '%s' already exists", name)
	}

	id := uuid.New()
	query := `
        INSERT INTO permissions (id, name, description, resource, action, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, name, description, resource, action, created_at
    `

	var perm Permission
	err = r.db.QueryRow(query, id, name, description, resource, action).Scan(
		&perm.ID, &perm.Name, &perm.Description,
		&perm.Resource, &perm.Action, &perm.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create permission: %w", err)
	}

	return &perm, nil
}

// Update updates an existing permission
func (r *PermissionRepository) Update(id uuid.UUID, resource, action, description string) (*Permission, error) {
	// Generate new name in format "resource:action"
	name := fmt.Sprintf("%s:%s", resource, action)

	// Check if permission exists
	existing, err := r.GetByID(id)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing permission: %w", err)
	}
	if existing == nil {
		return nil, fmt.Errorf("permission not found")
	}

	// Check if another permission with the new name already exists (excluding current)
	existingByName, err := r.GetByName(name)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing permission by name: %w", err)
	}
	if existingByName != nil && existingByName.ID != id {
		return nil, fmt.Errorf("permission with name '%s' already exists", name)
	}

	query := `
        UPDATE permissions
        SET name = $2, description = $3, resource = $4, action = $5
        WHERE id = $1
        RETURNING id, name, description, resource, action, created_at
    `

	var perm Permission
	err = r.db.QueryRow(query, id, name, description, resource, action).Scan(
		&perm.ID, &perm.Name, &perm.Description,
		&perm.Resource, &perm.Action, &perm.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update permission: %w", err)
	}

	return &perm, nil
}

// Delete deletes a permission by ID
func (r *PermissionRepository) Delete(id uuid.UUID) error {
	// First, remove all role assignments for this permission
	if err := r.removeAllRoleAssignments(id); err != nil {
		return fmt.Errorf("failed to remove role assignments: %w", err)
	}

	// Then delete the permission
	query := `DELETE FROM permissions WHERE id = $1`
	result, err := r.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete permission: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("permission not found")
	}

	return nil
}

// removeAllRoleAssignments removes all role assignments for a permission
func (r *PermissionRepository) removeAllRoleAssignments(permissionID uuid.UUID) error {
	query := `DELETE FROM role_permissions WHERE permission_id = $1`
	_, err := r.db.Exec(query, permissionID)
	if err != nil {
		return fmt.Errorf("failed to remove role assignments: %w", err)
	}
	return nil
}
