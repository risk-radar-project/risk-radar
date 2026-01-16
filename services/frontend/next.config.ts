import type { NextConfig } from "next"

const nextConfig: NextConfig = {
    // API requests are proxied via middleware/route handlers where needed
    // No rewrites needed - local /api/* route handlers handle everything
}

export default nextConfig
