import { NextResponse } from "next/server"
import { GATEWAY_URL, withAuth, errorResponse, demoModeGuard } from "@/lib/api/server-config"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    // Block in demo mode
    const demoBlock = demoModeGuard()
    if (demoBlock) return demoBlock

    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
        return errorResponse("Unauthorized", 401)
    }

    const { id } = await params

    try {
        const res = await fetch(`${GATEWAY_URL}/api/users/${id}/unban`, {
            method: "POST",
            ...withAuth(authHeader)
        })

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Unknown error" }))
            console.error(`[admin/users/${id}/unban] Error:`, err)
            return NextResponse.json(err, { status: res.status })
        }

        const data = await res.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error(`[admin/users/${id}/unban] Error:`, error)
        return errorResponse("Internal Server Error", 500)
    }
}
