"use client"

import { cn } from "@/lib/utils"

export function Spinner({ className }: { className?: string }) {
    return (
        <div className={cn("size-6 animate-spin rounded-full border-2 border-[#e0dcd7]/30 border-t-[#d97706]", className)} />
    )
}
