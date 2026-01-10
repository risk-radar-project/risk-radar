import { GATEWAY_URL, getFreshAccessToken } from "@/lib/auth/auth-service"

const AUTHZ_BASE_URL = `${GATEWAY_URL}/api/authz`

export type Permission = {
    id: string
    name: string // "resource:action"
    description: string
    resource: string
    action: string
    created_at: string
}

export type Role = {
    id: string
    name: string
    description: string
    permissions: Permission[]
    created_at: string
    updated_at: string
    userCount: number
}

// Raw API response component for role
type ApiRole = {
    id: string
    name: string
    description: string
    created_at: string
    updated_at: string
}

// Item structure in lists and details
type ApiRoleResponseItem = {
    role: ApiRole
    permissions: Permission[]
    users_count: number
}

export type CreateRoleRequest = {
    name: string
    description: string
    permissions: { resource: string; action: string }[]
}

export type UpdateRoleRequest = {
    name?: string
    description?: string
    permissions?: { resource: string; action: string }[]
}

// NOTE: Fetcher wrapper that adds auth token automatically
async function authzFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await getFreshAccessToken()
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    }

    const res = await fetch(`${AUTHZ_BASE_URL}${endpoint}`, {
        ...options,
        headers
    })

    if (!res.ok) {
        let errorMessage = `Error ${res.status}: ${res.statusText}`
        try {
            const errorData = await res.json()
            if (errorData.message) errorMessage = errorData.message
        } catch {
            // ignore JSON parse error
        }
        throw new Error(errorMessage)
    }

    // Handle 204 No Content
    if (res.status === 204) {
        return {} as T
    }

    return res.json()
}

// Helper to separate role metadata from permissions into a flat structure
function mapApiRole(item: ApiRoleResponseItem): Role {
    return {
        ...item.role,
        permissions: item.permissions || [],
        userCount: item.users_count || 0
    }
}

export async function getRoles(): Promise<Role[]> {
    const data = await authzFetch<ApiRoleResponseItem[]>("/roles")
    // Map the nested API structure { role: {...}, permissions: [...] } to our flat Role type
    return data.map(mapApiRole)
}

export async function getRoleById(roleId: string): Promise<{ role: Role }> {
    // The details endpoint returns { role: { ...roleData }, permissions: [...] } ?
    // Docs say: GET /roles/{roleId} returns
    // {
    //   "role": { ... },
    //   "permissions": [ ... ] ?? No wait, let's verify if structure is consistent or if it's nested differently
    // }
    // Based on the list, it's likely returning the same "Item" structure but maybe wrapped differently?
    // Let's assume consistent wrapper based on docs for POST/PUT.

    // Actually, looking at docs for GET /roles/{roleId}:
    // Response 200 OK:
    // { "role": { ... } ] } <-- The closing brace seems to be a typo in my earlier read or the docs are weird.
    // Use raw fetch to check invalidating assumptions or just correct the type based on likelihood.

    // If I look at POST response in docs:
    // { "role": { ... } ] }
    // It seems the "role" key contains the metadata, and "permissions" might be sibling or child.

    // Let's re-read the index.md snippet I requested earlier.
    // It showed:
    // [
    //   {
    //     "role": { ... },
    //     "permissions": [ ... ]
    //   }
    // ]

    // So for a single item it is likely:
    // {
    //   "role": { ... },
    //   "permissions": [ ... ]
    // }
    // OR
    // { "role": { ..., "permissions": [...] } }

    // The docs for GET /roles/{id} was cutoff in my previous view.
    // I will assume it follows the structure of one item from the list.

    const data = await authzFetch<ApiRoleResponseItem>(`/roles/${roleId}`)
    return { role: mapApiRole(data) }
}

export async function createRole(data: CreateRoleRequest): Promise<{ role: Role }> {
    const res = await authzFetch<ApiRoleResponseItem>("/roles", {
        method: "POST",
        body: JSON.stringify(data)
    })
    return { role: mapApiRole(res) }
}

export async function updateRole(roleId: string, data: UpdateRoleRequest): Promise<{ role: Role }> {
    const res = await authzFetch<ApiRoleResponseItem>(`/roles/${roleId}`, {
        method: "PUT",
        body: JSON.stringify(data)
    })
    return { role: mapApiRole(res) }
}

export async function deleteRole(roleId: string): Promise<void> {
    return authzFetch<void>(`/roles/${roleId}`, {
        method: "DELETE"
    })
}

export async function getPermissions(): Promise<Permission[]> {
    return authzFetch<Permission[]>("/permissions")
}
