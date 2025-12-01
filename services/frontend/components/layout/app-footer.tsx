"use client"

export function AppFooter() {
    return (
        <footer className="border-t text-center py-4 text-sm text-muted-foreground">
            RiskRadar © {new Date().getFullYear()}
        </footer>
    )
}
