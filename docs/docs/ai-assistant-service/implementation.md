# 🤖 AI Assistant - Analiza Zagrożeń w Okolicy

## Opis Funkcjonalności

Przycisk **"AI Asystent"** na mapie pozwala użytkownikowi sprawdzić bezpieczeństwo swojej okolicy. Po kliknięciu:

1. **Pobierana jest lokalizacja użytkownika** (geolokalizacja przeglądarki)
2. **Backend pobiera raporty** z bazy danych w promieniu 1km
3. **AI analizuje zgłoszenia** i generuje czytelne podsumowanie
4. **Wynik wyświetlany jest w dymku** na mapie

---

## Architektura

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                       │
│  ┌──────────────┐                                               │
│  │  Przycisk    │  ───► Geolokalizacja ───► POST /api/ai-      │
│  │  "AI Asystent"│                           assistant/nearby   │
│  └──────────────┘                                               │
│         ▲                                                       │
│         │ Dymek z odpowiedzią                                   │
└─────────┼───────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│               AI ASSISTANT SERVICE (Python/FastAPI)             │
│                                                                 │
│  POST /api/v1/nearby-threats                                    │
│  ├── 1. Pobierz raporty z Report Service                       │
│  ├── 2. Przygotuj dane dla AI                                  │
│  ├── 3. Wyślij do Google Gemini                                │
│  └── 4. Zwróć podsumowanie                                     │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│              REPORT SERVICE (Java/Spring Boot)                  │
│                                                                 │
│  GET /reports/nearby?latitude=X&longitude=Y&radiusKm=1.0       │
│  ├── Zapytanie SQL z formułą Haversine                         │
│  └── Zwraca raporty VERIFIED/PENDING w promieniu               │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                          │
│                                                                 │
│  Tabela: report                                                 │
│  ├── id, title, description, category                          │
│  ├── latitude, longitude                                       │
│  └── status, created_at                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### 1. Frontend Proxy Route

**POST** `/api/ai-assistant/nearby-threats`

```typescript
// Request
{
  latitude: number,     // Szerokość geograficzna
  longitude: number,    // Długość geograficzna  
  radius_km?: number    // Promień w km (domyślnie: 1.0)
}

// Response
{
  status: "success",
  location: { lat: 50.06, lon: 19.94 },
  radius_km: 1.0,
  reports_count: 5,
  danger_score: 35,          // 0-100
  danger_level: "Niski",     // Bardzo niski/Niski/Umiarkowany/Wysoki/Bardzo wysoki
  ai_summary: "W okolicy jest kilka zgłoszeń...",
  timestamp: "2026-01-02T19:00:00Z"
}
```

### 2. AI Assistant Service

**POST** `/api/v1/nearby-threats`

```python
class NearbyThreatRequest(BaseModel):
    latitude: float
    longitude: float
    radius_km: float = 1.0
    user_id: Optional[str] = None

class NearbyThreatResponse(BaseModel):
    status: str
    location: Dict[str, float]
    radius_km: float
    reports_count: int
    danger_score: float
    danger_level: str
    ai_summary: str
    timestamp: str
```

### 3. Report Service

**GET** `/reports/nearby`

```
Query Parameters:
  - latitude: Double (wymagane)
  - longitude: Double (wymagane)
  - radiusKm: Double (domyślnie: 1.0)

Response:
{
  "location": { "lat": 50.06, "lng": 19.94 },
  "radiusKm": 1.0,
  "count": 5,
  "reports": [
    {
      "id": "uuid",
      "title": "Wandalizm przy ul. Głównej",
      "description": "Zdewastowana ławka...",
      "category": "VANDALISM",
      "latitude": 50.061,
      "longitude": 19.941,
      "status": "VERIFIED",
      "createdAt": "2026-01-01T10:00:00"
    }
  ]
}
```

---

## Zapytanie SQL (Haversine)

```sql
SELECT * FROM report r 
WHERE r.status IN ('VERIFIED', 'PENDING')
AND (
    6371 * acos(
        cos(radians(:latitude)) * cos(radians(r.latitude)) * 
        cos(radians(r.longitude) - radians(:longitude)) + 
        sin(radians(:latitude)) * sin(radians(r.latitude))
    )
) <= :radiusKm
ORDER BY r.created_at DESC
```

---

## Prompt dla AI (Google Gemini)

```
Jesteś asystentem bezpieczeństwa w aplikacji RiskRadar. 
Użytkownik sprawdza bezpieczeństwo swojej okolicy.

Przeanalizuj poniższe PRAWDZIWE zgłoszenia z bazy danych:
[LISTA ZGŁOSZEŃ]

Twoim zadaniem jest:
1. Ocenić poziom zagrożenia w tej okolicy
2. Napisać KRÓTKIE, przyjazne podsumowanie dla użytkownika (max 2-3 zdania)
3. Skupić się na najważniejszych zagrożeniach i praktycznych radach

Odpowiedź JSON:
{
  "danger_score": <0-100>,
  "danger_level": <"Bardzo niski" | "Niski" | "Umiarkowany" | "Wysoki" | "Bardzo wysoki">,
  "summary": "<krótkie podsumowanie po polsku>"
}
```

