import { NextResponse } from "next/server"

export async function POST(request: Request) {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    const USER_SERVICE = process.env.USER_SERVICE_URL || "http://127.0.0.1:8080"
    const targetUrl = `${USER_SERVICE}/banUser`

    console.log(`[ban/route] Forwarding to: ${targetUrl}`)
    console.log(`[ban/route] Body:`, body)

    try {
        const res = await fetch(targetUrl, {
            method: "POST",
            headers: {
                Authorization: authHeader,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        })

        console.log(`[ban/route] Response status: ${res.status}`)

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Unknown error" }))
            console.log(`[ban/route] Error response:`, err)
            return NextResponse.json(err, { status: res.status })
        }

        const data = await res.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("Error banning user:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
