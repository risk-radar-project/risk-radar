import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Placeholder – backend not wired yet
// In future: validate JWT via API Gateway here

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl

    // Protect /admin/*
    if (pathname.startsWith("/admin")) {
        // Placeholder session
        const isAdmin = false // later read from cookie / gateway token

        if (!isAdmin) {
            const url = new URL("/login", req.url)
            url.searchParams.set("redirect", pathname)
            return NextResponse.redirect(url)
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: ["/admin/:path*"]
}
