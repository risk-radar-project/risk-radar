"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { JwtPayload, parseJwt } from "@/lib/auth/jwt-utils"
import { GATEWAY_URL } from "@/lib/auth/auth-service"
import { cn } from "@/lib/utils"
import { useUnreadNotificationsCount } from "@/hooks/use-notifications"
import { usePermission } from "@/hooks/use-permission"

interface AppSidebarProps {
    isOpen: boolean
    setIsOpen: (value: boolean) => void
}

export function AppSidebar({ isOpen, setIsOpen }: AppSidebarProps) {
    const pathname = usePathname()
    const [mounted, setMounted] = useState(false)
    const isAdminPanelOpenInit = pathname.startsWith("/admin") || pathname.startsWith("/reports")
    const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(isAdminPanelOpenInit)
    const { user, hasPermission } = usePermission()

    const { data: unreadCount } = useUnreadNotificationsCount()

    useEffect(() => {
        setMounted(true)
        // If we navigate to admin section, ensure its open
        if (pathname.startsWith("/admin") || pathname.startsWith("/reports")) {
            setIsAdminPanelOpen(true)
        }
    }, [pathname])

    if (!mounted) return null

    const isAdmin = hasPermission("system:admin")
    const canValidate = hasPermission("reports:validate")

    const handleLogout = async () => {
        try {
            const token = localStorage.getItem("access_token")
            if (token) {
                fetch(`${GATEWAY_URL}/api/users/logout`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }).catch((err) => console.warn("Backend logout failed:", err))
            }
        } finally {
            localStorage.removeItem("access_token")
            localStorage.removeItem("refresh_token")
            window.location.replace("/login")
        }
    }

    return (
        <>
            {/* Hamburger Trigger (only when closed) */}
            <button
                onClick={() => setIsOpen(true)}
                className={cn(
                    "fixed top-4 left-4 z-40 flex size-12 items-center justify-center rounded-lg bg-[#362c20]/90 shadow-lg backdrop-blur-sm transition-all hover:bg-[#362c20]",
                    isOpen ? "-translate-x-full opacity-0" : "translate-x-0 opacity-100"
                )}
                title="Pokaż menu"
            >
                <span className="material-symbols-outlined text-3xl text-[#e0dcd7]">menu</span>
            </button>

            {/* Sidebar Config */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#362c20]/95 p-4 shadow-2xl backdrop-blur-sm transition-transform duration-300 ease-in-out",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2">
                    <Link href="/" className="flex items-center gap-3">
                        <div
                            className="aspect-square size-10 rounded-full bg-cover bg-center bg-no-repeat ring-2 ring-[#e0dcd7]/20"
                            style={{
                                backgroundImage: 'url("/icon.png")'
                            }}
                        />
                        <h1 className="text-lg leading-normal font-bold text-[#e0dcd7]">RiskRadar</h1>
                    </Link>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="flex size-10 items-center justify-center rounded-lg text-[#e0dcd7] transition-colors hover:bg-white/10"
                        title="Schowaj menu"
                    >
                        <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                </div>

                {/* Navigation Links */}
                <nav className="custom-scrollbar mt-8 flex flex-1 flex-col gap-2 overflow-y-auto">
                    <Link
                        className="flex items-center gap-3 rounded-lg bg-[#d97706] px-3 py-2 font-semibold text-white shadow-md transition-colors hover:bg-[#d97706]/80"
                        href="/submit-report"
                    >
                        <span className="material-symbols-outlined">add_location_alt</span>
                        <p className="text-base leading-normal">Zgłoś Zdarzenie</p>
                    </Link>

                    <div className="my-2 border-t border-[#e0dcd7]/10"></div>

                    <Link
                        className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-[#e0dcd7] transition-colors hover:bg-white/10",
                            pathname === "/" && "bg-white/5"
                        )}
                        href="/"
                    >
                        <span className="material-symbols-outlined">map</span>
                        <p className="text-base leading-normal">Mapa</p>
                    </Link>

                    <Link
                        className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-[#e0dcd7] transition-colors hover:bg-white/10",
                            pathname.startsWith("/profile") && "bg-white/5"
                        )}
                        href="/profile"
                    >
                        <span className="material-symbols-outlined">person</span>
                        <p className="text-base leading-normal">Profil</p>
                    </Link>

                    <Link
                        className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-[#e0dcd7] transition-colors hover:bg-white/10",
                            pathname.startsWith("/my-reports") && "bg-white/5"
                        )}
                        href="/my-reports"
                    >
                        <span className="material-symbols-outlined">description</span>
                        <p className="text-base leading-normal">Moje zgłoszenia</p>
                    </Link>

                    <Link
                        className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-[#e0dcd7] transition-colors hover:bg-white/10",
                            pathname.startsWith("/notifications") && "bg-white/5"
                        )}
                        href="/notifications"
                    >
                        <div className="relative">
                            <span className="material-symbols-outlined">notifications</span>
                            {unreadCount && unreadCount > 0 ? (
                                <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                                    {unreadCount > 99 ? "99+" : unreadCount}
                                </span>
                            ) : null}
                        </div>
                        <p className="text-base leading-normal">Powiadomienia</p>
                    </Link>

                    {/* Admin / Management Section */}
                    {canValidate && (
                        <>
                            <div className="my-2 border-t border-[#e0dcd7]/10"></div>

                            <button
                                onClick={() => setIsAdminPanelOpen(!isAdminPanelOpen)}
                                className={cn(
                                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-[#e0dcd7] transition-colors hover:bg-white/10",
                                    (pathname.startsWith("/admin") || pathname.startsWith("/reports")) && "bg-white/5"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined">settings_suggest</span>
                                    <p className="text-base leading-normal">Panel Zarządzania</p>
                                </div>
                                <span
                                    className={cn(
                                        "material-symbols-outlined transition-transform",
                                        isAdminPanelOpen ? "rotate-180" : "rotate-0"
                                    )}
                                >
                                    expand_more
                                </span>
                            </button>

                            {isAdminPanelOpen && (
                                <div className="mt-1 ml-4 flex flex-col gap-1 border-l border-[#e0dcd7]/10 pl-2">
                                    {isAdmin && (
                                        <Link
                                            className={cn(
                                                "flex items-center gap-3 rounded-lg px-3 py-2 text-[#e0dcd7]/80 transition-colors hover:bg-white/10 hover:text-[#e0dcd7]",
                                                pathname === "/admin" && "bg-white/5 text-[#d97706]"
                                            )}
                                            href="/admin"
                                        >
                                            <span className="material-symbols-outlined text-lg">dashboard</span>
                                            <p className="text-sm leading-normal">Dashboard</p>
                                        </Link>
                                    )}

                                    {canValidate && (
                                        <Link
                                            className={cn(
                                                "flex items-center gap-3 rounded-lg px-3 py-2 text-[#e0dcd7]/80 transition-colors hover:bg-white/10 hover:text-[#e0dcd7]",
                                                (pathname.startsWith("/reports") ||
                                                    pathname.startsWith("/admin/verification")) &&
                                                "bg-white/5 text-[#d97706]"
                                            )}
                                            href={isAdmin ? "/admin/verification" : "/reports"}
                                        >
                                            <span className="material-symbols-outlined text-lg">verified</span>
                                            <p className="text-sm leading-normal">Weryfikacja</p>
                                        </Link>
                                    )}

                                    {isAdmin && (
                                        <Link
                                            className={cn(
                                                "flex items-center gap-3 rounded-lg px-3 py-2 text-[#e0dcd7]/80 transition-colors hover:bg-white/10 hover:text-[#e0dcd7]",
                                                pathname.startsWith("/admin/reports") && "bg-white/5 text-[#d97706]"
                                            )}
                                            href="/admin/reports"
                                        >
                                            <span className="material-symbols-outlined text-lg">description</span>
                                            <p className="text-sm leading-normal">Zgłoszenia</p>
                                        </Link>
                                    )}

                                    {hasPermission("users:view") && (
                                        <Link
                                            className={cn(
                                                "flex items-center gap-3 rounded-lg px-3 py-2 text-[#e0dcd7]/80 transition-colors hover:bg-white/10 hover:text-[#e0dcd7]",
                                                pathname.startsWith("/admin/users") && "bg-white/5 text-[#d97706]"
                                            )}
                                            href="/admin/users"
                                        >
                                            <span className="material-symbols-outlined text-lg">group</span>
                                            <p className="text-sm leading-normal">Użytkownicy</p>
                                        </Link>
                                    )}

                                    {isAdmin && (
                                        <Link
                                            className={cn(
                                                "flex items-center gap-3 rounded-lg px-3 py-2 text-[#e0dcd7]/80 transition-colors hover:bg-white/10 hover:text-[#e0dcd7]",
                                                pathname.startsWith("/admin/roles") && "bg-white/5 text-[#d97706]"
                                            )}
                                            href="/admin/roles"
                                        >
                                            <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                                            <p className="text-sm leading-normal">Role i Permisje</p>
                                        </Link>
                                    )}

                                    {isAdmin && (
                                        <Link
                                            className={cn(
                                                "flex items-center gap-3 rounded-lg px-3 py-2 text-[#e0dcd7]/80 transition-colors hover:bg-white/10 hover:text-[#e0dcd7]",
                                                pathname.startsWith("/admin/audit") && "bg-white/5 text-[#d97706]"
                                            )}
                                            href="/admin/audit"
                                        >
                                            <span className="material-symbols-outlined text-lg">receipt_long</span>
                                            <p className="text-sm leading-normal">Dziennik Zdarzeń</p>
                                        </Link>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </nav>

                {/* Footer Actions (Auth) */}
                <div className="mt-2 border-t border-[#e0dcd7]/10 pt-4">
                    {/* User Info & Terms */}
                    <div className="mb-2 flex flex-col gap-2 px-1">
                        {user && (
                            <div className="mb-2 px-2 text-xs text-[#e0dcd7]/50">
                                Zalogowany jako: <br />
                                <span className="block truncate font-semibold text-[#e0dcd7]" title={user.email}>
                                    {user.username || user.email || "Użytkownik"}
                                </span>
                            </div>
                        )}
                        <Link
                            href="/terms"
                            className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-[#e0dcd7]/70 transition-colors hover:bg-white/5 hover:text-[#d97706]"
                        >
                            <span className="material-symbols-outlined text-lg">gavel</span>
                            <p className="leading-normal">Regulamin</p>
                        </Link>
                    </div>

                    {user ? (
                        <button
                            onClick={handleLogout}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[#ef4444] transition-colors hover:bg-[#ef4444]/10"
                        >
                            <span className="material-symbols-outlined">logout</span>
                            <p className="text-base leading-normal">Wyloguj</p>
                        </button>
                    ) : (
                        <Link
                            href="/login"
                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-[#d97706] transition-colors hover:bg-[#d97706]/10"
                        >
                            <span className="material-symbols-outlined">login</span>
                            <p className="text-base leading-normal">Zaloguj się</p>
                        </Link>
                    )}
                </div>
            </aside>
        </>
    )
}
