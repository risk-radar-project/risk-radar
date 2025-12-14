import type { ReactNode } from 'react'

export default function MapLayout({
    children
}: {
    children: ReactNode
}) {
    // This layout bypasses the root layout's header/footer
    // Map page has its own UI with sidebar
    return <>{children}</>
}
