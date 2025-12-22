package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"api-gateway/internal/config"

	"github.com/golang-jwt/jwt/v5"
)

func TestIntegration_Gateway(t *testing.T) {
	// 1. Start Mock Upstream
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/me" {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"id": "user123", "name": "Test User"}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer upstream.Close()

	// 2. Setup Config
	secret := "testsecret"
	cfg := config.RuntimeConfig{
		Server: config.ServerConfig{
			Port:            0,
			UpstreamTimeout: 5, // 5 seconds
		},
		JWT: config.JWTConfig{
			Algorithm:  "HS256",
			HMACSecret: secret,
			Issuer:     "risk-radar",
		},
		Routes: []config.RuntimeRoute{
			{
				Prefix:       "/api/users",
				Upstream:     upstream.URL,
				AuthRequired: true,
			},
			{
				Prefix:       "/api/public",
				Upstream:     upstream.URL,
				AuthRequired: false,
			},
		},
		CORS: config.CORSConfig{
			AllowedOrigins: []string{"*"},
			AllowedMethods: []string{"GET"},
		},
	}

	// 3. Init Gateway
	handler, err := NewGatewayHandler(cfg)
	if err != nil {
		t.Fatalf("NewGatewayHandler failed: %v", err)
	}
	ts := httptest.NewServer(handler)
	defer ts.Close()

	client := ts.Client()

	// 4. Test Cases

	// Case A: Status Endpoint
	resp, err := client.Get(ts.URL + "/status")
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Errorf("status endpoint returned %d", resp.StatusCode)
	}

	// Case B: Auth Required - No Token
	resp, err = client.Get(ts.URL + "/api/users/me")
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 for missing token, got %d", resp.StatusCode)
	}

	// Case C: Auth Required - Valid Token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"iss": "risk-radar",
		"sub": "user123",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	tokenStr, _ := token.SignedString([]byte(secret))

	req, _ := http.NewRequest("GET", ts.URL+"/api/users/me", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	resp, err = client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		var buf []byte
		buf, _ = io.ReadAll(resp.Body)
		t.Errorf("expected 200 with valid token, got %d. Body: %s", resp.StatusCode, string(buf))
	}

	// Verify Response Body
	var body map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&body)
	if body["id"] != "user123" {
		t.Errorf("expected user id 'user123', got %v", body["id"])
	}

	// Case D: 404 Not Found
	resp, err = client.Get(ts.URL + "/api/unknown")
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404, got %d", resp.StatusCode)
	}
}
