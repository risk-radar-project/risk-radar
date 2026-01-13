package services

import (
	"errors"
	"fmt"
	"strings"
	"testing"

	"authz-service/internal/db"
	"authz-service/internal/services"

	"github.com/google/uuid"
)

// MockRoleRepository implements RoleRepositoryInterface for tests
type MockRoleRepository struct {
	roles       map[uuid.UUID]db.Role
	permissions map[uuid.UUID][]db.Permission
}

func NewMockRoleRepository() *MockRoleRepository {
	return &MockRoleRepository{
		roles:       make(map[uuid.UUID]db.Role),
		permissions: make(map[uuid.UUID][]db.Permission),
	}
}

func (m *MockRoleRepository) GetAll() ([]db.Role, error) {
	// Initialize as empty slice instead of nil to ensure JSON marshals as [] not null
	roles := make([]db.Role, 0)
	for _, role := range m.roles {
		roles = append(roles, role)
	}
	return roles, nil
}

func (m *MockRoleRepository) GetByID(id uuid.UUID) (*db.Role, error) {
	role, exists := m.roles[id]
	if !exists {
		return nil, nil
	}
	return &role, nil
}

func (m *MockRoleRepository) GetByName(name string) (*db.Role, error) {
	for _, role := range m.roles {
		if role.Name == name {
			return &role, nil
		}
	}
	return nil, nil
}

func (m *MockRoleRepository) Create(name, description string) (*db.Role, error) {
	// Check if role exists
	for _, role := range m.roles {
		if role.Name == name {
			return nil, fmt.Errorf("role with name '%s' already exists", name)
		}
	}

	role := db.Role{
		ID:          uuid.New(),
		Name:        name,
		Description: description,
	}
	m.roles[role.ID] = role
	return &role, nil
}

func (m *MockRoleRepository) Update(id uuid.UUID, name, description string) (*db.Role, error) {
	role, exists := m.roles[id]
	if !exists {
		return nil, nil
	}

	role.Name = name
	role.Description = description
	m.roles[id] = role
	return &role, nil
}

func (m *MockRoleRepository) Delete(id uuid.UUID) error {
	delete(m.roles, id)
	delete(m.permissions, id)
	return nil
}

func (m *MockRoleRepository) GetPermissions(roleID uuid.UUID) ([]db.Permission, error) {
	return m.permissions[roleID], nil
}

// MockPermissionRepository implements PermissionRepositoryInterface for tests
type MockPermissionRepository struct {
	permissions     map[uuid.UUID]db.Permission
	rolePermissions map[uuid.UUID][]uuid.UUID // roleID -> []permissionID
}

func NewMockPermissionRepository() *MockPermissionRepository {
	return &MockPermissionRepository{
		permissions:     make(map[uuid.UUID]db.Permission),
		rolePermissions: make(map[uuid.UUID][]uuid.UUID),
	}
}

func (m *MockPermissionRepository) GetByRoleID(roleID uuid.UUID) ([]db.Permission, error) {
	// Initialize as empty slice instead of nil to ensure JSON marshals as [] not null
	rolePermissions := make([]db.Permission, 0)
	permissionIDs := m.rolePermissions[roleID]
	for _, permID := range permissionIDs {
		if perm, exists := m.permissions[permID]; exists {
			rolePermissions = append(rolePermissions, perm)
		}
	}
	return rolePermissions, nil
}

func (m *MockPermissionRepository) GetByUserID(userID uuid.UUID) ([]db.Permission, error) {
	return make([]db.Permission, 0), nil // Return empty slice instead of nil
}

func (m *MockPermissionRepository) HasPermission(userID uuid.UUID, action, resource string) (bool, error) {
	return false, nil // Not used in role service tests
}

func (m *MockPermissionRepository) GetAll() ([]db.Permission, error) {
	allPermissions := make([]db.Permission, 0)
	for _, perm := range m.permissions {
		allPermissions = append(allPermissions, perm)
	}
	return allPermissions, nil
}

func (m *MockPermissionRepository) AssignToRole(roleID, permissionID uuid.UUID) error {
	if m.rolePermissions[roleID] == nil {
		m.rolePermissions[roleID] = make([]uuid.UUID, 0)
	}
	m.rolePermissions[roleID] = append(m.rolePermissions[roleID], permissionID)
	return nil
}

func (m *MockPermissionRepository) RemoveFromRole(roleID, permissionID uuid.UUID) error {
	permissionIDs := m.rolePermissions[roleID]
	for i, id := range permissionIDs {
		if id == permissionID {
			m.rolePermissions[roleID] = append(permissionIDs[:i], permissionIDs[i+1:]...)
			break
		}
	}
	return nil
}

