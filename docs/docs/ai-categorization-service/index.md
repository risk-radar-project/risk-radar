# ai-categorization-service

**Owner:** @Michal

---

# AI Categorization Service

The **AI Categorization Service** automatically categorizes incident reports using machine learning. It employs a trained scikit-learn pipeline to classify reports into predefined categories, helping organize and route reports efficiently within the RiskRadar platform.

---

## 🏗️ Architecture

### Core Capabilities

- **Automatic Categorization** – ML-based classification of incident reports
- **Multi-class Prediction** – Supports multiple incident categories with confidence scores
- **Event Publishing** – Kafka integration for categorization results
- **Audit Logging** – Complete tracking of all categorization operations

### Technology Stack

- **Language:** Python 3.11
- **Framework:** FastAPI with async/await support
- **ML Models:** scikit-learn pipeline with TfidfVectorizer
- **Messaging:** aiokafka for asynchronous Kafka operations
- **Validation:** Pydantic models with type safety

### Model Components

- **Pipeline** – Complete sklearn preprocessing + classification pipeline
- **Label Encoder** – Maps numeric predictions to category names

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
  "service": "ai-categorization-service",
  "timestamp": "2024-12-02T19:30:45.123Z",
  "model_loaded": true,
  "kafka_enabled": true
}
```

---

### Model Info
```http
GET /model-info
```

**Response:**
```json
{
  "model_type": "sklearn_pipeline",
  "model_version": "1.0.0",
  "categories": [
    "infrastruktura_drogowa",
    "bezpieczeństwo",
    "środowisko",
    "oświetlenie",
    "inne"
  ],
  "n_categories": 5
}
```

---

### Categorize Report
```http
POST /categorize
```

**Request Body:**
```json
{
  "report_id": "report-123",
  "title": "Dziura w chodniku na ul. Głównej",
  "description": "Duża dziura w chodniku która może być niebezpieczna dla pieszych",
  "user_id": "user-456"
}
```

**Response:**
```json
{
  "report_id": "report-123",
  "category": "infrastruktura_drogowa",
  "confidence": 0.8523,
  "all_probabilities": {
    "infrastruktura_drogowa": 0.8523,
    "bezpieczeństwo": 0.1123,
    "środowisko": 0.0234,
    "oświetlenie": 0.0089,
    "inne": 0.0031
  },
  "processing_time_ms": 45.23
}
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | `8080` |
| `KAFKA_BROKERS` | Kafka bootstrap servers | `kafka:9092` |
| `KAFKA_CLIENT_ID` | Kafka client identifier | `ai-categorization-service` |
| `KAFKA_ENABLED` | Enable/disable Kafka | `true` |
| `AUDIT_SERVICE_URL` | Audit log service URL | `http://audit-log-service:8080` |
| `AUDIT_ENABLED` | Enable/disable audit logging | `true` |

---

## 🤖 Machine Learning Pipeline

### Categories

- **infrastruktura_drogowa** – Road infrastructure issues
- **bezpieczeństwo** – Safety concerns
- **środowisko** – Environmental issues
- **oświetlenie** – Lighting problems
- **inne** – Other uncategorized issues

---

## 📝 Audit Events

### Logged Actions

- `service_startup` – Service initialization
- `service_shutdown` – Service shutdown
- `model_load` – Model loading status
- `categorize_report` – Categorization performed

---

## 🔄 Kafka Integration

### Published Topics

- **`categorization_events`** – Categorization results
- **`notification_events`** – User notifications

---

## 🚀 Development

### Local Setup

```bash
cd services/ai-categorization-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

### Docker

```bash
docker build -t ai-categorization-service .
docker run -p 8083:8080 ai-categorization-service
```
