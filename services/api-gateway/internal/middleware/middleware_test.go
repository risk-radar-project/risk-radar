package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRecovery(t *testing.T) {
	handler := Recovery(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("oops")
	}))

	req := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected status 500, got %d", w.Code)
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}

	if resp["success"] != false {
		t.Error("expected success: false")
	}
}

func TestCorrelation(t *testing.T) {
	handler := Correlation(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		corr := CorrelationIDFromContext(r.Context())
		if corr == "" {
			t.Error("expected correlation id in context")
		}
		if w.Header().Get("X-Correlation-ID") != corr {
			t.Error("expected correlation id in response header")
		}
	}))

	req := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)
}

func TestCorrelation_Existing(t *testing.T) {
	existingID := "test-id"
	handler := Correlation(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		corr := CorrelationIDFromContext(r.Context())
		if corr != existingID {
			t.Errorf("expected correlation id %s, got %s", existingID, corr)
		}
	}))

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("X-Correlation-ID", existingID)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)
}

func TestRequestLogger(t *testing.T) {
	var loggedEntry map[string]interface{}
	logFunc := func(entry map[string]interface{}) {
		loggedEntry = entry
	}

	handler := RequestLogger(logFunc)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if loggedEntry == nil {
		t.Fatal("expected log entry")
	}
	if loggedEntry["status"] != http.StatusTeapot {
		t.Errorf("expected status %d, got %v", http.StatusTeapot, loggedEntry["status"])
	}
	if loggedEntry["path"] != "/test" {
		t.Errorf("expected path /test, got %v", loggedEntry["path"])
	}
}

func TestGetStatusColor(t *testing.T) {
	tests := []struct {
		status int
		want   string
	}{
		{200, "\033[32m"},
		{300, "\033[33m"},
		{400, "\033[31m"},
		{500, "\033[35m"},
		{100, "\033[37m"},
	}

	for _, tt := range tests {
		if got := getStatusColor(tt.status); got != tt.want {
			t.Errorf("getStatusColor(%d) = %v, want %v", tt.status, got, tt.want)
		}
	}
}

func TestGetMethodColor(t *testing.T) {
	tests := []struct {
		method string
		want   string
	}{
		{"GET", "\033[34m"},
		{"POST", "\033[32m"},
		{"PUT", "\033[33m"},
		{"DELETE", "\033[31m"},
		{"PATCH", "\033[36m"},
		{"HEAD", "\033[35m"},
		{"OPTIONS", "\033[37m"},
		{"UNKNOWN", "\033[37m"},
	}

	for _, tt := range tests {
		if got := getMethodColor(tt.method); got != tt.want {
			t.Errorf("getMethodColor(%s) = %v, want %v", tt.method, got, tt.want)
		}
	}
}

func TestWriteJSONError(t *testing.T) {
	w := httptest.NewRecorder()
	WriteJSONError(w, http.StatusBadRequest, "BAD_REQUEST", "bad request")

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}

	if resp["success"] != false {
		t.Error("expected success: false")
	}
}

func TestContextHelpers(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	ctx := req.Context()

	ctx = WithUserID(ctx, "user1")
	if UserIDFromContext(ctx) != "user1" {
		t.Error("expected user1")
	}

	ctx = WithUpstream(ctx, "http://upstream")
	if UpstreamFromContext(ctx) != "http://upstream" {
		t.Error("expected upstream")
	}
}

func TestClientIP(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "1.2.3.4:1234"

	if got := clientIP(req); got != "1.2.3.4:1234" {
		t.Errorf("expected 1.2.3.4:1234, got %s", got)
	}
}
