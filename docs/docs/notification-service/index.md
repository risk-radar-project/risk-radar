# notification service

**Owner:** @Sergiusz Sanetra

---
 
# Notification Service

The **Notification Service** orchestrates all outbound user-facing communications for RiskRadar. It ingests domain events, applies routing rules, renders channel-specific templates, persists in-app notifications, queues transactional emails with retries, and publishes detailed audit trails. Events may arrive asynchronously via Kafka or synchronously through a fallback REST endpoint, ensuring users never miss critical platform activities.

---

## 🏗️ Architecture

### Core Capabilities

- **Event Ingestion** – Kafka consumer (`notification_events` topic) with JSON schema validation and an idempotent dispatch log.
- **Rule-Based Fan-out** – `notification_rules` map each `eventType` to target audiences, channels (`in_app`, `email`), and template keys.
- **Template Rendering** – Mustache-like renderer injects payload variables into HTML/subject/title bodies stored in `notification_templates`.
- **In-App Inbox** – Persistent notification feed per user with pagination and read tracking.
- **Email Orchestration** – Durable `email_jobs` queue, background scheduler with exponential retry, and Nodemailer SMTP delivery (Mailpit friendly by default).
- **Audit & Observability** – Every channel transition is mirrored to the Audit Log Service for compliance and troubleshooting.

### Technology Stack

- **Language:** TypeScript (Node.js 18+)
- **Framework:** Express.js
- **Messaging:** KafkaJS consumer
- **Database:** PostgreSQL (query builder is the native `pg` client)
- **Email:** Nodemailer transport over SMTP (Mailpit by default)
- **Validation:** Joi schemas + custom request-context middleware
- **Testing:** Jest + Supertest
- **Logging:** Winston with structured metadata and optional Kafka log passthrough

### Runtime Services

- `notificationConsumer` – connects to Kafka, validates messages, and forwards them to the dispatcher.
- `notificationDispatcher` – loads rules/templates, renders content, writes inbox entries, queues emails, and records audit events.
- `emailScheduler` – polls `email_jobs`, invokes `emailDeliveryService`, and schedules retries using `EMAIL_RETRY_DELAYS_MS`.
- `emailDeliveryService` – thin wrapper over Nodemailer with configurable SMTP credentials.
- `auditClient` / `userServiceClient` – Axios-based integrations with Audit Log and User services.

---

## 📊 Database Schema

### `notification_rules`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| event_type | VARCHAR | RiskRadar event identifier (e.g., `USER_REGISTERED`). Supported types: `AUDIT_SECURITY_EVENT_DETECTED`, `ROLE_ASSIGNED`, `ROLE_REVOKED`, `MEDIA_APPROVED`, `MEDIA_REJECTED`, `MEDIA_FLAGGED_NSFW`, `MEDIA_CENSORED`, `MEDIA_DELETED_SYSTEM`, `MEDIA_STORAGE_THRESHOLD`, `USER_REGISTERED`, `USER_PASSWORD_RESET_REQUESTED`, `USER_BANNED`, `USER_UNBANNED` |
| audience | VARCHAR | `user` or `admin` audience scope |
| channels | JSONB | Array of enabled channels (`["in_app","email"]`) |
| template_mappings | JSONB | Per-channel template keys |
| is_active | BOOLEAN | Disabled rules are skipped |
| created_at / updated_at | TIMESTAMPTZ | Audit columns |

### `notification_templates`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| template_key | VARCHAR | Unique identifier referenced by rules |
| event_type | VARCHAR | Associated event type |
| channel | VARCHAR | `in_app` or `email` |
| title | TEXT | Optional in-app title template |
| subject | TEXT | Optional email subject template |
| body | TEXT | HTML/markdown body template |
| created_at / updated_at | TIMESTAMPTZ | Audit columns |

