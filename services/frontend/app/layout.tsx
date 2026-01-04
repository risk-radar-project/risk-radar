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
import { AppHeader } from "@/components/layout/app-header"
import { AppFooter } from "@/components/layout/app-footer"

const fontSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"]
})

const fontMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"]
})

export const metadata: Metadata = {
    title: "RiskRadar - Mapa zagrożeń i incydentów",
    description: "Interaktywna mapa zgłoszeń zagrożeń, incydentów i problemów w Twoim mieście"
}

export default async function RootLayout({
    children
}: Readonly<{
    children: ReactNode
}>) {
    const session = await loadSession()
    const serializedSession = JSON.stringify(session ?? null).replace(/</g, "\\u003c")

    const headersList = await headers()
    const pathname = headersList.get("x-pathname") || ""
    const isMapPage = pathname === "/" || pathname === ""

    return (
        <html lang="en">
            <head>
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
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window.__SESSION__ = ${serializedSession};`
                    }}
                />
                <ClientSessionHydrator />
                <QueryClientWrapper>
                    <AuthGuard>
                        {!isMapPage && <AppHeader />}
                        <main className={isMapPage ? "h-screen" : "flex-1"}>{children}</main>
                        {!isMapPage && <AppFooter />}
                        <Toaster />
                    </AuthGuard>
                </QueryClientWrapper>
            </body>
        </html>
    )
}
