# ai categorization service

**Owner:** @Michał Rzepecki


## 🔹 Health & Root 🩺

### GET /
**Description:** Root endpoint with service information and a list of all available endpoints.

**Example Response:**

```json
{
  "service": "AI Categorization Service",
  "version": "1.0.0",
  "endpoints": {
    "categorize": "POST /categorize - Categorize single incident",
    "batch_categorize": "POST /batch-categorize - Categorize multiple incidents",
    "categories": "GET /categories - List all available categories",
    "category_info": "GET /categories/{category} - Get info about specific category",
    "statistics": "GET /statistics - Get model and service statistics",
    "validate": "POST /validate - Validate and preview text preprocessing",
    "model_info": "GET /model-info - Get detailed model information",
    "health": "GET /health - Health check"
  }
}
```

---

### GET /health
**Description:** Checks the service's health status.

**Example Request:**
```
GET http://localhost:8083/health
```

**Example Response:**

```json
{
  "status": "healthy",
  "service": "ai-categorization"
}
```

---

## 🔹 Categorization 📝

### POST /categorize
**Description:** Categorizes a single incident description.

**Example Request Body:**

```json
{
  "title": "Wypadek drogowy na głównej ulicy"
}
```

**Example Response:**

```json
{
  "category": "accident",
  "title": "Wypadek drogowy na głównej ulicy",
  "metrics": {
    "prediction_confidence": 0.92,
    "response_time_ms": 45.2,
    "model_accuracy": "0.88",
    "preprocessing_time_ms": 10.1,
    "vectorization_time_ms": 8.3,
    "inference_time_ms": 12.5
  },
  "model_info": {
    "model_type": "LogisticRegression",
    "model_version": "1.0.0",
    "categories": ["traffic", "accident", "infrastructure", "damage", "pedestrian", "danger"],
    "feature_count": {
      "word_features": 5000,
      "char_features": 2000,
      "numerical_features": 7
    },
    "training_info": {
      "training_date": "2025-01-01",
      "model_file": "incident_classifier_clean.pkl"
    }
  }
}
```

---

### POST /batch-categorize
**Description:** Categorizes multiple incidents at once (max 100).

**Example Request Body:**

```json
[
  {"title": "Kolizja dwóch pojazdów"},
  {"title": "Awaria sygnalizacji świetlnej"}
]
```

**Example Response:**

```json
{
  "results": [
    {
      "index": 0,
      "category": "accident",
      "title": "Kolizja dwóch pojazdów",
      "confidence": 0.87,
      "processing_time_ms": 40.2
    },
    {
      "index": 1,
      "category": "infrastructure",
      "title": "Awaria sygnalizacji świetlnej",
      "confidence": 0.91,
      "processing_time_ms": 42.5
    }
  ],
  "batch_stats": {
    "total_items": 2,
    "successful": 2,
    "failed": 0,
    "total_processing_time_ms": 85.1,
    "average_time_per_item_ms": 42.6
  }
}
```

---

## 🔹 Categories 🗂️

### GET /categories
**Description:** Lists all available categories for the model.

**Example Request:**
```
GET http://localhost:8083/categories
```

**Example Response:**

```json
{
  "categories": ["traffic", "accident", "infrastructure", "damage", "pedestrian", "danger"],
  "total_categories": 6,
  "model_type": "LogisticRegression"
}
```

---

### GET /categories/{category}
**Description:** Retrieves detailed information about a specific category.

**Example Request:**
```
GET http://localhost:8083/categories/traffic
```

**Example Response:**

```json
{
  "category": "traffic",
  "description": "Traffic-related incidents including accidents, collisions, and traffic flow problems",
  "keywords": ["ruch", "droga", "ulica", "auto", "samochód", "pojazd", "kierowca"],
  "examples": ["Kolizja dwóch pojazdów", "Korek na głównej ulicy", "Awaria pojazdu na drodze"],
  "total_categories": 6
}
```

---

## 🔹 Model & Statistics 📈

### GET /statistics
**Description:** Provides statistics about the model and the service.

**Example Response:**

```json
{
  "model_stats": {
    "model_type": "LogisticRegression",
    "model_version": "1.0.0",
    "model_accuracy": "0.88",
    "training_date": "2025-01-01",
    "total_categories": 6
  },
  "feature_stats": {
    "word_features": 5000,
    "char_features": 2000,
    "numerical_features": 7,
    "total_features": 7007
  },
  "categories": ["traffic", "accident", "infrastructure", "damage", "pedestrian", "danger"],
  "service_info": {
    "service_name": "AI Categorization Service",
    "version": "1.0.0",
    "status": "operational"
  }
}
```

---

### GET /model-info
**Description:** Fetches detailed information about the machine learning model.

**Example Response:**

```json
{
  "model_info": {
    "model_type": "LogisticRegression",
    "model_file": "incident_classifier_clean.pkl",
    "numerical_features": ["text_length", "word_count", "has_traffic", "has_accident"],
    "word_vectorizer_features": 5000,
    "char_vectorizer_features": 2000,
    "model_accuracy": "0.88",
    "training_date": "2025-01-01",
    "model_version": "1.0.0",
    "categories": ["traffic", "accident", "infrastructure", "damage", "pedestrian", "danger"]
  },
  "status": "loaded"
}
```

---

## 🔹 Validation ✅

### POST /validate
**Description:** Validates input and provides a preview of how text is preprocessed before being fed to the model.

**Example Request Body:**

```json
{
  "title": "Awaria sygnalizacji świetlnej na skrzyżowaniu"
}
```

**Example Response:**

```json
{
  "original_text": "Awaria sygnalizacji świetlnej na skrzyżowaniu",
  "cleaned_text": "awaria sygnalizacja świetlny skrzyżowanie",
  "text_length": 43,
  "cleaned_length": 39,
  "word_count": 5,
  "cleaned_word_count": 4,
  "detected_features": {
    "text_length": 43,
    "word_count": 5,
    "has_infrastructure": 1,
    "has_damage": 1
  },
  "is_valid": true
}
```
