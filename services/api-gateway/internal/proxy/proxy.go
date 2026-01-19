package proxy

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"api-gateway/internal/config"
	"api-gateway/internal/middleware"
)

type Handler struct {
	Transport http.RoundTripper
}

func NewHandler(transport http.RoundTripper) Handler {
	return Handler{Transport: transport}
}

func (h Handler) Build(route config.RuntimeRoute) *httputil.ReverseProxy {
	target, _ := url.Parse(route.Upstream)
	rp := &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			trimmed := strings.TrimPrefix(req.URL.Path, route.Prefix)
			originalHost := req.Host
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			
			var finalPath string
			if trimmed == "" {
				// Exact match - use target path directly without adding slash
				finalPath = target.Path
				if finalPath == "" {
					finalPath = "/"
				}
			} else {
				finalPath = singleJoiningSlash(target.Path, trimmed)
			}
			
			req.URL.Path = finalPath
			req.Host = target.Host
			setForwardHeaders(req, originalHost)
		},
		Transport: h.Transport,
		ModifyResponse: func(resp *http.Response) error {
			// Ensure only gateway CORS headers are present to avoid duplicates
			stripUpstreamCORSHeaders(resp)
			if shouldSkipBody(resp) {
				return nil
			}
			if resp.StatusCode >= 400 {
				return normalizeError(resp)
			}
			return flattenData(resp)
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			code := http.StatusServiceUnavailable
			reason := "UPSTREAM_UNAVAILABLE"
			lower := strings.ToLower(err.Error())
			if strings.Contains(lower, "timeout") {
				reason = "UPSTREAM_TIMEOUT"
			} else if strings.Contains(lower, "connection refused") {
				reason = "UPSTREAM_UNAVAILABLE"
			}
			middleware.WriteJSONError(w, code, reason, "upstream error: "+err.Error())
		},
	}
	return rp
}

func setForwardHeaders(req *http.Request, originalHost string) {
	req.Header.Set("X-Forwarded-Proto", req.URL.Scheme)
	if originalHost != "" {
		req.Header.Set("X-Forwarded-Host", originalHost)
	}
	if ip := middleware.ClientIP(req); ip != "" {
		req.Header.Set("X-Forwarded-For", ip)
	}
}

func singleJoiningSlash(a, b string) string {
	aHas := strings.HasSuffix(a, "/")
	bHas := strings.HasPrefix(b, "/")
	switch {
	case aHas && bHas:
		return a + b[1:]
	case !aHas && !bHas:
		return a + "/" + b
	default:
		return a + b
	}
}

func shouldSkipBody(resp *http.Response) bool {
	if resp.Request != nil {
		if strings.EqualFold(resp.Request.Header.Get("Upgrade"), "websocket") {
			return true
		}
	}
	return false
}

func normalizeError(resp *http.Response) error {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	_ = resp.Body.Close()
	errcode := deriveErrorCode(resp.StatusCode, body)
	payload := map[string]interface{}{
		"success": false,
		"error": map[string]string{
			"code":    errcode,
			"message": http.StatusText(resp.StatusCode),
		},
	}
	buf, _ := json.Marshal(payload)
	resp.Body = io.NopCloser(bytes.NewReader(buf))
	resp.ContentLength = int64(len(buf))
	resp.Header.Set("Content-Type", "application/json")
	resp.Header.Del("Content-Encoding") // Ensure no compression header remains
	resp.Header.Del("Content-Length")   // Ensure old length is removed
	return nil
}

func deriveErrorCode(status int, body []byte) string {
	var payload map[string]interface{}
	if len(body) > 0 {
		if err := json.Unmarshal(body, &payload); err == nil {
			if val, ok := payload["error"].(string); ok && val != "" {
				return strings.ToUpper(val)
			}
			if errObj, ok := payload["error"].(map[string]interface{}); ok {
				if codeVal, ok := errObj["code"].(string); ok && codeVal != "" {
					return strings.ToUpper(codeVal)
				}
			}
		}
	}
	return strings.ReplaceAll(strings.ToUpper(http.StatusText(status)), " ", "_")
}

func flattenData(resp *http.Response) error {
	if resp.StatusCode >= 400 {
		return nil
	}
	if !strings.Contains(resp.Header.Get("Content-Type"), "application/json") {
		return nil
	}
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	_ = resp.Body.Close()
	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		resp.Body = io.NopCloser(bytes.NewReader(data))
		resp.ContentLength = int64(len(data))
		return nil
	}
	inner, ok := payload["data"].(map[string]interface{})
	if !ok {
		resp.Body = io.NopCloser(bytes.NewReader(data))
		resp.ContentLength = int64(len(data))
		return nil
	}
	val, exists := inner["data"]
	if !exists {
		resp.Body = io.NopCloser(bytes.NewReader(data))
		resp.ContentLength = int64(len(data))
		return nil
	}
	delete(inner, "data")
	payload["data"] = val
	for k, v := range inner {
		payload[k] = v
	}
	buf, err := json.Marshal(payload)
	if err != nil {
		resp.Body = io.NopCloser(bytes.NewReader(data))
		resp.ContentLength = int64(len(data))
		return nil
	}
	resp.Body = io.NopCloser(bytes.NewReader(buf))
	resp.ContentLength = int64(len(buf))
	resp.Header.Set("Content-Type", "application/json")
	resp.Header.Del("Content-Encoding") // Ensure no compression header remains
	resp.Header.Del("Content-Length")   // Ensure old length is removed
	return nil
}

// Remove CORS headers added by upstream services so the gateway can set a single, correct value.
func stripUpstreamCORSHeaders(resp *http.Response) {
	if resp == nil {
		return
	}
	h := resp.Header
	// Access-Control-* headers that may be set upstream
	h.Del("Access-Control-Allow-Origin")
	h.Del("Access-Control-Allow-Credentials")
	h.Del("Access-Control-Allow-Headers")
	h.Del("Access-Control-Allow-Methods")
	h.Del("Access-Control-Expose-Headers")
	// Some servers add Vary: Origin for CORS; keep generic Vary but remove duplicates later in the chain
	// We don't delete Vary entirely to preserve caching semantics
}

