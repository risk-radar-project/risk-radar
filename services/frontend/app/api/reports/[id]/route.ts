import { NextRequest, NextResponse } from "next/server"
import { GATEWAY_URL, withAuthHandler, demoModeGuard } from "@/lib/api/server-config"

// GET single report
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const authHeader = request.headers.get("Authorization")

    const headers: Record<string, string> = {}
    if (authHeader) {
        headers["Authorization"] = authHeader
    }

    const res = await fetch(`${GATEWAY_URL}/api/reports/${id}`, {
        method: "GET",
        headers
    })

    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
}

// PATCH update report
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    // Block in demo mode
    const demoBlock = demoModeGuard()
    if (demoBlock) return demoBlock

    return withAuthHandler(request, async (token) => {
        const { id } = await params
        const body = await request.json()

        const res = await fetch(`${GATEWAY_URL}/api/reports/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(body)
        })

        const data = await res.json().catch(() => ({}))
        return NextResponse.json(data, { status: res.status })
    })
}

// DELETE report
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    // Block in demo mode
    const demoBlock = demoModeGuard()
    if (demoBlock) return demoBlock

    return withAuthHandler(request, async (token) => {
        const { id } = await params

        const res = await fetch(`${GATEWAY_URL}/api/reports/${id}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        if (res.status === 204) {
            return new NextResponse(null, { status: 204 })
        }

        const data = await res.json().catch(() => ({}))
        return NextResponse.json(data, { status: res.status })
    })
}
