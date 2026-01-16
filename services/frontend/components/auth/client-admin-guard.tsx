"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useSessionStore } from "@/stores/use-session-store"
import { Spinner } from "@/components/ui/ux/spinner"

export function ClientAdminGuard({ children }: { children: React.ReactNode }) {
    const { user } = useSessionStore()
    const router = useRouter()
    const pathname = usePathname()

    const roles = user?.roles || []
    const permissions = user?.permissions || []

    // Check role levels
    const isAdmin =
        roles.includes("ROLE_ADMIN") ||
        permissions.includes("*:*") ||
        permissions.includes("PERM_*:*") ||
        permissions.includes("PERM_SYSTEM:ADMIN") ||
        permissions.includes("system:admin")

    const isModerator = roles.includes("ROLE_MODERATOR")
    const isVolunteer = roles.includes("ROLE_VOLUNTEER")

    // Determine access based on current path
    const canAccess = (() => {
        // Admin has full access
        if (isAdmin) return true

        // Moderator can access users and verification pages
        if (isModerator) {
            if (pathname.startsWith("/admin/verification")) return true
            if (pathname.startsWith("/admin/users")) return true
            if (pathname === "/admin") return true // Dashboard
            return false
        }

        // Volunteer can only access verification page
        if (isVolunteer) {
            if (pathname.startsWith("/admin/verification")) return true
            if (pathname === "/admin") return true // Dashboard with limited view
            return false
        }

        return false
    })()

    useEffect(() => {
        if (user === undefined) return // hydration not finished
        if (user === null) {
            router.replace("/login")
            return
        }
        if (!canAccess) {
            router.replace("/")
        }
    }, [user, canAccess, router])

    if (user === undefined || user === null || !canAccess) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <Spinner className="size-10 text-[#d97706]" />
            </div>
        )
    }

    return <>{children}</>
}
