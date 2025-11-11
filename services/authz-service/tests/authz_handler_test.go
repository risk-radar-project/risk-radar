package services

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	apphandlers "authz-service/internal/handlers"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

func TestAuthzHandler_HasPermissionQueryContract(t *testing.T) {
	mockAuthz := NewMockAuthorizationService()
	mockAuthz.Allow("reports:read")

	handler := apphandlers.NewAuthzHandler(mockAuthz)
	userID := uuid.New()

	req := httptest.NewRequest(http.MethodGet, "/has-permission?userId="+userID.String()+"&action=reports:read", nil)
	rr := httptest.NewRecorder()

	handler.HasPermission(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rr.Code)
	}

	var resp struct {
		HasPermission bool `json:"has_permission"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if !resp.HasPermission {
		t.Fatalf("expected has_permission true")
	}
}

func TestAuthzHandler_AssignRoleForbidden(t *testing.T) {
	mockAuthz := NewMockAuthorizationService()
	handler := apphandlers.NewAuthzHandler(mockAuthz)

	userID := uuid.New()
	roleID := uuid.New()

	body := map[string]string{"role_id": roleID.String()}
	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("failed to marshal body: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/users/"+userID.String()+"/roles", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", uuid.New().String())
	req = mux.SetURLVars(req, map[string]string{"userId": userID.String()})

	rr := httptest.NewRecorder()
	handler.AssignRole(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, rr.Code)
	}
}

func TestAuthzHandler_RemoveRoleForbidden(t *testing.T) {
	mockAuthz := NewMockAuthorizationService()
	handler := apphandlers.NewAuthzHandler(mockAuthz)

	userID := uuid.New()
	roleID := uuid.New()

	req := httptest.NewRequest(http.MethodDelete, "/users/"+userID.String()+"/roles/"+roleID.String(), nil)
	req.Header.Set("X-User-ID", uuid.New().String())
	req = mux.SetURLVars(req, map[string]string{
		"userId": userID.String(),
		"roleId": roleID.String(),
	})

	rr := httptest.NewRecorder()
	handler.RemoveRole(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, rr.Code)
	}
}
