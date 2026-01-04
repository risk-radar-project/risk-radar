"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { JwtPayload, parseJwt } from "@/lib/auth/jwt-utils"

export function AppHeader() {
    const [user, setUser] = useState<JwtPayload | null>(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        const token = localStorage.getItem("access_token")
        if (token) {
            setUser(parseJwt(token))
        }
    }, [])

    if (!mounted) return null

    const permissions = user?.permissions || []
    const roles = user?.roles || []

    const isAdmin = permissions.includes("*:*") ||
        permissions.includes("system:admin") ||
        permissions.includes("PERM_SYSTEM_ADMIN") ||
        roles.includes("ROLE_ADMIN")


    const canValidate = isAdmin ||
        permissions.includes("reports:validate") ||
        permissions.includes("PERM_REPORTS_VALIDATE")

    return (
        <header className="bg-[#362c20]/90 backdrop-blur-sm border-b border-[#e0dcd7]/10">
            <div className="px-6 h-16 flex items-center justify-between">
                <Link href="/" className="text-xl font-bold text-[#e0dcd7] hover:text-[#d97706] transition-colors">
                    RiskRadar
                </Link>

                <nav className="flex items-center gap-6 text-sm">
                    <a
                        href="/"
                        className="text-[#e0dcd7] hover:text-[#d97706] transition-colors font-medium"
                    >
                        Mapa
                    </a>

                    {canValidate && (
                        <Link
                            href="/reports"
                            className="text-[#e0dcd7] hover:text-[#d97706] transition-colors font-medium"
                        >
                            Weryfikacja
                        </Link>
                    )}

                    <Link
                        href="/profile"
                        className="text-[#e0dcd7] hover:text-[#d97706] transition-colors font-medium"
                    >
                        Profil
                    </Link>

                    <Link
                        href="/my-reports"
                        className="text-[#e0dcd7] hover:text-[#d97706] transition-colors font-medium"
                    >
                        Moje zgłoszenia
                    </Link>

                    {isAdmin && (
                        <Link
                            href="/admin"
                            className="text-[#e0dcd7] hover:text-[#d97706] transition-colors font-medium"
                        >
                            Admin
                        </Link>
                    )}

                    {!user ? (
                        <Link
                            href="/login"
                            className="px-4 py-2 rounded-lg bg-[#d97706] hover:bg-[#d97706]/80 text-white font-semibold transition-colors"
                        >
                            Zaloguj
                        </Link>
                    ) : (
                        <button
                            onClick={async () => {
                                try {
                                    const token = localStorage.getItem("access_token")

                                    // Try to call backend logout (don't await to avoid delays)
                                    if (token) {
                                        fetch("http://localhost:8090/api/users/logout", {
                                            method: "POST",
                                            headers: {
                                                "Authorization": `Bearer ${token}`
                                            }
                                        }).catch(err => console.warn("Backend logout failed:", err))
                                    }
                                } finally {
                                    // Always clear local storage and redirect
                                    localStorage.removeItem("access_token")
                                    localStorage.removeItem("refresh_token")
                                    // Use replace to prevent back button issues
                                    window.location.replace("/login")
                                }
                            }}
                            className="px-4 py-2 rounded-lg bg-transparent border border-[#d97706] text-[#d97706] hover:bg-[#d97706]/20 font-semibold transition-colors"
                        >
                            Wyloguj
                        </button>
                    )}
                </nav>
            </div>
        </header>
    )
}
