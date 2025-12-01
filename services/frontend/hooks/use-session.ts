"use client"

import { useSessionStore } from "@/stores/use-session-store"

export function useSession() {
    const user = useSessionStore((state) => state.user)
    return user
}
