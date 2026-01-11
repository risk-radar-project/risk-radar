import { NextResponse } from "next/server"

export async function GET(request: Request) {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = searchParams.get("page") || "0"
    const size = searchParams.get("size") || "10"

    const USER_SERVICE = process.env.USER_SERVICE_URL || "http://127.0.0.1:8080"

    try {
        const res = await fetch(`${USER_SERVICE}/users?page=${page}&size=${size}`, {
            headers: { Authorization: authHeader }
        })

        if (!res.ok) {
            return NextResponse.json({ error: "Failed to fetch users" }, { status: res.status })
        }

        const data = await res.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("Error fetching users:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
