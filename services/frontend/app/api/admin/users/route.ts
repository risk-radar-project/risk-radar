import { NextResponse } from "next/server"
import { GATEWAY_URL, withAuth, errorResponse } from "@/lib/api/server-config"

export async function GET(request: Request) {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
        return errorResponse("Unauthorized", 401)
    }

    const { searchParams } = new URL(request.url)
    const page = searchParams.get("page") || "0"
    const size = searchParams.get("size") || "10"

    try {
        const res = await fetch(`${GATEWAY_URL}/api/users?page=${page}&size=${size}`, withAuth(authHeader))

        if (!res.ok) {
            const errorText = await res.text().catch(() => "Unknown error")
            console.error(`[admin/users] Upstream error ${res.status}:`, errorText)
            return errorResponse(`Failed to fetch users: ${res.status}`, res.status)
        }

        const data = await res.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("[admin/users] Error fetching users:", error)
        return errorResponse("Internal Server Error", 500)
    }
}

export async function POST(request: Request) {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
        return errorResponse("Unauthorized", 401)
    }

    try {
        const body = await request.json()
        const res = await fetch(`${GATEWAY_URL}/api/users`, {
            method: "POST",
            ...withAuth(authHeader),
            body: JSON.stringify(body)
        })

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: "Unknown error" }))
            return NextResponse.json(errorData, { status: res.status })
        }

        const data = await res.json()
        return NextResponse.json(data, { status: 201 })
    } catch (error) {
        console.error("[admin/users] Error creating user:", error)
        return errorResponse("Internal Server Error", 500)
    }
}
