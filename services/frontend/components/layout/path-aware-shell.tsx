"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import { usePathname } from "next/navigation"
import { AppFooter } from "./app-footer"
import { AppSidebar } from "./app-sidebar"
import { cn } from "@/lib/utils"

const MAP_PATHS = new Set(["/", "", "/map"])

export function PathAwareShell({ children }: { children: ReactNode }) {
    const pathname = usePathname() || "/"

    const normalizedPath = pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname

    const isMapPage = MAP_PATHS.has(normalizedPath)

    // State derived from prop pattern
    const [isSidebarOpen, setIsSidebarOpen] = useState(!isMapPage)
    const [prevIsMapPage, setPrevIsMapPage] = useState(isMapPage)

    if (isMapPage !== prevIsMapPage) {
        setIsSidebarOpen(!isMapPage)
        setPrevIsMapPage(isMapPage)
    }

    if (isMapPage && typeof document !== "undefined") {
        document.body.classList.add("h-screen", "overflow-hidden")
    } else if (typeof document !== "undefined") {
        document.body.classList.remove("h-screen", "overflow-hidden")
    }

    // if (isAdminPage) {
    //     return <main className="min-h-screen">{children}</main>
    // }

    return (
        <div className="relative flex min-h-screen flex-col">
            <AppSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

            <div
                className={cn(
                    "flex flex-1 flex-col transition-all duration-300 ease-in-out",
                    isSidebarOpen && !isMapPage ? "ml-72" : "ml-0"
                )}
            >
                <main className={cn("relative w-full flex-1", isMapPage ? "h-screen" : "flex flex-col")}>{children}</main>
                {!isMapPage && <AppFooter />}
            </div>
        </div>
    )
}
