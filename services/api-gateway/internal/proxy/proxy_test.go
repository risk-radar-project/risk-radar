package proxy

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"api-gateway/internal/config"
)

type mockTransport struct {
	RoundTripFunc func(*http.Request) (*http.Response, error)
}

func (m *mockTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	return m.RoundTripFunc(req)
}

func TestNewHandler(t *testing.T) {
	h := NewHandler(http.DefaultTransport)
	if h.Transport != http.DefaultTransport {
		t.Error("expected transport to be set")
	}
}

func TestHandler_Build(t *testing.T) {
	h := NewHandler(&mockTransport{
		RoundTripFunc: func(req *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: 200,
				Body:       io.NopCloser(bytes.NewBufferString("OK")),
				Header:     make(http.Header),
			}, nil
		},
	})

	route := config.RuntimeRoute{
		Prefix:   "/api/test",
		Upstream: "http://localhost:8081",
	}

	rp := h.Build(route)

	req := httptest.NewRequest("GET", "/api/test/foo", nil)
	w := httptest.NewRecorder()

	rp.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Errorf("expected status 200, got %d", w.Code)
	}
}

func TestModifyResponse_ErrorNormalization(t *testing.T) {
	h := NewHandler(nil)
	route := config.RuntimeRoute{Upstream: "http://localhost"}
	rp := h.Build(route)

	resp := &http.Response{
		StatusCode: 400,
		Body:       io.NopCloser(bytes.NewBufferString(`{"error": "bad_request"}`)),
		Header:     make(http.Header),
	}

	if err := rp.ModifyResponse(resp); err != nil {
		t.Fatal(err)
	}

	body, _ := io.ReadAll(resp.Body)
	if !strings.Contains(string(body), "BAD_REQUEST") {
		t.Errorf("expected normalized error, got %s", string(body))
	}
}

func TestModifyResponse_FlattenData(t *testing.T) {
	h := NewHandler(nil)
	route := config.RuntimeRoute{Upstream: "http://localhost"}
	rp := h.Build(route)

	jsonBody := `{"data": {"data": [{"id": 1}], "meta": "foo"}}`
	resp := &http.Response{
		StatusCode: 200,
		Body:       io.NopCloser(bytes.NewBufferString(jsonBody)),
		Header:     make(http.Header),
	}
	resp.Header.Set("Content-Type", "application/json")

	if err := rp.ModifyResponse(resp); err != nil {
		t.Fatal(err)
	}

	body, _ := io.ReadAll(resp.Body)
	if !strings.Contains(string(body), `"meta":"foo"`) {
		t.Errorf("expected flattened data, got %s", string(body))
	}
}

func TestShouldSkipBody(t *testing.T) {
	resp := &http.Response{
		Request: &http.Request{
			Header: http.Header{"Upgrade": []string{"websocket"}},
		},
	}
	if !shouldSkipBody(resp) {
		t.Error("expected to skip body for websocket")
	}

	resp = &http.Response{Request: &http.Request{Header: make(http.Header)}}
	if shouldSkipBody(resp) {
		t.Error("expected not to skip body")
	}
}

func TestDeriveErrorCode(t *testing.T) {
	code := deriveErrorCode(404, []byte{})
	if code != "NOT_FOUND" {
		t.Errorf("expected NOT_FOUND, got %s", code)
	}

	code = deriveErrorCode(400, []byte(`{"error": "custom_error"}`))
	if code != "CUSTOM_ERROR" {
		t.Errorf("expected CUSTOM_ERROR, got %s", code)
	}
	
	code = deriveErrorCode(400, []byte(`{"error": {"code": "obj_error"}}`))
	if code != "OBJ_ERROR" {
		t.Errorf("expected OBJ_ERROR, got %s", code)
	}
}

func TestErrorHandler(t *testing.T) {
	h := NewHandler(&mockTransport{
		RoundTripFunc: func(req *http.Request) (*http.Response, error) {
			return nil, io.EOF // Simulate error
		},
	})
	route := config.RuntimeRoute{Upstream: "http://localhost"}
	rp := h.Build(route)

	req := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()

	rp.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", w.Code)
	}
}

func TestClientIP(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("X-Forwarded-For", "10.0.0.1, 10.0.0.2")
	if ip := clientIP(req); ip != "10.0.0.1" {
		t.Errorf("expected 10.0.0.1, got %s", ip)
	}

	req = httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "127.0.0.1:1234"
	if ip := clientIP(req); ip != "127.0.0.1" {
		t.Errorf("expected 127.0.0.1, got %s", ip)
	}
}

func TestSingleJoiningSlash(t *testing.T) {
	tests := []struct {
		a, b, want string
	}{
		{"http://a", "b", "http://a/b"},
		{"http://a/", "b", "http://a/b"},
		{"http://a", "/b", "http://a/b"},
		{"http://a/", "/b", "http://a/b"},
	}
	for _, tt := range tests {
		if got := singleJoiningSlash(tt.a, tt.b); got != tt.want {
			t.Errorf("singleJoiningSlash(%q, %q) = %q, want %q", tt.a, tt.b, got, tt.want)
		}
	}
}
