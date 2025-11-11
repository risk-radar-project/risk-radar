package services

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"authz-service/internal/db"
	apphandlers "authz-service/internal/handlers"
	"authz-service/internal/services"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// TestEmptyArraysNotNull tests if empty lists return [] instead of null
func TestEmptyArraysNotNull(t *testing.T) {
	// Test empty user roles
	t.Run("Empty user roles should return [] not null", func(t *testing.T) {
		// Arrange
		userRoleRepo := NewMockUserRoleRepository()
		permissionRepo := NewMockPermissionRepositoryForAuthz()
		authzService := services.NewAuthzService(userRoleRepo, permissionRepo)
		handler := apphandlers.NewAuthzHandler(authzService)

		userID := uuid.New()

		// Act
		req := httptest.NewRequest("GET", "/users/"+userID.String()+"/roles", nil)
		req = mux.SetURLVars(req, map[string]string{"userId": userID.String()})
		w := httptest.NewRecorder()

		handler.GetUserRoles(w, req)

		// Assert
		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
		}

		var result []db.Role
		err := json.Unmarshal(w.Body.Bytes(), &result)
		if err != nil {
			t.Fatalf("Failed to unmarshal response: %v", err)
		}

		// Check if it's empty list, not null
		if result == nil {
			t.Error("Expected empty array [], got null")
		}

		if len(result) != 0 {
			t.Errorf("Expected empty array, got %d elements", len(result))
		}

		// Check raw JSON - should be [] not null
		responseBody := w.Body.String()
		if responseBody != "[]" && responseBody != "[]\n" {
			t.Errorf("Expected '[]' or '[]\n', got '%s'", responseBody)
		}
	})

	// Test empty user permissions
	t.Run("Empty user permissions should return [] not null", func(t *testing.T) {
		// Arrange
		userRoleRepo := NewMockUserRoleRepository()
		permissionRepo := NewMockPermissionRepositoryForAuthz()
		authzService := services.NewAuthzService(userRoleRepo, permissionRepo)
		handler := apphandlers.NewAuthzHandler(authzService)

		userID := uuid.New()

		// Act
		req := httptest.NewRequest("GET", "/users/"+userID.String()+"/permissions", nil)
		req = mux.SetURLVars(req, map[string]string{"userId": userID.String()})
		w := httptest.NewRecorder()

		handler.GetUserPermissions(w, req)

		// Assert
		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
		}

		var result []db.Permission
		err := json.Unmarshal(w.Body.Bytes(), &result)
		if err != nil {
			t.Fatalf("Failed to unmarshal response: %v", err)
		}

		// Check if it's empty list, not null
		if result == nil {
			t.Error("Expected empty array [], got null")
		}

		if len(result) != 0 {
			t.Errorf("Expected empty array, got %d elements", len(result))
		}

		// Check raw JSON - should be [] not null
		responseBody := w.Body.String()
		if responseBody != "[]" && responseBody != "[]\n" {
			t.Errorf("Expected '[]' or '[]\n', got '%s'", responseBody)
		}
	})

	// Test empty roles list
	t.Run("Empty roles list should return [] not null", func(t *testing.T) {
		// Arrange
		roleRepo := NewMockRoleRepository()
		permissionRepo := NewMockPermissionRepository()
		roleService := services.NewRoleService(roleRepo, permissionRepo)
		handler := apphandlers.NewRoleHandler(roleService, NewMockAuthorizationService())

		// Act
		req := httptest.NewRequest("GET", "/roles", nil)
		w := httptest.NewRecorder()

		handler.GetRoles(w, req)

		// Assert
		if w.Code != http.StatusOK {
			t.Errorf("Expected status %d, got %d", http.StatusOK, w.Code)
		}

		var result []db.RoleWithPermissions
		err := json.Unmarshal(w.Body.Bytes(), &result)
		if err != nil {
			t.Fatalf("Failed to unmarshal response: %v", err)
		}

		// Check if it's empty list, not null
		if result == nil {
			t.Error("Expected empty array [], got null")
		}

		if len(result) != 0 {
			t.Errorf("Expected empty array, got %d elements", len(result))
		}

		// Check raw JSON - should be [] not null
		responseBody := w.Body.String()
		if responseBody != "[]" && responseBody != "[]\n" {
			t.Errorf("Expected '[]' or '[]\n', got '%s'", responseBody)
		}
	})
}
