"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSessionStore } from "@/stores/use-session-store"
import { Spinner } from "@/components/ui/ux/spinner"

export function ClientUserGuard({ children }: { children: React.ReactNode }) {
    const { user } = useSessionStore()
    const router = useRouter()

    useEffect(() => {
        if (user === undefined) return // hydration not finished

        if (user === null) {
            router.replace("/login")
        }
    }, [user, router])

    if (user === undefined || user === null) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <Spinner className="size-10 text-[#d97706]" />
            </div>
        )
    }

    return <>{children}</>
}
