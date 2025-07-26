package services

import (
	"testing"

	"github.com/google/uuid"
)

// TestPermissionService_GetPermissions tests getting all permissions
func TestPermissionService_GetPermissions(t *testing.T) {
	// Arrange
	permRepo := NewMockPermissionRepository()
	service := NewPermissionService(permRepo)

	// Add some test permissions
	perm1ID := permRepo.AddPermission("users:read", "Read user profiles", "read", "users")
	perm2ID := permRepo.AddPermission("reports:create", "Create new reports", "create", "reports")

	// Act
	permissions, err := service.GetPermissions()

	// Assert
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if len(permissions) != 2 {
		t.Errorf("Expected 2 permissions, got %d", len(permissions))
	}

	// Verify the permissions are returned
	found := make(map[uuid.UUID]bool)
	for _, perm := range permissions {
		found[perm.ID] = true
	}

	if !found[perm1ID] {
		t.Error("Expected to find first permission")
	}
	if !found[perm2ID] {
		t.Error("Expected to find second permission")
	}
}

// TestPermissionService_GetPermission tests getting a specific permission
func TestPermissionService_GetPermission(t *testing.T) {
	// Arrange
	permRepo := NewMockPermissionRepository()
	service := NewPermissionService(permRepo)

	// Add a test permission
	permID := permRepo.AddPermission("users:read", "Read user profiles", "read", "users")

	// Act
	permission, err := service.GetPermission(permID)

	// Assert
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if permission == nil {
		t.Fatal("Expected permission to be found, got nil")
	}

	if permission.ID != permID {
		t.Errorf("Expected permission ID %v, got %v", permID, permission.ID)
	}

	if permission.Name != "users:read" {
		t.Errorf("Expected permission name 'users:read', got '%s'", permission.Name)
	}
}

// TestPermissionService_GetPermissionNotFound tests getting a non-existent permission
func TestPermissionService_GetPermissionNotFound(t *testing.T) {
	// Arrange
	permRepo := NewMockPermissionRepository()
	service := NewPermissionService(permRepo)

	nonExistentID := uuid.New()

	// Act
	permission, err := service.GetPermission(nonExistentID)

	// Assert
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if permission != nil {
		t.Errorf("Expected nil permission, got %v", permission)
	}
}

// TestPermissionService_CreatePermission tests creating a new permission
func TestPermissionService_CreatePermission(t *testing.T) {
	// Arrange
	permRepo := NewMockPermissionRepository()
	service := NewPermissionService(permRepo)

	req := CreatePermissionRequest{
		Resource:    "test",
		Action:      "action",
		Description: "Test permission",
	}

	// Act
	permission, err := service.CreatePermission(req)

	// Assert
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if permission == nil {
		t.Fatal("Expected permission to be created, got nil")
	}

	if permission.Name != "test:action" {
		t.Errorf("Expected permission name 'test:action', got '%s'", permission.Name)
	}

	if permission.Resource != "test" {
		t.Errorf("Expected resource 'test', got '%s'", permission.Resource)
	}

	if permission.Action != "action" {
		t.Errorf("Expected action 'action', got '%s'", permission.Action)
	}

	if permission.Description != "Test permission" {
		t.Errorf("Expected description 'Test permission', got '%s'", permission.Description)
	}
}

// TestPermissionService_CreatePermissionValidation tests validation in create permission
func TestPermissionService_CreatePermissionValidation(t *testing.T) {
	// Arrange
	permRepo := NewMockPermissionRepository()
	service := NewPermissionService(permRepo)

	testCases := []struct {
		name        string
		req         CreatePermissionRequest
		expectError bool
	}{
		{
			name: "Valid request",
			req: CreatePermissionRequest{
				Resource:    "users",
				Action:      "read",
				Description: "Read users",
			},
			expectError: false,
		},
		{
			name: "Invalid resource with colon",
			req: CreatePermissionRequest{
				Resource:    "users:invalid",
				Action:      "read",
				Description: "Read users",
			},
			expectError: true,
		},
		{
			name: "Invalid action with colon",
			req: CreatePermissionRequest{
				Resource:    "users",
				Action:      "read:invalid",
				Description: "Read users",
			},
			expectError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Act
			_, err := service.CreatePermission(tc.req)

			// Assert
			if tc.expectError && err == nil {
				t.Error("Expected error but got none")
			}
			if !tc.expectError && err != nil {
				t.Errorf("Expected no error but got: %v", err)
			}
		})
	}
}

// TestPermissionService_UpdatePermission tests updating a permission
func TestPermissionService_UpdatePermission(t *testing.T) {
	// Arrange
	permRepo := NewMockPermissionRepository()
	service := NewPermissionService(permRepo)

	// Add a test permission first
	existingPermID := permRepo.AddPermission("users:read", "Read users", "read", "users")

	req := UpdatePermissionRequest{
		Resource:    "users",
		Action:      "write",
		Description: "Updated description",
	}

	// Act
	permission, err := service.UpdatePermission(existingPermID, req)

	// Assert
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}

	if permission == nil {
		t.Fatal("Expected permission to be updated, got nil")
	}

	if permission.Name != "users:write" {
		t.Errorf("Expected permission name 'users:write', got '%s'", permission.Name)
	}
}

// TestPermissionService_DeletePermission tests deleting a permission
func TestPermissionService_DeletePermission(t *testing.T) {
	// Arrange
	permRepo := NewMockPermissionRepository()
	service := NewPermissionService(permRepo)

	// Add a test permission first
	permID := permRepo.AddPermission("users:read", "Read users", "read", "users")

	// Act
	err := service.DeletePermission(permID)

	// Assert
	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
}
