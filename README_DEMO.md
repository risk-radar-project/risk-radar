# Risk Radar - Demo Mode (zakres danych)

## Co już jest w systemie
1. **Authz Service** — [services/authz-service/internal/db/migrations/001_initial.up.sql](services/authz-service/internal/db/migrations/001_initial.up.sql): role (`admin`, `moderator`, `volunteer`, `user`) + komplet uprawnień; przypięcie roli admin do UUID `11111111-1111-1111-1111-111111111111`.
2. **User Service** — [services/user-service/src/main/java/com/riskRadar/user_service/config/AdminSeeder.java](services/user-service/src/main/java/com/riskRadar/user_service/config/AdminSeeder.java): tworzy konto admin (`admin@riskradar.local`, login `admin`, hasło `admin`) dla powyższego UUID.
3. **Frontend** — [services/frontend/app/(auth)/login/page.tsx](services/frontend/app/(auth)/login/page.tsx): wyświetla konta demo (admin/moderator/wolontariusz/uzytkownik) z hasłami jak w UI.

## Co planujemy w danych demo

### Użytkownicy
- Zmiana istniejącego admina: login `superadmin`, hasło z `ADMIN_PASSWORD` (gdy brak → losowe bezpieczne 32-znakowe), UUID zostaje ten sam.
- Dodanie kont pod frontendowe demo: `moderator`, `wolontariusz`, `uzytkownik` z hasłami jak w froncie.
- Przypięcie ról zgodnie z nazwami kont (role już istnieją w authz-service).

### Raporty (1000 sztuk)
- **1000 unikatowych** zgłoszeń, równy rozkład kategorii (9 kategorii → ~111 per kategoria).
- Lokalizacja: promień 30 km od centrum Krakowa (50.0647° N, 19.9450° E), gęstsza koncentracja bliżej centrum.
- **Gorące punkty** (klastry): Rynek Krakowski (50.0619° N, 19.9369° E) + Kazimierz (50.0520° N, 19.9462° E).
- Realistyczne tytuły i opisy (kontekst krakowski, np. "Dziura w jezdni ul. Długa", "Graffiti na budynku dworca").
- Równy podział raportów między użytkowników demo (250 raportów na każdego z 4 użytkowników).
- Stany: losowo rozłożone (PENDING / VERIFIED / REJECTED), ~60% verified, ~30% pending, ~10% rejected.
- **AI flags**: ~5–10% raportów z flagą podejrzaną (`ai_is_fake=true`, `ai_fake_probability` 0.6–0.9, `ai_confidence` HIGH/MEDIUM/LOW).
- **AI verification timeline**: `ai_verified_at` rozłożone losowo w przedziale 1–7 dni od `created_at` (nie wszystkie w tym samym momencie).
- **Timestampy**: losowo październik 2025 – luty 2026, z pikami w godzinach 8–10 i 17–19.

### Media
- Placeholder `.jpg`  na każdą kategorię w `demo-data/media/`.
- Upload do media-service; każdy raport wskazuje UUID zdjęcia swojej kategorii w polu `image_ids`.
- Większość raportów z 1 zdjęciem, kilka (~5%) z 2–3 zdjęciami dla prezentacji galerii.

### Logi/Audyt
- Realistyczne losowe wpisy (150–250 eventów) z **różnorodnym aktorem** (superadmin, moderator, volunteer, uzytkownik):
  - Logowania (success/fail) — mix użytkowników
  - Ban/unban użytkowników — superadmin + moderator
  - Weryfikacja/odrzucenie raportów — moderator + volunteer
  - Zmiana kategorii raportu — różni moderatorzy
  - Upload/edycja mediów — autorzy raportów
  - AI verification events — system
  - Zmiana uprawnień/ról — tylko superadmin
  - Login attempts (failed) — próby dostępu
- Timestampy zgodne z zakresem raportów (październik 2025 – luty 2026).
- Akcje sensownie rozłożone (nie wszystko od superadmina, ale autentyczne scenariusze).

### Powiadomienia
- Podstawowe typy dla każdego użytkownika demo (identyczne zestawy dla spójności prezentacji):
  - "Twoje zgłoszenie zostało zaakceptowane"
  - "Twoje zgłoszenie zostało odrzucone"
  - "AI oznaczyło zgłoszenie jako podejrzane"
  - "Nowy komentarz do zgłoszenia"
  - "Dodano nowe zdjęcie do zgłoszenia"
- Stan: wszystkie odczytane (`read=true`) poza ostatnim (`read=false`).
- Notification-service: wsparcie dla kanału e-mail (Mailpit) + in-app.

## Tryb Demo - Ochrona przed zmianami

Gdy w `.env` (lub `docker-compose.yml`) ustawiona zmienna `DEMO_MODE=true`:
- **Blokada destrukcyjnych akcji** dla zwykłych użytkowników:
  - Ban/unban użytkowników
  - Zmiana ról/uprawnień
  - Akceptacja/odrzucenie raportów
  - Usuwanie użytkowników/raportów
  - Edycja/usuwanie mediów innych użytkowników
- Tylko konto `superadmin` może wykonywać pełne operacje administracyjne.
- Cel: **Live demo publiczne** bez ryzyka zniszczenia danych przez zewnętrznych użytkowników.
- Implementacja: middleware/guard w każdym serwisie sprawdzający `DEMO_MODE` + user role.
