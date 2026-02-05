/**
 * Server-side API configuration for Next.js Route Handlers.
 * These URLs are internal Docker network addresses, NOT accessible from browser.
 *
 * Use these ONLY in Route Handlers (app/api/...) and Server Components.
 */

import { NextRequest, NextResponse } from "next/server"

// API Gateway - central routing point for all services
export const GATEWAY_URL = process.env.GATEWAY_URL || "http://api-gateway:8080"

// Demo mode - blocks all modifying operations
export const IS_DEMO_MODE = process.env.DEMO_MODE === "true"

// Usernames that bypass demo mode restrictions (admin accounts)
const DEMO_MODE_BYPASS_USERS = ["superadmin", "admin"]

/**
 * Extract username from JWT token (sub claim)
 */
function extractUsernameFromToken(authHeader: string | null): string | null {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null
    }
    try {
        const token = authHeader.replace("Bearer ", "")
        const parts = token.split(".")
        if (parts.length !== 3) return null
        const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8"))
        return payload.sub || payload.username || null
    } catch {
        return null
    }
}

/**
 * Guard for demo mode - returns error response if demo mode is active
 * Use at the beginning of POST/PUT/PATCH/DELETE handlers to block modifications
 * 
 * @param authHeader - Optional Authorization header to check for admin bypass
 * @returns NextResponse with 403 if blocked, null if allowed
 */
export function demoModeGuard(authHeader?: string | null): NextResponse | null {
    if (!IS_DEMO_MODE) {
        return null
    }
    
    // Check if user is an admin that bypasses demo restrictions
    if (authHeader) {
        const username = extractUsernameFromToken(authHeader)
        if (username && DEMO_MODE_BYPASS_USERS.includes(username.toLowerCase())) {
            console.log(`[DEMO MODE] Bypass for admin user: ${username}`)
            return null
        }
    }
    
    return NextResponse.json(
        { 
            error: "Ta akcja jest niedostępna w trybie demonstracyjnym",
            demo_mode: true,
            message: "W wersji demo można tylko przeglądać dane. Modyfikacje są zablokowane."
        },
        { status: 403 }
    )
}

// Direct service URLs (bypass gateway for internal calls if needed)
export const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://user-service:8080"
export const AUTHZ_SERVICE_URL = process.env.AUTHZ_SERVICE_URL || "http://authz-service:8080"
export const AUDIT_SERVICE_URL = process.env.AUDIT_SERVICE_URL || "http://audit-log-service:8080"
export const REPORT_SERVICE_URL = process.env.REPORT_SERVICE_URL || "http://report-service:8080"
export const MEDIA_SERVICE_URL = process.env.MEDIA_SERVICE_URL || "http://media-service:8080"
export const MAP_SERVICE_URL = process.env.MAP_SERVICE_URL || "http://map-service:8080"
export const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || "http://notification-service:8080"

/**
 * Extract user ID from JWT token (without full verification - just decode)
 * Returns the 'userId' claim which contains the user UUID.
 * Note: 'sub' claim contains username, not UUID, so we use 'userId' first.
 */
export function extractUserIdFromToken(authHeader: string | null): string | null {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null
    }
    try {
        const token = authHeader.replace("Bearer ", "")
        const parts = token.split(".")
        if (parts.length !== 3) return null

        // Decode JWT payload (base64url)
        const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8"))
        // userId claim contains UUID, sub contains username
        return payload.userId || payload.user_id || null
    } catch {
        return null
    }
}

/**
 * Helper to create fetch options with auth header
 */
export function withAuth(authHeader: string | null, options: RequestInit = {}): RequestInit {
    return {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(authHeader ? { Authorization: authHeader } : {}),
            ...(options.headers || {})
        }
    }
}

/**
 * Helper to create fetch options with auth header AND X-User-ID (for authz-service)
 */
export function withAuthAndUserId(authHeader: string | null, options: RequestInit = {}): RequestInit {
    const userId = extractUserIdFromToken(authHeader)
    return {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(authHeader ? { Authorization: authHeader } : {}),
            ...(userId ? { "X-User-ID": userId } : {}),
            ...(options.headers || {})
        }
    }
}

/**
 * Standard error response creator
 */
export function errorResponse(message: string, status: number) {
    return Response.json({ error: message }, { status })
}

/**
 * Wrapper for route handlers that require authentication.
 * Extracts token from Authorization header and passes it to the handler.
 * Returns 401 if no token is present.
 */
export async function withAuthHandler(
    request: NextRequest,
    handler: (token: string) => Promise<Response | NextResponse>
): Promise<Response | NextResponse> {
    const authHeader = request.headers.get("Authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    return handler(token)
}
