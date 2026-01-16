import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// List of API paths that are handled locally by Next.js route handlers
// These should NOT be proxied to the backend gateway
const LOCAL_API_ROUTES = [
    "/api/image",
    "/api/media/upload",
    "/api/reports", // All /api/reports/* handled locally (including /create, /pending, /my-reports, /[id])
    "/api/ai/categorize",
    "/api/ai/verify",
    "/api/ai-assistant",
    "/api/admin", // All /api/admin/* handled locally (reports, users, stats, audit, authz)
    "/api/login", // Auth routes handled locally
    "/api/register",
    "/api/refresh",
    "/api/users", // Includes /api/users/logout
    "/api/me", // User profile
    "/api/forgot-password",
    "/api/change-email",
    "/api/reset-password",
    "/api/validate-reset-token",
    "/api/notifications" // All notifications endpoints
]

function isLocalApiRoute(pathname: string): boolean {
    return LOCAL_API_ROUTES.some((route) => pathname.startsWith(route))
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Handle API routes - proxy to gateway unless handled locally
    if (pathname.startsWith("/api/")) {
        // If this is a local route handler, let Next.js handle it
        if (isLocalApiRoute(pathname)) {
            const requestHeaders = new Headers(request.headers)
            requestHeaders.set("x-pathname", pathname)
            return NextResponse.next({
                request: { headers: requestHeaders }
            })
        }

        // Proxy all other /api/* requests to the backend gateway
        const gatewayUrl = process.env.GATEWAY_URL || "http://api-gateway:8080"
        const targetUrl = new URL(pathname + request.nextUrl.search, gatewayUrl)

        // Forward the request to gateway
        const headers = new Headers(request.headers)
        headers.delete("host") // Remove host header to avoid conflicts

        try {
            const response = await fetch(targetUrl.toString(), {
                method: request.method,
                headers,
                body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
                // @ts-expect-error - duplex is needed for streaming body
                duplex: "half"
            })

            // Create response with appropriate headers
            const responseHeaders = new Headers(response.headers)
            responseHeaders.delete("transfer-encoding") // Remove chunked encoding header

            return new NextResponse(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders
            })
        } catch (error) {
            console.error("Middleware proxy error:", error)
            return NextResponse.json(
                { error: { code: "PROXY_ERROR", message: "Failed to connect to backend" } },
                { status: 502 }
            )
        }
    }

    // For non-API routes, just add pathname header
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-pathname", pathname)

    return NextResponse.next({
        request: { headers: requestHeaders }
    })
}

export const config = {
    matcher: [
        // Match all API routes for proxying
        "/api/:path*",
        // Match all pages except static files
        "/((?!_next/static|_next/image|favicon.ico).*)"
    ]
}
