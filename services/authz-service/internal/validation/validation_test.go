package validation

import (
	"testing"
)

func TestValidateRoleName(t *testing.T) {
	tests := []struct {
		name        string
		roleName    string
		expectError bool
	}{
		{"valid name", "admin", false},
		{"valid name with spaces", "Super Admin", false},
		{"valid name with hyphen", "user-role", false},
		{"valid name with underscore", "user_role", false},
		{"empty name", "", true},
		{"too short name", "a", true},
		{"too long name", string(make([]byte, 101)), true},
		{"invalid characters", "admin@role", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateRoleName(tt.roleName)
			if tt.expectError && err == nil {
				t.Errorf("Expected error for role name '%s', but got none", tt.roleName)
			}
			if !tt.expectError && err != nil {
				t.Errorf("Expected no error for role name '%s', but got: %v", tt.roleName, err)
			}
		})
	}
}

func TestValidatePermissionAction(t *testing.T) {
	tests := []struct {
		name        string
		action      string
		expectError bool
	}{
		{"valid action", "read", false},
		{"valid action with colon", "user:read", false},
		{"empty action", "", true},
		{"too long action", string(make([]byte, 51)), true},
		{"invalid characters", "read@user", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePermissionAction(tt.action)
			if tt.expectError && err == nil {
				t.Errorf("Expected error for action '%s', but got none", tt.action)
			}
			if !tt.expectError && err != nil {
				t.Errorf("Expected no error for action '%s', but got: %v", tt.action, err)
			}
		})
	}
}

func TestValidatePermissionResource(t *testing.T) {
	tests := []struct {
		name        string
		resource    string
		expectError bool
	}{
		{"valid resource", "users", false},
		{"valid resource with slash", "api/users", false},
		{"empty resource", "", true},
		{"too long resource", string(make([]byte, 101)), true},
		{"invalid characters", "users@api", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePermissionResource(tt.resource)
			if tt.expectError && err == nil {
				t.Errorf("Expected error for resource '%s', but got none", tt.resource)
			}
			if !tt.expectError && err != nil {
				t.Errorf("Expected no error for resource '%s', but got: %v", tt.resource, err)
			}
		})
	}
}

func TestValidatePermissions(t *testing.T) {
	validPermissions := []interface{}{
		map[string]interface{}{
			"action":   "read",
			"resource": "users",
		},
		map[string]interface{}{
			"action":   "write",
			"resource": "api/posts",
		},
	}

	invalidPermissions := []interface{}{
		map[string]interface{}{
			"action":   "",
			"resource": "users",
		},
	}

	invalidFormat := []interface{}{
		"not_a_map",
	}

	tests := []struct {
		name        string
		permissions []interface{}
		expectError bool
	}{
		{"valid permissions", validPermissions, false},
		{"invalid permissions", invalidPermissions, true},
		{"invalid format", invalidFormat, true},
		{"empty permissions", []interface{}{}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePermissions(tt.permissions)
			if tt.expectError && err == nil {
				t.Errorf("Expected error for permissions, but got none")
			}
			if !tt.expectError && err != nil {
				t.Errorf("Expected no error for permissions, but got: %v", err)
			}
		})
	}
}