### `notifications_inbox`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Inbox entry |
| user_id | UUID | Recipient user |
| event_id | UUID | Source event |
| event_type | VARCHAR | Event descriptor |
| title | TEXT | Rendered title |
| body | TEXT | Rendered body |
| metadata | JSONB | Serialized payload snapshot |
| is_read | BOOLEAN | Read flag |
| read_at | TIMESTAMPTZ | Timestamp when user read |
| created_at | TIMESTAMPTZ | Arrival time |

### `email_jobs`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Job identifier |
| event_id | UUID | Source event |
| user_id | UUID | Optional user reference |
| recipient_email | VARCHAR | Target mailbox |
| subject / body | TEXT | Rendered content |
| status | ENUM | `pending`, `sent`, `failed`, `dead` |
| retry_count | INT | Attempts performed |
| next_retry_at | TIMESTAMPTZ | Backoff schedule |
| last_error | TEXT | Latest SMTP error |
| created_at / updated_at | TIMESTAMPTZ | Audit columns |

### `event_dispatch_log`
| Column | Type | Description |
|--------|------|-------------|
| event_id | UUID | Primary key ensuring idempotency |
| event_type | VARCHAR | Event metadata |
| processed_at | TIMESTAMPTZ | Auto timestamp |

---

## 🔄 Event Flow & Channels

1. **Ingestion** – Kafka pushes a message or an external caller invokes `POST /notifications/send`.
2. **Validation** – Joi schema enforces UUID/eventType/userId/source shape; malformed payloads are logged and dropped.
3. **Idempotency** – `event_dispatch_log` prevents duplicate fan-out.
4. **Rule Lookup** – `notification_rules` defines active channels and template keys per event.
5. **Rendering** – Template variables merge event payload overrides (e.g., `email`, `displayName`) with canonical attributes.
6. **Channel Delivery**
	 - **In-App**: entry persisted in `notifications_inbox`, marked unread, and audit logged as `notification.in_app.queued`.
	 - **Email**: job inserted into `email_jobs`; scheduler later sends via SMTP with retry + dead-letter semantics.
7. **Audit Trail** – Every queue/sent/failed transition posts to the Audit Log Service for traceability.

