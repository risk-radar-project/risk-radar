# report service

**Owner:** @Filip Sanecki

Report Service dla **RiskRadar** odpowiedzialny za tworzenie, aktualizację, i pobieranie zgłoszeń incydentów. Obsługuje logikę biznesową związaną z raportami, zarządzanie ich statusem, a także integruje się z **Kafka** do publikacji zdarzeń oraz z zewnętrznym serwisem **Audit Log Service** do rejestrowania działań.

---

## 🎯 Purpose

Ten serwis zapewnia **kompleksowe zarządzanie raportami** w ramach RiskRadar.
Zapewnia:

* **Kreację** nowych zgłoszeń incydentów.
* Zarządzanie **statusami** raportów (`PENDING`, `VERIFIED`, `REJECTED`).
* **Pobieranie** raportów z paginacją, sortowaniem i możliwością filtrowania (np. po statusie `VERIFIED`).
* Integrację z **Kafka** do asynchronicznej publikacji zdarzeń po utworzeniu raportu.
* Rejestrowanie **logów audytowych** dla kluczowych działań (tworzenie, zmiana statusu).

---

## 🏗️ Architecture

* **Language:** Java 21
* **Framework:** Spring Boot 3.5
* **Database:** PostgreSQL (via Spring Data JPA + Hibernate)
* **Queue:** Kafka (dla publikacji zdarzeń i logów audytowych)
* **External Service Integration:** Audit Log Service (przez `WebClient` jako **mechanizm awaryjny/fallback** dla logów audytowych)
* **Build Tool:** Maven
* **Communication:** REST (Spring Web)
* **Deployment:** Docker / Docker Compose

---

## ⚙️ Core Components

* **Report Creation (POST /createReport)**
  * Akceptuje szczegóły raportu w body (DTO: `ReportRequest`).
  * Waliduje i zapisuje raport w PostgreSQL.
  * Publikuje zdarzenie o utworzeniu raportu do tematu Kafka (`report.kafka.topic`).

* **Report Status Management (PATCH /report/{id}/status)**
  * Aktualizuje status raportu na podstawie przekazanego parametru (`PENDING`, `VERIFIED`, `REJECTED`).
  * Loguje zdarzenie statusu do **Audit Log Service** (z priorytetem wysyłki przez Kafka, z fallbackiem do REST `WebClient`).

* **Report Retrieval**
  * `GET /reports`: Pobiera paginowaną listę wszystkich raportów.
  * `GET /report/{id}`: Pobiera pojedynczy raport po UUID.
  * `GET /reports/verified`: Pobiera listę raportów ze statusem `VERIFIED`.

* **Health Check (GET /status)**
  * Zwraca status aplikacji (`UP`/`DOWN`).
  * Sprawdza i raportuje stan połączenia z **PostgreSQL** (poprzez `JdbcTemplate.queryForObject("SELECT 1")`).
  * Sprawdza i raportuje stan połączenia z **Kafka** (poprzez `AdminClient.listTopics().names().get()`).

---

## 🗄️ Database Schema

### `report` (Encja: `Report.java`)

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | **PK**, not null, updatable=false | Unikalny identyfikator raportu |
| `created_at` | TIMESTAMP | Not null, Default: now() | Czas utworzenia raportu |
| `title` | VARCHAR | Not null | Tytuł raportu |
| `description` | TEXT | Not null | Szczegółowy opis incydentu |
| `latitude` | DOUBLE | Not null | Szerokość geograficzna |
| `longitude` | DOUBLE | Not null | Długość geograficzna |
| `status` | VARCHAR | Not null, Default: PENDING | Status raportu (ENUM: PENDING, VERIFIED, REJECTED) |
| `category` | VARCHAR | Not null | Kategoria raportu (ENUM: VANDALISM, INFRASTRUCTURE, ...) |
| `user_id` | UUID | Not null | ID użytkownika zgłaszającego |

### `report_image_ids` (Element Collection)

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `report_id` | UUID | **FK** to `report(id)` | Klucz obcy do powiązanego raportu |
| `image_ids` | UUID | Not null | Identyfikator obrazu powiązanego z raportem |

---

## 📑 Report Statuses

