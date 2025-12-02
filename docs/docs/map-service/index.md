# map-service

**Owner:** @Filip Sanecki

Usługa Mapy dla **RiskRadar** (część Frontend/Backend For Frontend - BFF), odpowiedzialna za serwowanie strony mapy oraz agregację i dostarczanie zweryfikowanych raportów incydentów z `report-service` do przeglądarki.

---

## 🎯 Cel (Purpose)

Ta usługa udostępnia **interaktywną mapę** w RiskRadar.
Zapewnia:

* Serwowanie głównej strony HTML mapy (`index.html`).
* Pobieranie **zweryfikowanych** raportów incydentów z `report-service`.
* Dostarczanie danych o raportach do skryptu JavaScript po stronie klienta w celu wizualizacji (Markery Leaflet z klasteryzacją).

---

## 🏗️ Architektura (Architecture)

* **Język:** Java 21
* **Framework:** Spring Boot 3.5 (Spring Web, RestTemplate)
* **Komunikacja:** REST (RestTemplate do komunikacji z `report-service`)
* **Frontend:** Leaflet, Leaflet.markercluster (OSM)
* **Deployment:** Docker / Docker Compose

---

## ⚙️ Kluczowe Komponenty (Core Components)

### 1. Serwowanie Mapy (`MapController.java`)
* Serwuje widok mapy (strona `index.html`) poprzez endpoint `GET /`.

### 2. Agregacja Raportów (`ReportQueryController.java`, `ReportServiceClient.java`)
* Endpoint `GET /reports` służy do pobierania listy zweryfikowanych raportów.
* `ReportServiceClient` pobiera raporty z endpointu `/reports/verified` w `report-service` używając `RestTemplate`.
* URL docelowy (`report-service-url`) jest konfigurowany za pomocą zmiennej `${app.services.report-service-url}`.

### 3. Wizualizacja Mapy (`index.html`)
* Wykorzystuje **Leaflet** do wyświetlania mapy.
* Używa wtyczki **Leaflet.markercluster** do grupowania znaczników na mapie.
* Skrypt JavaScript po stronie klienta:
    * Pobiera raporty z `/reports`.
    * Tworzy dynamicznie markery na podstawie współrzędnych (`latitude`, `longitude`) i ikon zależnych od kategorii.
    * Popupy markerów zawierają tytuł, opis, kategorię i obrazy (pobierane z `${MEDIA_SERVICE_BASE_URL}`).

---

## 🔑 Endpunkty API (API Endpoints)

| Metoda | Ścieżka | Opis | Kod Statusu | Szczegóły |
|---|---|---|---|---|
| **GET** | `/` | Serwuje stronę HTML z mapą (index.html). | `200 OK` | Strona mapy załadowana. |
| **GET** | `/reports` | Pobiera i zwraca listę zweryfikowanych raportów z `report-service`. | `200 OK` | Zwraca listę obiektów `ReportDTO`. |
| | | | `500 Internal Server Error` | Błąd komunikacji z `report-service` lub błąd wewnętrzny. |

---

## 🗃️ Integracja z Innymi Usługami

| Usługa Docelowa | Komponent Klienta | Komunikacja | Endpoint Docelowy | Cel |
|---|---|---|---|---|
| `report-service` | `ReportServiceClient` | REST (RestTemplate) | `${app.services.report-service-url}/reports/verified` | Pobieranie zweryfikowanych raportów. |
| `media-service` | `index.html` (JavaScript) | REST | `${MEDIA_SERVICE_BASE_URL}{imageId}/preview`, `${MEDIA_SERVICE_BASE_URL}{imageId}` | Pobieranie podglądów i pełnych zdjęć dla popupów markerów. |

---

## 🧑‍💻 Przykładowe Użycie

### Otwórz Mapę

Otwórz w przeglądarce, aby zobaczyć mapę i załadować markery:

```bash
# W przeglądarce (załóżmy, że serwer działa na porcie 8086)
http://localhost:8086/
```
## Pobierz Zweryfikowane Raporty (API)
Pobiera dane JSON, które są następnie wykorzystywane przez frontend:
``` JSON
    [
        {
        "id": "37794ccf-d2a8-4ac5-b72f-8f9b10390552",
        "latitude": 52.2297,
        "longitude": 21.0122,
        "title": "Zalana droga",
        "description": "...",
        "userID": "...",
        "imageIds": [
        "660e8400-e29b-41d4-a716-446655440000"
        ],
        "status": "VERIFIED",
        "category": "INFRASTRUCTURE",
        "createdAt": "2025-12-01T10:00:00"
        },
    // ... więcej raportów
    ]
```