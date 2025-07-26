package services

import (
	"fmt"
	"testing"

	"authz-service/internal/db"

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
	var roles []db.Role
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
	var rolePermissions []db.Permission
	permissionIDs := m.rolePermissions[roleID]
	for _, permID := range permissionIDs {
		if perm, exists := m.permissions[permID]; exists {
			rolePermissions = append(rolePermissions, perm)
		}
	}
	return rolePermissions, nil
}

func (m *MockPermissionRepository) GetByUserID(userID uuid.UUID) ([]db.Permission, error) {
	return []db.Permission{}, nil
}

func (m *MockPermissionRepository) HasPermission(userID uuid.UUID, action, resource string) (bool, error) {
	return false, nil
}

func (m *MockPermissionRepository) GetAll() ([]db.Permission, error) {
	var allPermissions []db.Permission
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
	// Generate name in format "resource:action"
	name := fmt.Sprintf("%s:%s", resource, action)

	permission := db.Permission{
		ID:          id,
		Name:        name,
		Description: description,
		Resource:    resource,
		Action:      action,
	}
	m.permissions[id] = permission
	return &permission, nil
}

func (m *MockPermissionRepository) Delete(id uuid.UUID) error {
	delete(m.permissions, id)
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
	roleRepo := NewMockRoleRepository()
	permRepo := NewMockPermissionRepository()
	service := NewRoleService(roleRepo, permRepo)

	testRole := db.Role{
		ID:          uuid.New(),
		Name:        "test-role",
		Description: "Test role description",
	}
	roleRepo.roles[testRole.ID] = testRole

	roles, err := service.GetRoles()

	if err != nil {
		t.Errorf("GetRoles() error = %v, expected nil", err)
		return
	}

	if len(roles) != 1 {
		t.Errorf("Expected 1 role, got %d", len(roles))
	}
}

// TestRoleService_CreateRoleSuccess tests successful role creation
func TestRoleService_CreateRoleSuccess(t *testing.T) {
	roleRepo := NewMockRoleRepository()
	permRepo := NewMockPermissionRepository()

	// Add the permission to the mock's global catalog
	permRepo.AddPermission("Users Read", "Read access to users", "read", "users")

	service := NewRoleService(roleRepo, permRepo)

	req := CreateRoleRequest{
		Name:        "new-role",
		Description: "New role description",
		Permissions: []Permission{
			{Action: "read", Resource: "users"},
		},
	}

	role, err := service.CreateRole(req)

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
}

// TestRoleService_CreateRoleDuplicateName tests error when creating role with existing name
func TestRoleService_CreateRoleDuplicateName(t *testing.T) {
	roleRepo := NewMockRoleRepository()
	permRepo := NewMockPermissionRepository()
	service := NewRoleService(roleRepo, permRepo)

	// Add existing role
	existingRole := db.Role{
		ID:          uuid.New(),
		Name:        "existing-role",
		Description: "Existing role",
	}
	roleRepo.roles[existingRole.ID] = existingRole

	req := CreateRoleRequest{
		Name:        "existing-role",
		Description: "Duplicate role",
		Permissions: []Permission{},
	}

	_, err := service.CreateRole(req)

	if err == nil {
		t.Error("Expected error for duplicate role name, got nil")
	}
}

// TestRoleService_GetRole testuje pobieranie roli po ID
func TestRoleService_GetRole(t *testing.T) {
	roleRepo := NewMockRoleRepository()
	permRepo := NewMockPermissionRepository()
	service := NewRoleService(roleRepo, permRepo)

	roleID := uuid.New()
	testRole := db.Role{
		ID:          roleID,
		Name:        "test-role",
		Description: "Test role description",
	}
	roleRepo.roles[roleID] = testRole

	role, err := service.GetRole(roleID)

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

// TestRoleService_GetRoleNotFound tests fetching non-existent role
func TestRoleService_GetRoleNotFound(t *testing.T) {
	roleRepo := NewMockRoleRepository()
	permRepo := NewMockPermissionRepository()
	service := NewRoleService(roleRepo, permRepo)

	roleID := uuid.New()

	role, err := service.GetRole(roleID)

	if err != nil {
		t.Errorf("GetRole() error = %v, expected nil", err)
		return
	}

	if role != nil {
		t.Error("Expected nil role for non-existent ID")
	}
}

// TestRoleService_UpdateRoleSuccess tests successful role update
func TestRoleService_UpdateRoleSuccess(t *testing.T) {
	roleRepo := NewMockRoleRepository()
	permRepo := NewMockPermissionRepository()

	// Add the permission to the mock's global catalog
	permRepo.AddPermission("Reports Read", "Read access to reports", "read", "reports")

	service := NewRoleService(roleRepo, permRepo)

	roleID := uuid.New()
	testRole := db.Role{
		ID:          roleID,
		Name:        "old-role",
		Description: "Old description",
	}
	roleRepo.roles[roleID] = testRole

	req := UpdateRoleRequest{
		Name:        "updated-role",
		Description: "Updated description",
		Permissions: []Permission{
			{Action: "read", Resource: "reports"},
		},
	}

	role, err := service.UpdateRole(roleID, req)

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

// TestRoleService_DeleteRoleSuccess tests successful role deletion
func TestRoleService_DeleteRoleSuccess(t *testing.T) {
	roleRepo := NewMockRoleRepository()
	permRepo := NewMockPermissionRepository()
	service := NewRoleService(roleRepo, permRepo)

	roleID := uuid.New()
	testRole := db.Role{
		ID:          roleID,
		Name:        "role-to-delete",
		Description: "Role to be deleted",
	}
	roleRepo.roles[roleID] = testRole

	err := service.DeleteRole(roleID)

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

// TestRoleService_CreateRoleEmptyName tests error when creating role with empty name
func TestRoleService_CreateRoleEmptyName(t *testing.T) {
	roleRepo := NewMockRoleRepository()
	permRepo := NewMockPermissionRepository()
	service := NewRoleService(roleRepo, permRepo)

	req := CreateRoleRequest{
		Name:        "",
		Description: "Role without name",
		Permissions: []Permission{},
	}

	_, err := service.CreateRole(req)

	if err == nil {
		t.Error("Expected error for empty role name, got nil")
	}
}
