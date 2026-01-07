# User Service

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
- **Communication:** REST (Spring Web & WebFlux), `WebClient` (`AuthzClient`, `AuditLogClient`)
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

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, not null | Unique user identifier |
| `created_at`| TIMESTAMP | Default: now() | Account creation timestamp |
| `email` | VARCHAR | Unique, not null | User email address |
| `is_banned` | BOOLEAN | Default: false | Ban status flag |
| `password` | VARCHAR | Not null (bcrypt hash) | Encrypted user password |
| `username` | VARCHAR | Unique, not null | User login name |

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

### 5. **Request Password Reset**
**POST** `/forgot-password`
Initiates the password reset process (e.g., sends an email).
- `200 OK` — Request processed (even if email doesn't exist, for security)

### 6. **Perform Password Reset**
**POST** `/reset-password`
Sets a new password using a valid reset token.
- `200 OK` — Password reset successfully
- `400 Bad Request` — Invalid/expired token OR new password matches the old password

### 7. **Ban User** (Admin only)
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