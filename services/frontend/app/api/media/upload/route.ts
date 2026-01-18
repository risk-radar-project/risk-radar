import { NextRequest, NextResponse } from "next/server"
import { GATEWAY_URL } from "@/lib/api/server-config"

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()

        console.log("API Route: Uploading images to media service")

        const authHeader = request.headers.get("Authorization")

        // Gateway strips /api/media, so media-service receives /media
        // media-service has router mounted at /media
        const response = await fetch(`${GATEWAY_URL}/api/media`, {
            method: "POST",
            headers: {
                ...(authHeader ? { Authorization: authHeader } : {})
            },
            body: formData
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`Media service returned error: ${response.status}`, errorText)
            return NextResponse.json({ error: `Failed to upload images: ${response.status}` }, { status: response.status })
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error: unknown) {
        console.error("Failed to upload images:", error)
        return NextResponse.json(
            {
                error: "Failed to upload images",
                details: error instanceof Error ? error.message : undefined
            },
            { status: 500 }
        )
    }
}