`X-User-ID` headers provided by the API gateway populate `req.context.userId`, which is mandatory for inbox operations.

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/status` | Liveness snapshot (DB, Kafka, SMTP) |
| `GET` | `/notifications` | Paginated inbox for the authenticated user |
| `POST` | `/notifications/{id}/read` | Marks a notification as read |
| `POST` | `/notifications/{id}/unread` | Marks a notification as unread |
| `POST` | `/notifications/send` | Fallback pathway to enqueue an event manually |

> **Headers:** Inbox endpoints require `X-User-ID`.

### `GET /status`

Returns component health based on live dependency probes. The Kafka entry now exposes both the probe status and the consumer runtime mode (`connected`, `fallback`, or `disabled`), so operators can see when the service is relying on the HTTP fallback while Kafka is unavailable. `services.smtp` still resolves to `"up"`, `"down"`, or `"disabled"`, and the top-level `status` flips to `"degraded"` whenever a required dependency is down.

**200 OK**
```json
{
	"status": "ok",
	"services": {
		"database": "up",
		"kafka": {
			"status": "up",
			"mode": "connected",
			"connected": true,
			"reconnecting": false,
			"brokersConfigured": true,
			"lastError": null,
			"lastFailureAt": null
		},
		"smtp": "disabled"
	},
	"timestamp": "2025-11-19T12:34:56.000Z"
}
```

When Kafka is unreachable, the service logs at startup:

```
[WARN] Kafka unavailable at startup; HTTP fallback active while retrying connection
```

This makes it obvious in aggregated logs that HTTP-only mode is active until brokers recover.

### `GET /notifications`

Query parameters:

- `page` (default `1`, min `1`)
- `limit` (default `20`, max `100`)
- `isRead` (`true|false`) – optional filter

**200 OK**
```json
{
	"data": [
		{
			"id": "ef3f...",
			"eventId": "7b59...",
			"eventType": "USER_REGISTERED",
			"title": "Witaj w serwisie!",
			"body": "Twoje konto zostało pomyślnie utworzone.",
			"isRead": false,
			"createdAt": "2025-11-19T10:10:00.000Z"
		}
	]
}
```

**Errors**
- `400` – missing `X-User-ID` header or invalid pagination params

### `POST /notifications/{id}/read`

Marks a specific inbox record as read.

- Path param `id` – notification UUID
- Requires `X-User-ID`

**204 No Content** – notification transitioned to read state

**404 Not Found** – record not owned by the caller or already deleted

### `POST /notifications/{id}/unread`

Reverts a previously read notification back to the unread state so it remains visible in the default inbox ordering.

- Requires `X-User-ID`.
- `204 No Content` when the notification belonged to the caller and was marked unread.
- `404 Not Found` when the record does not exist, does not belong to the caller, or was already unread.

### `POST /notifications/send`

Fallback endpoint to trigger notifications without Kafka.

**Request Body**
```json
{
	"eventId": "optional-uuid",
	"eventType": "USER_REGISTERED",
	"userId": "1c7f...",
	"initiatorId": "admin-uuid",
	"payload": { "displayName": "Anna", "email": "anna@example.com" },
	"source": "admin-panel"
}
```

Refer to **Event Templates & Payloads** for event-specific fields such as `payload.resetUrl` required by password reset emails.

**Responses**
- `202 Accepted` – `{ "status": "accepted", "eventId": "generated-uuid" }`
- `400 Bad Request` – validation failure
- `500 Internal Server Error` – dispatcher failure (logged + audit trail)

---

## 🔁 Kafka Integration

- **Topic:** `notification_events` (configurable via `KAFKA_TOPIC`)
- **Client/Group:** `notification-service` / `notification-service-consumer` (overridable)
- **Payload Contract:**
	```json
	{
		"eventId": "UUIDv4",
		"eventType": "USER_REGISTERED",
		"userId": "UUID",
		"initiatorId": "UUID | null",
		"payload": { "displayName": "..." },
		"source": "originating-service"
	}
	```
- **Validation:** Joi schema rejects missing fields, malformed UUIDs, or blank payloads.
- **Logging:** Custom Kafka log creator funnels broker logs into Winston; noise can be suppressed via `LOG_KAFKA_EVENTS=false`.

When no brokers are configured, the consumer stays disabled and the service relies solely on the fallback endpoint.

---

## 📨 Event Templates & Payloads

| Event Type | Channels | Template Keys | Required Payload Fields | Notes |
|------------|----------|---------------|-------------------------|-------|
| `USER_REGISTERED` | `in_app`, `email` | `USER_REGISTERED_IN_APP`, `USER_REGISTERED_EMAIL` | _(none)_ | Include `displayName` for friendly salutation, `appUrl` for the CTA button, and override `email` in the payload when you do not want to rely on the User Service lookup. |
| `USER_PASSWORD_RESET_REQUESTED` | `email` | `USER_PASSWORD_RESET_REQUESTED_EMAIL` | `payload.resetUrl` (must be https:// or http://) | Template explains that a password reset was requested and renders both a button and the raw URL so the user can open the link and define a new password. Optional `displayName`/`expiresInMinutes` personalize the copy. |

Guidelines

- Use this table as the single source of truth for channel coverage, template keys, and required payload attributes. Add a row whenever a new event/template pair is introduced so producers know what data to supply.
- Every payload may include `email`, `userEmail`, or `recipientEmail` to override the address lookup; otherwise the dispatcher falls back to the User Service.
- Template variables silently drop when missing, but strongly-typed requirements (like `resetUrl`) are enforced by the fallback validation schema and will cause a `400`.

---

## 📧 Email Delivery & Retries

- Scheduler polls at `EMAIL_POLL_INTERVAL_MS` (default 10s).
- Retry schedule defined by `EMAIL_RETRY_DELAYS_MS` (default `[15000,30000,120000,600000,1800000]`).
- Jobs exceeding retry budget transition to `dead` and emit an audit log with the failure reason.
- Nodemailer transport supports authentication if `SMTP_USER`/`SMTP_PASSWORD` are provided; otherwise anonymous SMTP is used (Mailpit/local dev).

---

## 🛡️ Audit Logging

Every enqueue/sent/failed event triggers `auditClient.recordNotification`, which posts structured entries to the Audit Log Service. Payloads include channel, status, recipient metadata, and event identifiers, ensuring analysts can reconstruct delivery trajectories and diagnose incidents.

---

## ⚙️ Configuration

Key environment variables (see `.env.example`):

- `PORT` – HTTP port (default `8086`)
- `DATABASE_URL` – PostgreSQL DSN (required)
- `KAFKA_BROKERS`, `KAFKA_CLIENT_ID`, `KAFKA_GROUP_ID`, `KAFKA_TOPIC`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`
- `USER_SERVICE_BASE_URL` – used to enrich events with recipient email when payload lacks it
- `AUDIT_LOG_SERVICE_BASE_URL` – HTTP audit sink fallback endpoint
- `AUDIT_HTTP_TIMEOUT_MS` (default `3000`) – timeout per HTTP attempt to the Audit Log Service
- `AUDIT_HTTP_RETRIES` (default `2`) – capped retries when HTTP is used (Kafka failure or disabled)
- `AUDIT_KAFKA_ENABLED` (default `true`) – toggles Kafka-first audit publishing; when `false`, only HTTP is used
- `AUDIT_KAFKA_BROKERS` (default `kafka:9092`) – broker list for audit events
- `AUDIT_KAFKA_TOPIC` (default `audit_logs`) – topic that receives audit entries
- `AUDIT_KAFKA_CLIENT_ID` (default `notification-service`) – logical client id for audit producer
- `AUDIT_KAFKA_ACKS` (default `-1`) – acknowledgement requirement for audit writes
- `AUDIT_KAFKA_CONNECTION_TIMEOUT_MS` (default `3000`) – broker connection timeout for audit producer
- `AUDIT_KAFKA_REQUEST_TIMEOUT_MS` (default `5000`) – request timeout per Kafka send
- `AUDIT_KAFKA_SEND_TIMEOUT_MS` (default `5000`) – hard stop for producer send
- `AUDIT_KAFKA_IDEMPOTENT` (default `true`) – enables idempotent producer to avoid duplicate audit events
- `EMAIL_RETRY_DELAYS_MS`, `EMAIL_POLL_INTERVAL_MS`
- `EMAIL_SCHEDULER_BATCH_SIZE` (default `50`) – max email jobs pulled from DB per scheduler tick
- `EMAIL_SCHEDULER_CONCURRENCY` (default `5`) – number of emails sent in parallel per batch
- `LOG_LEVEL`, `LOG_DB_QUERIES`, `LOG_KAFKA_EVENTS`

---

## 🔧 Development

1. **Install dependencies**
	 ```powershell
	 cd services/notification-service
	 npm install
	 ```
2. **Configure environment** – copy `.env.example` to `.env`, set at least `DATABASE_URL`.
3. **Run locally**
	 ```powershell
	 npm run dev
	 ```
	 Migrations, seed data, the email scheduler, and the Kafka consumer start automatically once PostgreSQL is reachable.
4. **Tests & Coverage**
	 ```powershell
	 npm test
	 npx jest --coverage
	 ```

---

## 🧭 Integration Notes

- Always pass `X-User-ID` when calling inbox endpoints so records can be scoped correctly.
- Prefer Kafka for high-volume producers; reserve `POST /notifications/send` for administrative tooling, smoke tests, or emergency fallbacks.
- Populate event payloads with `displayName`, `email`, or custom variables referenced in templates to avoid missing placeholders.
- The service is stateless beyond PostgreSQL; scale horizontally for throughput—consumers coordinate via Kafka consumer groups and rely on database-level idempotency.
