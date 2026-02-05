import { NextRequest, NextResponse } from "next/server"
import { GATEWAY_URL, withAuthHandler, errorResponse, demoModeGuard } from "@/lib/api/server-config"

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    // Block in demo mode
    const demoBlock = demoModeGuard()
    if (demoBlock) return demoBlock

    return withAuthHandler(request, async (token) => {
        const { id } = await params
        // Gateway strips /api/reports, admin delete endpoint is /report/{id}
        const url = `${GATEWAY_URL}/api/reports/report/${id}`

        const response = await fetch(url, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`[admin/reports/${id}] DELETE error: ${response.status}`, errorText)
            return errorResponse(`Backend error: ${response.status}`, response.status)
        }

        return NextResponse.json({ success: true })
    })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    // Block in demo mode
    const demoBlock = demoModeGuard()
    if (demoBlock) return demoBlock

    return withAuthHandler(request, async (token) => {
        const { id } = await params
        const body = await request.json()
        // Gateway strips /api/reports, so report-service receives /report/{id}
        const url = `${GATEWAY_URL}/api/reports/report/${id}`

        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(body)
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`[admin/reports/${id}] PUT error: ${response.status}`, errorText)
            return errorResponse(`Backend error: ${response.status}`, response.status)
        }

        const data = await response.json()
        return NextResponse.json(data)
    })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    // Block in demo mode
    const demoBlock = demoModeGuard()
    if (demoBlock) return demoBlock

    return withAuthHandler(request, async (token) => {
        const { id } = await params
        const searchParams = request.nextUrl.searchParams
        const status = searchParams.get("status")

        if (!status) {
            return errorResponse("Status parameter is required", 400)
        }

        // Gateway strips /api/reports, so report-service receives /report/{id}/status
        const url = `${GATEWAY_URL}/api/reports/report/${id}/status?status=${status}`

        const response = await fetch(url, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`[admin/reports/${id}] PATCH error: ${response.status}`, errorText)
            return errorResponse(`Backend error: ${response.status}`, response.status)
        }

        const data = await response.json()
        return NextResponse.json(data)
    })
}
