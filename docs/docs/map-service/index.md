# Map Service

**Owner:** @Filip Sanecki

Map Service for **RiskRadar** (Frontend/Backend For Frontend - BFF component), responsible for serving the map page and aggregating and delivering verified incident reports from `report-service` to the browser.

---

## 🎯 Purpose

This service provides an **interactive map** in RiskRadar.
It ensures:

* Serving the main HTML map page (`index.html`).
* Fetching **verified** incident reports from `report-service`.
* Delivering report data to client-side JavaScript for visualization (Leaflet markers with clustering).
* Caching AI verification data from Kafka events for real-time display.

---

## 🏗️ Architecture

* **Language:** Java 21
* **Framework:** Spring Boot 3.5 (Spring Web, RestTemplate, Kafka)
* **Communication:**
  * REST (RestTemplate for communication with `report-service`)
  * Kafka (Consumer for AI verification events)
* **Frontend:** Leaflet, Leaflet.markercluster (OpenStreetMap)
* **Deployment:** Docker / Docker Compose

---

## ⚙️ Core Components

### 1. Map Page Serving (`MapController.java`)

* Serves the map view (`index.html` page) via `GET /` endpoint.

### 2. Report Aggregation (`ReportQueryController.java`, `ReportServiceClient.java`)

* `GET /reports` endpoint retrieves a list of verified reports.
* `ReportServiceClient` fetches reports from `/reports/verified` endpoint in `report-service` using `RestTemplate`.
* Target URL (`report-service-url`) is configured via `${app.services.report-service-url}` variable.

### 3. AI Verification Data Cache (`VerificationCacheService.java`)

* Listens to Kafka topic `verification_events` for AI verification results.
* Stores verification data in-memory (ConcurrentHashMap) for quick access.
* Provides `GET /verification/{reportId}` endpoint to fetch cached AI data.
* Handles two event types:
  * `report_verified` - AI fake detection results
  * `duplicate_check` - Duplicate report detection results

### 4. Map Visualization (`index.html`)

* Uses **Leaflet** to display the map.
* Uses **Leaflet.markercluster** plugin for marker grouping.
* Client-side JavaScript:
  * Fetches reports from `/reports`.
  * Dynamically creates markers based on coordinates (`latitude`, `longitude`) and category-specific icons.
  * Marker popups display title, description, category, and images (fetched from `${MEDIA_SERVICE_BASE_URL}`).
  * Displays AI verification badges when available.

---

## 🔑 API Endpoints

| Method | Path | Description | Status Code | Details |
|---|---|---|---|---|
| **GET** | `/` | Serves the HTML map page (index.html). | `200 OK` | Map page loaded. |
| **GET** | `/reports` | Fetches and returns a list of verified reports from `report-service`. | `200 OK` | Returns array of `ReportDTO` objects. |
| | | | `500 Internal Server Error` | Communication error with `report-service` or internal error. |
| **GET** | `/verification/{reportId}` | Retrieves cached AI verification data for a specific report. | `200 OK` | Returns `VerificationDataDTO` object. |
| | | | `404 Not Found` | No verification data found for this report. |

---

## 🗃️ Integration with Other Services

| Target Service | Client Component | Communication | Target Endpoint | Purpose |
|---|---|---|---|---|
| `report-service` | `ReportServiceClient` | REST (RestTemplate) | `${app.services.report-service-url}/reports/verified` | Fetch verified reports. |
| `media-service` | `index.html` (JavaScript) | REST | `${MEDIA_SERVICE_BASE_URL}{imageId}/preview`, `${MEDIA_SERVICE_BASE_URL}{imageId}` | Fetch image previews and full photos for marker popups. |
| `ai-verification-service` | `VerificationCacheService` | Kafka Consumer | Topic: `verification_events` | Receive AI verification and duplicate detection results. |

---

## 📊 Data Models

### ReportDTO

```java
public record ReportDTO(
    UUID id,
    Double latitude,
    Double longitude,
    String title,
    String description,
    UUID userID,
    List<UUID> imageIds,
    String status,
    String category,
    LocalDateTime createdAt
) {}
```

### VerificationDataDTO

```java
public record VerificationDataDTO(
    String reportId,
    Boolean isFake,
    Double fakeProbability,
    String verificationConfidence,
    LocalDateTime verifiedAt,
    Boolean isDuplicate,
    Double duplicateProbability,
    LocalDateTime duplicateCheckedAt
) {}
```

---

## 🧑‍💻 Example Usage

### Open Map

Open in your browser to see the map and load markers:

```bash
# In browser (assuming server runs on port 8086)
http://localhost:8086/
```

### Fetch Verified Reports (API)

Retrieves JSON data used by the frontend:

```json
[
    {
        "id": "37794ccf-d2a8-4ac5-b72f-8f9b10390552",
        "latitude": 52.2297,
        "longitude": 21.0122,
        "title": "Flooded road",
        "description": "...",
        "userID": "...",
        "imageIds": [
            "660e8400-e29b-41d4-a716-446655440000"
        ],
        "status": "VERIFIED",
        "category": "INFRASTRUCTURE",
        "createdAt": "2025-12-01T10:00:00"
    }
    // ... more reports
]
```

### Fetch AI Verification Data

```bash
GET http://localhost:8086/verification/37794ccf-d2a8-4ac5-b72f-8f9b10390552
```

Response:

```json
{
    "reportId": "37794ccf-d2a8-4ac5-b72f-8f9b10390552",
    "isFake": false,
    "fakeProbability": 0.12,
    "verificationConfidence": "HIGH",
    "verifiedAt": "2025-12-01T10:05:00",
    "isDuplicate": false,
    "duplicateProbability": 0.05,
    "duplicateCheckedAt": "2025-12-01T10:05:30"
}
```
