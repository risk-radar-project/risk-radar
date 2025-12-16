package config

import (
	"os"
	"testing"
	"time"
)

func TestLoadConfig_EnvExpansion(t *testing.T) {
	os.Setenv("TEST_SECRET", "mysecretvalue")
	defer os.Unsetenv("TEST_SECRET")

	yamlContent := `
server:
  port: 9090
jwt:
  hmac_secret: "${TEST_SECRET}"
routes:
  - prefix: "/api/test"
    upstream: "http://localhost:8081"
`
	tmpfile, err := os.CreateTemp("", "config_*.yaml")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(tmpfile.Name())

	if _, err := tmpfile.Write([]byte(yamlContent)); err != nil {
		t.Fatal(err)
	}
	if err := tmpfile.Close(); err != nil {
		t.Fatal(err)
	}

	cfg, err := Load(tmpfile.Name())
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if cfg.JWT.HMACSecret != "mysecretvalue" {
		t.Errorf("expected 'mysecretvalue', got '%s'", cfg.JWT.HMACSecret)
	}
	if cfg.Server.Port != 9090 {
		t.Errorf("expected port 9090, got %d", cfg.Server.Port)
	}
}

func TestLoadConfig_Defaults(t *testing.T) {
	yamlContent := `
routes:
  - prefix: "/api/test"
    upstream: "http://localhost:8081"
`
	tmpfile, err := os.CreateTemp("", "config_*.yaml")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(tmpfile.Name())
	tmpfile.Write([]byte(yamlContent))
	tmpfile.Close()

	cfg, err := Load(tmpfile.Name())
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if cfg.Server.Port != 8080 {
		t.Errorf("expected default port 8080, got %d", cfg.Server.Port)
	}
	if cfg.Server.ReadTimeoutSec != 20 {
		t.Errorf("expected default read timeout 20, got %d", cfg.Server.ReadTimeoutSec)
	}
	if cfg.ReadTimeout() != 20*time.Second {
		t.Errorf("expected duration 20s, got %v", cfg.ReadTimeout())
	}
}
