"use client"

import Link from "next/link"

export function AppFooter() {
    return (
        <footer className="border-t border-[#e0dcd7]/10 bg-[#362c20]/90 py-4 text-center text-sm text-[#e0dcd7]/70 backdrop-blur-sm">
            RiskRadar © {new Date().getFullYear()}
            <div className="mt-2">
                <Link href="/terms" className="hover:text-primary">
                    Regulamin
                </Link>
            </div>
        </footer>
    )
}
