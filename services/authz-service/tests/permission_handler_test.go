package services

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"authz-service/internal/db"
	apphandlers "authz-service/internal/handlers"
	svc "authz-service/internal/services"

	"github.com/google/uuid"
)

type StubPermissionService struct {
	createCalled bool
}

func (s *StubPermissionService) GetPermissions() ([]db.Permission, error) {
	return []db.Permission{}, nil
}

func (s *StubPermissionService) GetPermission(permissionID uuid.UUID) (*db.Permission, error) {
	return nil, nil
}

func (s *StubPermissionService) CreatePermission(req svc.CreatePermissionRequest) (*db.Permission, error) {
	s.createCalled = true
	return &db.Permission{}, nil
}

func (s *StubPermissionService) UpdatePermission(permissionID uuid.UUID, req svc.UpdatePermissionRequest) (*db.Permission, error) {
	return nil, nil
}

func (s *StubPermissionService) DeletePermission(permissionID uuid.UUID) error {
	return nil
}

func TestPermissionHandler_CreatePermissionForbidden(t *testing.T) {
	stubService := &StubPermissionService{}
	mockAuthz := NewMockAuthorizationService()
	handler := apphandlers.NewPermissionHandler(stubService, mockAuthz)

	request := svc.CreatePermissionRequest{
		Resource:    "reports",
		Action:      "create",
		Description: "Create reports",
	}

	payload, err := json.Marshal(request)
	if err != nil {
		t.Fatalf("failed to marshal request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/permissions", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", uuid.New().String())

	rr := httptest.NewRecorder()
	handler.CreatePermission(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, rr.Code)
	}

	if stubService.createCalled {
		t.Fatal("expected CreatePermission not to be called when unauthorized")
	}
}
