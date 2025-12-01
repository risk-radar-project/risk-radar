"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSessionStore } from "@/stores/use-session-store"

export function useRequireAdmin() {
    const user = useSessionStore((s) => s.user)
    const router = useRouter()

    useEffect(() => {
        if (user === undefined) return // hydration not finished

        if (user === null || !user.roles?.includes("admin")) {
            router.replace("/login")
        }
    }, [router, user])
}
