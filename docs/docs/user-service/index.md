# user service

**Owner:** @Filip Sanecki

User Service for **RiskRadar** responsible for user identity and access management. It provides user registration, authentication, JWT handling, refresh token rotation, banning functionality, and integration with the Audit Logging and Authorization services.

---

## 🎯 Purpose

This service provides **authentication and identity management** within RiskRadar.  
It ensures:

- Secure user registration and login
- JWT-based authentication
- Refresh token management with Redis
- User banning (admin only)
- Audit logging of authentication events
- Integration with the central Authorization Service for roles & permissions

---

## 🏗️ Architecture

- **Language:** Java 21
- **Framework:** Spring Boot 3.5
- **Database:** PostgreSQL (via Spring Data JPA + Hibernate)
- **Cache/Token Store:** Redis (Lettuce client)
- **Security:** Spring Security + JWT (jjwt)
- **Build Tool:** Maven
- **Communication:** REST (Spring Web & WebFlux), Feign clients (`AuthzClient`, `AuditLogClient`)
- **Deployment:** Docker / Docker Compose (via `spring-boot-docker-compose`)

---

## ⚙️ Core Components

- **User Registration & Authentication**
    - Registers new users (with validation)
    - Authenticates users and issues tokens

- **JWT Management**
    - Access tokens (short-lived)
    - Refresh tokens (stored in Redis and rotated on refresh)
    - Blacklisting access tokens on logout

- **User Banning**
    - Admin-only endpoint to ban users
    - Revokes refresh tokens and prevents logins

- **Audit Logging**
    - All authentication and authorization events logged with metadata (IP, user agent, status)

- **Authorization Integration**
    - Fetches roles and permissions from external Authorization Service
    - Injects them into JWT claims

---

## 🗄️ Database Schema

### `users`

| Column      | Type      | Constraints              | Description                |
|-------------|-----------|--------------------------|----------------------------|
| `id`        | UUID      | PK, not null             | Unique user identifier     |
| `created_at`| TIMESTAMP | Default: now()           | Account creation timestamp |
| `email`     | VARCHAR   | Unique, not null         | User email address         |
| `is_banned` | BOOLEAN   | Default: false           | Ban status flag            |
| `password`  | VARCHAR   | Not null (bcrypt hash)   | Encrypted user password    |
| `username`  | VARCHAR   | Unique, not null         | User login name            |

---

## 🔑 API Endpoints

### 1. **Register User**
**POST** `/register`  
Registers a new user.
- `201 Created` — User registered
- `409 Conflict` — Username/email exists
- `500 Internal Server Error` — Unexpected error

### 2. **Login**
**POST** `/login`  
Authenticates and issues JWT access + refresh tokens.
- `200 OK` — Returns tokens
- `401 Unauthorized` — Invalid credentials or banned

### 3. **Logout**
**POST** `/logout`  
Invalidates current tokens (access token blacklisted, refresh revoked).
- `200 OK` — Success
- `401 Unauthorized` — Missing/invalid token

### 4. **Refresh Token**
**POST** `/refresh`  
Rotates tokens using a valid refresh token.
- `200 OK` — New tokens
- `401 Unauthorized` — Invalid/expired/banned

### 5. **Ban User** (Admin only)
**POST** `/banUser`  
Bans a user and revokes their tokens.
- `200 OK` — User banned
- `400 Bad Request` — Already banned or not found

---

## ❌ Error Handling

All errors follow consistent format:

```json
{
  "error": "Message here"
}
```

---

## 🔒 Security Configuration

The service uses **Spring Security** with **JWT-based stateless authentication**:

- **Public endpoints** (no token required):
    - `POST /login`
    - `POST /register`
    - `POST /refresh`

- **Protected endpoints** (JWT required in `Authorization` header):
    - `POST /banUser`
    - `POST /logout`
    - Any other non-public endpoints

### Token Requirement

All protected requests must include a valid JWT in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

### Example: Ban User (Admin Only)

**Request**

```
POST http://localhost:8080/banUser
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
Content-Type: application/json
```

**Body**

```json
{
  "username": "userForBan",
  "reason": "reason"
}
```

**Responses**

- `200 OK` – User successfully banned
- `401 Unauthorized` – Missing or invalid JWT
- `403 Forbidden` – Token valid but user lacks `ROLE_ADMIN`
- `400 Bad Request` – User already banned or not found

---

## 🧑‍💻 Example Usage Flow

### 1. Register
```bash
curl -X POST http://localhost:8080/register   -H "Content-Type: application/json"   -d '{"username":"userTest","email":"testUser@gmail.com","password":"Secret123"}'
```

### 2. Login
```bash
curl -X POST http://localhost:8080/login   -H "Content-Type: application/json"   -d '{"username":"userTest","password":"Secret123"}'
```

_Response:_
```json
{
  "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "..."
}
```

### 3. Access Profile (JWT required)
```bash
curl -X GET http://localhost:8080/auth/profile   -H "Authorization: Bearer <access_token>"
```

### 4. Refresh Token
```bash
curl -X POST http://localhost:8080/refresh   -H "Content-Type: application/json"   -d '{"refreshToken":"<refresh_token>"}'
```

### 5. Logout
```bash
curl -X POST http://localhost:8080/logout   -H "Authorization: Bearer <access_token>"
```

---

## 🧪 Testing

- Unit tests: JUnit 5, Mockito
- Security tests: Spring Security Test
- Integration tests: Spring Boot Starter Test