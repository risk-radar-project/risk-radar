"use client"
export function AppFooter() {
    return (
        <footer className="h-10 border-t border-[#e0dcd7]/10 bg-[#362c20]/90 text-sm text-[#e0dcd7]/70 backdrop-blur-sm">
            <div className="mx-auto flex h-full max-w-7xl items-center justify-center gap-4 px-6 text-center">
                <span>RiskRadar © {new Date().getFullYear()}</span>
            </div>
        </footer>
    )
}
