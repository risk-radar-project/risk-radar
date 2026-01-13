package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chcors "github.com/go-chi/cors"
	"github.com/joho/godotenv"

	"api-gateway/internal/auth"
	"api-gateway/internal/config"
	"api-gateway/internal/middleware"
	"api-gateway/internal/proxy"
	"api-gateway/internal/ratelimit"
	"api-gateway/internal/router"
)

func main() {
	// Load environment variables - try current dir first, then parent dir
	if err := godotenv.Load(); err != nil {
		if err := godotenv.Load("../.env"); err != nil {
			log.Printf("Warning: .env file not found: %v", err)
		}
	}

	cfgPath := os.Getenv("GATEWAY_CONFIG")
	if cfgPath == "" {
		cfgPath = "config.yaml"
	}
	cfg, err := config.Load(cfgPath)
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	handler, err := NewGatewayHandler(cfg)
	if err != nil {
		log.Fatalf("failed to init gateway: %v", err)
	}

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Server.Port),
		Handler:      handler,
		ReadTimeout:  cfg.ReadTimeout(),
		WriteTimeout: cfg.WriteTimeout(),
		IdleTimeout:  cfg.IdleTimeout(),
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server error: %v", err)
		}
	}()

	log.Printf("gateway listening on %s", srv.Addr)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

func NewGatewayHandler(cfg config.RuntimeConfig) (http.Handler, error) {
	jwtValidator, err := auth.NewValidator(cfg.JWT)
	if err != nil {
		return nil, fmt.Errorf("failed to init jwt validator: %w", err)
	}

	limiter := ratelimit.New(60 * time.Second)
	matcher := router.NewMatcher(cfg.Routes)
	transport := defaultTransport()
	proxyBuilder := proxy.NewHandler(transport)

	r := chi.NewRouter()
	r.Use(middleware.Recovery)
	r.Use(cors(cfg))
	r.Use(middleware.RequestLogger(createLogFunc(cfg.AuditLogURL)))
	r.Use(middleware.Correlation)

	r.Get("/status", statusHandler)
	r.Get("/api/docs/openapi.yaml", openAPIHandler)
	r.Get("/api/docs", swaggerHandler)

	// Dev endpoint for generating JWTs
	if os.Getenv("NODE_ENV") == "development" || os.Getenv("ENV") == "development" {
		r.Post("/api/dev/generate-jwt", generateJWTHandler(jwtValidator))
	}

	gw := gateway{
		cfg:         cfg,
		matcher:     matcher,
		limiter:     limiter,
		jwtValidate: jwtValidator,
		proxy:       proxyBuilder,
	}

	r.NotFound(func(w http.ResponseWriter, _ *http.Request) {
		middleware.WriteJSONError(w, http.StatusNotFound, "NOT_FOUND", "route not found")
	})

	r.Handle("/*", http.HandlerFunc(gw.handle))
	return r, nil
}

func cors(cfg config.RuntimeConfig) func(http.Handler) http.Handler {
	opts := chcors.Options{
		AllowedOrigins:   cfg.CORS.AllowedOrigins,
		AllowedMethods:   cfg.CORS.AllowedMethods,
		AllowedHeaders:   cfg.CORS.AllowedHeaders,
		AllowCredentials: cfg.CORS.AllowCredentials,
		MaxAge:           cfg.CORS.MaxAgeSeconds,
	}
	return chcors.Handler(opts)
}

func createLogFunc(auditURL string) func(map[string]interface{}) {
	return func(entry map[string]interface{}) {
		// 1. Log to stdout
		data, err := json.Marshal(entry)
		if err != nil {
			log.Printf("log marshal error: %v", err)
			return
		}
		log.Print(string(data))

		// 2. Send to audit log if URL is set
		if auditURL != "" {
			go sendToAuditLog(auditURL, entry)
		}
	}
}

func sendToAuditLog(url string, entry map[string]interface{}) {
	statusInt, _ := entry["status"].(int)
	statusStr := "success"
	if statusInt >= 400 {
		statusStr = "error"
	}

	userID, _ := entry["userId"].(string)
	if userID == "" {
		userID = "anonymous"
	}

	ip, _ := entry["ip"].(string)

	auditPayload := map[string]interface{}{
		"service": "api-gateway",
		"action":  fmt.Sprintf("%s %s", entry["method"], entry["path"]),
		"actor": map[string]string{
			"id":   userID,
			"type": "user",
			"ip":   ip,
		},
		"status":   statusStr,
		"log_type": "ACTION",
		"metadata": entry,
	}

	body, _ := json.Marshal(auditPayload)
	// Ensure URL doesn't end with slash if we append /logs, or handle it
	target := strings.TrimSuffix(url, "/") + "/logs"
	resp, err := http.Post(target, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("failed to send audit log: %v", err)
		return
	}
	defer resp.Body.Close()
}

func statusHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func openAPIHandler(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "openapi.yaml")
}

