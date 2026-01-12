import { NextResponse } from "next/server"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Ensure we use the internal container URL if running in Docker, or external if local
    const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:8090"
    
    // Construct the URL to match the API Gateway route
    // API Gateway maps /api -> user-service (stripping /api)
    // So /api/users/{id}/roles -> user-service /users/{id}/roles
    const targetUrl = `${GATEWAY_URL}/api/users/${id}/roles`

    console.log(`[Admin API] Forwarding request to: ${targetUrl}`)

    try {
        const res = await fetch(targetUrl, {
            method: "POST",
            headers: {
                Authorization: authHeader,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        })

        if (!res.ok) {
            const errorText = await res.text()
            let errorJson
            try {
                errorJson = JSON.parse(errorText)
            } catch {
                errorJson = { error: errorText || "Unknown error from upstream" }
            }
            console.error(`[Admin API] Upstream error: ${res.status}`, errorJson)
            return NextResponse.json(errorJson, { status: res.status })
        }

        const data = await res.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("Error updating role:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
