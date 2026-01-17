# ai-verification-duplication-service

**Owner:** @Michal

---

# AI Verification-Duplication Service

The **AI Verification-Duplication Service** uses machine learning to detect fake reports and identify duplicate submissions in RiskRadar. It employs BERT-based models for content analysis and similarity detection, helping maintain data quality and prevent abuse.

---

## 🏗️ Architecture

### Core Capabilities

- **Fake Detection** – BERT-based classifier to identify potentially fraudulent reports
- **Duplicate Detection** – Cosine similarity analysis to find duplicate submissions
- **Event Publishing** – Kafka integration for verification results
- **Audit Logging** – Complete tracking of all verification operations

### Technology Stack

- **Language:** Python 3.11
- **Framework:** FastAPI with async/await support
- **ML Models:** PyTorch, Transformers (BERT), scikit-learn
- **Messaging:** aiokafka for asynchronous Kafka operations
- **Validation:** Pydantic models with type safety

### Model Components

- **BERT Model** – Fine-tuned `bert-base-uncased` for text embeddings
- **Fake Detector** – Neural network classifier head
- **Scaler** – Feature normalization (joblib)
- **Duplicate Classifier** – Similarity-based duplicate detection

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
  "service": "ai-verification-duplication-service",
  "timestamp": "2024-12-02T19:30:45.123Z",
  "models_loaded": true,
  "kafka_enabled": true
}
```

---

### Verify Report

```http
POST /verify
```

**Description:** Analyzes a report to determine if it's potentially fake.

**Request Body:**

```json
{
  "report_id": "report-789",
  "title": "Dziura w chodniku",
  "description": "Znalazłem dużą dziurę na chodniku przy ul. Głównej",
  "user_id": "user-123",
  "metadata": {
    "location": "ul. Główna 15"
  }
}
```

**Response:**

```json
{
  "report_id": "report-789",
  "is_fake": false,
  "fake_probability": 0.1234,
  "confidence": "high",
  "explanation": "Report classified as authentic with high confidence"
}
```

**Confidence Levels:**

- `high` – Probability difference > 0.3 from threshold
- `medium` – Probability difference 0.15-0.3 from threshold
- `low` – Probability difference < 0.15 from threshold

---

### Check Duplicate

```http
POST /check-duplicate
```

**Description:** Compares a report against existing reports to detect duplicates.

**Request Body:**

```json
{
  "report_id": "report-new",
  "title": "Dziura w drodze",
  "description": "Duża dziura na ulicy Głównej",
  "user_id": "user-123",
  "existing_reports": [
    {
      "id": "report-001",
      "title": "Dziura w drodze ul. Główna",
      "description": "Uszkodzenie nawierzchni"
    }
  ]
}
```

**Response:**

```json
{
  "report_id": "report-new",
  "is_duplicate": false,
  "duplicate_probability": 0.7523,
  "similar_reports": [
    {
      "report_id": "report-001",
      "title": "Dziura w drodze ul. Główna",
      "similarity": 0.7523
    }
  ]
}
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | `8080` |
| `KAFKA_BROKERS` | Kafka bootstrap servers | `kafka:9092` |
| `KAFKA_CLIENT_ID` | Kafka client identifier | `ai-verification-duplication-service` |
| `KAFKA_ENABLED` | Enable/disable Kafka | `true` |
| `AUDIT_SERVICE_URL` | Audit log service URL | `http://audit-log-service:8080` |
| `AUDIT_ENABLED` | Enable/disable audit logging | `true` |

---

## 🤖 Machine Learning Models

### Model Files

Located in `detector_model_components/`:

- `bert_model_finetuned.pth` – Fine-tuned BERT weights
- `fake_detector_head.pth` – Classification head
- `scaler.joblib` – Feature scaler
- `duplicate_classifier.joblib` – Duplicate detection model

---

## 📝 Audit Events

### Logged Actions

- `service_startup` – Service initialization with model status
- `service_shutdown` – Service shutdown
- `verify_report` – Fake detection performed
- `check_duplicate` – Duplicate check performed

---

## 🔄 Kafka Integration

### Published Topics

- **`verification_events`** – Verification and duplicate check results
- **`notification_events`** – User notifications for fake reports

---

## 🚀 Development

### Local Setup

```bash
cd services/ai-verification-duplication-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

### Docker

```bash
docker build -t ai-verification-duplication-service .
docker run -p 8089:8080 ai-verification-duplication-service
```
