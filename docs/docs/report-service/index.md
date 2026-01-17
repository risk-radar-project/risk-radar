# Report Service

**Owner:** @Filip Sanecki

Report Service for **RiskRadar** responsible for creating, updating, and retrieving incident reports. It handles business logic related to reports, manages their status, and integrates with **Kafka** for event publishing and with the external **Audit Log Service** for action logging.

---

## 🎯 Purpose

This service provides **comprehensive report management** within RiskRadar.
It ensures:

* **Creation** of new incident reports.
* Management of report **statuses** (`PENDING`, `VERIFIED`, `REJECTED`).
* **Retrieval** of reports with pagination, sorting, and filtering capabilities (e.g., by `VERIFIED` status).
* Integration with **Kafka** for asynchronous event publishing after report creation.
* **Audit logging** for critical actions (creation, status changes).

---

## 🏗️ Architecture

* **Language:** Java 21
* **Framework:** Spring Boot 3.5
* **Database:** PostgreSQL (via Spring Data JPA + Hibernate)
* **Queue:** Kafka (for event publishing and audit logs)
* **External Service Integration:**
  * **Audit Log Service** (Kafka as primary channel, `WebClient` as fallback)
  * **Media Service** (REST via `RestTemplate` for image confirmation)
* **Build Tool:** Maven
* **Communication:** REST (Spring Web), Kafka (Events & Audit), `RestTemplate` (Media Service)
* **Deployment:** Docker / Docker Compose

---

## ⚙️ Core Components

* **Report Creation (POST /createReport)**
  * Accepts report details in body (DTO: `ReportRequest`).
  * Handles `X-User-ID` header (injected by API Gateway) as an alternative to the `userId` field in the request body.
  * Validates and saves the report to PostgreSQL.
  * Contacts **Media Service** (via REST) to confirm temporary images.
  * Publishes a report creation event to Kafka topic (`report.kafka.topic`).
  * Logs the creation action to Audit Log Service (Kafka/REST).

* **Report Status Management (PATCH /{id}/status)**
  * Updates report status based on the provided parameter (`PENDING`, `VERIFIED`, `REJECTED`).
  * Logs the status event to **Audit Log Service** (prioritizing Kafka, with REST `WebClient` fallback).

