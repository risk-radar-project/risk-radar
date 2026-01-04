"use client"

import clsx from "clsx"

type BadgeVariant = "default" | "success" | "warning" | "danger"

type BadgeProps = {
    children: React.ReactNode
    variant?: BadgeVariant
    className?: string
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
    return (
        <span
            className={clsx(
                "rounded px-2 py-0.5 text-xs font-medium",
                variant === "default" && "bg-zinc-800 text-zinc-100",
                variant === "success" && "bg-green-600 text-white",
                variant === "warning" && "bg-yellow-600 text-white",
                variant === "danger" && "bg-red-600 text-white",
                className
            )}
        >
            {children}
        </span>
    )
}
