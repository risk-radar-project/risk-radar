"use client"

import React from "react"

export function PageTitle({ children }: { children: React.ReactNode }) {
    return (
        <h1 className="text-2xl font-bold tracking-tight">
            {children}
        </h1>
    )
}
