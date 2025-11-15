package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"authz-service/internal/db"
	apphandlers "authz-service/internal/handlers"
	"authz-service/internal/services"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// MockRoleServiceForHandler implements role service for handler tests
type MockRoleServiceForHandler struct {
	roles     map[uuid.UUID]db.RoleWithPermissions
	err       error
	createErr error
	updateErr error
	deleteErr error
}

func NewMockRoleServiceForHandler() *MockRoleServiceForHandler {
	return &MockRoleServiceForHandler{
		roles: make(map[uuid.UUID]db.RoleWithPermissions),
	}
}

func (m *MockRoleServiceForHandler) SetError(shouldFail bool, errorMsg string) {
	if shouldFail {
		m.err = fmt.Errorf(errorMsg)
	} else {
		m.err = nil
	}
}

func (m *MockRoleServiceForHandler) SetCreateRoleError(err error) {
	m.createErr = err
}

func (m *MockRoleServiceForHandler) SetUpdateRoleError(err error) {
	m.updateErr = err
}

func (m *MockRoleServiceForHandler) SetDeleteRoleError(err error) {
	m.deleteErr = err
}

func (m *MockRoleServiceForHandler) GetRoles() ([]db.RoleWithPermissions, error) {
	if m.err != nil {
		return nil, m.err
	}

	// Initialize as empty slice instead of nil to ensure JSON marshals as [] not null
	roles := make([]db.RoleWithPermissions, 0)
	for _, role := range m.roles {
		roles = append(roles, role)
	}
	return roles, nil
}

func (m *MockRoleServiceForHandler) GetRole(roleID uuid.UUID) (*db.RoleWithPermissions, error) {
	if m.err != nil {
		return nil, m.err
	}

	role, exists := m.roles[roleID]
	if !exists {
		return nil, nil
	}
	return &role, nil
}

func (m *MockRoleServiceForHandler) CreateRole(req services.CreateRoleRequest) (*db.RoleWithPermissions, error) {
	if m.err != nil {
		return nil, m.err
	}
	if m.createErr != nil {
		return nil, m.createErr
	}

	role := db.RoleWithPermissions{
		Role: db.Role{
			ID:          uuid.New(),
			Name:        req.Name,
			Description: req.Description,
		},
		Permissions: []db.Permission{},
	}

	// Convert service permissions to db permissions
	for _, perm := range req.Permissions {
		dbPerm := db.Permission{
			ID:          uuid.New(),
			Name:        perm.Action + ":" + perm.Resource,
			Description: perm.Action + " access to " + perm.Resource,
			Action:      perm.Action,
			Resource:    perm.Resource,
		}
		role.Permissions = append(role.Permissions, dbPerm)
	}

	m.roles[role.Role.ID] = role
	return &role, nil
}

func (m *MockRoleServiceForHandler) UpdateRole(roleID uuid.UUID, req services.UpdateRoleRequest) (*db.RoleWithPermissions, error) {
	if m.err != nil {
		return nil, m.err
	}
	if m.updateErr != nil {
		return nil, m.updateErr
	}

	role, exists := m.roles[roleID]
	if !exists {
		return nil, fmt.Errorf("role not found")
	}

	role.Role.Name = req.Name
	role.Role.Description = req.Description
	role.Permissions = []db.Permission{}

	// Convert service permissions to db permissions
	for _, perm := range req.Permissions {
		dbPerm := db.Permission{
			ID:          uuid.New(),
			Name:        perm.Action + ":" + perm.Resource,
			Description: perm.Action + " access to " + perm.Resource,
			Action:      perm.Action,
			Resource:    perm.Resource,
		}
		role.Permissions = append(role.Permissions, dbPerm)
	}

	m.roles[roleID] = role
	return &role, nil
}

func (m *MockRoleServiceForHandler) DeleteRole(roleID uuid.UUID) error {
	if m.err != nil {
		return m.err
	}
	if m.deleteErr != nil {
		return m.deleteErr
	}

	delete(m.roles, roleID)
	return nil
}

