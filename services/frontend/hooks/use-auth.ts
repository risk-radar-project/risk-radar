"use client";

import { useState, useEffect } from "react";
import { parseJwt, isTokenExpired, JwtPayload } from "@/lib/auth/jwt-utils";

interface UseAuthReturn {
    user: JwtPayload | null;
    roles: string[];
    permissions: string[];
    isAuthenticated: boolean;
    hasRole: (role: string) => boolean;
    hasPermission: (permission: string) => boolean;
    loading: boolean;
}

export function useAuth(): UseAuthReturn {
    const [user, setUser] = useState<JwtPayload | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (token) {
            // Check if token is expired before using it
            if (!isTokenExpired(token)) {
                const decoded = parseJwt(token);
                setUser(decoded);
            } else {
                // Token is expired, clear it
                console.log("useAuth: Token expired, clearing...");
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                setUser(null);
            }
        }
        setLoading(false);
    }, []);

    const roles = user?.roles || [];
    const permissions = user?.permissions || [];
    const isAuthenticated = !!user;

    const hasRole = (role: string) => {
        if (!roles) return false;
        // Check exact match or with ROLE_ prefix
        return roles.includes(role) || roles.includes(`ROLE_${role.toUpperCase()}`);
    };

    const hasPermission = (permission: string) => {
        if (!permissions) return false;
        // Check exact match or with PERM_ prefix
        return permissions.includes(permission) || permissions.includes(`PERM_${permission.toUpperCase()}`);
    };

    return {
        user,
        roles,
        permissions,
        isAuthenticated,
        hasRole,
        hasPermission,
        loading
    };
}
