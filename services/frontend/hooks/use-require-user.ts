"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSessionStore } from "@/stores/use-session-store"

export function useRequireUser() {
    const user = useSessionStore((s) => s.user)
    const router = useRouter()

    useEffect(() => {
        if (user === undefined) return

        if (user === null) {
            router.replace("/login")
        }
    }, [router, user])
}
