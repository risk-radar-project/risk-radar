"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Github, MapPin, Shield, Eye, Code } from "lucide-react"
import Link from "next/link"

const WELCOME_SHOWN_KEY = "riskradar_welcome_shown"

export function WelcomeDialog() {
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        // Check if this is first visit
        const hasSeenWelcome = localStorage.getItem(WELCOME_SHOWN_KEY)
        if (!hasSeenWelcome) {
            // Small delay for better UX
            const timer = setTimeout(() => {
                setIsOpen(true)
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [])

    const handleClose = () => {
        localStorage.setItem(WELCOME_SHOWN_KEY, "true")
        setIsOpen(false)
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="border-[#d97706]/30 bg-zinc-900 text-zinc-100 sm:max-w-[550px]">
                <DialogHeader className="text-center">
                    {/* Logo / Icon */}
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#d97706] to-[#b45309]">
                        <MapPin className="h-10 w-10 text-white" />
                    </div>

                    <DialogTitle className="text-center text-2xl font-bold">Witamy w RiskRadar! 👋</DialogTitle>

                    <DialogDescription className="text-center text-zinc-400">
                        Webowa mapa zagrożeń w Twoim mieście
                    </DialogDescription>
                </DialogHeader>

                {/* Features */}
                <div className="my-4 grid gap-3">
                    <div className="flex items-start gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3">
                        <div className="rounded-lg bg-blue-500/20 p-2">
                            <Shield className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="font-medium text-zinc-200">Projekt Inżynierski</p>
                            <p className="text-sm text-zinc-400">
                                Ta aplikacja została stworzona jako grupowy projekt inżynierski.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3">
                        <div className="rounded-lg bg-purple-500/20 p-2">
                            <Code className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                            <p className="font-medium text-zinc-200">Kod Źródłowy</p>
                            <p className="text-sm text-zinc-400">Kod źródłowy aplikacji jest dostępny na GitHubie.</p>
                            <Link
                                href="https://github.com/risk-radar-project/risk-radar"
                                target="_blank"
                                className="mt-1 inline-flex items-center gap-1 text-sm text-[#d97706] hover:underline"
                            >
                                <Github className="h-3.5 w-3.5" />
                                github.com/risk-radar-project/risk-radar
                            </Link>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-lg border border-[#d97706]/30 bg-[#d97706]/10 p-3">
                        <div className="rounded-lg bg-[#d97706]/20 p-2">
                            <Eye className="h-5 w-5 text-[#d97706]" />
                        </div>
                        <div>
                            <p className="font-medium text-[#d97706]">Tryb Demo</p>
                            <p className="text-sm text-zinc-400">
                                Aplikacja działa w trybie demonstracyjnym. Możesz przeglądać wszystkie funkcje, ale{" "}
                                <strong className="text-zinc-300">
                                    tworzenie, edycja i usuwanie danych jest zablokowane
                                </strong>
                                .
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter className="mt-2">
                    <Button
                        onClick={handleClose}
                        className="w-full bg-[#d97706] text-[#120c07] hover:bg-[#d97706]/90"
                        size="lg"
                    >
                        Rozpocznij eksplorację 🚀
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
