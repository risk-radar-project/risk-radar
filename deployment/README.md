# 🚀 Risk Radar - Deployment Guide

A guide to deploying the Risk Radar application on a VPS with Ubuntu.

## 📋 Requirements

- **System:** Ubuntu 22.04+ (or other Linux with Docker)
- **RAM:** Minimum 8GB (recommended 16GB)
- **CPU:** 4 cores
- **Disk:** 40GB+ free space
- **Docker:** 24.0+ with Docker Compose v2
- **Domain:** Configured in Cloudflare with tunnel

## 🔧 Step 1: VPS Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker (if not installed)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Log out and log back in, or:
newgrp docker

# Verify installation
docker --version
docker compose version
```

## 📥 Step 2: Clone Repository

```bash
# Create application directory
sudo mkdir -p /opt/risk-radar
sudo chown $USER:$USER /opt/risk-radar
cd /opt/risk-radar

# Clone repository
git clone https://github.com/YOUR-REPO/risk-radar.git .
# or via SSH:
# git clone git@github.com:YOUR-REPO/risk-radar.git .
```

## 🔐 Step 3: Environment Variables Configuration

```bash
# Copy template
cp deployment/.env.production.template .env

# Generate secrets
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 64 | tr -d '\n')"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')"
echo "SUPERADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '\n')"

# Edit .env and paste generated values
nano .env
```

### `.env` Contents:

```env
HOSTNAME=riskradar.ovh

# Paste generated values:
JWT_ACCESS_SECRET=<your_generated_secret>
JWT_REFRESH_SECRET=<your_generated_secret>
POSTGRES_USER=riskradar_prod
POSTGRES_PASSWORD=<your_password>
SUPERADMIN_PASSWORD=<admin_password>

# Google AI (optional)
GOOGLE_API_KEY=<your_api_key>
GOOGLE_AI_MODEL=models/gemini-2.5-flash

# Cloudflare Tunnel (if running in Docker)
CLOUDFLARE_TUNNEL_TOKEN=<tunnel_token>
```

## 🌐 Step 4: Cloudflare Tunnel Configuration

### Option A: Tunnel in Docker (recommended)

1. Log in to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Access → Tunnels**
3. Create a new tunnel or use an existing one
4. Copy the tunnel token to `.env` as `CLOUDFLARE_TUNNEL_TOKEN`
5. Configure routing in Cloudflare dashboard:

| Public hostname | Service |
|-----------------|---------|
| `riskradar.ovh` | `http://frontend:3000` |
| `riskradar.ovh/api/*` | `http://api-gateway:8080` |
| `docs.riskradar.ovh` | `http://docs-service:8000` |
| `mail.riskradar.ovh` | `http://mailpit:8025` |

### Option B: Tunnel Running Separately

If you prefer to run cloudflared outside Docker:

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# Configuration (using config file)
sudo mkdir -p /etc/cloudflared
sudo cp deployment/cloudflared-config.yml.example /etc/cloudflared/config.yml
sudo nano /etc/cloudflared/config.yml  # fill in tunnel ID

# Run as service
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

## 🚀 Step 5: Launch Application

```bash
cd /opt/risk-radar

# Start all services (without tunnel in Docker)
docker compose -f docker-compose.prod.yml up -d

# OR with Cloudflare tunnel in Docker:
docker compose -f docker-compose.prod.yml --profile cloudflare up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# Check logs
docker compose -f docker-compose.prod.yml logs -f
```

## 🌱 Step 6: Seed Demo Data (optional, one-time)

```bash
# Run seeder (creates superadmin and sample data)
docker compose -f docker-compose.prod.yml --profile seeder run --rm demo-data-seeder

# Log in as superadmin:
# Email: superadmin@riskradar.ovh
# Password: (SUPERADMIN_PASSWORD value from .env)
```

## ✅ Step 7: Verification

1. Open https://riskradar.ovh - frontend should be displayed
2. Open https://docs.riskradar.ovh - documentation
3. Open https://mail.riskradar.ovh - Mailpit panel (secure in Cloudflare!)
4. Test login as superadmin

## 🔒 Securing Mailpit

In Cloudflare Zero Trust Dashboard:
1. Navigate to **Access → Applications**
2. Add a new application for `mail.riskradar.ovh`
3. Configure access policy (e.g., your email only)

## 📊 Useful Commands

```bash
# Service status
docker compose -f docker-compose.prod.yml ps

# All service logs
docker compose -f docker-compose.prod.yml logs -f

# Specific service logs
docker compose -f docker-compose.prod.yml logs -f frontend

# Restart everything
docker compose -f docker-compose.prod.yml restart

# Stop
docker compose -f docker-compose.prod.yml down

# Stop with volume removal (WARNING: deletes data!)
docker compose -f docker-compose.prod.yml down -v

# Update (after git pull)
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

## 🔄 Application Update

```bash
cd /opt/risk-radar

# Pull changes
git pull origin main

# Rebuild images
docker compose -f docker-compose.prod.yml build

# Restart with new images
docker compose -f docker-compose.prod.yml up -d
```

## 🐛 Troubleshooting

### Service Won't Start
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs service-name

# Check healthcheck
docker inspect service-name | grep -A 10 Health
```

### Database Issues
```bash
# Connect to PostgreSQL
docker exec -it postgres psql -U riskradar_prod -d risk-radar

# Check tables
\dt
```

### Memory Issues
```bash
# Check usage
docker stats

# Limit memory for services (add to compose)
# deploy:
#   resources:
#     limits:
#       memory: 512M
```

## 📁 Data Structure

Persistent data is stored in Docker volumes:
- `postgres_data` - PostgreSQL database
- `redis_data` - Redis cache
- `media_data` - uploaded media files

Backup:
```bash
# PostgreSQL backup
docker exec postgres pg_dump -U riskradar_prod risk-radar > backup_$(date +%Y%m%d).sql

# Backup all volumes
docker run --rm -v risk-radar_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz /data
```