* **Report Retrieval & Management**
  * `GET /`: Retrieves a paginated list of all reports.
  * `GET /verified`: Retrieves a list of reports with `VERIFIED` status.
  * `GET /pending`: Retrieves a list of reports with `PENDING` status.
  * `GET /my-reports`: Retrieves the authenticated user's reports (requires `X-User-ID` header), with optional `status` and `category` filters, pagination, and sorting (`page`, `size`, `sort`, `direction`).
  * `GET /{id}`: Retrieves a single report by UUID.
  * `DELETE /{id}`: Deletes a report (requires `X-User-ID` header; only deletes user's own reports).
  * `GET /nearby`: Retrieves reports within a `radiusKm` radius from given coordinates (`latitude`, `longitude`).

* **Health Check (GET /status)**
  * Returns application status (`UP`/`DOWN`).
  * Checks and reports **PostgreSQL** connection status (via `JdbcTemplate.queryForObject("SELECT 1")`).
  * Checks and reports **Kafka** connection status (via `AdminClient.listTopics().names().get()`).

---

## 🗄️ Database Schema

### `report` (Entity: `Report.java`)

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK**, not null, updatable=false | Unique report identifier |
| `created_at` | TIMESTAMP | Not null, Default: now() | Report creation timestamp |
| `title` | VARCHAR | Not null, Max length: 500 | Report title |
| `description` | TEXT | Not null | Detailed incident description |
| `latitude` | DOUBLE | Not null | Geographic latitude |
| `longitude` | DOUBLE | Not null | Geographic longitude |
| `status` | VARCHAR | Not null, Default: PENDING | Report status (ENUM: PENDING, VERIFIED, REJECTED) |
| `category` | VARCHAR | Not null | Report category (ENUM: VANDALISM, INFRASTRUCTURE, ...) |
| `user_id` | UUID | Not null | ID of the reporting user |
| `ai_is_fake` | BOOLEAN | Nullable | Whether AI flagged the report as fake |
| `ai_fake_probability` | DOUBLE | Nullable | Probability that the report is fake (0.0 - 1.0) |
| `ai_confidence` | VARCHAR | Nullable | AI confidence level (e.g., HIGH, MEDIUM, LOW) |
| `ai_verified_at` | TIMESTAMP | Nullable | AI verification timestamp |

### `report_image_ids` (Element Collection)

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `report_id` | UUID | **FK** to `report(id)` | Foreign key to associated report |
| `image_ids` | UUID | Not null | Identifier of an image associated with the report |

---

## 📑 Report Statuses

Available report statuses (Enum: `ReportStatus.java`):

* **PENDING** - Awaiting verification.
* **VERIFIED** - Verified, considered valid.
* **REJECTED** - Rejected.

## 🗂️ Report Categories

Report categories (Enum: `ReportCategory.java`):

| Enum Name | Display Name (PL) | Icon Name (Google Material Symbols) |
| :--- | :--- | :--- |
| **VANDALISM** | Vandalism | format\_paint |
| **INFRASTRUCTURE** | Road/sidewalk infrastructure | construction |
| **DANGEROUS\_SITUATION** | Dangerous situations | warning |
| **TRAFFIC\_ACCIDENT** | Traffic accidents | car\_crash |
| **PARTICIPANT\_BEHAVIOR** | Driver/pedestrian behavior | person\_alert |
| **PARTICIPANT\_HAZARD** | Hazards for pedestrians, cyclists, and drivers | brightness\_alert |
| **WASTE\_ILLEGAL\_DUMPING** | Waste/illegal littering/illegal dumpsites | delete\_sweep |
| **BIOLOGICAL\_HAZARD** | Biological hazards | bug\_report |
| **OTHER** | Other | help\_outline |

---

## 🔑 API Endpoints

### 1. **Create Report**

**POST** `/createReport`
Creates a new report.
* `201 Created` — Report created
* `400 Bad Request` — Validation error
* `500 Internal Server Error` — Server error

### 2. **Update Report Status**

**PATCH** `/report/{id}/status`
Updates report status (`PENDING`, `VERIFIED`, `REJECTED`).
* `200 OK` — Status updated
* `500 Internal Server Error` — Update error

### 3. **Get Reports (Paginated)**

**GET** `/?page=0&size=10&sort=createdAt&direction=desc&status=PENDING&category=INFRASTRUCTURE`
Returns a paginated list of all reports with optional filtering.
* `200 OK` — Report list
* `500 Internal Server Error` — Retrieval error

### 4. **Get Report by ID**

**GET** `/{id}`
Returns details of a single report.
* `200 OK` — Report found
* `404 Not Found` — Report doesn't exist
* `500 Internal Server Error` — Retrieval error

### 5. **Get Verified Reports**

**GET** `/verified` or `/reports/verified`
Returns a list of reports with **VERIFIED** status.
* `200 OK` — List of verified reports
* `500 Internal Server Error` — Retrieval error

### 6. **Get Pending Reports**

**GET** `/reports/pending`
Returns a list of reports with **PENDING** status.
* `200 OK` — List of pending reports
* `500 Internal Server Error` — Retrieval error

### 7. **Get My Reports**

**GET** `/my-reports`
Retrieves the authenticated user's reports (requires `X-User-ID` header).
* `200 OK` — User's report list
* `401 Unauthorized` — Missing `X-User-ID` header
* `500 Internal Server Error` — Server error

### 8. **Update Report (User)**

**PATCH** `/{id}`
Updates the user's own report.
* `200 OK` — Report updated
* `403 Forbidden` — No permission to edit this report
* `500 Internal Server Error` — Update error

### 9. **Delete Report (User)**

**DELETE** `/{id}`
Deletes the user's own report.
* `200 OK` — Report deleted
* `403 Forbidden` — No permission to delete
* `500 Internal Server Error` — Deletion error

### 10. **Admin: Update Report**

**PUT** `/report/{id}`
Full report edit by administrator.
* `200 OK` — Report updated
* `404 Not Found` — Report doesn't exist
* `500 Internal Server Error` — Server error

### 11. **Admin: Delete Report**

**DELETE** `/report/{id}`
Deletes any report (admin only).
* `200 OK` — Report deleted
* `404 Not Found` — Report doesn't exist
* `500 Internal Server Error` — Server error

### 12. **Admin: Report Statistics**

**GET** `/reports/stats`
Retrieves report statistics.
* `200 OK` — Report statistics
* `500 Internal Server Error` — Server error

### 13. **Get Nearby Reports**

**GET** `/nearby`
Retrieves reports within a specified radius.
Parameters: `latitude`, `longitude`, `radiusKm` (default: 1.0).
* `200 OK` — Nearby reports
* `500 Internal Server Error` — Server error

### 14. **Service Status / Health Check**

**GET** `/status`
Checks service status and database/Kafka connections.
* `200 OK` — Service status
