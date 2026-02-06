import { NextRequest, NextResponse } from "next/server"
import { GATEWAY_URL, withAuth, withAuthAndUserId, errorResponse, demoModeGuard } from "@/lib/api/server-config"

// GET /api/admin/authz/roles - List all roles
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
        return errorResponse("Unauthorized", 401)
    }

    try {
        const res = await fetch(`${GATEWAY_URL}/api/authz/roles`, withAuth(authHeader))

        if (!res.ok) {
            const errorText = await res.text().catch(() => "Unknown error")
            console.error(`[admin/authz/roles] Upstream error ${res.status}:`, errorText)
            return errorResponse(`Failed to fetch roles: ${res.status}`, res.status)
        }

        const data = await res.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("[admin/authz/roles] Error:", error)
        return errorResponse("Internal Server Error", 500)
    }
}

// POST /api/admin/authz/roles - Create a new role
export async function POST(request: NextRequest) {
    // Get auth header early for demo mode bypass check
    const authHeader = request.headers.get("Authorization")
    
    // Block in demo mode (with admin bypass check)
    const demoBlock = demoModeGuard(authHeader)
    if (demoBlock) return demoBlock

    if (!authHeader) {
        return errorResponse("Unauthorized", 401)
    }

    try {
        const body = await request.json()
        const res = await fetch(`${GATEWAY_URL}/api/authz/roles`, {
            method: "POST",
            ...withAuthAndUserId(authHeader),
            body: JSON.stringify(body)
        })

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: "Unknown error" }))
            return NextResponse.json(errorData, { status: res.status })
        }

        const data = await res.json()
        return NextResponse.json(data, { status: 201 })
    } catch (error) {
        console.error("[admin/authz/roles] Error creating role:", error)
        return errorResponse("Internal Server Error", 500)
    }
}