func (m *MockPermissionRepository) RemoveAllFromRole(roleID uuid.UUID) error {
	delete(m.rolePermissions, roleID)
	return nil
}

// New methods for the extended interface
func (m *MockPermissionRepository) GetByID(id uuid.UUID) (*db.Permission, error) {
	perm, exists := m.permissions[id]
	if !exists {
		return nil, nil
	}
	return &perm, nil
}

func (m *MockPermissionRepository) GetByName(name string) (*db.Permission, error) {
	for _, perm := range m.permissions {
		if perm.Name == name {
			return &perm, nil
		}
	}
	return nil, nil
}

func (m *MockPermissionRepository) Create(resource, action, description string) (*db.Permission, error) {
	// Generate name in format "resource:action"
	name := fmt.Sprintf("%s:%s", resource, action)

	permission := db.Permission{
		ID:          uuid.New(),
		Name:        name,
		Description: description,
		Resource:    resource,
		Action:      action,
	}
	m.permissions[permission.ID] = permission
	return &permission, nil
}

func (m *MockPermissionRepository) Update(id uuid.UUID, resource, action, description string) (*db.Permission, error) {
	return nil, nil
}

func (m *MockPermissionRepository) Delete(id uuid.UUID) error {
	return nil
}

// Helper method to add a permission to the global catalog
func (m *MockPermissionRepository) AddPermission(name, description, action, resource string) uuid.UUID {
	permission := db.Permission{
		ID:          uuid.New(),
		Name:        name,
		Description: description,
		Action:      action,
		Resource:    resource,
	}
	m.permissions[permission.ID] = permission
	return permission.ID
}

// TestRoleService_GetRoles tests fetching all roles
func TestRoleService_GetRoles(t *testing.T) {
	// Arrange
	roleRepo := NewMockRoleRepository()
	permRepo := NewMockPermissionRepository()
	service := services.NewRoleService(roleRepo, permRepo, NewMockUserRoleRepository())

	// Add test role
	testRole := db.Role{
		ID:          uuid.New(),
		Name:        "test-role",
		Description: "Test role description",
	}
	roleRepo.roles[testRole.ID] = testRole

	// Act
	roles, err := service.GetRoles()

	// Assert
	if err != nil {
		t.Errorf("GetRoles() error = %v, expected nil", err)
		return
	}

	if len(roles) != 1 {
		t.Errorf("Expected 1 role, got %d", len(roles))
	}
}

// TestRoleService_GetRole tests retrieving role by ID
func TestRoleService_GetRole(t *testing.T) {
	// Arrange
	roleRepo := NewMockRoleRepository()
	permRepo := NewMockPermissionRepository()
	service := services.NewRoleService(roleRepo, permRepo, NewMockUserRoleRepository())

	roleID := uuid.New()
	testRole := db.Role{
		ID:          roleID,
		Name:        "test-role",
		Description: "Test role description",
	}
	roleRepo.roles[roleID] = testRole

	// Act
	role, err := service.GetRole(roleID)

	// Assert
	if err != nil {
		t.Errorf("GetRole() error = %v, expected nil", err)
		return
	}

	if role == nil {
		t.Error("Expected role to be found, got nil")
		return
	}

	if role.Role.Name != "test-role" {
		t.Errorf("Expected role name 'test-role', got '%s'", role.Role.Name)
	}
}

// TestRoleService_CreateRoleSuccess tests successful role creation
func TestRoleService_CreateRoleSuccess(t *testing.T) {
	// Arrange
	roleRepo := NewMockRoleRepository()
	permRepo := NewMockPermissionRepository()

	// Add permissions to the mock's global catalog
	permRepo.AddPermission("Users Read", "Read access to users", "read", "users")
	permRepo.AddPermission("Posts Write", "Write access to posts", "write", "posts")

	service := services.NewRoleService(roleRepo, permRepo, NewMockUserRoleRepository())

	req := services.CreateRoleRequest{
		Name:        "new-role",
		Description: "New role description",
		Permissions: []services.Permission{
			{Action: "read", Resource: "users"},
			{Action: "write", Resource: "posts"},
		},
	}

	// Act
	role, err := service.CreateRole(req)

	// Assert
	if err != nil {
		t.Errorf("CreateRole() error = %v, expected nil", err)
		return
	}

	if role == nil {
		t.Error("Expected role to be created, got nil")
		return
	}

	if role.Role.Name != req.Name {
		t.Errorf("Expected role name '%s', got '%s'", req.Name, role.Role.Name)
	}

	if len(role.Permissions) != 2 {
		t.Errorf("Expected 2 permissions, got %d", len(role.Permissions))
	}
}

