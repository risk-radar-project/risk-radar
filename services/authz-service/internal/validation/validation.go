package validation

import (
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"
)

const (
	MaxRoleNameLength        = 100
	MaxRoleDescriptionLength = 500
	MaxActionLength          = 50
	MaxResourceLength        = 100
	MinRoleNameLength        = 2
	MaxUUIDLength            = 36 // Standard UUID format: 8-4-4-4-12 = 36 characters
)

var (
	// Allow alphanumeric, spaces, hyphens, underscores
	roleNameRegex = regexp.MustCompile(`^[a-zA-Z0-9\s\-_]+$`)
	// Allow alphanumeric, colons, hyphens, underscores, dots, slashes
	actionResourceRegex = regexp.MustCompile(`^[a-zA-Z0-9:\-_.\/]+$`)
)

// ValidationError represents a validation error
type ValidationError struct {
	Field   string
	Message string
}

func (e ValidationError) Error() string {
	return fmt.Sprintf("validation error in field '%s': %s", e.Field, e.Message)
}

// ValidateRoleName validates role name
func ValidateRoleName(name string) error {
	name = strings.TrimSpace(name)

	if name == "" {
		return ValidationError{Field: "name", Message: "name is required"}
	}

	if utf8.RuneCountInString(name) < MinRoleNameLength {
		return ValidationError{Field: "name", Message: fmt.Sprintf("name must be at least %d characters long", MinRoleNameLength)}
	}

	if utf8.RuneCountInString(name) > MaxRoleNameLength {
		return ValidationError{Field: "name", Message: fmt.Sprintf("name must not exceed %d characters", MaxRoleNameLength)}
	}

	if !roleNameRegex.MatchString(name) {
		return ValidationError{Field: "name", Message: "name contains invalid characters (only alphanumeric, spaces, hyphens, underscores allowed)"}
	}

	return nil
}

// ValidateRoleDescription validates role description
func ValidateRoleDescription(description string) error {
	description = strings.TrimSpace(description)

	if utf8.RuneCountInString(description) > MaxRoleDescriptionLength {
		return ValidationError{Field: "description", Message: fmt.Sprintf("description must not exceed %d characters", MaxRoleDescriptionLength)}
	}

	return nil
}

// ValidatePermissionAction validates permission action
func ValidatePermissionAction(action string) error {
	action = strings.TrimSpace(action)

	if action == "" {
		return ValidationError{Field: "action", Message: "action is required"}
	}

	if utf8.RuneCountInString(action) > MaxActionLength {
		return ValidationError{Field: "action", Message: fmt.Sprintf("action must not exceed %d characters", MaxActionLength)}
	}

	if !actionResourceRegex.MatchString(action) {
		return ValidationError{Field: "action", Message: "action contains invalid characters"}
	}

	return nil
}

// ValidatePermissionResource validates permission resource
func ValidatePermissionResource(resource string) error {
	resource = strings.TrimSpace(resource)

	if resource == "" {
		return ValidationError{Field: "resource", Message: "resource is required"}
	}

	if utf8.RuneCountInString(resource) > MaxResourceLength {
		return ValidationError{Field: "resource", Message: fmt.Sprintf("resource must not exceed %d characters", MaxResourceLength)}
	}

	if !actionResourceRegex.MatchString(resource) {
		return ValidationError{Field: "resource", Message: "resource contains invalid characters"}
	}

	return nil
}

// ValidatePermissions validates a list of permissions
func ValidatePermissions(permissions []interface{}) error {
	for i, perm := range permissions {
		permMap, ok := perm.(map[string]interface{})
		if !ok {
			return ValidationError{Field: fmt.Sprintf("permissions[%d]", i), Message: "invalid permission format"}
		}

		action, ok := permMap["action"].(string)
		if !ok {
			return ValidationError{Field: fmt.Sprintf("permissions[%d].action", i), Message: "action must be a string"}
		}

		resource, ok := permMap["resource"].(string)
		if !ok {
			return ValidationError{Field: fmt.Sprintf("permissions[%d].resource", i), Message: "resource must be a string"}
		}

		if err := ValidatePermissionAction(action); err != nil {
			return ValidationError{Field: fmt.Sprintf("permissions[%d].action", i), Message: err.Error()}
		}

		if err := ValidatePermissionResource(resource); err != nil {
			return ValidationError{Field: fmt.Sprintf("permissions[%d].resource", i), Message: err.Error()}
		}
	}

	return nil
}

// ValidateUUIDString validates UUID string before parsing
func ValidateUUIDString(uuidStr string) error {
	if uuidStr == "" {
		return ValidationError{Field: "uuid", Message: "UUID is required"}
	}

	if len(uuidStr) > MaxUUIDLength {
		return ValidationError{Field: "uuid", Message: fmt.Sprintf("UUID must not exceed %d characters", MaxUUIDLength)}
	}

	// Basic format check for UUID pattern (8-4-4-4-12)
	if len(uuidStr) != 36 {
		return ValidationError{Field: "uuid", Message: "UUID must be exactly 36 characters long"}
	}

	// Check hyphen positions first
	if uuidStr[8] != '-' || uuidStr[13] != '-' || uuidStr[18] != '-' || uuidStr[23] != '-' {
		return ValidationError{Field: "uuid", Message: "UUID must have hyphens at positions 8, 13, 18, 23"}
	}

	// Check if it contains only valid UUID characters
	for i, char := range uuidStr {
		if i == 8 || i == 13 || i == 18 || i == 23 {
			// Already checked hyphens above
			continue
		} else {
			if !((char >= '0' && char <= '9') || (char >= 'a' && char <= 'f') || (char >= 'A' && char <= 'F')) {
				return ValidationError{Field: "uuid", Message: "UUID must contain only hexadecimal characters and hyphens"}
			}
		}
	}

	return nil
}
