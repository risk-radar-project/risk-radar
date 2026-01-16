package db

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// UserRoleRepository handles user-role assignment database operations
type UserRoleRepository struct {
	db *sql.DB
}

// NewUserRoleRepository creates a new user role repository
func NewUserRoleRepository(db *sql.DB) *UserRoleRepository {
	return &UserRoleRepository{db: db}
}

// CountByRoleID counts the number of users assigned to a specific role
func (r *UserRoleRepository) CountByRoleID(roleID uuid.UUID) (int, error) {
	query := `
		SELECT COUNT(*)
		FROM user_roles
		WHERE role_id = $1
	`
	var count int
	err := r.db.QueryRow(query, roleID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count users for role %s: %w", roleID, err)
	}
	return count, nil
}

// GetUserRoles retrieves all roles for a user
func (r *UserRoleRepository) GetUserRoles(userID uuid.UUID) ([]Role, error) {
	query := `
        SELECT ro.id, ro.name, COALESCE(ro.description, '') as description, ro.created_at, ro.updated_at
        FROM roles ro
        INNER JOIN user_roles ur ON ro.id = ur.role_id
        WHERE ur.user_id = $1
        ORDER BY ro.name
    `

	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query user roles: %w", err)
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

// AssignRole assigns a role to a user
func (r *UserRoleRepository) AssignRole(userID, roleID uuid.UUID) error {
	query := `
        INSERT INTO user_roles (user_id, role_id, assigned_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, role_id) DO NOTHING
    `

	_, err := r.db.Exec(query, userID, roleID, time.Now().UTC())
	if err != nil {
		return fmt.Errorf("failed to assign role: %w", err)
	}

	return nil
}

// RemoveRole removes a role from a user
func (r *UserRoleRepository) RemoveRole(userID, roleID uuid.UUID) error {
	query := `DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2`

	result, err := r.db.Exec(query, userID, roleID)
	if err != nil {
		return fmt.Errorf("failed to remove role: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("user role assignment not found")
	}

	return nil
}

// HasRole checks if a user has a specific role
func (r *UserRoleRepository) HasRole(userID, roleID uuid.UUID) (bool, error) {
	query := `
        SELECT 1
        FROM user_roles
        WHERE user_id = $1 AND role_id = $2
        LIMIT 1
    `

	var exists int
	err := r.db.QueryRow(query, userID, roleID).Scan(&exists)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, fmt.Errorf("failed to check role assignment: %w", err)
	}

	return true, nil
}
