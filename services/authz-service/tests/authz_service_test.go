package services

import (
	"fmt"
	"testing"

	"authz-service/internal/db"
	"authz-service/internal/services"

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
	// Return empty slice instead of nil to ensure JSON marshals as [] not null
	return make([]db.Role, 0), nil
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
	permissions, exists := m.userPermissions[userKey]
	if !exists {
		return make([]db.Permission, 0), nil // Return empty slice instead of nil
	}
	return permissions, nil
}

func (m *MockPermissionRepositoryForAuthz) HasPermission(userID uuid.UUID, action, resource string) (bool, error) {
	userKey := userID.String()
	permissions := m.userPermissions[userKey]

	for _, perm := range permissions {
		// Exact match
		if perm.Action == action && perm.Resource == resource {
			return true, nil
		}
		// Wildcard action
		if perm.Action == "*" && perm.Resource == resource {
			return true, nil
		}
		// Wildcard resource
		if perm.Action == action && perm.Resource == "*" {
			return true, nil
		}
		// Wildcard both
		if perm.Action == "*" && perm.Resource == "*" {
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
	// Arrange
	userRoleRepo := NewMockUserRoleRepository()
	permRepo := NewMockPermissionRepositoryForAuthz()

	userID := uuid.New()
	permRepo.AddUserPermission(userID, "read", "users")

	service := services.NewAuthzService(userRoleRepo, permRepo)

	// Act
	hasPermission, err := service.HasPermission(userID, "users:read")

	// Assert
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
	// Arrange
	userRoleRepo := NewMockUserRoleRepository()
	permRepo := NewMockPermissionRepositoryForAuthz()

	userID := uuid.New()
	service := services.NewAuthzService(userRoleRepo, permRepo)

	// Act
	hasPermission, err := service.HasPermission(userID, "users:write")

	// Assert
	if err != nil {
		t.Errorf("HasPermission() error = %v, expected nil", err)
		return
	}

	if hasPermission {
		t.Error("Expected permission to be denied, got allowed")
	}
}

// TestAuthzService_ParsePermissionValid tests parsing valid permissions
func TestAuthzService_ParsePermissionValid(t *testing.T) {
	testCases := []struct {
		name             string
		permission       string
		expectedAction   string
		expectedResource string
	}{
		{
			name:             "SimplePermission",
			permission:       "users:read",
			expectedAction:   "read",
			expectedResource: "users",
		},
		{
			name:             "ComplexPermission",
			permission:       "user_reports:delete",
			expectedAction:   "delete",
			expectedResource: "user_reports",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Arrange
			userRoleRepo := NewMockUserRoleRepository()
			permRepo := NewMockPermissionRepositoryForAuthz()
			service := services.NewAuthzService(userRoleRepo, permRepo)

			userID := uuid.New()
			permRepo.AddUserPermission(userID, tc.expectedAction, tc.expectedResource)

			// Act
			hasPermission, err := service.HasPermission(userID, tc.permission)

			// Assert
			if err != nil {
				t.Errorf("HasPermission() error = %v, expected nil", err)
				return
			}

			if !hasPermission {
				t.Error("Expected permission to be allowed")
			}
		})
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
		{"MultipleColons", "users:read:admin"},
		{"OnlyColon", ":"},
		{"Empty", ""},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Arrange
			userRoleRepo := NewMockUserRoleRepository()
			permRepo := NewMockPermissionRepositoryForAuthz()
			service := services.NewAuthzService(userRoleRepo, permRepo)

			userID := uuid.New()

			// Act
			_, err := service.HasPermission(userID, tc.permission)

			// Assert
			if err == nil {
				t.Errorf("Expected error for invalid permission format '%s', got nil", tc.permission)
			}
		})
	}
}

// TestAuthzService_GetUserPermissions tests fetching user permissions
func TestAuthzService_GetUserPermissions(t *testing.T) {
	// Arrange
	userRoleRepo := NewMockUserRoleRepository()
	permRepo := NewMockPermissionRepositoryForAuthz()

	userID := uuid.New()
	permRepo.AddUserPermission(userID, "read", "users")
	permRepo.AddUserPermission(userID, "write", "posts")

	service := services.NewAuthzService(userRoleRepo, permRepo)

	// Act
	permissions, err := service.GetUserPermissions(userID)

	// Assert
	if err != nil {
		t.Errorf("GetUserPermissions() error = %v, expected nil", err)
		return
	}

	if len(permissions) != 2 {
		t.Errorf("Expected 2 permissions, got %d", len(permissions))
	}
}

// TestAuthzService_GetUserPermissionsEmpty tests fetching empty permissions list
func TestAuthzService_GetUserPermissionsEmpty(t *testing.T) {
	// Arrange
	userRoleRepo := NewMockUserRoleRepository()
	permRepo := NewMockPermissionRepositoryForAuthz()

	userID := uuid.New()
	service := services.NewAuthzService(userRoleRepo, permRepo)

	// Act
	permissions, err := service.GetUserPermissions(userID)

	// Assert
	if err != nil {
		t.Errorf("GetUserPermissions() error = %v, expected nil", err)
		return
	}

	if len(permissions) != 0 {
		t.Errorf("Expected 0 permissions, got %d", len(permissions))
	}
}

