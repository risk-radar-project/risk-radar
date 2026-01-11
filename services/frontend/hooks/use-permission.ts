"use client"

import { useCallback } from "react"
import { useSessionStore } from "@/stores/use-session-store"

export function usePermission() {
    const user = useSessionStore((state) => state.user)

    const hasPermission = useCallback(
        (permission: string) => {
            if (!user) return false

            // 1. Check Super Admin wildcard in permissions
            const perms = user.permissions || []
            if (perms.includes("*:*") || perms.includes("PERM_*:*")) {
                return true
            }

            // 2. Check exact permission
            if (perms.includes(permission)) {
                return true
            }

            // 3. Check with PERM_ prefix if not provided
            if (!permission.startsWith("PERM_") && perms.includes(`PERM_${permission}`)) {
                return true
            }

            // 4. Check case-insensitive?
            // Based on auth-guard, it seems we might need uppercase check for the prefix
            const upperPerm = permission.toUpperCase()
            if (perms.includes(`PERM_${upperPerm}`)) {
                return true
            }

            return false
        },
        [user]
    )

    const hasAnyPermission = useCallback(
        (permissions: string[]) => {
            return permissions.some(hasPermission)
        },
        [hasPermission]
    )

    /**
     * Checks if user has a specific role.
     * WARNING: Prefer hasPermission() for authorization checks.
     * Use hasRole() only for UI customization (e.g. badges).
     */
    const hasRole = useCallback(
        (role: string) => {
            if (!user || !user.roles) return false
            const normalize = (r: string) => r.toLowerCase().replace("role_", "")
            const target = normalize(role)
            return user.roles.some((r) => normalize(r) === target)
        },
        [user]
    )

    return {
        user,
        hasPermission,
        hasAnyPermission,
        hasRole
    }
}
