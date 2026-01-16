package db

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// RoleRepository handles role database operations
type RoleRepository struct {
	db *sql.DB
}

// NewRoleRepository creates a new role repository
func NewRoleRepository(db *sql.DB) *RoleRepository {
	return &RoleRepository{db: db}
}

// GetAll retrieves all roles
func (r *RoleRepository) GetAll() ([]Role, error) {
	query := `
        SELECT id, name, COALESCE(description, '') as description, created_at, updated_at
        FROM roles
        ORDER BY name
    `

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query roles: %w", err)
	}
	defer rows.Close()

	// Initialize as empty slice instead of nil to ensure JSON marshals as [] not null
	roles := make([]Role, 0)
	for rows.Next() {
		var role Role
		err := rows.Scan(&role.ID, &role.Name, &role.Description, &role.CreatedAt, &role.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan role: %w", err)
		}
		roles = append(roles, role)
	}

	return roles, rows.Err()
}

// GetByID retrieves a role by ID
func (r *RoleRepository) GetByID(id uuid.UUID) (*Role, error) {
	query := `
        SELECT id, name, COALESCE(description, '') as description, created_at, updated_at
        FROM roles
        WHERE id = $1
    `

	var role Role
	err := r.db.QueryRow(query, id).Scan(
		&role.ID, &role.Name, &role.Description, &role.CreatedAt, &role.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query role: %w", err)
	}

	return &role, nil
}

// GetByName retrieves a role by name
func (r *RoleRepository) GetByName(name string) (*Role, error) {
	query := `
        SELECT id, name, COALESCE(description, '') as description, created_at, updated_at
        FROM roles
        WHERE name = $1
    `

	var role Role
	err := r.db.QueryRow(query, name).Scan(
		&role.ID, &role.Name, &role.Description, &role.CreatedAt, &role.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query role: %w", err)
	}

	return &role, nil
}

// Create creates a new role
func (r *RoleRepository) Create(name, description string) (*Role, error) {
	role := &Role{
		ID:          uuid.New(),
		Name:        name,
		Description: description,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	query := `
        INSERT INTO roles (id, name, description, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
    `

	_, err := r.db.Exec(query, role.ID, role.Name, role.Description, role.CreatedAt, role.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create role: %w", err)
	}

	return role, nil
}

// Update updates an existing role
func (r *RoleRepository) Update(id uuid.UUID, name, description string) (*Role, error) {
	query := `
        UPDATE roles
        SET name = $2, description = $3, updated_at = $4
        WHERE id = $1
        RETURNING id, name, description, created_at, updated_at
    `

	var role Role
	err := r.db.QueryRow(query, id, name, description, time.Now().UTC()).Scan(
		&role.ID, &role.Name, &role.Description, &role.CreatedAt, &role.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to update role: %w", err)
	}

	return &role, nil
}

// Delete deletes a role
func (r *RoleRepository) Delete(id uuid.UUID) error {
	query := `DELETE FROM roles WHERE id = $1`

	result, err := r.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete role: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return nil // Role not found, but not an error
	}

	return nil
}

// GetPermissions retrieves all permissions for a role
func (r *RoleRepository) GetPermissions(roleID uuid.UUID) ([]Permission, error) {
	query := `
        SELECT p.id, p.name, COALESCE(p.description, '') as description, p.resource, p.action, p.created_at
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = $1
        ORDER BY p.resource, p.action
    `

	rows, err := r.db.Query(query, roleID)
	if err != nil {
		return nil, fmt.Errorf("failed to query role permissions: %w", err)
	}
	defer rows.Close()

	// Initialize as empty slice instead of nil to ensure JSON marshals as [] not null
	permissions := make([]Permission, 0)
	for rows.Next() {
		var permission Permission
		err := rows.Scan(&permission.ID, &permission.Name, &permission.Description, &permission.Resource, &permission.Action, &permission.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan permission: %w", err)
		}
		permissions = append(permissions, permission)
	}

	return permissions, rows.Err()
}
