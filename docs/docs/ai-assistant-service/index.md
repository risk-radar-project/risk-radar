# ai-assistant-service

**Owner:** @Michal

---

# AI Assistant Service

The **AI Assistant Service** provides conversational AI capabilities for RiskRadar users. It offers chat-based assistance for navigating the platform, understanding features, and getting help with report submissions. The service integrates with Kafka for event streaming and the Audit Log Service for comprehensive activity tracking.

---

## 🏗️ Architecture

### Core Capabilities

- **Chat Interface** – REST API for conversational interactions with context tracking
- **Event Publishing** – Kafka integration for broadcasting chat events to other services
- **Audit Logging** – Comprehensive logging of all user interactions
- **Notification Integration** – Automatic notifications for chat responses via Kafka

### Technology Stack

- **Language:** Python 3.11
- **Framework:** FastAPI with async/await support
- **Messaging:** aiokafka for asynchronous Kafka operations
- **Validation:** Pydantic models with type safety
- **HTTP Client:** aiohttp for audit service communication

### Kafka Integration

- **Published Topics:**
  - `ai_assistant_events` – Chat interactions and conversation events
  - `notification_events` – User notifications for chat responses

- **Event Types:**
  - `chat_interaction` – User message and assistant response pairs
  - `chat_response` – Notification trigger for new responses

---

## 📊 API Endpoints

### Health Check

```http
GET /health
```

**Response:**

```json
{
  "status": "healthy",
  "service": "ai-assistant-service",
  "timestamp": "2024-12-02T19:30:45.123Z",
  "kafka_enabled": true
}
```

---

### Chat

```http
POST /chat
```

**Request Body:**

```json
{
  "user_id": "user-123",
  "message": "Jak zgłosić problem?",
  "conversation_id": "conv-456",
  "context": {
    "previous_topic": "navigation"
  }
}
```

**Response:**

```json
{
  "conversation_id": "conv-456",
  "message": "Aby zgłosić problem, kliknij przycisk 'Nowe zgłoszenie' w menu głównym...",
  "suggestions": [
    "Zgłoś problem",
    "Sprawdź status zgłoszenia",
    "Pomoc"
  ],
  "metadata": {
    "processed_at": "2024-12-02T19:30:45.123Z"
  }
}
```

---

### Get Conversation

```http
GET /conversations/{conversation_id}
```

**Response:**

```json
{
  "conversation_id": "conv-456",
  "messages": [],
  "metadata": {}
}
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | `8080` |
| `KAFKA_BROKERS` | Kafka bootstrap servers | `kafka:9092` |
| `KAFKA_CLIENT_ID` | Kafka client identifier | `ai-assistant-service` |
| `KAFKA_ENABLED` | Enable/disable Kafka | `true` |
| `AUDIT_SERVICE_URL` | Audit log service URL | `http://audit-log-service:8080` |
| `AUDIT_ENABLED` | Enable/disable audit logging | `true` |

---

## 📝 Audit Events

### Logged Actions

- `service_startup` – Service initialization
- `service_shutdown` – Service shutdown
- `chat_request` – User chat message received

### Event Schema

```json
{
  "service": "ai-assistant-service",
  "action": "chat_request",
  "actor": {
    "id": "user-123",
    "type": "user"
  },
  "status": "success",
  "log_type": "ACTION",
  "metadata": {
    "conversation_id": "conv-456",
    "message_length": 42
  }
}
```

---

## 🚀 Development

### Local Setup

```bash
cd services/ai-assistant-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

### Docker

```bash
docker build -t ai-assistant-service .
docker run -p 8088:8080 \
  -e KAFKA_BROKERS=kafka:9092 \
  -e AUDIT_SERVICE_URL=http://audit-log-service:8080 \
  ai-assistant-service
```

---

## 🔗 Integration Points

- **Audit Log Service** – HTTP POST for event logging
- **Notification Service** – Kafka events for user notifications
- **User Service** – Future integration for user context retrieval
