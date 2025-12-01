"use client"

import { useHydrateSession } from "@/hooks/use-hydrate-session"

export function ClientSessionHydrator() {
    useHydrateSession()
    return null
}
