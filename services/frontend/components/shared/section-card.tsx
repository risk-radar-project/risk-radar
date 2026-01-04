"use client"

import React from "react"
import { Card } from "@/components/ui/card"

import { cn } from "@/lib/utils"

export function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
    return <Card className={cn("space-y-4 p-6", className)}>{children}</Card>
}
