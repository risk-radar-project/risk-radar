"use client"

import React from "react"

export function PageHeader({ children }: { children: React.ReactNode }) {
    return (
        <div className="mb-6 flex items-center justify-between">
            {children}
        </div>
    )
}
