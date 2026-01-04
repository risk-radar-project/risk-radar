import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Placeholder – backend not wired yet
// In future: validate JWT via API Gateway here

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl

    // Set pathname header for layout detection
    const response = NextResponse.next()
    response.headers.set("x-pathname", pathname)

    // TODO: Add admin protection later
    // Protect /admin/*
    // if (pathname.startsWith("/admin")) {
    //     const isAdmin = false // later read from cookie / gateway token
    //     if (!isAdmin) {
    //         const url = new URL("/login", req.url)
    //         url.searchParams.set("redirect", pathname)
    //         return NextResponse.redirect(url)
    //     }
    // }

    return response
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
}
