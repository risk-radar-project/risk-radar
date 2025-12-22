package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
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
	return r.RemoteAddr
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
