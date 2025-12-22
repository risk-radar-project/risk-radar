"use client"

import Link from "next/link"

export function AppHeader() {
    return (
        <header className="bg-[#362c20]/90 backdrop-blur-sm border-b border-[#e0dcd7]/10">
            <div className="px-6 h-16 flex items-center justify-between">
                <Link href="/" className="text-xl font-bold text-[#e0dcd7] hover:text-[#d97706] transition-colors">
                    RiskRadar
                </Link>

                <nav className="flex items-center gap-6 text-sm">
                    <a
                        href="/map"
                        className="text-[#e0dcd7] hover:text-[#d97706] transition-colors font-medium"
                    >
                        Mapa
                    </a>
                    <Link
                        href="/reports"
                        className="text-[#e0dcd7] hover:text-[#d97706] transition-colors font-medium"
                    >
                        Zgłoszenia
                    </Link>
                    <Link
                        href="/profile"
                        className="text-[#e0dcd7] hover:text-[#d97706] transition-colors font-medium"
                    >
                        Profil
                    </Link>
                    <Link
                        href="/settings"
                        className="text-[#e0dcd7] hover:text-[#d97706] transition-colors font-medium"
                    >
                        Ustawienia
                    </Link>
                    <Link
                        href="/my-reports"
                        className="text-[#e0dcd7] hover:text-[#d97706] transition-colors font-medium"
                    >
                        Moje zgłoszenia
                    </Link>
                    <Link
                        href="/admin"
                        className="text-[#e0dcd7] hover:text-[#d97706] transition-colors font-medium"
                    >
                        Admin
                    </Link>
                    <Link
                        href="/login"
                        className="px-4 py-2 rounded-lg bg-[#d97706] hover:bg-[#d97706]/80 text-white font-semibold transition-colors"
                    >
                        Zaloguj
                    </Link>
                    <button
                        className="px-4 py-2 rounded-lg bg-transparent border border-[#d97706] text-[#d97706] hover:bg-[#d97706]/20 font-semibold transition-colors"
                    >
                        Wyloguj
                    </button>
                </nav>
            </div>
        </header>
    )
}