Dostępne statusy dla raportów (Enum: `ReportStatus.java`):

* **PENDING** - Oczekujący na weryfikację.
* **VERIFIED** - Zweryfikowany, uznany za ważny.
* **REJECTED** - Odrzucony.

## 🗂️ Report Categories

Kategorie zgłoszeń (Enum: `ReportCategory.java`):

| Enum Name | Display Name (PL) | Icon Name (Google Material Symbols) |
| :--- | :--- | :--- |
| **VANDALISM** | Wandalizm | format\_paint |
| **INFRASTRUCTURE** | Infrastruktura drogowa/chodników | construction |
| **DANGEROUS\_SITUATION** | Niebezpieczne sytuacje | warning |
| **TRAFFIC\_ACCIDENT** | Wypadki drogowe | car\_crash |
| **PARTICIPANT\_BEHAVIOR** | Zachowania kierowców/pieszych | person\_alert |
| **PARTICIPANT\_HAZARD** | Zagrożenia dla pieszych i rowerzystów i kierowców | brightness\_alert |
| **WASTE\_ILLEGAL\_DUMPING** | Śmieci/nielegalne zaśmiecanie/nielegalne wysypiska śmieci | delete\_sweep |
| **BIOLOGICAL\_HAZARD** | Zagrożenia biologiczne | bug\_report |
| **OTHER** | Inne | help\_outline |

---

## 🔑 API Endpoints

### 1. **Create Report**

**POST** `/createReport`
Tworzy nowe zgłoszenie.

* `201 Created` — Report created
* `500 Internal Server Error` — Failed to create report

### 2. **Update Report Status**

**PATCH** `/report/{id}/status?status=NEW_STATUS`
Aktualizuje status raportu (`PENDING`, `VERIFIED`, `REJECTED`).

* `200 OK` — Status updated
* `404 Not Found` — Report not found
* `500 Internal Server Error` — Failed to update

### 3. **Get Reports (Paginated)**

**GET** `/reports?page=0&size=10&sort=createdAt&direction=desc`
Zwraca paginowaną listę wszystkich raportów, sortowanych po dowolnym polu.

* `200 OK` — Returns reports page
* `500 Internal Server Error` — Failed to fetch reports

### 4. **Get Report by ID**

**GET** `/report/{id}`
Zwraca szczegóły pojedynczego raportu.

* `200 OK` — Report found
* `404 Not Found` — Report not found
* `500 Internal Server Error` — Failed to fetch report

### 5. **Get Verified Reports**

**GET** `/reports/verified`
Zwraca listę raportów, których status to **VERIFIED**.

* `200 OK` — Returns reports
* `500 Internal Server Error` — Failed to fetch verified reports

### 6. **Service Status / Health Check**

**GET** `/status`
Zwraca metadane serwisu, czas działania, oraz statusy kluczowych zależności (DB, Kafka).

* `200 OK` — Service is healthy

---

## ❌ Error Handling

Wszystkie błędy API zwracają spójny format JSON:

```json
{
  "message": "Description of the failure",
  "status": "failure",
  "error": "Detailed error message (e.g., Report not found)"
}
```

## 🧑‍💻 Example Usage
### Create Report
```Bash
curl -X POST http://localhost:8085/createReport \
-H "Content-Type: application/json" \
-d '{
"title": "Zalana droga",
"description": "Ulica Przykładowa jest całkowicie zalana po ulewie.",
"latitude": 52.2297,
"longitude": 21.0122,
"userId": "550e8400-e29b-41d4-a716-446655440000",
"imageIds": [
"660e8400-e29b-41d4-a716-446655440000"
],
"reportCategory": "INFRASTRUCTURE"
}'
```
### Update Report Status
``` Bash
  curl -X PATCH "http://localhost:8085/report/37794ccf-d2a8-4ac5-b72f-8f9b10390552/status?status=VERIFIED"
```
### Get Reports (paginated)
``` Bash
  curl -X GET "http://localhost:8085/reports?page=0&size=5&sort=createdAt&direction=desc"
```
### Get Single Report
``` Bash
  curl -X GET "http://localhost:8085/report/37794ccf-d2a8-4ac5-b72f-8f9b10390552"
```