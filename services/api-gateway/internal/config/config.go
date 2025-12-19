package config

import (
	"errors"
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

const (
	DefaultServerPort               = 8080
	DefaultReadTimeoutSec           = 20
	DefaultWriteTimeoutSec          = 20
	DefaultIdleTimeoutSec           = 60
	DefaultUpstreamTimeoutSec       = 15
	DefaultUploadMaxBytes     int64 = 10 * 1024 * 1024
	DefaultJSONMaxBytes       int64 = 2 * 1024 * 1024
	DefaultAnonLimit                = 100
	DefaultAuthLimit                = 300
)

type RateLimitConfig struct {
	Anonymous     int `yaml:"anonymous"`
	Authenticated int `yaml:"authenticated"`
}

type RouteConfig struct {
	Prefix         string           `yaml:"prefix"`
	Upstream       string           `yaml:"upstream"`
	AuthRequired   bool             `yaml:"auth_required"`
	RateLimit      *RateLimitConfig `yaml:"-"`
	RateLimitRaw   *yaml.Node       `yaml:"rate_limit"`
	RateLimitOff   bool             `yaml:"-"`
	UploadMaxBytes *int64           `yaml:"upload_max_bytes"`
}

type JWTConfig struct {
	Algorithm     string `yaml:"algorithm"`
	Issuer        string `yaml:"issuer"`
	HMACSecret    string `yaml:"hmac_secret"`
	PublicKey     string `yaml:"public_key"`
	PublicKeyFile string `yaml:"public_key_file"`
}

type CORSConfig struct {
	AllowedOrigins   []string `yaml:"allowed_origins"`
	AllowedMethods   []string `yaml:"allowed_methods"`
	AllowedHeaders   []string `yaml:"allowed_headers"`
	AllowCredentials bool     `yaml:"allow_credentials"`
	MaxAgeSeconds    int      `yaml:"max_age_seconds"`
}

type ServerConfig struct {
	Port            int `yaml:"port"`
	ReadTimeoutSec  int `yaml:"read_timeout_seconds"`
	WriteTimeoutSec int `yaml:"write_timeout_seconds"`
	IdleTimeoutSec  int `yaml:"idle_timeout_seconds"`
	UpstreamTimeout int `yaml:"upstream_timeout_seconds"`
}

type Config struct {
	Server             ServerConfig    `yaml:"server"`
	JWT                JWTConfig       `yaml:"jwt"`
	CORS               CORSConfig      `yaml:"cors"`
	DefaultRateLimit   RateLimitConfig `yaml:"default_rate_limit"`
	DefaultUploadBytes int64           `yaml:"default_upload_max_bytes"`
	JSONMaxBytes       int64           `yaml:"json_body_max_bytes"`
	Routes             []RouteConfig   `yaml:"routes"`
	AuditLogURL        string          `yaml:"audit_log_url"`
}

type RuntimeRoute struct {
	Prefix         string
	Upstream       string
	AuthRequired   bool
	RateLimit      *RateLimitConfig
	UploadMaxBytes int64
}

type RuntimeConfig struct {
	Server      ServerConfig
	JWT         JWTConfig
	CORS        CORSConfig
	Routes      []RuntimeRoute
	JSONMax     int64
	AuditLogURL string
}

func Load(path string) (RuntimeConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return RuntimeConfig{}, fmt.Errorf("read config: %w", err)
	}
	expanded := os.ExpandEnv(string(data))
	// fmt.Println("DEBUG Config:", expanded) // Commented out to avoid noise
	var cfg Config
	if err := yaml.Unmarshal([]byte(expanded), &cfg); err != nil {
		return RuntimeConfig{}, fmt.Errorf("parse yaml: %w", err)
	}
	applyDefaults(&cfg)

	if secret := os.Getenv("JWT_ACCESS_SECRET"); secret != "" {
		cfg.JWT.HMACSecret = secret
	}

	// Validate JWT Secret
	if cfg.JWT.Algorithm == "HS256" && cfg.JWT.HMACSecret == "" {
		return RuntimeConfig{}, errors.New("JWT HMAC secret is required for HS256 algorithm")
	}

	routes, err := buildRuntimeRoutes(cfg)
	if err != nil {
		return RuntimeConfig{}, err
	}
	return RuntimeConfig{
		Server:      cfg.Server,
		JWT:         cfg.JWT,
		CORS:        cfg.CORS,
		Routes:      routes,
		JSONMax:     cfg.JSONMaxBytes,
		AuditLogURL: cfg.AuditLogURL,
	}, nil
}

