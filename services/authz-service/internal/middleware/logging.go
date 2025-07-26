package middleware

import (
	"fmt"
	"net/http"
	"time"

	"authz-service/internal/utils"
)

// ResponseWriter wrapper to capture status code and response size
type responseWriter struct {
	http.ResponseWriter
	statusCode int
	size       int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	size, err := rw.ResponseWriter.Write(b)
	rw.size += size
	return size, err
}

// LoggingMiddleware provides Gin-style beautiful request logging
func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Record start time
		start := time.Now()

		// Create response writer wrapper
		rw := &responseWriter{
			ResponseWriter: w,
			statusCode:     200, // default status
			size:           0,
		}

		// Process request
		next.ServeHTTP(rw, r)

		// Calculate duration
		duration := time.Since(start)

		// Get status color
		statusColor := getStatusColor(rw.statusCode)
		methodColor := getMethodColor(r.Method)

		// Format duration to show microseconds/milliseconds for better precision
		var durationStr string
		nanoseconds := duration.Nanoseconds()

		if nanoseconds == 0 {
			// Handle edge case where duration is 0 (timer resolution issue)
			// Assume minimum realistic time for HTTP request processing
			durationStr = "~100ns"
		} else if nanoseconds < 1000 {
			// Show nanoseconds for very fast requests
			durationStr = fmt.Sprintf("%dns", nanoseconds)
		} else if duration < time.Millisecond {
			durationStr = fmt.Sprintf("%.1fμs", float64(nanoseconds)/1000)
		} else if duration < time.Second {
			durationStr = fmt.Sprintf("%.2fms", float64(nanoseconds)/1000000)
		} else {
			durationStr = fmt.Sprintf("%.2fs", duration.Seconds())
		}
		fmt.Printf("%s[AUTHZ]%s %s | %s%3d%s | %10s | %15s | %s%-7s%s %s\n",
			"\033[90m", "\033[0m", // [AUTHZ] in gray
			time.Now().Format("2006/01/02 - 15:04:05"),
			statusColor, rw.statusCode, "\033[0m", // Status code with color
			durationStr,
			r.RemoteAddr,
			methodColor, r.Method, "\033[0m", // Method with color
			r.RequestURI,
		)

		// Also log to audit system for important events
		if rw.statusCode >= 400 {
			utils.LogEvent("http.request", map[string]interface{}{
				"method":      r.Method,
				"path":        r.RequestURI,
				"status":      rw.statusCode,
				"duration":    duration.String(),
				"remote_addr": r.RemoteAddr,
				"user_agent":  r.UserAgent(),
			})
		}
	})
}

// getStatusColor returns ANSI color code based on HTTP status
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

// getMethodColor returns ANSI color code based on HTTP method
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
