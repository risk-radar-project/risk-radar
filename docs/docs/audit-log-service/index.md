# audit log service

**Owner:** @Sergiusz Sanetra

---
 
# Audit Log Service

The **Audit Log Service** is a centralized event tracking and audit logging microservice for RiskRadar. It provides comprehensive audit trails, real-time event streaming, and GDPR-compliant data management for all platform activities. This service ensures complete accountability and compliance across the entire RiskRadar ecosystem.

---

## 🏗️ Architecture

### Core Components

- **Event Logging** - Capture and store audit events from all microservices
- **Real-time Streaming** - WebSocket-based live event notifications
- **Advanced Filtering** - Sophisticated query capabilities with pagination
- **Data Anonymization** - GDPR-compliant user data anonymization
- **Retention Management** - Automated cleanup and data lifecycle management

### Technology Stack

- **Language:** TypeScript (Node.js 18+)
- **Framework:** Express.js with custom middleware
- **Database:** PostgreSQL with JSONB storage
- **WebSocket:** Socket.IO for real-time communication
- **Validation:** Joi schema validation
- **Testing:** Jest with Supertest

---

## 📊 Database Schema

### Tables

#### `audit_logs`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| timestamp | TIMESTAMPTZ | Event timestamp - when the logged event occurred (user-specified or auto-generated) |
| service | VARCHAR(255) | Source microservice name |
| action | VARCHAR(255) | Action performed (e.g., "create", "update") |
| actor | JSONB | Actor information (user, system, etc.) |
| target | JSONB | Target resource affected by action (nullable) |
| status | VARCHAR(50) | Operation status: 'success', 'failure', 'warning', 'error' |
| operation_id | VARCHAR(255) | Idempotency key for duplicate prevention (nullable) |
| log_type | VARCHAR(50) | Log type: 'ACTION', 'SECURITY', 'SYSTEM', 'ERROR', 'INFO' |
| metadata | JSONB | Additional context and custom data (nullable) |
| is_anonymized | BOOLEAN | Flag indicating if data has been anonymized (default: false) |

#### Indexes
- **Primary Index:** `audit_logs_pkey` on `id`
- **Time-based Index:** `idx_audit_logs_timestamp` on `timestamp`
- **Service Index:** `idx_audit_logs_service` on `service`
- **Action Index:** `idx_audit_logs_action` on `action`
- **Status Index:** `idx_audit_logs_status` on `status`
- **Log Type Index:** `idx_audit_logs_log_type` on `log_type`
- **Operation ID Unique Index:** `ux_audit_logs_operation_id` UNIQUE on `operation_id` (WHERE operation_id IS NOT NULL) — enforces DB-level idempotency across instances.
- **Actor ID Expression Index:** `idx_audit_logs_actor_id` on `(actor->>'id')`
- **Target ID Expression Index:** `idx_audit_logs_target_id` on `(target->>'id')`
- **Actor Index:** `idx_audit_logs_actor_gin` (GIN) on `actor`
- **Target Index:** `idx_audit_logs_target_gin` (GIN) on `target`
- **Metadata Index:** `idx_audit_logs_metadata_gin` (GIN) on `metadata`
- **Anonymization Index:** `idx_audit_logs_is_anonymized` on `is_anonymized`

#### Database Constraints
- **Status Check:** Ensures status is one of: 'success', 'failure', 'warning', 'error'
- **Log Type Check:** Ensures log_type is one of: 'ACTION', 'SECURITY', 'SYSTEM', 'ERROR', 'INFO'

---

## 🔄 Event Types & Structure

### Log Types
- **ACTION** - User actions and business operations
- **SYSTEM** - Internal system events and operations
- **SECURITY** - Authentication, authorization, and security events
- **ERROR** - Error conditions and exception handling
- **INFO** - Informational events and general notices

### Status Values
- **success** - Operation completed successfully
- **failure** - Operation failed with error
- **warning** - Operation completed with warnings
- **error** - Operation failed with errors

### Standard Event Structure

#### Actor Format
```json
{
  "id": "user-uuid-123",
  "type": "user",
  "ip": "192.168.1.100"
}
```

#### Target Format
```json
{
  "id": "resource-uuid-456",
  "type": "report"
}
```

#### Metadata Format

The `metadata` field is a flexible JSONB object that accepts any valid JSON structure. Use it to store custom context data relevant to your specific use case - whether it's technical details, business information, or application-specific data.