// TestRoleHandler_GetRoles testuje endpoint GET /roles
func TestRoleHandler_GetRoles(t *testing.T) {
	// Arrange
	mockService := NewMockRoleServiceForHandler()
	handler := apphandlers.NewRoleHandler(mockService, NewMockAuthorizationService())

	// Add test role
	testRole := db.RoleWithPermissions{
		Role: db.Role{
			ID:          uuid.New(),
			Name:        "test-role",
			Description: "Test role",
		},
		Permissions: []db.Permission{},
	}
	mockService.roles[testRole.Role.ID] = testRole

	req, err := http.NewRequest("GET", "/roles", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()

	// Act
	handler.GetRoles(rr, req)

	// Assert
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	var roles []db.RoleWithPermissions
	err = json.Unmarshal(rr.Body.Bytes(), &roles)
	if err != nil {
		t.Errorf("Failed to unmarshal response: %v", err)
	}

	if len(roles) != 1 {
		t.Errorf("Expected 1 role, got %d", len(roles))
	}
}

// TestRoleHandler_GetRole testuje endpoint GET /roles/{roleId}
func TestRoleHandler_GetRole(t *testing.T) {
	// Arrange
	mockService := NewMockRoleServiceForHandler()
	handler := apphandlers.NewRoleHandler(mockService, NewMockAuthorizationService())

	roleID := uuid.New()
	testRole := db.RoleWithPermissions{
		Role: db.Role{
			ID:          roleID,
			Name:        "test-role",
			Description: "Test role",
		},
		Permissions: []db.Permission{},
	}
	mockService.roles[roleID] = testRole

	req, err := http.NewRequest("GET", "/roles/"+roleID.String(), nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/roles/{roleId}", handler.GetRole).Methods("GET")

	// Act
	router.ServeHTTP(rr, req)

	// Assert
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	var role db.RoleWithPermissions
	err = json.Unmarshal(rr.Body.Bytes(), &role)
	if err != nil {
		t.Errorf("Failed to unmarshal response: %v", err)
	}

	if role.Role.Name != "test-role" {
		t.Errorf("Expected role name 'test-role', got '%s'", role.Role.Name)
	}
}

// TestRoleHandler_GetRoleNotFound tests GET /roles/{roleId} endpoint for non-existent role
func TestRoleHandler_GetRoleNotFound(t *testing.T) {
	// Arrange
	mockService := NewMockRoleServiceForHandler()
	handler := apphandlers.NewRoleHandler(mockService, NewMockAuthorizationService())

	roleID := uuid.New()

	req, err := http.NewRequest("GET", "/roles/"+roleID.String(), nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/roles/{roleId}", handler.GetRole).Methods("GET")

	// Act
	router.ServeHTTP(rr, req)

	// Assert
	if status := rr.Code; status != http.StatusNotFound {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusNotFound)
	}
}

// TestRoleHandler_CreateRole testuje endpoint POST /roles
func TestRoleHandler_CreateRole(t *testing.T) {
	// Arrange
	mockService := NewMockRoleServiceForHandler()
	mockAuthz := NewMockAuthorizationService()
	mockAuthz.Allow("roles:edit")
	handler := apphandlers.NewRoleHandler(mockService, mockAuthz)

	reqBody := services.CreateRoleRequest{
		Name:        "new-role",
		Description: "New role description",
		Permissions: []services.Permission{
			{Action: "read", Resource: "users"},
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		t.Fatal(err)
	}

	req, err := http.NewRequest("POST", "/roles", bytes.NewBuffer(bodyBytes))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	actorID := uuid.New()
	req.Header.Set("X-User-ID", actorID.String())

	rr := httptest.NewRecorder()

	// Act
	handler.CreateRole(rr, req)

	// Assert
	if status := rr.Code; status != http.StatusCreated {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusCreated)
	}

	var role db.RoleWithPermissions
	err = json.Unmarshal(rr.Body.Bytes(), &role)
	if err != nil {
		t.Errorf("Failed to unmarshal response: %v", err)
	}

	if role.Role.Name != reqBody.Name {
		t.Errorf("Expected role name '%s', got '%s'", reqBody.Name, role.Role.Name)
	}
}

func TestRoleHandler_CreateRoleForbidden(t *testing.T) {
	mockService := NewMockRoleServiceForHandler()
	mockAuthz := NewMockAuthorizationService()
	handler := apphandlers.NewRoleHandler(mockService, mockAuthz)

	reqBody := services.CreateRoleRequest{
		Name:        "new-role",
		Description: "New role description",
		Permissions: []services.Permission{
			{Action: "read", Resource: "users"},
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		t.Fatal(err)
	}

	req, err := http.NewRequest("POST", "/roles", bytes.NewBuffer(bodyBytes))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", uuid.New().String())

	rr := httptest.NewRecorder()

	handler.CreateRole(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, rr.Code)
	}
}

func TestRoleHandler_CreateRolePermissionNotFound(t *testing.T) {
	mockService := NewMockRoleServiceForHandler()
	mockAuthz := NewMockAuthorizationService()
	mockAuthz.Allow("roles:edit")
	mockService.SetCreateRoleError(&services.PermissionNotFoundError{Resource: "reports", Action: "edit"})
	handler := apphandlers.NewRoleHandler(mockService, mockAuthz)

	reqBody := services.CreateRoleRequest{
		Name:        "new-role",
		Description: "New role description",
		Permissions: []services.Permission{
			{Action: "edit", Resource: "reports"},
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		t.Fatal(err)
	}

	req, err := http.NewRequest("POST", "/roles", bytes.NewBuffer(bodyBytes))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", uuid.New().String())

	rr := httptest.NewRecorder()

	handler.CreateRole(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

// TestRoleHandler_CreateRoleInvalidJSON tests POST /roles endpoint with invalid JSON
func TestRoleHandler_CreateRoleInvalidJSON(t *testing.T) {
	// Arrange
	mockService := NewMockRoleServiceForHandler()
	mockAuthz := NewMockAuthorizationService()
	mockAuthz.Allow("roles:edit")
	handler := apphandlers.NewRoleHandler(mockService, mockAuthz)

	req, err := http.NewRequest("POST", "/roles", bytes.NewBuffer([]byte("invalid json")))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", uuid.New().String())

	rr := httptest.NewRecorder()

	// Act
	handler.CreateRole(rr, req)

	// Assert
	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusBadRequest)
	}
}

// TestRoleHandler_UpdateRole testuje endpoint PUT /roles/{roleId}
func TestRoleHandler_UpdateRole(t *testing.T) {
	// Arrange
	mockService := NewMockRoleServiceForHandler()
	mockAuthz := NewMockAuthorizationService()
	mockAuthz.Allow("roles:edit")
	handler := apphandlers.NewRoleHandler(mockService, mockAuthz)

	roleID := uuid.New()
	testRole := db.RoleWithPermissions{
		Role: db.Role{
			ID:          roleID,
			Name:        "old-role",
			Description: "Old description",
		},
		Permissions: []db.Permission{},
	}
	mockService.roles[roleID] = testRole

	reqBody := services.UpdateRoleRequest{
		Name:        "updated-role",
		Description: "Updated description",
		Permissions: []services.Permission{
			{Action: "write", Resource: "posts"},
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		t.Fatal(err)
	}

	req, err := http.NewRequest("PUT", "/roles/"+roleID.String(), bytes.NewBuffer(bodyBytes))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", uuid.New().String())

	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/roles/{roleId}", handler.UpdateRole).Methods("PUT")

	// Act
	router.ServeHTTP(rr, req)

	// Assert
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	var role db.RoleWithPermissions
	err = json.Unmarshal(rr.Body.Bytes(), &role)
	if err != nil {
		t.Errorf("Failed to unmarshal response: %v", err)
	}

	if role.Role.Name != reqBody.Name {
		t.Errorf("Expected role name '%s', got '%s'", reqBody.Name, role.Role.Name)
	}
}

func TestRoleHandler_UpdateRolePermissionNotFound(t *testing.T) {
	mockService := NewMockRoleServiceForHandler()
	mockAuthz := NewMockAuthorizationService()
	mockAuthz.Allow("roles:edit")
	mockService.SetUpdateRoleError(&services.PermissionNotFoundError{Resource: "reports", Action: "archive"})
	handler := apphandlers.NewRoleHandler(mockService, mockAuthz)

	roleID := uuid.New()
	reqBody := services.UpdateRoleRequest{
		Name:        "updated-role",
		Description: "Updated description",
		Permissions: []services.Permission{
			{Action: "archive", Resource: "reports"},
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		t.Fatal(err)
	}

	req, err := http.NewRequest("PUT", "/roles/"+roleID.String(), bytes.NewBuffer(bodyBytes))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", uuid.New().String())
	req = mux.SetURLVars(req, map[string]string{"roleId": roleID.String()})

	rr := httptest.NewRecorder()
	handler.UpdateRole(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

// TestRoleHandler_DeleteRole testuje endpoint DELETE /roles/{roleId}
func TestRoleHandler_DeleteRole(t *testing.T) {
	// Arrange
	mockService := NewMockRoleServiceForHandler()
	mockAuthz := NewMockAuthorizationService()
	mockAuthz.Allow("roles:edit")
	handler := apphandlers.NewRoleHandler(mockService, mockAuthz)

	roleID := uuid.New()
	testRole := db.RoleWithPermissions{
		Role: db.Role{
			ID:          roleID,
			Name:        "role-to-delete",
			Description: "Role to delete",
		},
		Permissions: []db.Permission{},
	}
	mockService.roles[roleID] = testRole

	req, err := http.NewRequest("DELETE", "/roles/"+roleID.String(), nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/roles/{roleId}", handler.DeleteRole).Methods("DELETE")
	req.Header.Set("X-User-ID", uuid.New().String())

	// Act
	router.ServeHTTP(rr, req)

	// Assert
	if status := rr.Code; status != http.StatusNoContent {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusNoContent)
	}

	// Verify role was deleted
	_, exists := mockService.roles[roleID]
	if exists {
		t.Error("Expected role to be deleted")
	}
}

// TestRoleHandler_InvalidUUID tests handler with invalid UUID
func TestRoleHandler_InvalidUUID(t *testing.T) {
	// Arrange
	mockService := NewMockRoleServiceForHandler()
	handler := apphandlers.NewRoleHandler(mockService, NewMockAuthorizationService())

	req, err := http.NewRequest("GET", "/roles/invalid-uuid", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	router := mux.NewRouter()
	router.HandleFunc("/roles/{roleId}", handler.GetRole).Methods("GET")

	// Act
	router.ServeHTTP(rr, req)

	// Assert
	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusBadRequest)
	}
}
