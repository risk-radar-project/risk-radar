# api gateway

**Owner:** @Sergiusz Sanetra

---

# API Gateway

The **API Gateway** is the central entry point for the RiskRadar platform. It handles routing, authentication, rate limiting, and request normalization for all microservices. It acts as a unified facade for the entire system, ensuring security and consistency.

---

## 🏗️ Architecture

### Core Components

- **Routing Engine** - Dynamic request routing based on longest-prefix matching
- **Authentication & Authorization** - JWT validation and user context injection
- **Rate Limiting** - Protection against abuse (IP and User-based)
- **Request Normalization** - Standardized headers (Correlation ID, User ID)
- **Audit Logging** - Centralized logging of all incoming requests
- **CORS Management** - Global Cross-Origin Resource Sharing configuration
- **WebSocket Support** - Handling of persistent connections (e.g., for Audit Logs)

### Technology Stack

- **Language:** Go 1.22
- **Router:** chi (lightweight, idiomatic router)
- **Proxy:** httputil.ReverseProxy (standard library)
- **Auth:** JWT (HS256/RS256)
- **Configuration:** YAML + Environment Variables

---

## ⚙️ Configuration

Configuration is loaded from `config.yaml` (path override via `GATEWAY_CONFIG` env var).
Environment variables in the config file (e.g., `${JWT_SECRET}`) are expanded at runtime.

### Key Settings

- `server.port`: Listening port (default 8080)
- `jwt.issuer`: Required issuer claim
- `routes`: List of route prefixes and upstreams

### Middleware Chain

1. **Recovery**: Panic recovery for stability
2. **CORS**: Cross-Origin Resource Sharing handling
3. **RequestLogger**: Structured JSON logging (integrated with Audit Service)
4. **Correlation**: `X-Correlation-ID` injection for distributed tracing
5. **Routing**: Longest-prefix match to determine upstream
6. **Timeout**: Upstream timeout enforcement (with WebSocket exception)
7. **UserInjector**: Extracts `X-User-ID` from JWT and injects into headers
8. **JWTMiddleware**: Validates token if `auth_required: true`
9. **RateLimiter**: Fixed-window limiting (IP or User ID)
10. **BodyLimiter**: Max request body size enforcement

---

## 🛣️ Routing Table

The Gateway routes traffic to the following internal microservices:

| Prefix | Upstream Service | Auth Required | Description |
|--------|------------------|---------------|-------------|
| `/api/users` | `user-service` | No | User registration, login, management |
| `/api/authz` | `authz-service` | Yes | Role and permission management |
| `/api/notifications` | `notification-service` | Yes | User notifications |
| `/api/reports` | `report-service` | Yes | Incident reporting |
| `/api/map` | `map-service` | No | Map data and visualization |
| `/api/media` | `media-service` | Yes | File uploads (images/videos) |
| `/api/ai/categorization` | `ai-categorization-service` | Yes | AI incident categorization |
| `/api/ai/verification` | `ai-verification-duplication-service` | Yes | AI verification & duplicate check |
| `/api/ai/assistant` | `ai-assistant-service` | Yes | AI Threat Analysis |
| `/api/audit` | `audit-log-service` | Yes | System audit logs (supports WebSocket) |

---

## 🛡️ Security & Error Handling

### Authentication
- Validates **JWT Bearer Tokens** in the `Authorization` header.
- Injects `X-User-ID` header into upstream requests for authenticated users.

### Error Handling
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

### WebSocket Support
The Gateway detects `Upgrade: websocket` headers and bypasses standard timeouts to allow persistent connections (e.g., for real-time audit logs).

---

## 💻 Development

### Run locally
```bash
go run main.go
```

### Run tests
```bash
go test ./...
```

### Generate Dev Token
Only available in development mode (`NODE_ENV=development`).
**POST** `/api/dev/generate-jwt`
```json
{
  "user_id": "uuid",
  "roles": ["ADMIN"],
  "permissions": ["*"]
}
```
