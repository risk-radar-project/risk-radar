"use client"

import { useEffect } from "react"
import { useSessionStore } from "@/stores/use-session-store"
import type { SessionUser } from "@/lib/auth/session"
import { parseJwt } from "@/lib/auth/jwt-utils"

type WindowWithSession = Window & { __SESSION__?: unknown }

export function useHydrateSession() {
    const setUser = useSessionStore((s) => s.setUser)
    const clear = useSessionStore((s) => s.clear)

    useEffect(() => {
        // 1. Try server-injected session
        const session = (window as WindowWithSession).__SESSION__
        if (session) {
            setUser(session as SessionUser)
            return
        }

        // 2. Try client-side local storage
        const token = localStorage.getItem("access_token")
        if (token) {
            const payload = parseJwt(token)
            if (payload) {
                // Map payload to SessionUser
                // Note: userId contains UUID, sub contains username (for historical reasons)
                // username claim was added for clarity
                const user: SessionUser = {
                    id: payload.userId || payload.sub || "",
                    username:
                        typeof payload.username === "string"
                            ? payload.username
                            : typeof payload.sub === "string"
                              ? payload.sub
                              : "User",
                    email: (payload.email as string) || "",
                    roles: payload.roles || []
                }
                // Also attach permissions if possible (need to update SessionUser type later if strictly required,
                // but ClientAdminGuard uses roles and permissions from `user` object which is typed as `SessionUser`...
                // Wait, SessionUser in store might not have permissions field defined in type.
                // Let's cast or ensure compatibility.
                // ClientAdminGuard uses `user.permissions` which was causing TS error before.

                // Let's create a richer object, cast as SessionUser for now to satisfy store
                // We really should update SessionUser type, but for now let's just make it work
                setUser({
                    ...user,
                    permissions: payload.permissions || []
                } as SessionUser & { permissions: string[] })
                return
            }
        }

        // 3. Nothing found
        clear()
    }, [clear, setUser])
}
