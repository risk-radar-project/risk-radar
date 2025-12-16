# API Gateway Documentation

## Overview
The API Gateway is the entry point for the Risk Radar platform. It handles routing, authentication, rate limiting, and request normalization for all microservices.

## Architecture
- **Language**: Go 1.22
- **Router**: chi
- **Proxy**: httputil.ReverseProxy
- **Auth**: JWT (HS256/RS256)

## Configuration
Configuration is loaded from `config.yaml` (path override via `GATEWAY_CONFIG` env var).
Environment variables in the config file (e.g., `${JWT_SECRET}`) are expanded at runtime.

### Key Settings
- `server.port`: Listening port (default 8080)
- `jwt.issuer`: Required issuer claim
- `routes`: List of route prefixes and upstreams

## Middleware Chain
1. **Recovery**: Panic recovery
2. **CORS**: Cross-Origin Resource Sharing
3. **RequestLogger**: Structured JSON logging
4. **Correlation**: `X-Correlation-ID` injection
5. **Routing**: Longest-prefix match
6. **Timeout**: Upstream timeout enforcement
7. **UserInjector**: Extracts `X-User-ID` from JWT
8. **JWTMiddleware**: Validates token if `auth_required: true`
9. **RateLimiter**: Fixed-window limiting (IP or User ID)
10. **BodyLimiter**: Max request body size

## Error Handling
All errors are returned in a uniform JSON format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Description"
  }
}
```

## Development
Run locally:
```bash
go run main.go
```

Run tests:
```bash
go test ./...
```
