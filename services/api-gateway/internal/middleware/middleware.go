package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

type contextKey string

const (
	CorrelationIDKey contextKey = "correlation_id"
	UserIDKey        contextKey = "user_id"
	UpstreamKey      contextKey = "upstream"
)

func Recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				WriteJSONError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "unexpected error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func Correlation(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		corr := r.Header.Get("X-Correlation-ID")
		if corr == "" {
			corr = r.Header.Get("X-Request-ID")
		}
		if corr == "" {
			corr = uuid.NewString()
		}
		r = r.WithContext(context.WithValue(r.Context(), CorrelationIDKey, corr))
		w.Header().Set("X-Correlation-ID", corr)
		next.ServeHTTP(w, r)
	})
}

func WithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, UserIDKey, userID)
}

func UserIDFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(UserIDKey).(string); ok {
		return v
	}
	return ""
}

func CorrelationIDFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(CorrelationIDKey).(string); ok {
		return v
	}
	return ""
}

func WithUpstream(ctx context.Context, upstream string) context.Context {
	return context.WithValue(ctx, UpstreamKey, upstream)
}

func UpstreamFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(UpstreamKey).(string); ok {
		return v
	}
	return ""
}

func RequestLogger(logFunc func(map[string]interface{})) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rw := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rw, r)

			duration := time.Since(start)

			// Console logging (human readable, matching authz-service style)
			statusColor := getStatusColor(rw.status)
			methodColor := getMethodColor(r.Method)

			var durationStr string
			nanoseconds := duration.Nanoseconds()
			if nanoseconds == 0 {
				durationStr = "~100ns"
			} else if nanoseconds < 1000 {
				durationStr = fmt.Sprintf("%dns", nanoseconds)
			} else if duration < time.Millisecond {
				durationStr = fmt.Sprintf("%.1fμs", float64(nanoseconds)/1000)
			} else if duration < time.Second {
				durationStr = fmt.Sprintf("%.2fms", float64(nanoseconds)/1000000)
			} else {
				durationStr = fmt.Sprintf("%.2fs", duration.Seconds())
			}

			fmt.Printf("%s | %s%3d%s | %10s | %15s | %s%-7s%s %s\n",
				time.Now().Format("2006/01/02 - 15:04:05"),
				statusColor, rw.status, "\033[0m",
				durationStr,
				clientIP(r),
				methodColor, r.Method, "\033[0m",
				r.URL.Path,
			)

			// Structured logging (machine readable)
			entry := map[string]interface{}{
				"level":         "info",
				"method":        r.Method,
				"path":          r.URL.Path,
				"status":        rw.status,
				"duration_ms":   duration.Milliseconds(),
				"correlationId": CorrelationIDFromContext(r.Context()),
				"userId":        UserIDFromContext(r.Context()),
				"upstream":      UpstreamFromContext(r.Context()),
				"ip":            clientIP(r),
			}
			logFunc(entry)
		})
	}
}

func getStatusColor(status int) string {
	switch {
	case status >= 200 && status < 300:
		return "\033[32m" // Green
	case status >= 300 && status < 400:
		return "\033[33m" // Yellow
	case status >= 400 && status < 500:
		return "\033[31m" // Red
	case status >= 500:
		return "\033[35m" // Magenta
	default:
		return "\033[37m" // White
	}
}

func getMethodColor(method string) string {
	switch method {
	case "GET":
		return "\033[34m" // Blue
	case "POST":
		return "\033[32m" // Green
	case "PUT":
		return "\033[33m" // Yellow
	case "DELETE":
		return "\033[31m" // Red
	case "PATCH":
		return "\033[36m" // Cyan
	case "HEAD":
		return "\033[35m" // Magenta
	case "OPTIONS":
		return "\033[37m" // White
	default:
		return "\033[37m" // White
	}
}

func clientIP(r *http.Request) string {
	// Simple extraction, can be improved if needed
	return ClientIP(r)
}

func ClientIP(r *http.Request) string {
	ff := r.Header.Get("X-Forwarded-For")
	if ff != "" {
		parts := strings.Split(ff, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0]) // use strings.TrimSpace to be safe
		}
	}
	host := r.RemoteAddr
	if host == "" {
		return ""
	}
	// Strip port if present
	if idx := strings.LastIndex(host, ":"); idx != -1 {
		// Verify if it's an IPv6 address like [::1]:8080 or just IP:port
		// If it is [::1] (ipv6 without port), idx would be -1 or inside brackets?
		// r.RemoteAddr usually is "IP:Port".
		// For IPv6 it is "[IP]:Port".
		// If it ends with ] then no port? No, RemoteAddr generally has port.
		// Standard net/http behavior.
		return host[:idx]
	}
	return host
}

func DemoMode(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodDelete {
			WriteJSONError(w, http.StatusForbidden, "DEMO_MODE_RESTRICTION", "Delete actions are disabled in Demo Mode")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func WriteJSONError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": false,
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}
