import { NextResponse } from "next/server"
import { GATEWAY_URL, withAuth, errorResponse, demoModeGuard } from "@/lib/api/server-config"

export async function POST(request: Request) {
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

        const res = await fetch(`${GATEWAY_URL}/api/banUser`, {
            method: "POST",
            ...withAuth(authHeader),
            body: JSON.stringify(body)
        })

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Unknown error" }))
            return NextResponse.json(err, { status: res.status })
        }

        const data = await res.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("[admin/users/ban] Error:", error)
        return errorResponse("Internal Server Error", 500)
    }
}
