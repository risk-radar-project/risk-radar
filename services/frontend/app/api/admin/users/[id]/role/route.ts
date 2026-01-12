import { NextResponse } from "next/server"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Use USER_SERVICE_URL directly to bypass Gateway potential issues
    const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://127.0.0.1:8080"
    
    // user-service:8080/users/{id}/roles
    const targetUrl = `${USER_SERVICE_URL}/users/${id}/roles`

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
                errorJson = { error: errorText || `Upstream returned ${res.status}` }
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
