"use client"

import React from "react"
import clsx from "clsx"

type PageTitleProps = {
    children: React.ReactNode
    className?: string
}

export function PageTitle({ children, className }: PageTitleProps) {
    return <h1 className={clsx("text-2xl font-bold tracking-tight text-[#f6eedf]", className)}>{children}</h1>
}
