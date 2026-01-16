import { NextRequest, NextResponse } from "next/server"
import { REPORT_SERVICE_URL, errorResponse } from "@/lib/api/server-config"

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const url = `${REPORT_SERVICE_URL}/report/${id}`
        const authHeader = request.headers.get("Authorization")

        const response = await fetch(url, {
            method: "DELETE",
            headers: {
                ...(authHeader ? { Authorization: authHeader } : {})
            }
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`[admin/reports/${id}] DELETE error: ${response.status}`, errorText)
            return errorResponse(`Backend error: ${response.status}`, response.status)
        }

        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        console.error("[admin/reports] Failed to delete report:", error)
        return errorResponse("Failed to delete report", 500)
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const body = await request.json()
        const url = `${REPORT_SERVICE_URL}/report/${id}`
        const authHeader = request.headers.get("Authorization")

        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                ...(authHeader ? { Authorization: authHeader } : {})
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
    } catch (error: unknown) {
        console.error("[admin/reports] Failed to update report:", error)
        return errorResponse("Failed to update report", 500)
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const searchParams = request.nextUrl.searchParams
        const status = searchParams.get("status")

        if (!status) {
            return errorResponse("Status parameter is required", 400)
        }

        const url = `${REPORT_SERVICE_URL}/report/${id}/status?status=${status}`
        const authHeader = request.headers.get("Authorization")

        const response = await fetch(url, {
            method: "PATCH",
            headers: {
                ...(authHeader ? { Authorization: authHeader } : {})
            }
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`[admin/reports/${id}] PATCH error: ${response.status}`, errorText)
            return errorResponse(`Backend error: ${response.status}`, response.status)
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error: unknown) {
        console.error("[admin/reports] Failed to change report status:", error)
        return errorResponse("Failed to change status", 500)
    }
}
