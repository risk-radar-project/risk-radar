"use client"

import { useEffect } from "react"
import { useSessionStore } from "@/stores/use-session-store"

export function useHydrateSession() {
    const setUser = useSessionStore((s) => s.setUser)

    useEffect(() => {
        const session = (window as any).__SESSION__ || null
        setUser(session)
    }, [setUser])
}
