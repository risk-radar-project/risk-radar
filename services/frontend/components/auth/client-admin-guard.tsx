"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSessionStore } from "@/stores/use-session-store"
import { Spinner } from "@/components/ui/ux/spinner"

export function ClientAdminGuard({ children }: { children: React.ReactNode }) {
    const { user } = useSessionStore()
    const router = useRouter()

    const roles = user?.roles || []
    const permissions = user?.permissions || []
    const isAdminOrSuper =
        roles.includes("ROLE_ADMIN") ||
        roles.includes("ROLE_MODERATOR") ||
        permissions.includes("*:*") ||
        permissions.includes("PERM_*:*") ||
        permissions.includes("PERM_SYSTEM:ADMIN") ||
        permissions.includes("system:admin")

    useEffect(() => {
        if (user === undefined) return // hydration not finished
        if (user === null) {
            router.replace("/login")
            return
        }
        if (!isAdminOrSuper) {
            router.replace("/")
        }
    }, [user, isAdminOrSuper, router])

    if (user === undefined || user === null || !isAdminOrSuper) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <Spinner className="size-10 text-[#d97706]" />
            </div>
        )
    }

    return <>{children}</>
}
