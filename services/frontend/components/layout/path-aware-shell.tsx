"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo } from "react"
import { usePathname } from "next/navigation"
import { AppFooter } from "./app-footer"
import { AppHeader } from "./app-header"
import { cn } from "@/lib/utils"

const MAP_PATHS = new Set(["/", "", "/map"])

export function PathAwareShell({ children }: { children: ReactNode }) {
    const pathname = usePathname()

    const normalizedPath = useMemo(() => {
        if (!pathname) return "/"
        if (pathname !== "/" && pathname.endsWith("/")) return pathname.slice(0, -1)
        return pathname
    }, [pathname])

    const isMapPage = MAP_PATHS.has(normalizedPath)

    // Keep map view full-screen without middleware header detection
    useEffect(() => {
        const body = document.body
        body.classList.toggle("h-screen", isMapPage)
        body.classList.toggle("overflow-hidden", isMapPage)
    }, [isMapPage])

    return (
        <>
            {!isMapPage && <AppHeader />}
            <main className={cn("flex-1", isMapPage ? "h-screen" : undefined)}>{children}</main>
            {!isMapPage && <AppFooter />}
        </>
    )
}
