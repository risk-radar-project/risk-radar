"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"
import { cn } from "@/lib/utils"

const PATH_MAP: Record<string, string> = {
    admin: "Panel Zarządzania",
    dashboard: "Dashboard",
    users: "Użytkownicy",
    reports: "Zgłoszenia",
    stats: "Statystyki",
    verification: "Weryfikacja",
    profile: "Profil",
    "my-reports": "Moje zgłoszenia",
    "submit-report": "Dodaj zgłoszenie",
    terms: "Regulamin"
}

export function Breadcrumbs({ className }: { className?: string }) {
    const pathname = usePathname()
    const segments = pathname.split("/").filter(Boolean)

    if (segments.length === 0) return null

    return (
        <nav className={cn("flex items-center text-sm text-[#e0dcd7]/60", className)}>
            <Link href="/" className="flex items-center transition-colors hover:text-[#d97706]">
                <Home className="mr-1 size-4" />
                <span className="sr-only">Strona główna</span>
            </Link>
            {segments.map((segment, index) => {
                const path = `/${segments.slice(0, index + 1).join("/")}`
                const label = PATH_MAP[segment] || segment

                const isLast = index === segments.length - 1

                return (
                    <div key={path} className="flex items-center">
                        <ChevronRight className="mx-1 size-4 text-[#e0dcd7]/40" />
                        {isLast ? (
                            <span className="font-medium text-[#e0dcd7]">{label}</span>
                        ) : (
                            <Link href={path} className="transition-colors hover:text-[#d97706]">
                                {label}
                            </Link>
                        )}
                    </div>
                )
            })}
        </nav>
    )
}
