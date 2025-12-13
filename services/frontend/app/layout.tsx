import type { ReactNode } from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { headers } from "next/headers"
import "./globals.css"
import { cn } from "@/lib/utils"
import { AppHeader } from "@/components/layout/app-header"
import { AppFooter } from "@/components/layout/app-footer"
import { Toaster } from "@/components/ui/sonner"
import { QueryClientWrapper } from "@/components/providers/query-client-provider"
import { ClientSessionHydrator } from "@/components/providers/client-session-hydrator"
import { loadSession } from "@/lib/auth/load-session"

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
    const isMapPage = pathname.startsWith("/map")

    return (
        <html lang="en">
            <body className={cn(
                "bg-[#2a221a] font-sans antialiased",
                isMapPage ? "h-screen overflow-hidden" : "min-h-screen flex flex-col",
                fontSans.variable,
                fontMono.variable
            )}>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window.__SESSION__ = ${serializedSession};`
                    }}
                />
                <ClientSessionHydrator />
                <QueryClientWrapper>
                    <AppHeader />
                    <main className={isMapPage ? "h-[calc(100vh-8rem)]" : "flex-1"}>
                        {children}
                    </main>
                    <AppFooter />
                    <Toaster />
                </QueryClientWrapper>
            </body>
        </html>
    )
}
