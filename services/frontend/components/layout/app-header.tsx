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

<<<<<<< HEAD
    // In JWT: roles are "ROLE_ADMIN", permissions are "PERM_*:*"
    const isAdmin = roles.includes("ROLE_ADMIN") ||
        permissions.includes("PERM_*:*") ||
        permissions.includes("PERM_SYSTEM:ADMIN")

=======
    const isAdmin =
        permissions.includes("*:*") ||
        permissions.includes("system:admin") ||
        permissions.includes("PERM_SYSTEM_ADMIN") ||
        roles.includes("ROLE_ADMIN")

    const canValidate = isAdmin || permissions.includes("reports:validate") || permissions.includes("PERM_REPORTS_VALIDATE")
>>>>>>> main

    return (
        <header className="border-b border-[#e0dcd7]/10 bg-[#362c20]/90 backdrop-blur-sm">
            <div className="flex h-16 items-center justify-between px-6">
                <Link href="/" className="text-xl font-bold text-[#e0dcd7] transition-colors hover:text-[#d97706]">
                    RiskRadar
                </Link>

                <nav className="flex items-center gap-6 text-sm">
                    <Link href="/" className="font-medium text-[#e0dcd7] transition-colors hover:text-[#d97706]">
                        Mapa
                    </Link>

<<<<<<< HEAD
                    <Link
                        href="/profile"
                        className="text-[#e0dcd7] hover:text-[#d97706] transition-colors font-medium"
                    >
=======
                    {canValidate && (
                        <Link href="/reports" className="font-medium text-[#e0dcd7] transition-colors hover:text-[#d97706]">
                            Weryfikacja
                        </Link>
                    )}

                    <Link href="/profile" className="font-medium text-[#e0dcd7] transition-colors hover:text-[#d97706]">
>>>>>>> main
                        Profil
                    </Link>

                    <Link href="/my-reports" className="font-medium text-[#e0dcd7] transition-colors hover:text-[#d97706]">
                        Moje zgłoszenia
                    </Link>

                    {isAdmin && (
                        <Link href="/admin" className="font-medium text-[#e0dcd7] transition-colors hover:text-[#d97706]">
                            Admin
                        </Link>
                    )}

                    {!user ? (
                        <Link
                            href="/login"
                            className="rounded-lg bg-[#d97706] px-4 py-2 font-semibold text-white transition-colors hover:bg-[#d97706]/80"
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
                                                Authorization: `Bearer ${token}`
                                            }
                                        }).catch((err) => console.warn("Backend logout failed:", err))
                                    }
                                } finally {
                                    // Always clear local storage and redirect
                                    localStorage.removeItem("access_token")
                                    localStorage.removeItem("refresh_token")
                                    // Use replace to prevent back button issues
                                    window.location.replace("/login")
                                }
                            }}
                            className="rounded-lg border border-[#d97706] bg-transparent px-4 py-2 font-semibold text-[#d97706] transition-colors hover:bg-[#d97706]/20"
                        >
                            Wyloguj
                        </button>
                    )}
                </nav>
            </div>
        </header>
    )
}
