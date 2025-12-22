package router

import (
	"testing"

	"api-gateway/internal/config"
)

func TestMatcher_Match(t *testing.T) {
	routes := []config.RuntimeRoute{
		{Prefix: "/api/users", Upstream: "users"},
		{Prefix: "/api/users/admin", Upstream: "admin"},
		{Prefix: "/", Upstream: "root"},
	}

	m := NewMatcher(routes)

	tests := []struct {
		path      string
		wantUp    string
		wantFound bool
	}{
		{"/api/users", "users", true},
		{"/api/users/123", "users", true},
		{"/api/users/admin", "admin", true},
		{"/api/users/admin/123", "admin", true},
		{"/other", "root", true},
		{"/", "root", true},
	}

	for _, tt := range tests {
		route, found := m.Match(tt.path)
		if found != tt.wantFound {
			t.Errorf("Match(%s) found = %v, want %v", tt.path, found, tt.wantFound)
		}
		if found && route.Upstream != tt.wantUp {
			t.Errorf("Match(%s) upstream = %v, want %v", tt.path, route.Upstream, tt.wantUp)
		}
	}
}

func TestMatchPrefix(t *testing.T) {
	tests := []struct {
		path   string
		prefix string
		want   bool
	}{
		{"/api/users", "/api/users", true},
		{"/api/users/123", "/api/users", true},
		{"/api/users123", "/api/users", false},
		{"/", "/", true},
		{"/any", "/", true},
	}

	for _, tt := range tests {
		if got := matchPrefix(tt.path, tt.prefix); got != tt.want {
			t.Errorf("matchPrefix(%s, %s) = %v, want %v", tt.path, tt.prefix, got, tt.want)
		}
	}
}
