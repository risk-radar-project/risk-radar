# 🛡️ RiskRadar

A platform for reporting and viewing local hazards and public safety issues such as infrastructure problems, accidents, vandalism, dangerous situations, litter, and biohazards.

## 🔴 Live Demo & Video

- **Live App:** [Coming Soon](#)
- **Demo Video:** [Coming Soon](#)

---

## 🌟 Key Features

- 📢 **Incident Reporting** – Create reports with location, category, photos, and description
- 🗺️ **Interactive Map** – Browse reports on a map with filters, clustering, and legend
- 🤖 **AI-Powered Tools** – Automatic categorization, duplicate detection, and AI assistant for summaries
- 🔐 **Role-Based Access** – User, volunteer, moderator, and admin roles with granular permissions
- 🔔 **Notifications** – Email notifications for report status changes and follow-up questions
- 📊 **Admin Panel** – Manage users, reports, roles, and view statistics
- 📜 **Audit Logging** – Centralized logging of all user and system actions

---

## 🏗️ Architecture

RiskRadar is built as a **microservices monorepo** with:

- 🚪 A single **API Gateway** handling authentication, rate limiting, and routing
- 🔄 Independent services communicating via **REST API** and **Kafka events**
- 💾 Shared infrastructure: **PostgreSQL**, **Redis**, **Kafka**
- 🐳 Containerized deployment via **Docker Compose**

---

## ⚡ Quickstart

### 📋 Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- Git

### 🚀 Run the Stack

```bash
# Clone the repository
git clone https://github.com/risk-radar-project/risk-radar.git
cd risk-radar

# Configure environment variables
cp .env.example .env

# Start all services
docker compose up --build
```

### 🌐 Access Points

| Service         | URL                          |
|-----------------|------------------------------|
| Frontend        | http://localhost:3000        |
| API Gateway     | http://localhost:8090        |
| API Swagger     | http://localhost:8090/api/docs |
| Mailpit (email) | http://localhost:8025        |

### 🔧 Environment Variables

The project includes a `.env.example` file with all necessary configuration variables. 
Copy it to `.env` and adjust the values as needed.

The `docker-compose.yml` uses these variables. Key configurations include:

- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` – JWT signing secrets
- `DATABASE_URL` – PostgreSQL connection string
- `GOOGLE_API_KEY` – For AI assistant service (optional)
- `ADMIN_PASSWORD` – Demo seeder admin password

### 🛑 Stop the Stack

```bash
docker compose down

# To also remove volumes (database data):
docker compose down -v
```

---

## 📂 Project Structure

```
risk-radar/
├── docker-compose.yml       # Full stack orchestration
├── docs/                    # MkDocs documentation source
│   └── docs/                # Service-specific documentation
└── services/                # All microservices
    ├── api-gateway/         # Entry point, routing, auth validation
    ├── user-service/        # Registration, login, profiles, bans
    ├── authz-service/       # Role-based access control (RBAC)
    ├── report-service/      # Report CRUD, status management
    ├── map-service/         # Geospatial queries, clustering
    ├── media-service/       # Photo uploads, thumbnails
    ├── notification-service/# Email notifications
    ├── audit-log-service/   # Centralized audit logging
    ├── ai-categorization-service/    # Auto-categorization
    ├── ai-verification-duplication-service/  # Duplicate detection
    ├── ai-assistant-service/         # Summaries
    ├── frontend/            # Next.js web application
    └── demo-data-seeder/    # Demo seed data
```

---

## 🧩 Microservices

| Service | Port | Responsibility |
|---------|------|----------------|
| **api-gateway** | 8090 | Routing, JWT validation, rate limiting |
| **user-service** | 8080 | User registration, login, profiles, bans |
| **authz-service** | 8081 | Roles and permissions (RBAC) |
| **audit-log-service** | 8082 | Centralized event logging |
| **ai-categorization-service** | 8083 | Automatic report categorization |
| **media-service** | 8084 | Photo uploads and thumbnails |
| **report-service** | 8085 | Report CRUD and status management |
| **map-service** | 8086 | Geospatial queries and clustering |
| **notification-service** | 8087 | Email notifications |
| **ai-assistant-service** | 8088 | AI chat and regional summaries |
| **ai-verification-duplication-service** | 8089 | Report verification and duplicate detection |
| **frontend** | 3000 | Next.js web application |

---

## 📚 Documentation

Detailed documentation for each microservice is available in the `/docs` folder and served at http://localhost:8000 when running the stack.

### 📖 Service Documentation

| Service Name | Documentation Link |
|:--- |:---|
| **AI Assistant Service** | [📄 View Docs](docs/docs/ai-assistant-service/index.md) |
| **AI Categorization Service** | [📄 View Docs](docs/docs/ai-categorization-service/index.md) |
| **AI Verification Service** | [📄 View Docs](docs/docs/ai-verification-duplication-service/index.md) |
| **API Gateway** | [📄 View Docs](docs/docs/api-gateway/index.md) |
| **Audit Log Service** | [📄 View Docs](docs/docs/audit-log-service/index.md) |
| **Authz Service** | [📄 View Docs](docs/docs/authz-service/index.md) |
| **Frontend** | [📄 View Docs](docs/docs/frontend/index.md) |
| **Map Service** | [📄 View Docs](docs/docs/map-service/index.md) |
| **Media Service** | [📄 View Docs](docs/docs/media-service/index.md) |
| **Notification Service** | [📄 View Docs](docs/docs/notification-service/index.md) |
| **Report Service** | [📄 View Docs](docs/docs/report-service/index.md) |
| **User Service** | [📄 View Docs](docs/docs/user-service/index.md) |

---

## 🛠️ Troubleshooting

### ❌ Services fail to start

- Ensure Docker has enough resources allocated (4GB+ RAM recommended)
- Wait for health checks: `docker compose logs -f` to monitor startup
- PostgreSQL and Kafka must be healthy before dependent services start

### 🔌 Database connection errors

- Verify PostgreSQL is running: `docker compose ps postgres`
- Check connection string in `docker-compose.yml`

### 🚧 Port conflicts

If ports are already in use, either stop conflicting services or modify port mappings in `docker-compose.yml`.

### 🔄 Rebuild after code changes

```bash
docker compose up --build <service-name>
```

---

## 📜 License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.
