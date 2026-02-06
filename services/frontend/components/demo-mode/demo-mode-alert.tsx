"use client"

import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Lock } from "lucide-react"

interface DemoModeAlertProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    description?: string
}

export function DemoModeAlert({
    isOpen,
    onClose,
    title = "Tryb demonstracyjny",
    description = "Ta akcja jest niedostępna w trybie demo. W wersji demonstracyjnej można tylko przeglądać dane."
}: DemoModeAlertProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="border-[#d97706]/30 bg-zinc-900 text-zinc-100 sm:max-w-[450px]">
                <DialogHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#d97706]/20">
                        <Lock className="h-8 w-8 text-[#d97706]" />
                    </div>
                    <DialogTitle className="text-center text-xl">{title}</DialogTitle>
                    <DialogDescription className="text-center text-zinc-400">{description}</DialogDescription>
                </DialogHeader>

                <div className="my-4 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#d97706]" />
                        <div className="text-sm text-zinc-300">
                            <p className="font-medium">Aplikacja działa w trybie tylko do odczytu</p>
                            <p className="mt-1 text-zinc-400">
                                Tworzenie, edycja i usuwanie danych jest zablokowane dla użytkowników demo.
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={onClose} className="w-full bg-[#d97706] text-[#120c07] hover:bg-[#d97706]/90">
                        Rozumiem
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// Helper hook to handle demo mode errors
export function isDemoModeError(error: unknown): boolean {
    if (error && typeof error === "object" && "demo_mode" in error) {
        return (error as { demo_mode?: boolean }).demo_mode === true
    }
    return false
}

// Helper to extract demo mode from response
export async function checkDemoModeResponse(response: Response): Promise<{ isDemoMode: boolean; data?: unknown }> {
    if (response.status === 403) {
        try {
            const data = await response.json()
            if (data.demo_mode === true) {
                return { isDemoMode: true, data }
            }
        } catch {
            // Not JSON, not demo mode error
        }
    }
    return { isDemoMode: false }
}