*Note: No predefined schema is enforced. Each microservice can define its own metadata object based on its logging needs.*

---

## 🔌 API Endpoints

### Overview

The Audit Log Service provides a RESTful API for creating, retrieving, and managing audit logs. All endpoints return JSON responses and follow standard HTTP status codes.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/status` | Health check and service status |
| `POST` | `/logs` | Create new audit log entry |
| `GET` | `/logs` | Retrieve audit logs with filtering |
| `GET` | `/logs/{id}` | Get specific audit log by ID |
| `POST` | `/logs/anonymize` | Anonymize user data for GDPR compliance |

---

### Health Check

#### `GET /status`

Returns the current health status of the service and database connection.

**Response 200 OK:**
```json
{
  "status": "OK",
  "timestamp": "2025-08-08T22:05:01.963Z",
  "database_connection": "healthy",
  "websocket_enabled": true,
  "websocket_connections": 0
}
```

**Response 503 Service Unavailable:**
```json
{
  "status": "OK",
  "timestamp": "2025-08-08T14:30:45.123Z",
  "database_connection": "unhealthy",
  "websocket_enabled": false,
  "websocket_connections": 0
}
```

Note: On unexpected errors, the service may return:
```json
{
  "status": "error",
  "timestamp": "2025-08-08T14:30:45.123Z",
  "error": "Health check failed",
  "details": "<reason>"
}
```
with HTTP 503.

---

### Audit Log Management

#### `POST /logs`

Creates a new audit log entry with automatic timestamp and idempotency support.

**Request Body:**
```json
{
  "service": "user-service",
  "action": "login",
  "actor": {
    "id": "user-123",
    "type": "user",
    "ip": "192.168.1.100"
  },
  "target": {
    "id": "dashboard",
    "type": "page"
  },
  "status": "success",
  "log_type": "ACTION",
  "metadata": {
    "request_id": "req-789",
    "session_id": "sess-456",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0"
  },
  "operation_id": "login-user-123-20250808143045"
}
```

**Field Validation:**

- `service`: Required, 1-255 characters

- `action`: Required, 1-255 characters

- `actor`: Required object with `id`, `type` fields

- `actor.type`: Required, enum: 'user', 'admin', 'system', 'service', 'unknown'

- `actor.ip`: Optional, valid IP address

- `status`: Required, enum: 'success', 'failure', 'warning', 'error'

- `log_type`: Required, enum: 'ACTION', 'SECURITY', 'SYSTEM', 'ERROR', 'INFO'

- `target`: Optional object

- `metadata`: Optional JSONB object

- `operation_id`: Optional, used for idempotency


**Response 201 Created:**
```json
{
  "id": "932700c7-4c6c-47bd-9614-50cda872220b",
  "timestamp": "2025-08-08T22:07:04.913Z",
  "service": "user-service",
  "action": "login",
  "actor": {
    "id": "user-123",
    "type": "user",
    "ip": "192.168.1.100"
  },
  "target": {
    "id": "dashboard",
    "type": "page"
  },
  "status": "success",
  "operation_id": "login-user-123-20250808143045",
  "log_type": "ACTION",
  "metadata": {
    "request_id": "req-789",
    "session_id": "sess-456",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0"
  },
  "is_anonymized": false
}
```

**Response 204 No Content (Idempotency):**
When `operation_id` matches an existing log, the service returns HTTP 204 with no response body. Idempotency is guaranteed at the database level via a UNIQUE partial index on `operation_id`.

**Response 400 Bad Request:**
```json
{
  "error": "Validation failed",
  "details": [
    "Body: \"service\" is required"
  ]
}
```

**Response 500 Internal Server Error:**
```json
{
  "error": "<internal error message>",
  "message": "Failed to create audit log"
}
```

---

#### `GET /logs`

Retrieves audit logs with advanced filtering and pagination. Results are sorted by `timestamp` in descending order.

**Query Parameters:**

- `service` (optional): Filter by service name

- `action` (optional): Filter by action

- `actor_id` (optional): Filter by actor ID

- `target_id` (optional): Filter by target ID

- `status` (optional): Filter by status ('success', 'failure', 'warning', 'error')

- `log_type` (optional): Filter by log type ('ACTION', 'SECURITY', 'SYSTEM', 'ERROR', 'INFO')

- `start_date` (optional): Filter from date (ISO 8601 format)

- `end_date` (optional): Filter to date (ISO 8601 format)

- `page` (optional): Page number (default: 1, min: 1)

- `limit` (optional): Items per page (default: 50, max: 1000)

**Example Request:**
```
GET /logs?service=user-service&status=success&start_date=2025-08-01T00:00:00Z&page=1&limit=20
```

**Response 200 OK:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "service": "user-service",
      "action": "login",
      "actor": {
        "id": "user-123",
        "type": "user"
      },
      "target": {
        "id": "dashboard",
        "type": "page"
      },
      "status": "success",
      "log_type": "ACTION",
      "timestamp": "2025-08-08T14:30:45.123Z",
      "is_anonymized": false
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Response 400 Bad Request:**
```json
{
  "error": "Validation failed",
  "details": [
    "<validation messages from Joi>"
  ]
}
```

---

#### `GET /logs/{id}`

Retrieves a specific audit log entry by its UUID.

**Parameters:**

- `id` (path, required): UUID of the audit log

**Response 200 OK:**
```json
{
  "id": "932700c7-4c6c-47bd-9614-50cda872220b",
  "timestamp": "2025-08-08T22:07:04.913Z",
  "service": "user-service",
  "action": "login",
  "actor": {
    "id": "user-123",
    "type": "user",
    "ip": "192.168.1.100"
  },
  "target": {
    "id": "dashboard",
    "type": "page"
  },
  "status": "success",
  "log_type": "ACTION",
  "metadata": {
    "request_id": "req-789",
    "session_id": "sess-456",
    "user_agent": "Mozilla/5.0 Chrome/91.0"
  },
  "operation_id": "login-user-123-20250808143045",
  "is_anonymized": false
}
```

**Response 400 Bad Request:**
```json
{
  "error": "Validation failed",
  "details": ["<validation messages from Joi>"]
}
```

**Response 404 Not Found:**
```json
{
  "error": "Audit log not found",
  "message": "Audit log not found"
}
```

---

#### `POST /logs/anonymize`

Anonymizes user data in audit logs for GDPR compliance. Supports dry-run mode for preview.

**Request Body:**
```json
{
  "actor_id": "user-123"
}
```

**Query Parameters:**

- `dry_run` (optional): Set to 'true' for preview without actual anonymization

**Field Validation:**

- `actor_id`: Required, string

**Response 200 OK (Anonymization Performed):**
```json
{
  "message": "Logs anonymized successfully",
  "affected_rows": 2
}
```

**Response 200 OK (Dry Run):**
```json
{
  "message": "Dry run completed",
  "affected_rows": 2,
  "actor_id": "user-123",
  "warning": "This is a preview. No data was modified."
}
```

**Response 400 Bad Request:**
```json
{
  "error": "Validation failed",
  "details": [
    "Body: \"actor_id\" is required"
  ]
}
```

---

### Error Handling

The API returns consistent error responses:

- 400 Bad Request (validation errors):
```json
{
  "error": "Validation failed",
  "details": [
    "Body: <details>",
    "Query: <details>",
    "Params: <details>"
  ]
}
```

- 404 Not Found / 500 Internal Server Error:
```json
{
  "error": "<cause>",
  "message": "<context>"
}
```

- Health check failures (HTTP 503): either standard status payload with `database_connection` set to `unhealthy`, or:
```json
{
  "status": "error",
  "timestamp": "<ts>",
  "error": "Health check failed",
  "details": "<reason>"
}
```

---

## 🔄 Real-time Features

### WebSocket Integration

The service provides real-time audit log streaming through Socket.IO. WebSocket is available only when `WEBSOCKET_ENABLED=true`.

#### Connection
```javascript
import { io } from 'socket.io-client';

