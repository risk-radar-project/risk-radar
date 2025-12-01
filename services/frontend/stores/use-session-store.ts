"use client"

import { create } from "zustand"
import type { SessionUser } from "@/lib/auth/session"

type SessionState = {
    user: SessionUser | undefined
    setUser: (u: SessionUser) => void
    clear: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
    user: undefined,
    setUser: (u) => set({ user: u }),
    clear: () => set({ user: null })
}))
