import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    // Use env var or default to internal service URL (direct access fallback)
    const MEDIA_SERVICE_URL = process.env.MEDIA_SERVICE_URL || "http://media-service:8080"

    const { searchParams } = new URL(request.url)
    const variant = searchParams.get("variant")

    // Construct URL based on variant (thumb, preview, or default/master)
    // Note: We append /media because MEDIA_SERVICE_URL is expected to be the base (e.g. gateway root or service root)
    let fetchUrl = `${MEDIA_SERVICE_URL}/media/${id}`
    if (variant === "thumb") {
        fetchUrl += "/thumb"
    } else if (variant === "preview") {
        fetchUrl += "/preview"
    }

    try {
        const authHeader = request.headers.get("Authorization")
        const res = await fetch(fetchUrl, {
            cache: "no-store",
            headers: {
                ...(authHeader ? { Authorization: authHeader } : {})
            }
        })

        if (!res.ok) {
            return new NextResponse(null, { status: res.status })
        }

        const blob = await res.blob()
        const headers = new Headers()
        headers.set("Content-Type", res.headers.get("Content-Type") || "image/jpeg")
        headers.set("Cache-Control", "public, max-age=3600")

        return new NextResponse(blob, { headers })
    } catch (error) {
        console.error("Error proxying image:", error)
        return new NextResponse(null, { status: 500 })
    }
}
