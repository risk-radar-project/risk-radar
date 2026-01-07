"use client"

import React from "react"
import { Breadcrumbs } from "@/components/ui/ux/breadcrumbs"

export function PageHeader({ children }: { children: React.ReactNode }) {
    return (
        <div className="mb-6 flex flex-col gap-2">
            <Breadcrumbs />
            <div className="flex items-center justify-between">{children}</div>
        </div>
    )
}
