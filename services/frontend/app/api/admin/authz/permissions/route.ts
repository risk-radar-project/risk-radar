import { NextRequest, NextResponse } from "next/server"
import { GATEWAY_URL, withAuth, withAuthAndUserId, errorResponse, demoModeGuard } from "@/lib/api/server-config"

// GET /api/admin/authz/permissions - List all permissions
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
        return errorResponse("Unauthorized", 401)
    }

    try {
        const res = await fetch(`${GATEWAY_URL}/api/authz/permissions`, withAuth(authHeader))

        if (!res.ok) {
            const errorText = await res.text().catch(() => "Unknown error")
            console.error(`[admin/authz/permissions] Upstream error ${res.status}:`, errorText)
            return errorResponse(`Failed to fetch permissions: ${res.status}`, res.status)
        }

        const data = await res.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("[admin/authz/permissions] Error:", error)
        return errorResponse("Internal Server Error", 500)
    }
}

// POST /api/admin/authz/permissions - Create a new permission
export async function POST(request: NextRequest) {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
        return errorResponse("Unauthorized", 401)
    }

    const demoBlock = demoModeGuard(authHeader)
    if (demoBlock) return demoBlock

    try {
        const body = await request.json()
        const res = await fetch(`${GATEWAY_URL}/api/authz/permissions`, {
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
        console.error("[admin/authz/permissions] Error creating:", error)
        return errorResponse("Internal Server Error", 500)
    }
}
