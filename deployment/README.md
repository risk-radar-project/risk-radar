# 🚀 Risk Radar - Deployment Guide

Instrukcja wdrożenia aplikacji Risk Radar na VPS z Ubuntu.

## 📋 Wymagania

- **System:** Ubuntu 22.04+ (lub inny Linux z Docker)
- **RAM:** Minimum 8GB (zalecane 16GB)
- **CPU:** 4 rdzenie
- **Dysk:** 40GB+ wolnego miejsca
- **Docker:** 24.0+ z Docker Compose v2
- **Domena:** Skonfigurowana w Cloudflare z tunelem

## 🔧 Krok 1: Przygotowanie VPS

```bash
# Aktualizacja systemu
sudo apt update && sudo apt upgrade -y

# Instalacja Docker (jeśli nie zainstalowany)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Wyloguj się i zaloguj ponownie, lub:
newgrp docker

# Sprawdź instalację
docker --version
docker compose version
```

## 📥 Krok 2: Sklonuj repozytorium

```bash
# Utwórz katalog dla aplikacji
sudo mkdir -p /opt/risk-radar
sudo chown $USER:$USER /opt/risk-radar
cd /opt/risk-radar

# Sklonuj repozytorium
git clone https://github.com/TWOJE-REPO/risk-radar.git .
# lub przez SSH:
# git clone git@github.com:TWOJE-REPO/risk-radar.git .
```

## 🔐 Krok 3: Konfiguracja zmiennych środowiskowych

```bash
# Skopiuj szablon
cp deployment/.env.production.template .env

# Wygeneruj sekrety
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 64 | tr -d '\n')"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')"
echo "SUPERADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '\n')"

# Edytuj .env i wklej wygenerowane wartości
nano .env
```

### Zawartość `.env`:

```env
HOSTNAME=riskradar.ovh

# Wklej wygenerowane wartości:
JWT_ACCESS_SECRET=<twoj_wygenerowany_secret>
JWT_REFRESH_SECRET=<twoj_wygenerowany_secret>
POSTGRES_USER=riskradar_prod
POSTGRES_PASSWORD=<twoje_haslo>
SUPERADMIN_PASSWORD=<haslo_admina>

# Google AI (opcjonalne)
GOOGLE_API_KEY=<twoj_klucz_api>
GOOGLE_AI_MODEL=models/gemini-2.5-flash

# Cloudflare Tunnel (jeśli w Docker)
CLOUDFLARE_TUNNEL_TOKEN=<token_tunelu>
```

## 🌐 Krok 4: Konfiguracja Cloudflare Tunnel

### Opcja A: Tunel w Docker (zalecane)

1. Zaloguj się do [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Przejdź do **Access → Tunnels**
3. Utwórz nowy tunel lub użyj istniejącego
4. Skopiuj token tunelu do `.env` jako `CLOUDFLARE_TUNNEL_TOKEN`
5. Skonfiguruj routing w dashboardzie Cloudflare:

| Public hostname | Service |
|-----------------|---------|
| `riskradar.ovh` | `http://frontend:3000` |
| `riskradar.ovh/api/*` | `http://api-gateway:8080` |
| `docs.riskradar.ovh` | `http://docs-service:8000` |
| `mail.riskradar.ovh` | `http://mailpit:8025` |

### Opcja B: Tunel uruchomiony osobno

Jeśli wolisz uruchomić cloudflared poza Docker:

```bash
# Instalacja cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# Konfiguracja (używając pliku config)
sudo mkdir -p /etc/cloudflared
sudo cp deployment/cloudflared-config.yml.example /etc/cloudflared/config.yml
sudo nano /etc/cloudflared/config.yml  # uzupełnij tunnel ID

# Uruchom jako serwis
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

## 🚀 Krok 5: Uruchomienie aplikacji

```bash
cd /opt/risk-radar

# Uruchom wszystkie serwisy (bez tunelu w Docker)
docker compose -f docker-compose.prod.yml up -d

# LUB z tunelem Cloudflare w Docker:
docker compose -f docker-compose.prod.yml --profile tunnel up -d

# Sprawdź status
docker compose -f docker-compose.prod.yml ps

# Sprawdź logi
docker compose -f docker-compose.prod.yml logs -f
```

## 🌱 Krok 6: Seed danych demo (opcjonalne, jednorazowo)

```bash
# Uruchom seeder (utworzy superadmina i przykładowe dane)
docker compose -f docker-compose.prod.yml --profile seeder run --rm demo-seeder

# Zaloguj się jako superadmin:
# Email: superadmin@riskradar.ovh
# Hasło: (wartość SUPERADMIN_PASSWORD z .env)
```

## ✅ Krok 7: Weryfikacja

1. Otwórz https://riskradar.ovh - powinien wyświetlić się frontend
2. Otwórz https://docs.riskradar.ovh - dokumentacja
3. Otwórz https://mail.riskradar.ovh - panel Mailpit (zabezpiecz w Cloudflare!)
4. Przetestuj logowanie jako superadmin

## 🔒 Zabezpieczenie Mailpit

W Cloudflare Zero Trust Dashboard:
1. Przejdź do **Access → Applications**
2. Dodaj nową aplikację dla `mail.riskradar.ovh`
3. Skonfiguruj politykę dostępu (np. tylko Twój email)

## 📊 Przydatne komendy

```bash
# Status serwisów
docker compose -f docker-compose.prod.yml ps

# Logi wszystkich serwisów
docker compose -f docker-compose.prod.yml logs -f

# Logi konkretnego serwisu
docker compose -f docker-compose.prod.yml logs -f frontend

# Restart wszystkiego
docker compose -f docker-compose.prod.yml restart

# Zatrzymanie
docker compose -f docker-compose.prod.yml down

# Zatrzymanie z usunięciem volumes (UWAGA: usuwa dane!)
docker compose -f docker-compose.prod.yml down -v

# Aktualizacja (po git pull)
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

## 🔄 Aktualizacja aplikacji

```bash
cd /opt/risk-radar

# Pobierz zmiany
git pull origin main

# Przebuduj obrazy
docker compose -f docker-compose.prod.yml build

# Zrestartuj z nowymi obrazami
docker compose -f docker-compose.prod.yml up -d
```

## 🐛 Rozwiązywanie problemów

### Serwis nie startuje
```bash
# Sprawdź logi
docker compose -f docker-compose.prod.yml logs nazwa-serwisu

# Sprawdź healthcheck
docker inspect nazwa-serwisu | grep -A 10 Health
```

### Problemy z bazą danych
```bash
# Połącz się z PostgreSQL
docker exec -it postgres psql -U riskradar_prod -d risk-radar

# Sprawdź tabele
\dt
```

### Problemy z pamięcią
```bash
# Sprawdź zużycie
docker stats

# Ogranicz pamięć dla serwisów (dodaj do compose)
# deploy:
#   resources:
#     limits:
#       memory: 512M
```

## 📁 Struktura danych

Dane persystentne są przechowywane w Docker volumes:
- `riskradar-backend_postgres_data` - baza danych PostgreSQL
- `riskradar-backend_redis_data` - cache Redis
- `riskradar-backend_media_data` - przesłane pliki multimedialne

Backup:
```bash
# Backup PostgreSQL
docker exec postgres pg_dump -U riskradar_prod risk-radar > backup_$(date +%Y%m%d).sql

# Backup wszystkich volumes
docker run --rm -v riskradar-backend_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz /data
```
