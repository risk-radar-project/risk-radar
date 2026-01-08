"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSessionStore } from "@/stores/use-session-store"
import { Spinner } from "@/components/ui/ux/spinner"

export function ClientAdminGuard({ children }: { children: React.ReactNode }) {
    const { user } = useSessionStore()
    const router = useRouter()
    const isAdmin = user?.roles?.includes("ROLE_ADMIN") || user?.roles?.includes("ROLE_MODERATOR")

    useEffect(() => {
        if (user === undefined) return // hydration not finished

        if (user === null) {
            router.replace("/login")
            return
        }

        if (!isAdmin) {
            router.replace("/")
        }
    }, [user, isAdmin, router])

    if (user === undefined || user === null || !isAdmin) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <Spinner className="size-10 text-[#d97706]" />
            </div>
        )
    }

    return <>{children}</>
}
