"use client"

import Link from "next/link"

export function AppHeader() {
    return (
        <header className="border-b bg-background">
            <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
                <Link href="/" className="text-xl font-semibold">
                    RiskRadar
                </Link>

                <nav className="flex items-center gap-4 text-sm">
                    <Link href="/map">Mapa</Link>
                    <Link href="/reports">Zgłoszenia</Link>
                    <Link href="/profile">Profil</Link>
                    <Link href="/settings">Ustawienia</Link>
                    <Link href="/my-reports">Moje zgłoszenia</Link>
                    <Link href="/admin">Admin</Link>
                </nav>
            </div>
        </header>
    )
}
