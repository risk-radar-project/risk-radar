import { NextResponse } from "next/server"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const USER_SERVICE = process.env.USER_SERVICE_URL || "http://127.0.0.1:8080"
    const targetUrl = `${USER_SERVICE}/users/${id}/roles`

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
            const err = await res.json().catch(() => ({ error: "Unknown error" }))
            return NextResponse.json(err, { status: res.status })
        }

        const data = await res.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("Error updating role:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