---

## UX - Co widzi użytkownik

### 1. Przycisk na mapie (lewy dolny róg)

```
┌──────────────────┐
│ ✨ AI Asystent   │
└──────────────────┘
```

### 2. Stan ładowania

```
┌──────────────────┐
│ ⟳ Analizuję...   │
└──────────────────┘
```

### 3. Dymek z odpowiedzią

```
┌────────────────────────────────────┐
│ 🌟 Analiza bezpieczeństwa          │
│    3 zgłoszeń w promieniu 1km     │
├────────────────────────────────────┤
│ Poziom zagrożenia: [Niski] (25/100)│
├────────────────────────────────────┤
│ W Twojej okolicy jest kilka        │
│ drobnych zgłoszeń dotyczących      │
│ infrastruktury. Okolica wydaje     │
│ się bezpieczna.                    │
├────────────────────────────────────┤
│ 🤖 Analiza wygenerowana przez AI   │
└────────────────────────────────────┘
         ▲
```

---

## Obsługa przypadków brzegowych

### Brak raportów w okolicy

```json
{
  "danger_level": "Bardzo niski",
  "danger_score": 0,
  "ai_summary": "🌟 Świetnie! W promieniu 1km od Ciebie nie ma żadnych zgłoszeń. Okolica wydaje się bezpieczna."
}
```

### Błąd geolokalizacji

- Wyświetlany alert: "Nie można pobrać Twojej lokalizacji"
- Przycisk wraca do normalnego stanu

### Błąd AI Service

- Dymek wyświetla komunikat o błędzie
- Użytkownik może ponowić próbę

### Timeout (30s)

- Zwracany status 504
- Komunikat: "AI analysis timeout - please try again"

---

## Kategorie raportów (polski)

| Kod                   | Nazwa polska                        |
|-----------------------|-------------------------------------|
| VANDALISM             | Wandalizm                           |
| INFRASTRUCTURE        | Uszkodzenie infrastruktury          |
| DANGEROUS_SITUATION   | Niebezpieczna sytuacja              |
| TRAFFIC_ACCIDENT      | Wypadek drogowy                     |
| PARTICIPANT_BEHAVIOR  | Niebezpieczne zachowanie            |
| PARTICIPANT_HAZARD    | Zagrożenie dla uczestników          |
| OTHER                 | Inne zagrożenie                     |

---

## Poziomy zagrożenia

| Score  | Level          | Kolor      | Emoji |
|--------|----------------|------------|-------|
| 0-19   | Bardzo niski   | Zielony    | 🌟    |
| 20-39  | Niski          | Jasnoziel. | ✅    |
| 40-59  | Umiarkowany    | Żółty      | ⚠️    |
| 60-79  | Wysoki         | Pomarańcz. | 🔶    |
| 80-100 | Bardzo wysoki  | Czerwony   | 🚨    |

---

## Pliki implementacji

### Backend

- `services/report-service/src/main/java/report_service/repository/ReportRepository.java`
  - Dodane: `findReportsWithinRadius()` z formułą Haversine

- `services/report-service/src/main/java/report_service/service/ReportService.java`
  - Dodane: `getReportsWithinRadius(lat, lng, radius)`

- `services/report-service/src/main/java/report_service/controller/ReportController.java`
  - Dodane: `GET /reports/nearby`

- `services/ai-assistant-service/main.py`
  - Dodane: `POST /api/v1/nearby-threats`
  - Dodane: `fetch_nearby_reports()`, `prepare_real_reports_for_ai()`, `analyze_real_threats_with_ai()`

### Frontend

- `services/frontend/components/map-component.tsx`
  - Dodane: Przycisk "AI Asystent"
  - Dodane: Dymek z odpowiedzią AI
  - Dodane: `handleAIAnalysis()`, `getDangerColor()`, `getDangerEmoji()`

- `services/frontend/app/api/ai-assistant/nearby-threats/route.ts`
  - Nowy: Proxy route do AI Assistant Service

---

## Testowanie

### 1. Test manualny

```bash
# 1. Otwórz mapę
open http://localhost:3000

# 2. Kliknij przycisk "AI Asystent"
# 3. Zezwól na geolokalizację
# 4. Poczekaj na analizę AI
# 5. Sprawdź dymek z odpowiedzią
```

### 2. Test API (Report Service)

```bash
curl -X GET "http://localhost:8085/reports/nearby?latitude=50.06&longitude=19.94&radiusKm=1.0"
```

### 3. Test API (AI Assistant)

```bash
curl -X POST http://localhost:8083/api/v1/nearby-threats \
  -H "Content-Type: application/json" \
  -d '{"latitude": 50.06, "longitude": 19.94, "radius_km": 1.0}'
```

---

## Porty serwisów

| Serwis              | Port |
|---------------------|------|
| Frontend            | 3000 |
| AI Assistant        | 8083 |
| Report Service      | 8085 |
| AI Categorization   | 8081 |
| AI Verification     | 8082 |