func swaggerHandler(w http.ResponseWriter, _ *http.Request) {
	html := `<!doctype html>
<html>
<head>
  <title>RiskRadar API Gateway Docs</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/docs/openapi.yaml',
        dom_id: '#swagger-ui'
      });
    };
  </script>
</body>
</html>`
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(html))
}

type gateway struct {
	cfg         config.RuntimeConfig
	matcher     router.Matcher
	limiter     *ratelimit.Limiter
	jwtValidate *auth.Validator
	proxy       proxy.Handler
}

func (g gateway) handle(w http.ResponseWriter, r *http.Request) {
	route, ok := g.matcher.Match(r.URL.Path)
	if !ok {
		middleware.WriteJSONError(w, http.StatusNotFound, "NOT_FOUND", "route not found")
		return
	}

	var h http.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rp := g.proxy.Build(route)
		rp.ServeHTTP(w, r)
	})

	h = g.timeout(route)(h)
	h = g.userInjector(route)(h)
	h = g.jwtMiddleware(route)(h)
	h = g.rateLimiter(route)(h)
	h = g.bodyLimiter(route)(h)

	ctx := middleware.WithUpstream(r.Context(), route.Upstream)
	h.ServeHTTP(w, r.WithContext(ctx))
}

func generateJWTHandler(v *auth.Validator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			UserID      string   `json:"user_id"`
			ExpHours    int      `json:"exp_hours"`
			Roles       []string `json:"roles"`
			Permissions []string `json:"permissions"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			middleware.WriteJSONError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid json body")
			return
		}
		if req.UserID == "" {
			middleware.WriteJSONError(w, http.StatusBadRequest, "BAD_REQUEST", "user_id is required")
			return
		}
		if req.ExpHours <= 0 {
			req.ExpHours = 1
		}

		token, err := v.GenerateDevToken(req.UserID, time.Duration(req.ExpHours)*time.Hour, req.Roles, req.Permissions)
		if err != nil {
			middleware.WriteJSONError(w, http.StatusInternalServerError, "INTERNAL_ERROR", fmt.Sprintf("failed to generate token: %v", err))
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"token": token,
		})
	}
}

func (g gateway) bodyLimiter(route config.RuntimeRoute) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			limit := route.UploadMaxBytes
			if !isMultipart(r.Header.Get("Content-Type")) {
				if route.UploadMaxBytes > g.cfg.JSONMax {
					limit = g.cfg.JSONMax
				}
			}
			r.Body = http.MaxBytesReader(w, r.Body, limit)
			next.ServeHTTP(w, r)
		})
	}
}

func (g gateway) rateLimiter(route config.RuntimeRoute) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if route.RateLimit == nil {
				next.ServeHTTP(w, r)
				return
			}
			token := extractToken(r.Header.Get("Authorization"))
			userID := ""
			if token != "" {
				if id, err := g.jwtValidate.Validate(token); err == nil {
					userID = id
				}
			}
			key := userID
			authenticated := userID != ""
			if key == "" {
				key = middleware.ClientIP(r)
			}
			if !g.limiter.Allow(route, key, authenticated) {
				middleware.WriteJSONError(w, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED", "rate limit exceeded")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func (g gateway) jwtMiddleware(route config.RuntimeRoute) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := extractToken(r.Header.Get("Authorization"))
			if token == "" {
				if route.AuthRequired {
					middleware.WriteJSONError(w, http.StatusUnauthorized, "INVALID_TOKEN", "invalid or expired token")
					return
				}
				next.ServeHTTP(w, r)
				return
			}
			userID, err := g.jwtValidate.Validate(token)
			if err != nil {
				if route.AuthRequired {
					middleware.WriteJSONError(w, http.StatusUnauthorized, "INVALID_TOKEN", "invalid or expired token")
					return
				}
				next.ServeHTTP(w, r)
				return
			}
			ctx := middleware.WithUserID(r.Context(), userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func (g gateway) userInjector(route config.RuntimeRoute) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userID := middleware.UserIDFromContext(r.Context())
			if userID != "" {
				r.Header.Set("X-User-ID", userID)
			}
			corr := middleware.CorrelationIDFromContext(r.Context())
			if corr != "" {
				r.Header.Set("X-Correlation-ID", corr)
			}
			next.ServeHTTP(w, r)
		})
	}
}

func (g gateway) timeout(route config.RuntimeRoute) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip timeout for WebSocket upgrades
			if strings.EqualFold(r.Header.Get("Connection"), "upgrade") &&
				strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
				next.ServeHTTP(w, r)
				return
			}

			ctx, cancel := context.WithTimeout(r.Context(), g.cfg.UpstreamTimeout())
			defer cancel()
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func defaultTransport() http.RoundTripper {
	return &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   10 * time.Second,
			KeepAlive: 60 * time.Second,
		}).DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}
}

func extractToken(header string) string {
	if header == "" {
		return ""
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 {
		return ""
	}
	if !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

func isMultipart(ct string) bool {
	return strings.Contains(strings.ToLower(ct), "multipart/")
}
