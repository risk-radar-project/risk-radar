import { NextRequest, NextResponse } from "next/server"
import { GATEWAY_URL, withAuthHandler } from "@/lib/api/server-config"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return withAuthHandler(request, async (token) => {
        const { id } = await params

        const res = await fetch(`${GATEWAY_URL}/api/notifications/${id}/unread`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        // Handle 204 No Content response
        if (res.status === 204) {
            return new NextResponse(null, { status: 204 })
        }

        const data = await res.json().catch(() => ({}))
        return NextResponse.json(data, { status: res.status })
    })
}
