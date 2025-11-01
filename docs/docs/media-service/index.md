# media service

**Owner:** @Sergiusz Sanetra

---
 
# Media Service

The Media Service handles secure upload, storage, processing, moderation, and delivery of image assets. It provides fast thumbnails/previews, strict validation and antivirus screening, permission-aware access to master images, temporary uploads lifecycle, and audit logging of all sensitive actions.

---

## 🏗️ Architecture

### Core Capabilities

- **Upload & Normalize**: Accepts JPEG/PNG, normalizes to JPEG, strips metadata, rotates, enforces max pixels/size
- **Derivatives**: Generates `thumb` and `preview` variants for efficient delivery
- **Access Control**: Enforces visibility (`public`, `owner`, `staff`) and policy checks via AuthZ
- **Moderation**: Optional OpenAI-based image moderation with fail-closed behavior
- **Antivirus**: Optional AV scan hook before storing files
- **Temporary Uploads**: Mark as temporary; later keep or reject in bulk; auto-expire via GC
- **Storage Health**: Disk usage surfaced on `/status` with warn/critical thresholds
- **Audit Logging**: Emits detailed events to the Audit Log Service
- **Resilience**: Circuit breakers, retries, and timeouts for external dependencies

### Technology Stack

- **Language:** TypeScript (Node.js 18+)
- **Framework:** Express.js
- **Image Processing:** Sharp
- **MIME Detection:** file-type
- **Database:** PostgreSQL
- **Validation:** Joi
- **Logging:** Winston

---

## 📊 Database Schema

### Tables

#### `media_assets`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| owner_id | UUID | Owner (user) ID |
| visibility | VARCHAR(10) | `public` | `owner` | `staff` |
| status | VARCHAR(10) | `approved` | `flagged` | `rejected` |
| is_temporary | BOOLEAN | Temporary upload flag |
| expires_at | TIMESTAMPTZ | Auto-expiry for temporary assets |
| deleted | BOOLEAN | Logical deletion flag |
| deleted_at | TIMESTAMPTZ | Deletion timestamp |
| content_type | VARCHAR(50) | Stored MIME type (normalized to `image/jpeg`) |
| size_bytes | BIGINT | Size of master image in bytes |
| width | INT | Master width |
| height | INT | Master height |
| content_hash | CHAR(64) | SHA-256 hash of normalized content |
| original_filename | VARCHAR(255) | Client filename (optional) |
| alt | TEXT | Alt text (sanitized, length-limited) |
| tags | JSONB | Reserved for future tagging |
| collection | VARCHAR(255) | Reserved for future grouping |
| moderation_flagged | BOOLEAN | Moderation preliminary flag |
| moderation_decision_time_ms | INT | Moderation response time |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Update timestamp |

#### Indexes
- `idx_media_owner` on `(owner_id)`
- `idx_media_status` on `(status)`
- `idx_media_visibility` on `(visibility)`
- `idx_media_hash` on `(content_hash)`
- `idx_media_created` on `(created_at DESC)`
- `idx_media_temporary_expiry` on `(is_temporary, expires_at)`

---

## 🔐 Authorization & Permissions

Authorization is delegated to the AuthZ service with circuit breakers and retries. The Media Service uses these permission identifiers (see `src/authz/permissions.ts`):

- `media:read-all` – Read all assets (including non-approved variants, master access when not owner)
- `media:moderate` – Change moderation status (`approve`/`reject`/`flag`)
- `media:censor` – Apply manual censoring (full-image pixelation)
- `media:delete` – Delete any media asset
- `media:update` – Update others’ assets (visibility, alt)

Visibility rules for master image access:

- Anonymous users: only `public` and `approved` masters
- Owner: full access to own masters
- Holders of `media:read-all`: full access
- Otherwise: returns placeholders depending on state (`forbidden`, `flagged`, `deleted`)


The requester identity is passed via `X-User-ID` header.

---

## 🔄 Audit Logging

All sensitive operations emit audit events to the Audit Log Service. The emitter first publishes to Kafka (`audit_logs` topic) and automatically falls back to the REST `/logs` endpoint whenever Kafka is unavailable:

