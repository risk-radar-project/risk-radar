import type { NextConfig } from "next"

const nextConfig: NextConfig = {
    // API requests are proxied via middleware/route handlers where needed
    // No rewrites needed - local /api/* route handlers handle everything

    // Enable standalone output for Docker production builds
    // This creates a minimal production bundle with all dependencies
    output: process.env.NODE_ENV === "production" ? "standalone" : undefined
}

export default nextConfig
