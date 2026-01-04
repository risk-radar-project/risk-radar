"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isTokenExpired, parseJwt } from "@/lib/auth/jwt-utils";
import { refreshAccessToken } from "@/lib/auth/auth-service";

const PUBLIC_PATHS = ["/", "/login", "/register", "/terms"];

// Map paths to required permissions
const ROUTE_PERMISSIONS: Record<string, string[]> = {
    "/admin": ["system:admin", "PERM_SYSTEM_ADMIN"],
    "/stats": ["stats:view", "PERM_STATS_VIEW"],
    "/audit": ["audit:view", "PERM_AUDIT_VIEW"],
    "/users": ["users:view", "PERM_USERS_VIEW"],
    "/reports": ["reports:validate", "PERM_REPORTS_VALIDATE"],
    "/submit-report": ["reports:create", "PERM_REPORTS_CREATE", "ROLE_USER"],
};


export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const [alreadyLoggedIn, setAlreadyLoggedIn] = useState(false);

    // Helper function to clear tokens and redirect to login
    const clearAndRedirect = (reason: string) => {
        console.log(`AuthGuard: ${reason} -> Clearing tokens and redirecting to login`);
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setAuthorized(false);
        setLoading(false);
        router.push("/login");
    };

    // console.log("AuthGuard RENDER:", pathname, "| Loading:", loading, "| Authorized:", authorized);

    useEffect(() => {
        const checkAuth = async () => {
            setAccessDenied(false);
            // Normalize path
            const normalizedPath = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;

            const accessToken = localStorage.getItem("access_token");

            // Redirect logged-in users away from auth pages
            if (accessToken && !isTokenExpired(accessToken)) {
                if (["/login", "/register"].includes(normalizedPath)) {
                    setAlreadyLoggedIn(true);
                    setLoading(false);
                    setTimeout(() => router.push("/"), 1500);
                    return;
                }
            }

            // Check if it's a public path
            const isPublicPath = PUBLIC_PATHS.includes(normalizedPath) ||
                normalizedPath.startsWith("/_next") ||
                normalizedPath.startsWith("/static") ||
                normalizedPath.startsWith("/api");

            if (isPublicPath) {
                setAuthorized(true);
                setLoading(false);
                return;
            }

            const refreshToken = localStorage.getItem("refresh_token");

            if (!accessToken) {
                console.log("AuthGuard: Missing access token -> Redirect to login");
                // Clear any stale refresh tokens
                localStorage.removeItem("refresh_token");
                setAuthorized(false);
                setLoading(false);
                router.push("/login");
                return;
            }

            let currentToken = accessToken;

            if (isTokenExpired(accessToken)) {
                console.log("AuthGuard: Access token expired. Attempting refresh...");

                if (!refreshToken) {
                    clearAndRedirect("No refresh token available");
                    return;
                }

                const newTokens = await refreshAccessToken(refreshToken);

                if (newTokens) {
                    console.log("AuthGuard: Token refresh successful");
                    localStorage.setItem("access_token", newTokens.accessToken);
                    localStorage.setItem("refresh_token", newTokens.refreshToken);
                    currentToken = newTokens.accessToken;
                } else {
                    clearAndRedirect("Token refresh failed");
                    return;
                }
            }

            // --- CHECK PERMISSIONS (RBAC) ---
            const user = parseJwt(currentToken);
            if (!user) {
                console.log("AuthGuard: Failed to parse token -> Clear and redirect");
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                setAuthorized(false);
                setLoading(false);
                router.push("/login");
                return;
            }

            // Check if path requires special permissions
            const requiredPermissions = Object.entries(ROUTE_PERMISSIONS).find(([path]) =>
                normalizedPath.startsWith(path)
            )?.[1];

            if (requiredPermissions) {
                const userPermissions = user.permissions || [];
                const userRoles = user.roles || [];

                // Admin has access to everything
                const isAdmin = userPermissions.includes("*:*") ||
                    userPermissions.includes("system:admin") ||
                    userRoles.includes("ROLE_ADMIN");

                if (isAdmin) {
                    setAuthorized(true);
                    setLoading(false);
                    return;
                }

                // Check if user has required permission
                const hasPermission = requiredPermissions.some(req => {
                    const reqUpper = req.toUpperCase();
                    // Check permissions
                    if (userPermissions.includes(req) ||
                        userPermissions.includes(`PERM_${reqUpper}`) ||
                        userPermissions.some(p => p === req)) {
                        return true;
                    }
                    // Check roles
                    if (userRoles.includes(req) ||
                        userRoles.includes(`ROLE_${reqUpper}`)) {
                        return true;
                    }
                    return false;
                });

                if (!hasPermission) {
                    console.log(`AuthGuard: Access Denied to ${normalizedPath}. Missing permissions: ${requiredPermissions}`);
                    setAccessDenied(true);
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
    if (alreadyLoggedIn) {
        return (
            <div className="min-h-screen bg-[#1b140e] flex flex-col items-center justify-center text-white gap-4">
                <h1 className="text-xl font-bold text-[#d97706]">Jesteś już zalogowany</h1>
                <p className="text-[#baab9c]">Przekierowywanie na stronę główną...</p>
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#d97706]"></div>
                <button
                    onClick={() => {
                        localStorage.removeItem("access_token");
                        localStorage.removeItem("refresh_token");
                        window.location.href = "/login";
                    }}
                    className="mt-4 text-sm text-red-500 hover:text-red-400 underline z-50 cursor-pointer"
                >
                    Nie przekierowuje? Wyloguj się
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#1b140e] flex flex-col items-center justify-center text-white gap-4">
                <p>Przekierowywanie do logowania...</p>
                <button
                    onClick={() => {
                        localStorage.removeItem("access_token");
                        localStorage.removeItem("refresh_token");
                        window.location.href = "/login";
                    }}
                    className="text-sm text-red-400 hover:text-red-300 underline"
                >
                    Wymuś wylogowanie
                </button>
            </div>
        );
    }

    if (accessDenied) {
        return (
            <div className="min-h-screen bg-[#1b140e] flex flex-col items-center justify-center text-white gap-4">
                <h1 className="text-2xl font-bold text-red-500">Brak uprawnień</h1>
                <p className="text-[#baab9c]">Nie masz wystarczających uprawnień, aby wyświetlić tę stronę.</p>
                <button
                    onClick={() => {
                        localStorage.removeItem("access_token");
                        localStorage.removeItem("refresh_token");
                        window.location.href = "/login";
                    }}
                    className="px-6 py-2 rounded-lg bg-[#d97706] hover:bg-[#d97706]/80 text-white font-semibold transition-colors"
                >
                    Wyloguj i zaloguj ponownie
                </button>
                <button
                    onClick={() => router.push("/")}
                    className="text-sm text-[#baab9c] hover:text-white underline"
                >
                    Wróć na stronę główną
                </button>
            </div>
        );
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
