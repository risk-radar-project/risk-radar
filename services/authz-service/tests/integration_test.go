package services

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"authz-service/internal/db"
	apphandlers "authz-service/internal/handlers"
	"authz-service/internal/services"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// TestIntegrationEmptyArrays checks if endpoints actually return [] instead of null
func TestIntegrationEmptyArrays(t *testing.T) {
	// Setup - using real handlers with mock services
	roleService := NewMockRoleServiceForHandler()
	authzService := &MockAuthzService{
		userPermissions: make(map[string][]db.Permission),
		userRoles:       make(map[string][]db.Role),
	}

	roleHandler := apphandlers.NewRoleHandler(roleService, authzService)
	authzHandler := apphandlers.NewAuthzHandler(authzService)

	// Setup router
	r := mux.NewRouter()
	r.HandleFunc("/roles", roleHandler.GetRoles).Methods("GET")
	r.HandleFunc("/users/{userId}/permissions", authzHandler.GetUserPermissions).Methods("GET")
	r.HandleFunc("/users/{userId}/roles", authzHandler.GetUserRoles).Methods("GET")

	testCases := []struct {
		name     string
		endpoint string
		method   string
	}{
		{
			name:     "Empty roles list",
			endpoint: "/roles",
			method:   "GET",
		},
		{
			name:     "Empty user permissions",
			endpoint: "/users/" + uuid.New().String() + "/permissions",
			method:   "GET",
		},
		{
			name:     "Empty user roles",
			endpoint: "/users/" + uuid.New().String() + "/roles",
			method:   "GET",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.endpoint, nil)
			w := httptest.NewRecorder()

			r.ServeHTTP(w, req)

			// Check status
			if w.Code != http.StatusOK {
				t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
			}

			// Check if response is empty array, not null
			responseBody := strings.TrimSpace(w.Body.String())
			if responseBody == "null" {
				t.Errorf("Endpoint %s returned null instead of empty array []", tc.endpoint)
			}

			if responseBody != "[]" {
				// Check if it's a valid JSON array
				var result interface{}
				err := json.Unmarshal(w.Body.Bytes(), &result)
				if err != nil {
					t.Errorf("Invalid JSON response: %v", err)
				}

				// Check if it's a slice
				if arr, ok := result.([]interface{}); !ok {
					t.Errorf("Expected array, got %T", result)
				} else if len(arr) != 0 {
					t.Logf("Got non-empty array with %d elements (this is OK)", len(arr))
				}
			}
		})
	}
}

// MockAuthzService for integration tests
type MockAuthzService struct {
	userPermissions map[string][]db.Permission
	userRoles       map[string][]db.Role
}

func (m *MockAuthzService) HasPermission(userID uuid.UUID, permission string) (bool, error) {
	return false, nil
}

func (m *MockAuthzService) GetUserPermissions(userID uuid.UUID) ([]db.Permission, error) {
	userKey := userID.String()
	permissions, exists := m.userPermissions[userKey]
	if !exists {
		return make([]db.Permission, 0), nil
	}
	return permissions, nil
}

func (m *MockAuthzService) GetUserRoles(userID uuid.UUID) ([]db.Role, error) {
	userKey := userID.String()
	roles, exists := m.userRoles[userKey]
	if !exists {
		return make([]db.Role, 0), nil
	}
	return roles, nil
}

func (m *MockAuthzService) AssignRole(userID uuid.UUID, req services.AssignRoleRequest) error {
	return nil
}

func (m *MockAuthzService) RemoveRole(userID, roleID uuid.UUID) error {
	return nil
}