- `media_uploaded` (temporary flag in metadata)
- `moderation_changed` (from → to)
- `media_censored` (operation, strength)
- `visibility_changed` (from → to)
- `media_deleted`
- `temporary_kept` / `temporary_rejected`
- `access_denied`, `http_error`, `storage_threshold_warn/critical`

---

## 🔌 API Endpoints

### Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/status` | Health check and service status |
| `POST` | `/media` | Upload new image (multipart) |
| `GET` | `/media` | List media assets with pagination |
| `GET` | `/media/{id}` | Get master/original image (policy-aware) |
| `GET` | `/media/{id}/thumb` | Get thumbnail variant |
| `GET` | `/media/{id}/preview` | Get preview variant |
| `PATCH` | `/media/{id}` | Update asset (visibility, alt, moderation, censor) |
| `DELETE` | `/media/{id}` | Delete asset |
| `POST` | `/media/temporary/keep` | Keep temporary assets (bulk) |
| `POST` | `/media/temporary/reject` | Reject temporary assets (bulk) |

Base path: `/media`

Common headers:

- `X-User-ID`: UUID of the requester (required for owner-specific behavior and AuthZ checks)

### Upload

POST `/media`

Multipart form-data:

- `file` (required): JPEG or PNG. Service normalizes to JPEG.
- Fields (optional):
	- `visibility`: `public` | `owner` | `staff` (default: `owner`)
	- `alt`: string (max `ALT_MAX_LEN`)
	- `temporary`: boolean or string (`1|0|true|false|yes|no|on|off`)

Query (optional):

- `temporary`: same semantics as body. If set, marks asset as temporary, with `expires_at` in `TEMP_MEDIA_TTL_HOURS`.

Responses:

- 201 Created: JSON `MediaEntity`
- 400 Validation failed
- 413 Payload too large (bytes/pixels)
- 415 Unsupported media type
- 422 Unprocessable entity (e.g., AV detected)
- 503 Dependency unavailable (AuthZ/Audit when required paths fail hard)

Notes:

- Antivirus (if enabled) runs on original buffer; moderation runs on normalized content.
- Derivatives `thumb` and `preview` are generated on upload.

---

### Fetch Master

GET `/media/{id}`

Behavior:

- Enforces visibility + moderation policy. Non-eligible requests receive a placeholder (`forbidden`, `flagged`, or `deleted`).

Responses:

- 200 OK: `image/jpeg` bytes with `ETag` and `Cache-Control: no-store`
- 304 Not Modified: when `If-None-Match` matches
- 404 Not Found: asset or content missing

---

### Fetch Variants

GET `/media/{id}/thumb`  
GET `/media/{id}/preview`

Behavior:

- For non-approved items, only staff (`media:read-all`) can see real variants; others receive `flagged` placeholder.
- Approved variants are served with immutable caching headers.

Responses:

- 200 OK: `image/jpeg` bytes with `ETag` and `Cache-Control: public, max-age=..., immutable`
- 304 Not Modified
- 404 Not Found

---

### List

GET `/media`

Query:

- `owner` (uuid, allowed only if caller has `media:read-all`)
- `status`: `approved|flagged|rejected`
- `visibility`: `public|owner|staff`
- `date_from` / `date_to`: ISO timestamps
- `page` (default 1), `limit` (1..100, default 20)

Response 200 OK:
```json
{
	"data": [/* MediaEntity[] */],
	"pagination": {
		"page": 1,
		"pageSize": 20,
		"total": 0,
		"totalPages": 1,
		"hasNext": false,
		"hasPrev": false
	}
}
```

Errors: 400 on validation.

---

### Update (Patch)

PATCH `/media/{id}`

Body (at least one field):

- `visibility`: `public|owner|staff` (owner or `media:update`)
- `alt`: string (owner or `media:update`)
- `action`: `approve|reject|flag` (requires `media:moderate`)
- `censor`: `{ strength: number }` full-image pixelation (requires `media:censor`)

Responses:

- 200 OK: updated `MediaEntity`
- 403 Forbidden: insufficient permissions
- 404 Not Found

---

### Delete

DELETE `/media/{id}`

Marks asset as deleted, removes files, emits audit, and increments counters.

Responses:

- 204 No Content
- 403 Forbidden (requires `media:delete`)
- 404 Not Found

---

### Temporary Lifecycle

POST `/media/temporary/keep`