func applyDefaults(cfg *Config) {
	if cfg.Server.Port == 0 {
		cfg.Server.Port = DefaultServerPort
	}
	if cfg.Server.ReadTimeoutSec == 0 {
		cfg.Server.ReadTimeoutSec = DefaultReadTimeoutSec
	}
	if cfg.Server.WriteTimeoutSec == 0 {
		cfg.Server.WriteTimeoutSec = DefaultWriteTimeoutSec
	}
	if cfg.Server.IdleTimeoutSec == 0 {
		cfg.Server.IdleTimeoutSec = DefaultIdleTimeoutSec
	}
	if cfg.Server.UpstreamTimeout == 0 {
		cfg.Server.UpstreamTimeout = DefaultUpstreamTimeoutSec
	}
	if cfg.DefaultUploadBytes == 0 {
		cfg.DefaultUploadBytes = DefaultUploadMaxBytes
	}
	if cfg.JSONMaxBytes == 0 {
		cfg.JSONMaxBytes = DefaultJSONMaxBytes
	}
	if cfg.DefaultRateLimit.Anonymous == 0 {
		cfg.DefaultRateLimit.Anonymous = DefaultAnonLimit
	}
	if cfg.DefaultRateLimit.Authenticated == 0 {
		cfg.DefaultRateLimit.Authenticated = DefaultAuthLimit
	}
	if len(cfg.CORS.AllowedMethods) == 0 {
		cfg.CORS.AllowedMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	}
	if len(cfg.CORS.AllowedHeaders) == 0 {
		cfg.CORS.AllowedHeaders = []string{"Authorization", "Content-Type", "X-Correlation-ID"}
	}
	if len(cfg.CORS.AllowedOrigins) == 0 {
		cfg.CORS.AllowedOrigins = []string{"*"}
	}
	if cfg.CORS.MaxAgeSeconds == 0 {
		cfg.CORS.MaxAgeSeconds = 600
	}
}

func buildRuntimeRoutes(cfg Config) ([]RuntimeRoute, error) {
	if len(cfg.Routes) == 0 {
		return nil, errors.New("no routes configured")
	}
	var routes []RuntimeRoute
	for i := range cfg.Routes {
		rc := cfg.Routes[i]
		rc.detectRateLimit()
		uploadBytes := cfg.DefaultUploadBytes
		if rc.UploadMaxBytes != nil && *rc.UploadMaxBytes > 0 {
			uploadBytes = *rc.UploadMaxBytes
		}
		var rl *RateLimitConfig
		if !rc.RateLimitOff {
			rl = rc.RateLimit
			if rl == nil {
				rl = &cfg.DefaultRateLimit
			}
		}
		routes = append(routes, RuntimeRoute{
			Prefix:         rc.Prefix,
			Upstream:       rc.Upstream,
			AuthRequired:   rc.AuthRequired,
			RateLimit:      rl,
			UploadMaxBytes: uploadBytes,
		})
	}
	return routes, nil
}

func (rc *RouteConfig) detectRateLimit() {
	if rc.RateLimitRaw == nil {
		return
	}
	if rc.RateLimitRaw.Tag == "!!null" {
		rc.RateLimitOff = true
		return
	}
	var rl RateLimitConfig
	if err := rc.RateLimitRaw.Decode(&rl); err == nil {
		rc.RateLimit = &rl
	}
}

func (rc RuntimeConfig) UpstreamTimeout() time.Duration {
	return time.Duration(rc.Server.UpstreamTimeout) * time.Second
}

func (rc RuntimeConfig) ReadTimeout() time.Duration {
	return time.Duration(rc.Server.ReadTimeoutSec) * time.Second
}

func (rc RuntimeConfig) WriteTimeout() time.Duration {
	return time.Duration(rc.Server.WriteTimeoutSec) * time.Second
}

func (rc RuntimeConfig) IdleTimeout() time.Duration {
	return time.Duration(rc.Server.IdleTimeoutSec) * time.Second
}
