# report service

**Owner:** @Filip Sanecki

Report Service for **RiskRadar** responsible for creating, updating, and retrieving incident reports. It handles report creation, status management, audit logging, and integrates with Kafka and the database.

---

## 🎯 Purpose

This service provides **report management** within RiskRadar.
It ensures:

* Creation of new incident reports
* Status updates for reports (PENDING, VERIFIED, REJECTED)
* Retrieval of reports with pagination, sorting, and filtering
* Integration with Kafka for event publishing

---

## 🏗️ Architecture

* **Language:** Java 21
* **Framework:** Spring Boot 3.5
* **Database:** PostgreSQL (via Spring Data JPA + Hibernate)
* **Cache / Queue:** Redis, Kafka
* **Build Tool:** Maven
* **Communication:** REST (Spring Web)
* **Deployment:** Docker / Docker Compose

---

## ⚙️ Core Components

* **Report Creation**

    * Accepts report details via `POST /createReport`
    * Validates input and stores reports in PostgreSQL
    * Publishes creation events to Kafka

* **Report Status Management**

    * Update status via `PATCH /report/{id}/status`
    * Logs audit events for status changes

* **Report Retrieval**

    * Fetch all reports with pagination and sorting via `GET /reports`
    * Fetch single report by ID via `GET /report/{id}`
    * Optional filtering by userId or status

* **Audit Logging**

    * Logs all actions on reports (creation, status update)

---

## 🗄️ Database Schema

### `report`

| Column        | Type      | Constraints      | Description                  |
| ------------- | --------- | ---------------- | ---------------------------- |
| `id`          | UUID      | PK, not null     | Unique report identifier     |
| `createdat`   | TIMESTAMP | Default: now()   | Report creation timestamp    |
| `title`       | VARCHAR   | Not null         | Report title                 |
| `description` | TEXT      | Not null         | Report description           |
| `latitude`    | DOUBLE    | Not null         | Geographic latitude          |
| `longitude`   | DOUBLE    | Not null         | Geographic longitude         |
| `status`      | VARCHAR   | Default: PENDING | Report status                |
| `user_id`     | UUID      | Not null         | ID of user submitting report |

### `report_image_ids`

| Column      | Type   | Constraints        | Description       |
| ----------- | ------ | ------------------ | ----------------- |
| `report_id` | UUID   | FK to `report(id)` | Associated report |
| `image_ids` | UUID[] | Not null           | List of image IDs |

---

## 🔑 API Endpoints

### 1. **Create Report**

**POST** `/createReport`
Creates a new report.

* `201 Created` — Report created
* `500 Internal Server Error` — Failed to create report

### 2. **Update Report Status**

**PATCH** `/report/{id}/status?status=NEW_STATUS`
Updates status of a report (`PENDING`, `APPROVED`, `REJECTED`).

* `200 OK` — Status updated
* `404 Not Found` — Report not found
* `500 Internal Server Error` — Failed to update

### 3. **Get Reports (Paginated)**

**GET** `/reports?page=0&size=10&sort=createdAt&direction=desc`
Returns a paginated list of reports, sorted by any field.

* `200 OK` — Returns reports page
* `500 Internal Server Error` — Failed to fetch reports

### 4. **Get Report by ID**

**GET** `/report/{id}`
Returns details of a single report.

* `200 OK` — Report found
* `404 Not Found` — Report not found

### 5. **Service Status / Health Check**

**GET** `/status`
Returns service metadata, uptime, and status.

* `200 OK` — Service is healthy

---

## ❌ Error Handling

All errors follow consistent format:

```json
{
  "message": "Description",
  "status": "failure",
  "error": "Detailed error message"
}
```

---

## 🧑‍💻 Example Usage

### Create Report

```bash
curl -X POST http://localhost:8085/createReport \
-H "Content-Type: application/json" \
-d '{
  "title": "Zalana droga",
  "description": "Ulica Przykładowa jest całkowicie zalana po ulewie.",
  "latitude": 52.2297,
  "longitude": 21.0122,
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "imageIds": [
    "660e8400-e29b-41d4-a716-446655440000",
    "770e8400-e29b-41d4-a716-446655440000"
  ]
}'
```

### Update Report Status

```bash
curl -X PATCH "http://localhost:8085/report/37794ccf-d2a8-4ac5-b72f-8f9b10390552/status?status=APPROVED"
```

### Get Reports (paginated)

```bash
curl -X GET "http://localhost:8085/reports?page=0&size=5&sort=createdAt&direction=desc"
```

### Get Single Report

```bash
curl -X GET "http://localhost:8085/report/37794ccf-d2a8-4ac5-b72f-8f9b10390552"
```

### Status / Health Check

```bash
curl -X GET http://localhost:8085/status
```

---

## 🧪 Testing

* Unit tests: JUnit 5, Mockito
* Integration tests: Spring Boot Starter Test
* Kafka tests: Embedded Kafka (spring-kafka-test)