Body:
```json
{ "ids": ["<uuid>", "<uuid>"] }
```

Response 200 OK:
```json
{ "kept": ["<uuid>"], "requested": ["<uuid>"] }
```

Errors: 400 on validation.

---

POST `/media/temporary/reject`

Body:
```json
{ "ids": ["<uuid>", "<uuid>"] }
```

Response 200 OK:
```json
{ "rejected": ["<uuid>"], "requested": ["<uuid>"] }
```

Errors: 400 on validation.

---

## 📈 Status Endpoint

GET `/status`

Provides health and capacity snapshot, including database bootstrap info and dependency breaker states.

Sample 200 OK:
```json
{
	"http_status": "OK",
	"timestamp": "2025-08-30T12:34:56.789Z",
	"database_connection": "healthy",
	"database_bootstrap": {
		"attempts": 1,
		"last_error": null,
		"started_at": "2025-08-30T12:34:50.000Z",
		"is_connected": true
	},
	"dependencies": { "audit": "active", "authz": "active" },
	"dependencies_raw": { "audit": "closed", "authz": "closed" },
	"media_root": "./data",
	"disk_total_bytes": 1000000000,
	"disk_used_bytes": 123456789,
	"disk_used_percent": 12,
	"storage_warn": false,
	"storage_critical": false,
	"uploads_total": 1,
	"reads_master_total": 1,
	"reads_thumb_total": 1,
	"reads_preview_total": 1,
	"deletes_total": 0
}
```

On storage threshold exceeding configured levels, the service emits audit events (`storage_threshold_warn`/`storage_threshold_critical`).

---

## ⚙️ Configuration

Environment variables (`.env.example`).

Defaults and parsing live in `src/config/config.ts`.

### Audit Delivery

- `AUDIT_KAFKA_ENABLED` — enables Kafka publishing (auto-enabled when brokers are provided)
- `AUDIT_KAFKA_BROKERS` — comma-separated broker list, e.g. `kafka:9092`
- `AUDIT_KAFKA_TOPIC` — Kafka topic for audit events (default `audit_logs`)
- `AUDIT_KAFKA_CLIENT_ID` — Kafka client identifier (default `media-service`)
- `AUDIT_KAFKA_ACKS` — producer acknowledgements (`-1` all replicas, default)
- `AUDIT_TIMEOUT_MS` / `AUDIT_RETRIES` — HTTP fallback timeout + retry budget

---

## 🧹 Retention & GC

- Logical deletes are hard-deleted after `GC_DELETE_AFTER_DAYS` by a periodic task
- Temporary assets with expired `expires_at` are removed automatically
- Batch size and interval are configurable; GC runs once service starts

---

## 🔧 Development

### Prerequisites
- Node.js 18+
- PostgreSQL with a database URL like: `postgres://user:pass@localhost:5432/risk-radar?sslmode=disable`

### Install, Build, Run

Install dependencies:
```powershell
npm install
```

Dev mode with auto-reload:
```powershell
npm run dev
```

Run tests:
```powershell
npm test
```

---

## ❗ Error Model

Standardized JSON errors:

- 400: `{ "error": "validation_failed", "details": ["..."] }`
- 403: `{ "error": "FORBIDDEN", "message": "Forbidden" }`
- 404: `{ "error": "NOT_FOUND", "message": "Not found" }`
- 413: `{ "error": "PAYLOAD_TOO_LARGE", "message": "..." }`
- 415: `{ "error": "UNSUPPORTED_MEDIA_TYPE", "message": "..." }`
- 422: `{ "error": "UNPROCESSABLE_ENTITY", "message": "...", "details": { "code": "AV_DETECTED", ... } }`
- 500: `{ "error": "internal_error", "message": "Unexpected error" }` (includes debug info in non-production)
- 503: `{ "error": "DEPENDENCY_UNAVAILABLE", "message": "Dependency unavailable", "details": { "service": "authz|audit" } }`

---

## 🧪 Notes for Integrators

- Always send `X-User-ID` with user UUID for correct policy enforcement
- Use `temporary` uploads for draft flows; finalize via `/temporary/keep` or discard via `/temporary/reject`
- Cache policy: variants are immutable-cached; master is `no-store`
- Placeholders provided for `deleted`, `flagged`, and `forbidden` cases

