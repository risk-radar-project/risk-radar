"use client"

import React from "react"
import { Card } from "@/components/ui/card"

import { cn } from "@/lib/utils"

export function SectionCard({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <Card className={cn("p-6 space-y-4", className)}>
            {children}
        </Card>
    )
}