func TestRoleService_CreateRolePermissionNotFound(t *testing.T) {
	roleRepo := NewMockRoleRepository()
	permRepo := NewMockPermissionRepository()
	service := services.NewRoleService(roleRepo, permRepo, NewMockUserRoleRepository())

	req := services.CreateRoleRequest{
		Name:        "new-role",
		Description: "desc",
		Permissions: []services.Permission{{Action: "read", Resource: "missing"}},
	}

	_, err := service.CreateRole(req)
	if err == nil {
		t.Fatal("expected error when permission does not exist")
	}

	if !errors.Is(err, services.ErrPermissionNotFound) {
		t.Fatalf("expected ErrPermissionNotFound, got %v", err)
	}

	var permErr *services.PermissionNotFoundError
	if !errors.As(err, &permErr) {
		t.Fatalf("expected PermissionNotFoundError, got %T", err)
	}

	if permErr.Key() != "missing:read" {
		t.Fatalf("unexpected permission key: %s", permErr.Key())
	}

	if len(roleRepo.roles) != 0 {
		t.Fatalf("role should not be created when permissions are invalid")
	}
}

// TestRoleService_CreateRoleDuplicateName tests error when creating role with existing name
func TestRoleService_CreateRoleDuplicateName(t *testing.T) {
	// Arrange
	roleRepo := NewMockRoleRepository()
	permRepo := NewMockPermissionRepository()
	service := services.NewRoleService(roleRepo, permRepo, NewMockUserRoleRepository())

	// Add existing role
	existingRole := db.Role{
		ID:          uuid.New(),
		Name:        "existing-role",
		Description: "Existing role",
	}
	roleRepo.roles[existingRole.ID] = existingRole

	req := services.CreateRoleRequest{
		Name:        "existing-role",
		Description: "Duplicate role",
		Permissions: []services.Permission{},
	}

	// Act
	_, err := service.CreateRole(req)

	// Assert
	if err == nil {
		t.Error("Expected error for duplicate role name, got nil")
	}
}

// TestRoleService_CreateRoleEmptyName tests error when creating role with empty name
func TestRoleService_CreateRoleEmptyName(t *testing.T) {
	// Arrange
	roleRepo := NewMockRoleRepository()
	permRepo := NewMockPermissionRepository()
	service := services.NewRoleService(roleRepo, permRepo, NewMockUserRoleRepository())

	req := services.CreateRoleRequest{
		Name:        "",
		Description: "Role without name",
		Permissions: []services.Permission{},
	}

	// Act
	_, err := service.CreateRole(req)

	// Assert
	if err == nil {
		t.Error("Expected error for empty role name, got nil")
	}
}

// TestRoleService_UpdateRoleSuccess tests successful role update
func TestRoleService_UpdateRoleSuccess(t *testing.T) {
	// Arrange
	roleRepo := NewMockRoleRepository()
	permRepo := NewMockPermissionRepository()

	// Add permission to the mock's global catalog
	permRepo.AddPermission("Reports Read", "Read access to reports", "read", "reports")

	service := services.NewRoleService(roleRepo, permRepo, NewMockUserRoleRepository())

	roleID := uuid.New()
	testRole := db.Role{
		ID:          roleID,
		Name:        "old-role",
		Description: "Old description",
	}
	roleRepo.roles[roleID] = testRole

	req := services.UpdateRoleRequest{
		Name:        "updated-role",
		Description: "Updated description",
		Permissions: []services.Permission{
			{Action: "read", Resource: "reports"},
		},
	}

	// Act
	role, err := service.UpdateRole(roleID, req)

	// Assert
	if err != nil {
		t.Errorf("UpdateRole() error = %v, expected nil", err)
		return
	}

	if role == nil {
		t.Error("Expected role to be updated, got nil")
		return
	}

	if role.Role.Name != req.Name {
		t.Errorf("Expected role name '%s', got '%s'", req.Name, role.Role.Name)
	}
}

func TestRoleService_UpdateRolePermissionNotFound(t *testing.T) {
	roleRepo := NewMockRoleRepository()
	permRepo := NewMockPermissionRepository()
	service := services.NewRoleService(roleRepo, permRepo, NewMockUserRoleRepository())

	roleID := uuid.New()
	roleRepo.roles[roleID] = db.Role{
		ID:          roleID,
		Name:        "existing-role",
		Description: "desc",
	}

	req := services.UpdateRoleRequest{
		Name:        "existing-role",
		Description: "desc",
		Permissions: []services.Permission{{Action: "approve", Resource: "reports"}},
	}

	_, err := service.UpdateRole(roleID, req)
	if err == nil {
		t.Fatal("expected error when permission does not exist")
	}

	if !errors.Is(err, services.ErrPermissionNotFound) {
		t.Fatalf("expected ErrPermissionNotFound, got %v", err)
	}
}

