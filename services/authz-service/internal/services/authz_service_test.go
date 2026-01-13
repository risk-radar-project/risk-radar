package services

import (
	"fmt"
	"testing"

	"authz-service/internal/db"

	"github.com/google/uuid"
)

// MockUserRoleRepository implements UserRoleRepositoryInterface for tests
type MockUserRoleRepository struct {
	userRoles map[string][]uuid.UUID // userID -> roleIDs
}

func NewMockUserRoleRepository() *MockUserRoleRepository {
	return &MockUserRoleRepository{
		userRoles: make(map[string][]uuid.UUID),
	}
}

func (m *MockUserRoleRepository) GetUserRoles(userID uuid.UUID) ([]db.Role, error) {
	return []db.Role{}, nil
}

func (m *MockUserRoleRepository) AssignRole(userID, roleID uuid.UUID) error {
	userKey := userID.String()
	roles := m.userRoles[userKey]

	// Check if role already assigned
	for _, existingRoleID := range roles {
		if existingRoleID == roleID {
			return nil // Already assigned
		}
	}

	m.userRoles[userKey] = append(roles, roleID)
	return nil
}

func (m *MockUserRoleRepository) RemoveRole(userID, roleID uuid.UUID) error {
	userKey := userID.String()
	roles := m.userRoles[userKey]

	for i, existingRoleID := range roles {
		if existingRoleID == roleID {
			// Remove role
			m.userRoles[userKey] = append(roles[:i], roles[i+1:]...)
			return nil
		}
	}

	return fmt.Errorf("user role assignment not found")
}

func (m *MockUserRoleRepository) CountByRoleID(roleID uuid.UUID) (int, error) {
	return 0, nil
}

func (m *MockUserRoleRepository) HasRole(userID, roleID uuid.UUID) (bool, error) {
	userKey := userID.String()
	roles := m.userRoles[userKey]

	for _, existingRoleID := range roles {
		if existingRoleID == roleID {
			return true, nil
		}
	}

	return false, nil
}

// MockPermissionRepositoryForAuthz extends MockPermissionRepository for authz tests
type MockPermissionRepositoryForAuthz struct {
	userPermissions map[string][]db.Permission // userID -> permissions
}

func NewMockPermissionRepositoryForAuthz() *MockPermissionRepositoryForAuthz {
	return &MockPermissionRepositoryForAuthz{
		userPermissions: make(map[string][]db.Permission),
	}
}

func (m *MockPermissionRepositoryForAuthz) GetByRoleID(roleID uuid.UUID) ([]db.Permission, error) {
	return []db.Permission{}, nil
}

func (m *MockPermissionRepositoryForAuthz) GetByUserID(userID uuid.UUID) ([]db.Permission, error) {
	userKey := userID.String()
	return m.userPermissions[userKey], nil
}

func (m *MockPermissionRepositoryForAuthz) HasPermission(userID uuid.UUID, action, resource string) (bool, error) {
	userKey := userID.String()
	permissions := m.userPermissions[userKey]

	for _, perm := range permissions {
		if perm.Action == action && perm.Resource == resource {
			return true, nil
		}
	}

	return false, nil
}

func (m *MockPermissionRepositoryForAuthz) GetAll() ([]db.Permission, error) {
	return []db.Permission{}, nil
}

func (m *MockPermissionRepositoryForAuthz) AssignToRole(roleID, permissionID uuid.UUID) error {
	return nil
}

func (m *MockPermissionRepositoryForAuthz) RemoveFromRole(roleID, permissionID uuid.UUID) error {
	return nil
}

func (m *MockPermissionRepositoryForAuthz) RemoveAllFromRole(roleID uuid.UUID) error {
	return nil
}

// New methods for the extended interface
func (m *MockPermissionRepositoryForAuthz) GetByID(id uuid.UUID) (*db.Permission, error) {
	return nil, nil
}

func (m *MockPermissionRepositoryForAuthz) GetByName(name string) (*db.Permission, error) {
	return nil, nil
}

func (m *MockPermissionRepositoryForAuthz) Create(resource, action, description string) (*db.Permission, error) {
	// Generate name in format "resource:action"
	name := fmt.Sprintf("%s:%s", resource, action)

	permission := db.Permission{
		ID:          uuid.New(),
		Name:        name,
		Description: description,
		Resource:    resource,
		Action:      action,
	}
	return &permission, nil
}

func (m *MockPermissionRepositoryForAuthz) Update(id uuid.UUID, resource, action, description string) (*db.Permission, error) {
	return nil, nil
}

func (m *MockPermissionRepositoryForAuthz) Delete(id uuid.UUID) error {
	return nil
}

func (m *MockPermissionRepositoryForAuthz) AddUserPermission(userID uuid.UUID, action, resource string) {
	userKey := userID.String()
	perm := db.Permission{
		ID:       uuid.New(),
		Action:   action,
		Resource: resource,
	}
	m.userPermissions[userKey] = append(m.userPermissions[userKey], perm)
}