// TestAuthzService_AssignRoleSuccess tests successful role assignment
func TestAuthzService_AssignRoleSuccess(t *testing.T) {
	// Arrange
	userRoleRepo := NewMockUserRoleRepository()
	permRepo := NewMockPermissionRepositoryForAuthz()
	service := services.NewAuthzService(userRoleRepo, permRepo)

	userID := uuid.New()
	roleID := uuid.New()
	req := services.AssignRoleRequest{RoleID: roleID}

	// Act
	err := service.AssignRole(userID, req)

	// Assert
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
	// Arrange
	userRoleRepo := NewMockUserRoleRepository()
	permRepo := NewMockPermissionRepositoryForAuthz()
	service := services.NewAuthzService(userRoleRepo, permRepo)

	userID := uuid.New()
	roleID := uuid.New()

	// Assign role first
	userRoleRepo.AssignRole(userID, roleID)

	// Act
	err := service.RemoveRole(userID, roleID)

	// Assert
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

// TestAuthzService_RemoveRoleNotFound tests removing unassigned role
func TestAuthzService_RemoveRoleNotFound(t *testing.T) {
	// Arrange
	userRoleRepo := NewMockUserRoleRepository()
	permRepo := NewMockPermissionRepositoryForAuthz()
	service := services.NewAuthzService(userRoleRepo, permRepo)

	userID := uuid.New()
	roleID := uuid.New()

	// Act
	err := service.RemoveRole(userID, roleID)

	// Assert
	if err == nil {
		t.Error("Expected error for removing non-assigned role, got nil")
	}
}

// TestAuthzService_HasPermissionWildcardAction tests wildcard action permissions
func TestAuthzService_HasPermissionWildcardAction(t *testing.T) {
	// Arrange
	userRoleRepo := NewMockUserRoleRepository()
	permRepo := NewMockPermissionRepositoryForAuthz()

	userID := uuid.New()
	permRepo.AddUserPermission(userID, "*", "users") // users:*

	service := services.NewAuthzService(userRoleRepo, permRepo)

	// Act & Assert
	testCases := []struct {
		permission string
		expected   bool
	}{
		{"users:read", true},    // should match users:*
		{"users:write", true},   // should match users:*
		{"users:delete", true},  // should match users:*
		{"reports:read", false}, // should not match users:*
	}

	for _, tc := range testCases {
		hasPermission, err := service.HasPermission(userID, tc.permission)
		if err != nil {
			t.Errorf("HasPermission(%s) error = %v, expected nil", tc.permission, err)
			continue
		}

		if hasPermission != tc.expected {
			t.Errorf("HasPermission(%s) = %v, expected %v", tc.permission, hasPermission, tc.expected)
		}
	}
}

// TestAuthzService_HasPermissionWildcardResource tests wildcard resource permissions
func TestAuthzService_HasPermissionWildcardResource(t *testing.T) {
	// Arrange
	userRoleRepo := NewMockUserRoleRepository()
	permRepo := NewMockPermissionRepositoryForAuthz()

	userID := uuid.New()
	permRepo.AddUserPermission(userID, "read", "*") // read:*

	service := services.NewAuthzService(userRoleRepo, permRepo)

	// Act & Assert
	testCases := []struct {
		permission string
		expected   bool
	}{
		{"users:read", true},      // should match read:*
		{"reports:read", true},    // should match read:*
		{"roles:read", true},      // should match read:*
		{"users:write", false},    // should not match read:*
		{"reports:delete", false}, // should not match read:*
	}

	for _, tc := range testCases {
		hasPermission, err := service.HasPermission(userID, tc.permission)
		if err != nil {
			t.Errorf("HasPermission(%s) error = %v, expected nil", tc.permission, err)
			continue
		}

		if hasPermission != tc.expected {
			t.Errorf("HasPermission(%s) = %v, expected %v", tc.permission, hasPermission, tc.expected)
		}
	}
}

// TestAuthzService_HasPermissionWildcardBoth tests wildcard both action and resource
func TestAuthzService_HasPermissionWildcardBoth(t *testing.T) {
	// Arrange
	userRoleRepo := NewMockUserRoleRepository()
	permRepo := NewMockPermissionRepositoryForAuthz()

	userID := uuid.New()
	permRepo.AddUserPermission(userID, "*", "*") // *:* (super admin)

	service := services.NewAuthzService(userRoleRepo, permRepo)

	// Act & Assert
	testCases := []string{
		"users:read",
		"users:write",
		"reports:delete",
		"system:admin",
		"anything:any",
	}

	for _, permission := range testCases {
		hasPermission, err := service.HasPermission(userID, permission)
		if err != nil {
			t.Errorf("HasPermission(%s) error = %v, expected nil", permission, err)
			continue
		}

		if !hasPermission {
			t.Errorf("HasPermission(%s) = false, expected true (should match *:*)", permission)
		}
	}
}

// TestAuthzService_HasPermissionWildcardPriority tests that exact matches work alongside wildcards
func TestAuthzService_HasPermissionWildcardPriority(t *testing.T) {
	// Arrange
	userRoleRepo := NewMockUserRoleRepository()
	permRepo := NewMockPermissionRepositoryForAuthz()

	userID := uuid.New()
	// User has both exact permission and wildcard
	permRepo.AddUserPermission(userID, "read", "users") // exact: users:read
	permRepo.AddUserPermission(userID, "*", "reports")  // wildcard: reports:*

	service := services.NewAuthzService(userRoleRepo, permRepo)

	// Act & Assert
	testCases := []struct {
		permission string
		expected   bool
	}{
		{"users:read", true},     // exact match
		{"users:write", false},   // no match
		{"reports:read", true},   // wildcard match reports:*
		{"reports:write", true},  // wildcard match reports:*
		{"reports:delete", true}, // wildcard match reports:*
		{"roles:read", false},    // no match
	}

	for _, tc := range testCases {
		hasPermission, err := service.HasPermission(userID, tc.permission)
		if err != nil {
			t.Errorf("HasPermission(%s) error = %v, expected nil", tc.permission, err)
			continue
		}

		if hasPermission != tc.expected {
			t.Errorf("HasPermission(%s) = %v, expected %v", tc.permission, hasPermission, tc.expected)
		}
	}
}
