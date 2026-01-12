/* eslint-disable @next/next/no-page-custom-font */
import type { ReactNode } from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/sonner"
import { QueryClientWrapper } from "@/components/providers/query-client-provider"
import { ClientSessionHydrator } from "@/components/providers/client-session-hydrator"
import { loadSession } from "@/lib/auth/load-session"
import AuthGuard from "@/components/auth-guard"
import { PathAwareShell } from "@/components/layout/path-aware-shell"

// Load custom fonts
const fontSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"]
})

const fontMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"]
})

// Define metadata for the application
export const metadata: Metadata = {
    title: "RiskRadar - Risk and Incident Map",
    description: "Interactive map for reporting risks, incidents, and problems in your city"
}

// Root layout for the application
export default async function RootLayout({
    children
}: Readonly<{
    children: ReactNode
}>) {
    // Load session data on the server
    const session = await loadSession()
    // Serialize session data to be passed to the client
    const serializedSession = JSON.stringify(session ?? null).replace(/</g, "\\u003c")

    return (
        <html lang="en" className="dark">
            <head>
                {/* Load Material Symbols font */}
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
                />
            </head>
            <body
                className={cn(
                    "flex min-h-screen flex-col bg-[#2a221a] font-sans antialiased",
                    fontSans.variable,
                    fontMono.variable
                )}
            >
                {/* Pass session data to the client */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window.__SESSION__ = ${serializedSession};`
                    }}
                />
                {/* Hydrate session data on the client */}
                <ClientSessionHydrator />
                {/* Wrap the application with React Query client */}
                <QueryClientWrapper>
                    {/* Protect routes with AuthGuard */}
                    <AuthGuard>
                        {/* Render the shell with path-aware navigation */}
                        <PathAwareShell>{children}</PathAwareShell>
                        {/* Display toast notifications */}
                        <Toaster theme="dark" richColors closeButton />
                    </AuthGuard>
                </QueryClientWrapper>
            </body>
        </html>
    )
}