// TestAuthzService_HasPermissionAllowed tests permission checking when user has permission
func TestAuthzService_HasPermissionAllowed(t *testing.T) {
	userRoleRepo := NewMockUserRoleRepository()
	permRepo := NewMockPermissionRepositoryForAuthz()

	userID := uuid.New()
	permRepo.AddUserPermission(userID, "read", "users")

	service := NewAuthzService(userRoleRepo, permRepo)

	hasPermission, err := service.HasPermission(userID, "users:read")

	if err != nil {
		t.Errorf("HasPermission() error = %v, expected nil", err)
		return
	}

	if !hasPermission {
		t.Error("Expected permission to be allowed, got denied")
	}
}

// TestAuthzService_HasPermissionDenied tests permission checking when user doesn't have permission
func TestAuthzService_HasPermissionDenied(t *testing.T) {
	userRoleRepo := NewMockUserRoleRepository()
	permRepo := NewMockPermissionRepositoryForAuthz()

	userID := uuid.New()
	service := NewAuthzService(userRoleRepo, permRepo)

	hasPermission, err := service.HasPermission(userID, "users:write")

	if err != nil {
		t.Errorf("HasPermission() error = %v, expected nil", err)
		return
	}

	if hasPermission {
		t.Error("Expected permission to be denied, got allowed")
	}
}

// TestAuthzService_GetUserPermissions tests fetching user permissions
func TestAuthzService_GetUserPermissions(t *testing.T) {
	userRoleRepo := NewMockUserRoleRepository()
	permRepo := NewMockPermissionRepositoryForAuthz()

	userID := uuid.New()
	permRepo.AddUserPermission(userID, "read", "users")
	permRepo.AddUserPermission(userID, "write", "posts")

	service := NewAuthzService(userRoleRepo, permRepo)

	permissions, err := service.GetUserPermissions(userID)

	if err != nil {
		t.Errorf("GetUserPermissions() error = %v, expected nil", err)
		return
	}

	if len(permissions) != 2 {
		t.Errorf("Expected 2 permissions, got %d", len(permissions))
	}
}

// TestAuthzService_AssignRoleSuccess tests successful role assignment
func TestAuthzService_AssignRoleSuccess(t *testing.T) {
	userRoleRepo := NewMockUserRoleRepository()
	permRepo := NewMockPermissionRepositoryForAuthz()
	service := NewAuthzService(userRoleRepo, permRepo)

	userID := uuid.New()
	roleID := uuid.New()
	req := AssignRoleRequest{RoleID: roleID}

	err := service.AssignRole(userID, req)

	if err != nil {
		t.Errorf("AssignRole() error = %v, expected nil", err)
		return
	}

	// Verify role was assigned
	hasRole, err := userRoleRepo.HasRole(userID, roleID)
	if err != nil {
		t.Errorf("HasRole() error = %v, expected nil", err)
		return
	}

	if !hasRole {
		t.Error("Expected role to be assigned")
	}
}

// TestAuthzService_RemoveRoleSuccess tests successful role removal
func TestAuthzService_RemoveRoleSuccess(t *testing.T) {
	userRoleRepo := NewMockUserRoleRepository()
	permRepo := NewMockPermissionRepositoryForAuthz()
	service := NewAuthzService(userRoleRepo, permRepo)

	userID := uuid.New()
	roleID := uuid.New()

	// Assign role first
	userRoleRepo.AssignRole(userID, roleID)

	err := service.RemoveRole(userID, roleID)

	if err != nil {
		t.Errorf("RemoveRole() error = %v, expected nil", err)
		return
	}

	// Verify role was removed
	hasRole, err := userRoleRepo.HasRole(userID, roleID)
	if err != nil {
		t.Errorf("HasRole() error = %v, expected nil", err)
		return
	}

	if hasRole {
		t.Error("Expected role to be removed")
	}
}

// TestAuthzService_ParsePermissionInvalid tests parsing invalid permissions
func TestAuthzService_ParsePermissionInvalid(t *testing.T) {
	testCases := []struct {
		name       string
		permission string
	}{
		{"NoColon", "readusers"},
		{"EmptyAction", ":users"},
		{"EmptyResource", "read:"},
		{"MultipleColons", "read:users:admin"},
		{"OnlyColon", ":"},
		{"Empty", ""},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			userRoleRepo := NewMockUserRoleRepository()
			permRepo := NewMockPermissionRepositoryForAuthz()
			service := NewAuthzService(userRoleRepo, permRepo)

			userID := uuid.New()

			_, err := service.HasPermission(userID, tc.permission)

			if err == nil {
				t.Errorf("Expected error for invalid permission format '%s', got nil", tc.permission)
			}
		})
	}
}

// TestAuthzService_GetUserRoles tests fetching user roles
func TestAuthzService_GetUserRoles(t *testing.T) {
	userRoleRepo := NewMockUserRoleRepository()
	permRepo := NewMockPermissionRepositoryForAuthz()
	service := NewAuthzService(userRoleRepo, permRepo)

	userID := uuid.New()

	roles, err := service.GetUserRoles(userID)

	if err != nil {
		t.Errorf("GetUserRoles() error = %v, expected nil", err)
		return
	}

	if roles == nil {
		t.Error("Expected roles slice, got nil")
	}
}
