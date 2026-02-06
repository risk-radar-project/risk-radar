import { NextRequest, NextResponse } from "next/server"
import { GATEWAY_URL, withAuth, withAuthAndUserId, errorResponse, demoModeGuard } from "@/lib/api/server-config"

type RouteParams = { params: Promise<{ permissionId: string }> }

// GET /api/admin/authz/permissions/[permissionId]
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { permissionId } = await params
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
        return errorResponse("Unauthorized", 401)
    }

    try {
        const res = await fetch(`${GATEWAY_URL}/api/authz/permissions/${permissionId}`, withAuth(authHeader))

        if (!res.ok) {
            return errorResponse(`Failed to fetch permission: ${res.status}`, res.status)
        }

        const data = await res.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error(`[admin/authz/permissions/${permissionId}] Error:`, error)
        return errorResponse("Internal Server Error", 500)
    }
}

// PUT /api/admin/authz/permissions/[permissionId]
export async function PUT(request: NextRequest, { params }: RouteParams) {
    const { permissionId } = await params
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
        return errorResponse("Unauthorized", 401)
    }

    const demoBlock = demoModeGuard(authHeader)
    if (demoBlock) return demoBlock

    try {
        const body = await request.json()
        const res = await fetch(`${GATEWAY_URL}/api/authz/permissions/${permissionId}`, {
            method: "PUT",
            ...withAuthAndUserId(authHeader),
            body: JSON.stringify(body)
        })

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: "Unknown error" }))
            return NextResponse.json(errorData, { status: res.status })
        }

        if (res.status === 204) {
            return new NextResponse(null, { status: 204 })
        }

        const data = await res.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error(`[admin/authz/permissions/${permissionId}] Error updating:`, error)
        return errorResponse("Internal Server Error", 500)
    }
}

// DELETE /api/admin/authz/permissions/[permissionId]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const { permissionId } = await params
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
        return errorResponse("Unauthorized", 401)
    }

    const demoBlock = demoModeGuard(authHeader)
    if (demoBlock) return demoBlock

    try {
        const res = await fetch(`${GATEWAY_URL}/api/authz/permissions/${permissionId}`, {
            method: "DELETE",
            ...withAuthAndUserId(authHeader)
        })

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: "Unknown error" }))
            return NextResponse.json(errorData, { status: res.status })
        }

        return new NextResponse(null, { status: 204 })
    } catch (error) {
        console.error(`[admin/authz/permissions/${permissionId}] Error deleting:`, error)
        return errorResponse("Internal Server Error", 500)
    }
}
