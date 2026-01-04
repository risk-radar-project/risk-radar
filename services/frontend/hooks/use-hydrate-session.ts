"use client"

import { useEffect } from "react"
import { useSessionStore } from "@/stores/use-session-store"
import type { SessionUser } from "@/lib/auth/session"

type WindowWithSession = Window & { __SESSION__?: unknown }

export function useHydrateSession() {
    const setUser = useSessionStore((s) => s.setUser)
    const clear = useSessionStore((s) => s.clear)

    useEffect(() => {
        const session = (window as WindowWithSession).__SESSION__ ?? null
        if (session) {
            setUser(session as SessionUser)
        } else {
            clear()
        }
    }, [clear, setUser])
}
