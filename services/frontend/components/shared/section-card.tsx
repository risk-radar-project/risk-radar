"use client"

import React from "react"
import { Card } from "@/components/ui/card"

export function SectionCard({ children }: { children: React.ReactNode }) {
    return (
        <Card className="p-6 space-y-4">
            {children}
        </Card>
    )
}
