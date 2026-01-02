"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isTokenExpired, parseJwt } from "@/lib/auth/jwt-utils";
import { refreshAccessToken } from "@/lib/auth/auth-service";

const PUBLIC_PATHS = ["/", "/login", "/register", "/terms"];

// Mapowanie ścieżek na wymagane uprawnienia
// Jeśli ścieżka zaczyna się od klucza, użytkownik musi mieć PRZYNAJMNIEJ JEDNO z wymienionych uprawnień.
const ROUTE_PERMISSIONS: Record<string, string[]> = {
    "/admin": ["system:admin", "PERM_SYSTEM_ADMIN"],
    "/stats": ["stats:view", "PERM_STATS_VIEW"],
    "/audit": ["audit:view", "PERM_AUDIT_VIEW"],
    "/users": ["users:view", "PERM_USERS_VIEW"],
    // "/reports": ["reports:read", "PERM_REPORTS_READ"], // Dostępne dla każdego zalogowanego (user ma reports:read)
};


export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);

    // console.log("AuthGuard RENDER:", pathname, "| Loading:", loading, "| Authorized:", authorized);

    useEffect(() => {
        const checkAuth = async () => {
            // Normalizacja ścieżki
            const normalizedPath = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;

            // Sprawdź czy to ścieżka publiczna
            const isPublicPath = PUBLIC_PATHS.includes(normalizedPath) ||
                normalizedPath.startsWith("/_next") ||
                normalizedPath.startsWith("/static") ||
                normalizedPath.startsWith("/api");

            if (isPublicPath) {
                setAuthorized(true);
                setLoading(false);
                return;
            }

            const accessToken = localStorage.getItem("access_token");
            const refreshToken = localStorage.getItem("refresh_token");

            if (!accessToken) {
                console.log("AuthGuard: Missing access token -> Redirect to login");
                setAuthorized(false);
                setLoading(false);
                router.push("/login");
                return;
            }

            let currentToken = accessToken;

            if (isTokenExpired(accessToken)) {
                console.log("AuthGuard: Access token expired. Attempting refresh...");

                if (!refreshToken) {
                    console.log("AuthGuard: No refresh token -> Redirect to login");
                    setAuthorized(false);
                    setLoading(false);
                    router.push("/login");
                    return;
                }

                const newTokens = await refreshAccessToken(refreshToken);

                if (newTokens) {
                    console.log("AuthGuard: Token refresh successful");
                    localStorage.setItem("access_token", newTokens.accessToken);
                    localStorage.setItem("refresh_token", newTokens.refreshToken);
                    currentToken = newTokens.accessToken;
                } else {
                    console.log("AuthGuard: Token refresh failed -> Redirect to login");
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("refresh_token");
                    setAuthorized(false);
                    setLoading(false);
                    router.push("/login");
                    return;
                }
            }

            // --- SPRAWDZANIE UPRAWNIEŃ (RBAC) ---
            const user = parseJwt(currentToken);
            if (!user) {
                console.log("AuthGuard: Failed to parse token");
                setAuthorized(false);
                setLoading(false);
                router.push("/login");
                return;
            }

            // Sprawdź czy ścieżka wymaga specjalnych uprawnień
            const requiredPermissions = Object.entries(ROUTE_PERMISSIONS).find(([path]) =>
                normalizedPath.startsWith(path)
            )?.[1];

            if (requiredPermissions) {
                const userPermissions = user.permissions || [];
                const userRoles = user.roles || [];

                // Admin ma dostęp do wszystkiego
                const isAdmin = userPermissions.includes("*:*") ||
                    userPermissions.includes("system:admin") ||
                    userRoles.includes("ROLE_ADMIN");

                if (isAdmin) {
                    setAuthorized(true);
                    setLoading(false);
                    return;
                }

                // Sprawdź czy użytkownik ma wymagane uprawnienie
                const hasPermission = requiredPermissions.some(req => {
                    const reqUpper = req.toUpperCase();
                    return userPermissions.includes(req) ||
                        userPermissions.includes(`PERM_${reqUpper}`) ||
                        userPermissions.some(p => p === req);
                });

                if (!hasPermission) {
                    console.log(`AuthGuard: Access Denied to ${normalizedPath}. Missing permissions: ${requiredPermissions}`);
                    // Przekieruj na stronę główną, jeśli brak uprawnień
                    router.push("/");
                    setLoading(false);
                    return;
                }
            }

            // Token valid & Permissions OK
            setAuthorized(true);
            setLoading(false);
        };

        checkAuth();
    }, [pathname, router]);

    // Prevent flash of unauthorized content
    if (loading) {
        return <div className="min-h-screen bg-[#1b140e] flex items-center justify-center text-white">Loading auth...</div>;
    }

    const normalizedPath = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
    const isPublicPath = PUBLIC_PATHS.includes(normalizedPath) ||
        normalizedPath.startsWith("/_next") ||
        normalizedPath.startsWith("/static") ||
        normalizedPath.startsWith("/api");

    if (isPublicPath) {
        return <>{children}</>;
    }

    return authorized ? <>{children}</> : null;
}