// TestRoleService_UpdateRoleNotFound tests error when updating non-existent role
func TestRoleService_UpdateRoleNotFound(t *testing.T) {
	// Arrange
	roleRepo := NewMockRoleRepository()
	permRepo := NewMockPermissionRepository()
	service := services.NewRoleService(roleRepo, permRepo, NewMockUserRoleRepository())

	roleID := uuid.New()
	req := services.UpdateRoleRequest{
		Name:        "updated-role",
		Description: "Updated description",
		Permissions: []services.Permission{},
	}

	// Act
	role, err := service.UpdateRole(roleID, req)

	// Assert
	if err != nil {
		t.Errorf("UpdateRole() error = %v, expected nil", err)
		return
	}

	if role != nil {
		t.Error("Expected nil role for non-existent ID")
	}
}

// TestRoleService_DeleteRoleSuccess tests successful role deletion
func TestRoleService_DeleteRoleSuccess(t *testing.T) {
	// Arrange
	roleRepo := NewMockRoleRepository()
	permRepo := NewMockPermissionRepository()
	service := services.NewRoleService(roleRepo, permRepo, NewMockUserRoleRepository())

	roleID := uuid.New()
	testRole := db.Role{
		ID:          roleID,
		Name:        "role-to-delete",
		Description: "Role to be deleted",
	}
	roleRepo.roles[roleID] = testRole

	// Act
	err := service.DeleteRole(roleID)

	// Assert
	if err != nil {
		t.Errorf("DeleteRole() error = %v, expected nil", err)
		return
	}

	// Verify role was deleted
	_, exists := roleRepo.roles[roleID]
	if exists {
		t.Error("Expected role to be deleted")
	}
}

// TestRoleService_DeleteRoleNotFound tests deleting non-existent role
func TestRoleService_DeleteRoleNotFound(t *testing.T) {
	// Arrange
	roleRepo := NewMockRoleRepository()
	permRepo := NewMockPermissionRepository()
	service := services.NewRoleService(roleRepo, permRepo, NewMockUserRoleRepository())

	roleID := uuid.New()

	// Act
	err := service.DeleteRole(roleID)

	// Assert
	// Deleting non-existent role should return "role not found" error
	if err == nil {
		t.Error("Expected error for non-existent role, got nil")
		return
	}

	expectedErr := "role not found"
	if !strings.Contains(err.Error(), expectedErr) {
		t.Errorf("Expected error to contain '%s', got '%v'", expectedErr, err)
	}
}

// TestRoleService_ValidationEmptyName tests validation of empty name
func TestRoleService_ValidationEmptyName(t *testing.T) {
	testCases := []struct {
		name string
		req  services.CreateRoleRequest
	}{
		{
			name: "EmptyName",
			req: services.CreateRoleRequest{
				Name:        "",
				Description: "Valid description",
				Permissions: []services.Permission{},
			},
		},
		{
			name: "WhitespaceName",
			req: services.CreateRoleRequest{
				Name:        "   ",
				Description: "Valid description",
				Permissions: []services.Permission{},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Arrange
			roleRepo := NewMockRoleRepository()
			permRepo := NewMockPermissionRepository()
			service := services.NewRoleService(roleRepo, permRepo, NewMockUserRoleRepository())

			// Act
			_, err := service.CreateRole(tc.req)

			// Assert
			if err == nil {
				t.Errorf("Expected error for invalid name '%s', got nil", tc.req.Name)
			}
		})
	}
}

// TestRoleService_ValidationInvalidPermissions tests validation of invalid permissions
func TestRoleService_ValidationInvalidPermissions(t *testing.T) {
	testCases := []struct {
		name        string
		permissions []services.Permission
	}{
		{
			name: "EmptyAction",
			permissions: []services.Permission{
				{Action: "", Resource: "users"},
			},
		},
		{
			name: "EmptyResource",
			permissions: []services.Permission{
				{Action: "read", Resource: ""},
			},
		},
		{
			name: "BothEmpty",
			permissions: []services.Permission{
				{Action: "", Resource: ""},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Arrange
			roleRepo := NewMockRoleRepository()
			permRepo := NewMockPermissionRepository()
			service := services.NewRoleService(roleRepo, permRepo, NewMockUserRoleRepository())

			req := services.CreateRoleRequest{
				Name:        "valid-role",
				Description: "Valid description",
				Permissions: tc.permissions,
			}

			// Act
			_, err := service.CreateRole(req)

			// Assert
			if err == nil {
				t.Errorf("Expected error for invalid permissions, got nil")
			}
		})
	}
}
