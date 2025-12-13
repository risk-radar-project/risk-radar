import type { ReactNode } from 'react'
import { Nunito } from 'next/font/google'

const nunito = Nunito({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-nunito'
})

export default function MapLayout({
    children
}: {
    children: ReactNode
}) {
    return (
        <div className={`${nunito.className} h-full w-screen overflow-hidden`}>
            {children}
        </div>
    )
}
