package ratelimit

import (
	"testing"
	"time"

	"api-gateway/internal/config"
)

func TestLimiter_Allow(t *testing.T) {
	window := 100 * time.Millisecond
	l := New(window)

	route := config.RuntimeRoute{
		Prefix: "/api/test",
		RateLimit: &config.RateLimitConfig{
			Anonymous:     2,
			Authenticated: 5,
		},
	}

	// Anonymous
	if !l.Allow(route, "ip1", false) {
		t.Error("req 1 should be allowed")
	}
	if !l.Allow(route, "ip1", false) {
		t.Error("req 2 should be allowed")
	}
	if l.Allow(route, "ip1", false) {
		t.Error("req 3 should be blocked (limit 2)")
	}

	// Authenticated
	if !l.Allow(route, "user1", true) {
		t.Error("auth req 1 should be allowed")
	}
	// ... consume 4 more
	for i := 0; i < 4; i++ {
		l.Allow(route, "user1", true)
	}
	if l.Allow(route, "user1", true) {
		t.Error("auth req 6 should be blocked (limit 5)")
	}

	// Window reset
	time.Sleep(window + 10*time.Millisecond)
	if !l.Allow(route, "ip1", false) {
		t.Error("req 1 after window reset should be allowed")
	}
}
