import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    // Use internal Docker network URL when running in container, otherwise localhost
    const GATEWAY_URL = process.env.GATEWAY_URL || process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8090"

    const { searchParams } = new URL(request.url)
    const variant = searchParams.get("variant")

    // Construct URL based on variant (thumb, preview, or default/master)
    // Note: media-service uses /media/media/{id} pattern
    let fetchUrl = `${GATEWAY_URL}/api/media/media/${id}`
    if (variant === "thumb") {
        fetchUrl += "/thumb"
    } else if (variant === "preview") {
        fetchUrl += "/preview"
    }

    try {
        // Try to get token from: Authorization header or cookies only (not query params for security)
        let token: string | null = null
        const authHeader = request.headers.get("Authorization")
        if (authHeader?.startsWith("Bearer ")) {
            token = authHeader.substring(7)
        }
        if (!token) {
            const cookieStore = await cookies()
            token = cookieStore.get("access_token")?.value ?? null
        }

        const headers: HeadersInit = {}
        if (token) {
            headers["Authorization"] = `Bearer ${token}`
        }

        const res = await fetch(fetchUrl, {
            cache: "no-store",
            headers
        })

        if (!res.ok) {
            return new NextResponse(null, { status: res.status })
        }

        const blob = await res.blob()
        const responseHeaders = new Headers()
        responseHeaders.set("Content-Type", res.headers.get("Content-Type") || "image/jpeg")
        responseHeaders.set("Cache-Control", "public, max-age=3600")

        return new NextResponse(blob, { headers: responseHeaders })
    } catch (error) {
        console.error("Error proxying image:", error)
        return new NextResponse(null, { status: 500 })
    }
}
