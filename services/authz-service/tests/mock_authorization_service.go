package services

import (
	"authz-service/internal/db"
	svc "authz-service/internal/services"

	"github.com/google/uuid"
)

// MockAuthorizationService provides configurable responses for authorization checks in handler tests.
type MockAuthorizationService struct {
	allowed map[string]bool
	err     error
}

func NewMockAuthorizationService() *MockAuthorizationService {
	return &MockAuthorizationService{
		allowed: make(map[string]bool),
	}
}

func (m *MockAuthorizationService) Allow(permission string) {
	m.allowed[permission] = true
}

func (m *MockAuthorizationService) Deny(permission string) {
	m.allowed[permission] = false
}

func (m *MockAuthorizationService) SetError(err error) {
	m.err = err
}

func (m *MockAuthorizationService) HasPermission(userID uuid.UUID, permission string) (bool, error) {
	if m.err != nil {
		return false, m.err
	}

	allowed, ok := m.allowed[permission]
	if !ok {
		return false, nil
	}
	return allowed, nil
}

func (m *MockAuthorizationService) GetUserPermissions(userID uuid.UUID) ([]db.Permission, error) {
	return []db.Permission{}, nil
}

func (m *MockAuthorizationService) GetUserRoles(userID uuid.UUID) ([]db.Role, error) {
	return []db.Role{}, nil
}

func (m *MockAuthorizationService) AssignRole(userID uuid.UUID, req svc.AssignRoleRequest) error {
	return nil
}

func (m *MockAuthorizationService) RemoveRole(userID, roleID uuid.UUID) error {
	return nil
}
