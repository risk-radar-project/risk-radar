# authz service

**Owner:** @Sergiusz Sanetra

---
 
# Authorization Service (RBAC)

The **Authorization Service** is a Role-Based Access Control (RBAC) microservice for RiskRadar. It manages roles, permissions, and user authorization across the entire platform. This service provides fine-grained access control for all RiskRadar microservices.

---

## 🏗️ Architecture

### Core Components

- **Role Management** - Create, update, delete roles with associated permissions
- **Permission Management** - Full CRUD operations for the global permission catalog
- **Permission System** - Granular permission-based access control with wildcard support
- **User-Role Assignment** - Assign and manage user roles
- **Authorization Checks** - Real-time permission verification
- **Audit Logging** - Comprehensive event tracking

### Technology Stack

- **Language:** Go 1.21
- **Framework:** Gorilla Mux (HTTP routing)
- **Database:** PostgreSQL
- **ORM:** Native SQL with database/sql
- **Migrations:** golang-migrate/migrate

---

## 📊 Database Schema

### Tables

#### `roles`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(100) | Role name (unique) |
| description | TEXT | Role description |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

#### `permissions`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(100) | Permission name (unique) - format: "resource:action" |
| description | TEXT | Permission description |
| resource | VARCHAR(50) | Resource name (e.g., "users", "reports") |
| action | VARCHAR(50) | Action name (e.g., "read", "create", "ban") |
| created_at | TIMESTAMP | Creation timestamp |

*Note: The name field contains the combined format (e.g., "users:ban"), while resource and action are stored separately for efficient querying.*

#### `role_permissions`
| Column | Type | Description |
|--------|------|-------------|
| role_id | UUID | Foreign key to roles |
| permission_id | UUID | Foreign key to permissions |
| assigned_at | TIMESTAMP | Assignment timestamp |

#### `user_roles`
| Column | Type | Description |
|--------|------|-------------|
| user_id | UUID | User identifier |
| role_id | UUID | Foreign key to roles |
| assigned_at | TIMESTAMP | Assignment timestamp |

---

## 🔐 Default Roles & Permissions

### Default Roles
- **admin** - System administrator with full access (super admin permission)
- **moderator** - Content moderator with management permissions
- **volunteer** - Community helper with validation permissions  
- **user** - Basic user role with standard permissions

### Permissions Catalog

The system implements fine-grained permissions organized by resource categories. Each permission follows the format `resource:action`.

#### Reports
- `reports:create` - Create new reports
- `reports:read` - View reports
- `reports:edit` - Edit existing reports
- `reports:delete` - Delete reports
- `reports:cancel` - Cancel own reports
- `reports:cancel-any` - Cancel any user's reports
- `reports:validate` - Validate/verify reports
- `reports:view-location` - View report locations on map
- `reports:categorize` - Categorize reports
- `reports:rate-severity` - Rate report severity
- `reports:*` - Full access to all report operations

#### Users
- `users:profile` - Manage own profile
- `users:history` - View own report history
- `users:delete-account` - Delete own account
- `users:ban` - Ban users
- `users:unban` - Unban users
- `users:view` - View user profiles
- `users:*` - Full access to all user operations

#### AI Services
- `ai:chat` - Access AI chat assistant
- `ai:summary` - Access AI summary features
- `ai:*` - Full access to all AI features

#### Statistics
- `stats:view` - View system statistics
- `stats:*` - Full access to statistics

#### Audit
- `audit:view` - View audit logs
- `audit:*` - Full access to audit features

#### Roles
- `roles:manage` - Manage user roles
- `roles:view` - View role information
- `roles:*` - Full access to role management

#### System
- `system:admin` - Full system administration
- `system:*` - Full access to all system operations

#### Wildcard Permissions
- `*:*` - Full access to everything (super admin permission)

**Wildcard Support:** The system supports wildcards (`*`) in permissions:
- `users:*` - Grants access to any action on users resource
- `*:reports` - Grants access to reports resource with any action
- `*:*` - Grants access to everything (super admin)

### Default Role-Permission Assignments

The system includes four predefined roles with hierarchical permissions:

#### User Role (Basic User)
Basic permissions for regular platform users:

- **Reports:** `create`, `read`, `cancel`, `view-location`, `categorize`, `rate-severity`

