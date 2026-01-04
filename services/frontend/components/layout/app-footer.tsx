"use client"

import Link from "next/link"

export function AppFooter() {
    return (
        <footer className="bg-[#362c20]/90 backdrop-blur-sm border-t border-[#e0dcd7]/10 text-center py-4 text-sm text-[#e0dcd7]/70">
            RiskRadar © {new Date().getFullYear()}
            <div className="mt-2">
                <Link href="/terms" className="hover:text-primary">
                    Regulamin
                </Link>
            </div>
        </footer>
    )
}
