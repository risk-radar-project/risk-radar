package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"api-gateway/internal/config"
)

func TestValidator_Validate_HS256(t *testing.T) {
	secret := "supersecret"
	cfg := config.JWTConfig{
		Algorithm:  "HS256",
		HMACSecret: secret,
		Issuer:     "risk-radar",
	}
	v, err := NewValidator(cfg)
	if err != nil {
		t.Fatalf("NewValidator failed: %v", err)
	}

	// Valid token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"iss": "risk-radar",
		"sub": "user123",
		"exp": time.Now().Add(time.Hour).Unix(),
		"iat": time.Now().Unix(),
	})
	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}

	sub, err := v.Validate(tokenString)
	if err != nil {
		t.Errorf("Validate failed for valid token: %v", err)
	}
	if sub != "user123" {
		t.Errorf("expected sub 'user123', got '%s'", sub)
	}

	// Invalid Issuer
	tokenBadIss := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"iss": "other-issuer",
		"sub": "user123",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	badIssString, _ := tokenBadIss.SignedString([]byte(secret))
	if _, err := v.Validate(badIssString); err == nil {
		t.Error("expected error for invalid issuer, got nil")
	}

	// Expired Token
	tokenExp := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"iss": "risk-radar",
		"sub": "user123",
		"exp": time.Now().Add(-time.Hour).Unix(),
	})
	expString, _ := tokenExp.SignedString([]byte(secret))
	if _, err := v.Validate(expString); err == nil {
		t.Error("expected error for expired token, got nil")
	}
}
