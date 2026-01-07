"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSessionStore } from "@/stores/use-session-store"
import { Spinner } from "@/components/ui/ux/spinner"

export function ClientAdminGuard({ children }: { children: React.ReactNode }) {
    const { user } = useSessionStore()
    const router = useRouter()
    const [authorized, setAuthorized] = useState(false)

    useEffect(() => {
        if (user === undefined) return // hydration not finished

        if (user === null) {
            router.replace("/login")
            return
        }

        const isAdmin = 
            user.roles?.includes("ROLE_ADMIN") || 
            user.roles?.includes("ROLE_MODERATOR") // Allow mods to access panel base

        if (!isAdmin) {
            router.replace("/")
        } else {
            setAuthorized(true)
        }
    }, [user, router])

    if (user === undefined || !authorized) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <Spinner className="size-10 text-[#d97706]" />
            </div>
        )
    }

    return <>{children}</>
}
