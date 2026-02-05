import { NextResponse } from "next/server"
import { GATEWAY_URL, withAuth, errorResponse, demoModeGuard } from "@/lib/api/server-config"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    // Get auth header early for demo mode bypass check
    const authHeader = request.headers.get("Authorization")
    
    // Block in demo mode (with admin bypass check)
    const demoBlock = demoModeGuard(authHeader)
    if (demoBlock) return demoBlock

    if (!authHeader) {
        return errorResponse("Unauthorized", 401)
    }

    const { id } = await params

    try {
        const body = await request.json()

        const res = await fetch(`${GATEWAY_URL}/api/users/${id}/roles`, {
            method: "POST",
            ...withAuth(authHeader),
            body: JSON.stringify(body)
        })

        if (!res.ok) {
            const errorText = await res.text()
            let errorJson
            try {
                errorJson = JSON.parse(errorText)
            } catch {
                errorJson = { error: errorText || `Upstream returned ${res.status}` }
            }
            return NextResponse.json(errorJson, { status: res.status })
        }

        const data = await res.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error(`[admin/users/${id}/role] Error:`, error)
        return errorResponse("Internal Server Error", 500)
    }
}