- **Profile:** `users:profile`, `users:history`, `users:delete-account`

- **AI Services:** `ai:chat`, `ai:summary`


#### Volunteer Role (Community Helper)
Inherits all User permissions plus community moderation:

- **All User permissions** (inherited)

- **Community Moderation:** `reports:cancel-any`, `reports:validate`


#### Moderator Role (Content Moderator)
Inherits all Volunteer permissions plus moderation tools:

- **All Volunteer permissions** (inherited)

- **Content Management:** `reports:edit`, `reports:delete`

- **User Management:** `users:ban`, `users:unban`, `users:view`

- **System Access:** `stats:view`, `audit:view`


#### Admin Role (System Administrator)
Full system access with super admin permission:

- **Super Admin:** `*:*` (grants access to everything in the system)

---

## 🔌 API Endpoints

### Overview

The Authorization Service provides a RESTful API for managing roles, permissions, and user authorization. All endpoints return JSON responses and follow standard HTTP status codes.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/status` | Health check and service status |
| `GET` | `/roles` | List all roles with permissions |
| `GET` | `/roles/{roleId}` | Get specific role details |
| `POST` | `/roles` | Create new role |
| `PUT` | `/roles/{roleId}` | Update existing role |
| `DELETE` | `/roles/{roleId}` | Delete role |
| `GET` | `/permissions` | List all available permissions |
| `GET` | `/permissions/{permissionId}` | Get specific permission details |
| `POST` | `/permissions` | Create new permission |
| `PUT` | `/permissions/{permissionId}` | Update existing permission |
| `DELETE` | `/permissions/{permissionId}` | Delete permission |
| `GET` | `/has-permission` | Check user permission |
| `GET` | `/users/{userId}/roles` | Get user's assigned roles |
| `GET` | `/users/{userId}/permissions` | Get user's effective permissions |
| `POST` | `/users/{userId}/roles` | Assign role to user |
| `DELETE` | `/users/{userId}/roles/{roleId}` | Remove role from user |

---

### Health Check

#### `GET /status`

Returns the current health status of the service and database connection.

**Response 200 OK:**
```json
{
  "status": "OK",
  "timestamp": "2025-07-25T16:57:31.6167043Z",
  "database_connection": "OK"
}
```

**Response 503 Service Unavailable:**
```json
{
  "status": "FAIL",
  "timestamp": "2025-07-25T16:57:31.6167043Z",
  "database_connection": "FAIL: connection error details"
}
```

---

### Role Management

#### `GET /roles`

Retrieves all roles with their associated permissions.

**Response 200 OK:**
```json
[
  {
    "role": {
      "id": "2b410eb1-4abd-4bd3-b2d5-fd265a3ffddb",
      "name": "admin",
      "description": "Administrator role with full system access",
      "created_at": "2025-07-24T13:19:04.964265Z",
      "updated_at": "2025-07-24T13:19:04.964265Z"
    },
    "permissions": [
      {
        "id": "c5c860f2-7c38-4a17-a9b3-ee3986abe4a0",
        "name": "*:*",
        "description": "Full access to everything (super admin)",
        "resource": "*",
        "action": "*",
        "created_at": "2025-07-24T13:19:04.964265Z"
      }
    ]
  }
]
```

---

#### `GET /roles/{roleId}`

Retrieves a specific role by ID with its permissions.

**Parameters:**
- `roleId` (path, required): UUID of the role

**Response 200 OK:**
```json
{
  "role": {
    "id": "2b410eb1-4abd-4bd3-b2d5-fd265a3ffddb",
    "name": "admin",
    "description": "Administrator role with full system access",
    "created_at": "2025-07-24T13:19:04.964265Z",
    "updated_at": "2025-07-24T13:19:04.964265Z"
  },
  "permissions": [
    {
      "id": "c5c860f2-7c38-4a17-a9b3-ee3986abe4a0",
      "name": "*:*",
      "description": "Full access to everything (super admin)",
      "resource": "*",
      "action": "*",
      "created_at": "2025-07-24T13:19:04.964265Z"
    }
  ]
}
```

**Response 400 Bad Request:**
```json
{
  "error": "validation error in field 'uuid': UUID must be exactly 36 characters long",
  "code": 400,
  "message": "Invalid role ID format"
}
```

**Response 404 Not Found:**
```json
{
  "error": "",
  "code": 404,
  "message": "Role not found"
}
```

---

#### `POST /roles`

Creates a new role with specified permissions.

**Request Body:**
```json
{
  "name": "test-role-api",
  "description": "Test role created via API",
  "permissions": [
    {
      "action": "read",
      "resource": "reports"
    }
  ]
}
```

**Response 201 Created:**
```json
{
  "role": {
    "id": "8b73ef3b-91f8-4b76-a0d7-8931a5d41823",
    "name": "test-role-api",
    "description": "Test role created via API",
    "created_at": "2025-07-25T17:00:43.4496179Z",
    "updated_at": "2025-07-25T17:00:43.4496179Z"
  },
  "permissions": [
    {
      "id": "2cafea83-8bbc-4cc1-b6a6-664e9402a0a7",
      "name": "reports:read",
      "description": "Read access to reports and map",
      "resource": "reports",
      "action": "read",
      "created_at": "2025-07-24T13:19:04.964265Z"
    }
  ]
}
```

**Response 400 Bad Request:**
```json
{
  "error": "validation error in field 'name': name is required",
  "code": 400,
  "message": "validation error in field 'name': name is required"
}
```

**Response 409 Conflict:**
```json
{
  "error": "role with name 'test-role-api' already exists",
  "code": 409,
  "message": "role with name 'test-role-api' already exists"
}
```

---

#### `PUT /roles/{roleId}`

Updates an existing role with new data and permissions.

**Parameters:**
- `roleId` (path, required): UUID of the role to update

**Request Body:**
```json
{
  "name": "test-role-api-updated",
  "description": "Updated test role",
  "permissions": [
    {
      "action": "read",
      "resource": "reports"
    },
    {
      "action": "create",
      "resource": "reports"
    }
  ]
}
```

**Response 200 OK:**
```json
{
  "role": {
    "id": "8b73ef3b-91f8-4b76-a0d7-8931a5d41823",
    "name": "test-role-api-updated",
    "description": "Updated test role",
    "created_at": "2025-07-25T17:00:43.449618Z",
    "updated_at": "2025-07-25T17:01:00.485004Z"
  },
  "permissions": [
    {
      "id": "2cafea83-8bbc-4cc1-b6a6-664e9402a0a7",
      "name": "reports:read",
      "description": "Read access to reports and map",
      "resource": "reports",
      "action": "read",
      "created_at": "2025-07-24T13:19:04.964265Z"
    },
    {
      "id": "c7bf3acb-cedb-4da7-890f-568a52ca2316",
      "name": "reports:create",
      "description": "Create new reports",
      "resource": "reports",
      "action": "create",
      "created_at": "2025-07-24T13:19:04.964265Z"
    }
  ]
}
```

**Response 404 Not Found:**
```json
{
  "error": "",
  "code": 404,
  "message": "Role not found"
}
```

---

#### `DELETE /roles/{roleId}`

Deletes a role by ID.

**Parameters:**
- `roleId` (path, required): UUID of the role to delete

**Response 204 No Content:**
No response body.

**Response 404 Not Found:**
```json
{
  "error": "role not found",
  "code": 404,
  "message": "Role not found"
}
```

---

### Permission Management

#### `GET /permissions`

Retrieves all available permissions in the system.

**Response 200 OK:**
```json
[
  {
    "id": "c5c860f2-7c38-4a17-a9b3-ee3986abe4a0",
    "name": "users:ban",
    "description": "Ban users from the platform",
    "resource": "users",
    "action": "ban",
    "created_at": "2025-07-24T13:19:04.964265Z"
  },
  {
    "id": "2cafea83-8bbc-4cc1-b6a6-664e9402a0a7",
    "name": "reports:read",
    "description": "Read access to reports and map",
    "resource": "reports",
    "action": "read",
    "created_at": "2025-07-24T13:19:04.964265Z"
  }
]
```

---

#### `GET /permissions/{permissionId}`

Retrieves a specific permission by its UUID.

**Parameters:**
- `permissionId` (path, required): UUID of the permission

**Response 200 OK:**
```json
{
  "id": "c5c860f2-7c38-4a17-a9b3-ee3986abe4a0",
  "name": "users:ban",
  "description": "Ban users from the platform",
  "resource": "users",
  "action": "ban",
  "created_at": "2025-07-24T13:19:04.964265Z"
}
```

**Response 400 Bad Request:**
```json
{
  "error": "validation error in field 'uuid': UUID must be exactly 36 characters long",
  "code": 400,
  "message": "Invalid permission ID format"
}
```

**Response 404 Not Found:**
```json
{
  "error": "",
  "code": 404,
  "message": "Permission not found"
}
```

---

#### `POST /permissions`

Creates a new permission in the global catalog.

**Request Body:**
```json
{
  "resource": "notifications",
  "action": "send",
  "description": "Send notifications to users"
}
```

**Field Validation:**
- `resource`: Required, 1-50 characters, cannot contain colon (:)
- `action`: Required, 1-50 characters, cannot contain colon (:)
- `description`: Required, 1-255 characters

**Response 201 Created:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "notifications:send",
  "description": "Send notifications to users",
  "resource": "notifications",
  "action": "send",
  "created_at": "2025-07-26T10:30:45.123456Z"
}
```

