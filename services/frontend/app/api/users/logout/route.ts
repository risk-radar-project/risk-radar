import { NextRequest, NextResponse } from "next/server"
import { GATEWAY_URL, withAuthHandler } from "@/lib/api/server-config"

export async function POST(request: NextRequest) {
    return withAuthHandler(request, async (token) => {
        try {
            // Note: user-service endpoint is /logout, not /users/logout
            // Gateway strips /api prefix, so /api/logout -> /logout
            const res = await fetch(`${GATEWAY_URL}/api/logout`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })

            if (res.status === 204) {
                return new NextResponse(null, { status: 204 })
            }

            if (!res.ok) {
                const text = await res.text()
                console.error(`[api/users/logout] Backend returned ${res.status}: ${text}`)
                return NextResponse.json({ error: text || "Logout failed" }, { status: res.status })
            }

            const data = await res.json().catch(() => ({}))
            return NextResponse.json(data, { status: res.status })
        } catch (error) {
            console.error("[api/users/logout] Error:", error)
            return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
        }
    })
}
