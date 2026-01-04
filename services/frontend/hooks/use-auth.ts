"use client"

import { useState } from "react"
import { parseJwt, JwtPayload } from "@/lib/auth/jwt-utils"

interface UseAuthReturn {
    user: JwtPayload | null
    roles: string[]
    permissions: string[]
    isAuthenticated: boolean
    hasRole: (role: string) => boolean
    hasPermission: (permission: string) => boolean
    loading: boolean
}

export function useAuth(): UseAuthReturn {
    const [user] = useState<JwtPayload | null>(() => {
        if (typeof window === "undefined") return null
        const token = localStorage.getItem("access_token")
        return token ? parseJwt(token) : null
    })
    const [loading] = useState(false)

    const roles = user?.roles || []
    const permissions = user?.permissions || []
    const isAuthenticated = !!user

    const hasRole = (role: string) => {
        if (!roles) return false
        // Check exact match or with ROLE_ prefix
        return roles.includes(role) || roles.includes(`ROLE_${role.toUpperCase()}`)
    }

    const hasPermission = (permission: string) => {
        if (!permissions) return false
        // Check exact match or with PERM_ prefix
        return permissions.includes(permission) || permissions.includes(`PERM_${permission.toUpperCase()}`)
    }

    return {
        user,
        roles,
        permissions,
        isAuthenticated,
        hasRole,
        hasPermission,
        loading
    }
}