**Response 400 Bad Request (Validation Error):**
```json
{
  "error": "validation error in field 'resource': resource is required",
  "code": 400,
  "message": "validation error in field 'resource': resource is required"
}
```

**Response 400 Bad Request (Invalid Characters):**
```json
{
  "error": "resource and action cannot contain colon (:) character",
  "code": 400,
  "message": "resource and action cannot contain colon (:) character"
}
```

**Response 409 Conflict:**
```json
{
  "error": "permission with name 'notifications:send' already exists",
  "code": 409,
  "message": "permission with name 'notifications:send' already exists"
}
```

**Response 500 Internal Server Error:**
```json
{
  "error": "database insert failed",
  "code": 500,
  "message": "Failed to create permission"
}
```

---

#### `PUT /permissions/{permissionId}`

Updates an existing permission by its UUID.

**Parameters:**
- `permissionId` (path, required): UUID of the permission to update

**Request Body:**
```json
{
  "resource": "notifications",
  "action": "broadcast",
  "description": "Broadcast notifications to all users"
}
```

**Field Validation:**
- `resource`: Required, 1-50 characters, cannot contain colon (:)
- `action`: Required, 1-50 characters, cannot contain colon (:)
- `description`: Required, 1-255 characters

**Response 200 OK:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "notifications:broadcast",
  "description": "Broadcast notifications to all users",
  "resource": "notifications",
  "action": "broadcast",
  "created_at": "2025-07-26T10:30:45.123456Z"
}
```

**Response 400 Bad Request (Invalid UUID):**
```json
{
  "error": "validation error in field 'uuid': UUID must be exactly 36 characters long",
  "code": 400,
  "message": "Invalid permission ID format"
}
```

**Response 400 Bad Request (Validation Error):**
```json
{
  "error": "validation error in field 'action': action is required",
  "code": 400,
  "message": "validation error in field 'action': action is required"
}
```

**Response 404 Not Found:**
```json
{
  "error": "permission not found",
  "code": 404,
  "message": "Permission not found"
}
```

**Response 409 Conflict:**
```json
{
  "error": "permission with name 'notifications:broadcast' already exists",
  "code": 409,
  "message": "permission with name 'notifications:broadcast' already exists"
}
```

**Response 500 Internal Server Error:**
```json
{
  "error": "database update failed",
  "code": 500,
  "message": "Failed to update permission"
}
```

---

#### `DELETE /permissions/{permissionId}`

Deletes a permission from the global catalog. This operation also removes all role assignments for this permission.

**Parameters:**
- `permissionId` (path, required): UUID of the permission to delete

**Response 204 No Content:**
No response body. The permission and all its role assignments have been successfully deleted.

**Response 400 Bad Request:**
```json
{
  "error": "validation error in field 'uuid': UUID must be exactly 36 characters long",
  "code": 400,
  "message": "Invalid permission ID format"
}
```

**Response 404 Not Found:**
```json
{
  "error": "permission not found",
  "code": 404,
  "message": "Permission not found"
}
```

**Response 500 Internal Server Error:**
```json
{
  "error": "database delete failed",
  "code": 500,
  "message": "Failed to delete permission"
}
```

---

### Authorization

#### `GET /has-permission`

Checks if a user has a specific permission.

**Headers:**
- `X-User-ID` (required): UUID of the user

**Query Parameters:**
- `permission` (required): Permission in format "resource:action" (e.g., "reports:read", "ai:chat")

**Response 200 OK:**
```json
{
  "has_permission": true
}
```

**Response 400 Bad Request (missing header):**
```json
{
  "error": "",
  "code": 400,
  "message": "X-User-ID header is required"
}
```

**Response 400 Bad Request (missing permission):**
```json
{
  "error": "",
  "code": 400,
  "message": "permission query parameter is required"
}
```

**Response 400 Bad Request (invalid UUID):**
```json
{
  "error": "validation error in field 'uuid': UUID must be exactly 36 characters long",
  "code": 400,
  "message": "Invalid user ID format"
}
```

---

#### `GET /users/{userId}/roles`

Retrieves all roles assigned to a specific user.

**Parameters:**
- `userId` (path, required): UUID of the user

**Response 200 OK:**
```json
[
  {
    "id": "d4127aff-f2c0-4b9a-8419-1c247a6b56ff",
    "name": "user",
    "description": "Basic user role - can create and manage own reports",
    "created_at": "2025-07-24T13:19:04.964265Z",
    "updated_at": "2025-07-24T13:19:04.964265Z"
  }
]
```

**Response 400 Bad Request:**
```json
{
  "error": "validation error in field 'uuid': UUID must be exactly 36 characters long",
  "code": 400,
  "message": "Invalid user ID format"
}
```

---

#### `GET /users/{userId}/permissions`

Retrieves all permissions for a specific user (through their assigned roles).

**Parameters:**
- `userId` (path, required): UUID of the user

**Response 200 OK:**
```json
[
  {
    "id": "576e2e8c-d0ba-4dd6-8b5e-f04be2d6af2a",
    "name": "ai:chat",
    "description": "Chat with AI in context of reports",
    "resource": "ai",
    "action": "chat",
    "created_at": "2025-07-24T13:19:04.964265Z"
  },
  {
    "id": "2cafea83-8bbc-4cc1-b6a6-664e9402a0a7",
    "name": "reports:read",
    "description": "Read access to reports and map",
    "resource": "reports",
    "action": "read",
    "created_at": "2025-07-24T13:19:04.964265Z"
  }
]
```

---

#### `POST /users/{userId}/roles`

Assigns a role to a user.

**Parameters:**
- `userId` (path, required): UUID of the user

**Request Body:**
```json
{
  "role_id": "d4127aff-f2c0-4b9a-8419-1c247a6b56ff"
}
```

**Response 204 No Content:**
No response body.

**Response 400 Bad Request:**
```json
{
  "error": "role_id is required",
  "code": 400,
  "message": "role_id is required"
}
```

---

#### `DELETE /users/{userId}/roles/{roleId}`

Removes a role assignment from a user.

**Parameters:**
- `userId` (path, required): UUID of the user
- `roleId` (path, required): UUID of the role to remove

**Response 204 No Content:**
No response body.

**Response 404 Not Found:**
```json
{
  "error": "user role assignment not found",
  "code": 404,
  "message": "User role assignment not found"
}
```

---

### Error Handling
The API returns consistent error responses:

- **400 Bad Request**: Invalid input, malformed UUIDs, missing required fields

- **404 Not Found**: Resource not found (role, user assignment)

- **409 Conflict**: Resource already exists (duplicate role name)

- **500 Internal Server Error**: Server-side errors

All error responses include:

- `error`: Detailed error message

- `code`: HTTP status code

- `message`: User-friendly error description


---

## 🚀 Deployment

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | ✅ |
| `HTTP_PORT` | HTTP server port | `8080` | ❌ |

### Docker Deployment

#### Build Image
```bash
docker build -t authz-service .
```

#### Run Container
```bash
docker run -p 8080:8080 \
  -e DATABASE_URL="postgres://user:pass@host:5432/db?sslmode=disable" \
  authz-service
```

### Database Setup

The service automatically runs migrations on startup. Initial data includes:

- Default roles (admin, moderator, volunteer, user)

- Default permissions for each resource type

- Role-permission assignments


---

## 📊 Monitoring & Logging

Coming Soon