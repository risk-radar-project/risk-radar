# user service

**Owner:** @Filip Sanecki

# RiskRadar User Service

This is the **User Authentication Service** for RiskRadar. It handles user registration, authentication, JWT token management, refresh token management (with Redis), user banning, and profile retrieval.

---

## API Endpoints

All endpoints are prefixed with `/auth`.

### 1. **User Registration**

**POST** `/auth/register`

Registers a new user.

#### Request Body:

```json
{
  "username": "string",
  "password": "string",
  "email": "string"
}
```

#### Responses:

* `201 Created` — User registered successfully
* `409 Conflict` — Username or email already exists
* `500 Internal Server Error` — Unexpected error

---

### 2. **User Login**

**POST** `/auth/login`

Authenticates a user and issues JWT access and refresh tokens.

#### Request Body:

```json
{
  "username": "string",
  "password": "string"
}
```

#### Responses:

* `200 OK` — Returns tokens

```json
{
  "token": "<access_token>",
  "refreshToken": "<refresh_token>"
}
```

* `401 Unauthorized` — Invalid credentials or banned user

---

### 3. **Logout**

**POST** `/auth/logout`

Invalidates the current token and refresh token.

#### Headers:

* `Authorization: Bearer <access_token>`

#### Responses:

* `200 OK` — Logout successful
* `401 Unauthorized` — Missing or invalid token

---

### 4. **Refresh Token**

**POST** `/auth/refresh`

Generates new access and refresh tokens using a valid refresh token.

#### Request Body:

```json
{
  "refreshToken": "<refresh_token>"
}
```

#### Responses:

* `200 OK` — New tokens issued
* `401 Unauthorized` — Invalid, expired, or banned user

---

### 5. **Ban User** (Admin only)

**POST** `/auth/banUser`

Bans a user and revokes their refresh tokens.

#### Headers:

* Requires valid `Authorization` header with `ADMIN` role.

#### Request Body:

```json
{
  "username": "string",
  "reason": "string"
}
```

#### Responses:

* `200 OK` — User banned
* `400 Bad Request` — User not found or already banned

---

### 6. **User Profile**

**GET** `/auth/profile`

Returns the authenticated user's profile.

#### Headers:

* `Authorization: Bearer <access_token>`

#### Responses:

* `200 OK` — Returns username greeting
* `401 Unauthorized` — If not authenticated

---

## Token Management

* **Access Tokens:** Short-lived JWTs used for authentication.
* **Refresh Tokens:** Stored in Redis and rotated upon refresh. Banned users' tokens are invalidated.

---

## Error Handling

All error responses follow this format:

```json
{
  "error": "Error message here"
}
```

---

## Security Notes

* Banned users are checked both via database and Redis.
* Access tokens are blacklisted on logout or token expiration.
* Refresh tokens are revoked upon refresh and logout.

---