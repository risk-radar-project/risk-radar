import { NextResponse } from "next/server"
import { USER_SERVICE_URL, withAuth, errorResponse } from "@/lib/api/server-config"

export async function POST(request: Request) {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
        return errorResponse("Unauthorized", 401)
    }

    try {
        const body = await request.json()

        const res = await fetch(`${USER_SERVICE_URL}/banUser`, {
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
