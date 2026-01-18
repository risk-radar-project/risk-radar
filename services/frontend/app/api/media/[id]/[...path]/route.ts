import { NextRequest, NextResponse } from "next/server"

const GATEWAY_URL = process.env.GATEWAY_URL || "http://api-gateway:8080"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; path: string[] }> }) {
    const { id, path } = await params
    const pathSegment = path.join("/")

    // Build target URL: /api/media/{id}/{path...}
    const targetUrl = `${GATEWAY_URL}/api/media/${id}/${pathSegment}`

    try {
        const response = await fetch(targetUrl, {
            method: "GET",
            headers: {
                // Forward authorization if present
                ...(request.headers.get("authorization")
                    ? { Authorization: request.headers.get("authorization")! }
                    : {}),
                ...(request.headers.get("cookie") ? { Cookie: request.headers.get("cookie")! } : {})
            }
        })

        if (!response.ok) {
            return new NextResponse(null, { status: response.status, statusText: response.statusText })
        }

        // Forward the image response
        const contentType = response.headers.get("content-type") || "application/octet-stream"
        const cacheControl = response.headers.get("cache-control")

        const headers: HeadersInit = {
            "Content-Type": contentType
        }

        if (cacheControl) {
            headers["Cache-Control"] = cacheControl
        }

        return new NextResponse(response.body, {
            status: response.status,
            headers
        })
    } catch (error) {
        console.error("Media proxy error:", error)
        return new NextResponse(null, { status: 502, statusText: "Bad Gateway" })
    }
}