// Adjust the URL to your deployment:
// - Local dev server default: http://localhost:8080
const socket = io('http://localhost:8082', { transports: ['websocket'] });

// Subscribe to specific streams (all fields optional)
socket.emit('subscribe', {
  service: 'user-service',   // subscribe to a service room
  log_type: 'ACTION'         // subscribe to a log type room
});

// Listen for events actually emitted by the server
socket.on('new_log', (log) => {
  console.log('New log:', log);
});

socket.on('service_log', (log) => {
  console.log(`Service log (${log.service}):`, log.action);
});

socket.on('log_type_log', (log) => {
  console.log(`Log type (${log.log_type}):`, log.action);
});

// Optional: handle connection errors
socket.on('connect_error', (err) => {
  console.error('Connection error:', err.message);
});
```

#### Unsubscribe
```javascript
socket.emit('unsubscribe', {
  service: 'user-service',
  log_type: 'ACTION'
});
```

#### Room Subscriptions
- Service-based rooms: `service:<name>`
- Log-type rooms: `log_type:<TYPE>`

#### Event Types
- `new_log`: Broadcast for every new log to all connected clients
- `service_log`: Emitted to clients subscribed to a specific service
- `log_type_log`: Emitted to clients subscribed to a specific log type

Note:
- There are no user-based rooms or a global admin room implemented.
- There is no `log-anonymized` event emitted on anonymization.

---

## ⏳ Kafka Integration

The service consumes audit events from Kafka to support asynchronous ingestion.

### Configuration
- `KAFKA_BROKERS` (required to enable the consumer) — comma-separated broker list, e.g. `kafka:9092`
- `KAFKA_CLIENT_ID` — defaults to `audit-log-service`
- `KAFKA_GROUP_ID` — defaults to `audit-log-service-consumer`
- `KAFKA_TOPIC` — defaults to `audit_logs`

If `KAFKA_BROKERS` is unset the consumer stays disabled. No SSL or SASL configuration is required; cluster access is internal-only.

### Message Format
Messages must match the same schema as the REST `POST /logs` endpoint. Example payload:

The consumer validates every message. Invalid or malformed entries are logged and skipped without stopping the service.

Producers should reuse `operation_id` when idempotency is required; duplicates are deduplicated by the service.

---

## �🛡️ Data Management

### Retention Policy

The service implements automated data lifecycle management:

- **Configurable Retention**: Default 365 days (configurable via `LOG_RETENTION_DAYS`)
- **Automated Cleanup**: Application-level scheduler executes daily deletion of records older than the configured retention window
- **Anonymization Tracking**: Anonymized logs marked with `is_anonymized` flag
- **Fixed Schedule**: Cleanup runs once on service start and then every 24 hours

### GDPR Compliance

#### Data Anonymization Process
1. **Identification**: Locate all logs for specific actor ID
2. **Anonymization**: Replace PII with anonymized values
3. **Flag Update**: Mark with `is_anonymized = true`
4. **Verification**: Ensure data integrity maintained

#### Anonymized Data Format
When data is anonymized, the system:

- Sets `is_anonymized` flag to `true`

- Replaces actor.id with `"[ANONYMIZED]"`

- Adds `anonymized_at` timestamp to metadata JSONB

```json
{
  "actor": {
    "id": "[ANONYMIZED]",
    "type": "user"
  },
  "metadata": {
    "anonymized_at": "2025-08-08T14:30:45.123Z"
  },
  "is_anonymized": true
}
```
Note: Only `actor.id` is changed. Other actor fields and metadata remain intact. If `metadata` was null, it is created with just the `anonymized_at` field.

## 🔧 Development

### Getting Started

1. **Navigate to the service directory**

```bash
cd services/audit-log-service
```

2. **Install Dependencies**
```bash
npm install
```

3. **Setup Environment**
- Copy the example env file and adjust values as needed

```bash
cp .env.example .env
```

- Key variables (defaults shown in `.env.example`):
  - `PORT=8080`
  - `DATABASE_URL=postgres://postgres:postgres@localhost:5432/risk_radar`
  - `NODE_ENV=development`
  - `LOG_LEVEL=info`
  - `LOG_DB_QUERIES=false`
  - `DEFAULT_PAGE_SIZE=50`
  - `MAX_PAGE_SIZE=1000`
  - `LOG_RETENTION_DAYS=365`
  - `WEBSOCKET_ENABLED=true`

Note: Ensure PostgreSQL is running and `DATABASE_URL` is reachable. Migrations run automatically on service startup.

4. **Start Development Server**
```bash
npm run dev
```

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run lint` - Run ESLint code analysis
- `npm test` - Run test suite

### Code Quality

The project maintains high code quality standards:

- **TypeScript**: Strong typing for reliability
- **ESLint**: Code style and error checking
- **Prettier**: Consistent code formatting
- **Jest**: Comprehensive testing framework
- **Joi**: Runtime schema validation