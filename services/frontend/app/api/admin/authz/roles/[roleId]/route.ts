import { NextRequest, NextResponse } from "next/server"
import { GATEWAY_URL, withAuth, withAuthAndUserId, errorResponse, demoModeGuard } from "@/lib/api/server-config"

type RouteParams = { params: Promise<{ roleId: string }> }

// GET /api/admin/authz/roles/[roleId] - Get role by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { roleId } = await params
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
        return errorResponse("Unauthorized", 401)
    }

    try {
        const res = await fetch(`${GATEWAY_URL}/api/authz/roles/${roleId}`, withAuth(authHeader))

        if (!res.ok) {
            const errorText = await res.text().catch(() => "Unknown error")
            console.error(`[admin/authz/roles/${roleId}] Upstream error ${res.status}:`, errorText)
            return errorResponse(`Failed to fetch role: ${res.status}`, res.status)
        }

        const data = await res.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error(`[admin/authz/roles/${roleId}] Error:`, error)
        return errorResponse("Internal Server Error", 500)
    }
}

// PUT /api/admin/authz/roles/[roleId] - Update role
export async function PUT(request: NextRequest, { params }: RouteParams) {
    const { roleId } = await params
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
        const res = await fetch(`${GATEWAY_URL}/api/authz/roles/${roleId}`, {
            method: "PUT",
            ...withAuthAndUserId(authHeader),
            body: JSON.stringify(body)
        })

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: "Unknown error" }))
            return NextResponse.json(errorData, { status: res.status })
        }

        // Handle 204 No Content
        if (res.status === 204) {
            return new NextResponse(null, { status: 204 })
        }

        const data = await res.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error(`[admin/authz/roles/${roleId}] Error updating:`, error)
        return errorResponse("Internal Server Error", 500)
    }
}

// DELETE /api/admin/authz/roles/[roleId] - Delete role
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const { roleId } = await params
    // Get auth header early for demo mode bypass check
    const authHeader = request.headers.get("Authorization")
    
    // Block in demo mode (with admin bypass check)
    const demoBlock = demoModeGuard(authHeader)
    if (demoBlock) return demoBlock

    if (!authHeader) {
        return errorResponse("Unauthorized", 401)
    }

    try {
        const res = await fetch(`${GATEWAY_URL}/api/authz/roles/${roleId}`, {
            method: "DELETE",
            ...withAuthAndUserId(authHeader)
        })

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: "Unknown error" }))
            return NextResponse.json(errorData, { status: res.status })
        }

        return new NextResponse(null, { status: 204 })
    } catch (error) {
        console.error(`[admin/authz/roles/${roleId}] Error deleting:`, error)
        return errorResponse("Internal Server Error", 500)
    }
}
