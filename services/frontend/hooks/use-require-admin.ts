"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { usePermission } from "@/hooks/use-permission"

export function useRequireAdmin() {
    const { user, hasPermission } = usePermission()
    const router = useRouter()

    useEffect(() => {
        if (user === undefined) return // hydration not finished

        if (user === null || !hasPermission("system:admin")) {
            router.replace("/login")
        }
    }, [router, user, hasPermission])
}
