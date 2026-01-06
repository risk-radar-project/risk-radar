# RiskRadar - AI Verification Duplication Service

Serwis do weryfikacji autentyczności zgłoszeń i wykrywania duplikatów przy użyciu modeli ML.

## Wymagania

- Python 3.11+
- Git LFS (do pobrania modeli AI)

## Instalacja modeli AI

**WAŻNE:** Przed uruchomieniem serwisu należy pobrać modele AI z Git LFS:

```bash
# Zainstaluj Git LFS (jeśli nie masz)
# macOS:
brew install git-lfs

# Ubuntu/Debian:
apt-get install git-lfs

# Inicjalizacja Git LFS
git lfs install

# Pobranie modeli
git lfs pull
```

Alternatywnie, uruchom skrypt weryfikacyjny:
```bash
./setup_models.sh
```

## Pliki modeli

Wymagane pliki w `detector_model_components/`:
- `bert_model_finetuned.pth` (~438MB) - Model BERT do ekstrakcji cech
- `fake_detector_head.pth` (~1MB) - Klasyfikator fake/authentic
- `duplicate_classifier.joblib` - Klasyfikator duplikatów
- `scaler.joblib` - Scaler do normalizacji

## Uruchomienie

```bash
# Lokalnie
pip install -r requirements.txt
python main.py

# Docker
docker build -t ai-verification-service .
docker run -p 8080:8080 ai-verification-service
```

## Logika weryfikacji

1. **AI NIE odrzuca automatycznie** - tylko moderator może odrzucić zgłoszenie
2. Jeśli AI wykryje podejrzane zgłoszenie (`is_fake=true`) → status: **PENDING** (wymaga weryfikacji moderatora)
3. Jeśli AI potwierdzi autentyczność (`is_fake=false`) → status: **VERIFIED** (automatycznie zaakceptowane)

## API

- `POST /verify` - Weryfikacja autentyczności zgłoszenia
- `POST /check-duplicate` - Sprawdzenie duplikatów
- `GET /health` - Status zdrowia serwisu

## Rozwiązywanie problemów

### Błąd: "Model file is a Git LFS pointer"
```bash
git lfs install
git lfs pull
```

### Błąd: "Required model file not found"
Upewnij się że Git LFS pobrał pliki:
```bash
./setup_models.sh
```
