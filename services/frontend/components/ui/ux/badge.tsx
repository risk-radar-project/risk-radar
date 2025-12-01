"use client"

import clsx from "clsx"

export function Badge({ children, variant = "default" }: any) {
    return (
        <span
            className={clsx(
                "px-2 py-0.5 text-xs rounded font-medium",
                variant === "default" && "bg-zinc-800 text-zinc-100",
                variant === "success" && "bg-green-600 text-white",
                variant === "warning" && "bg-yellow-600 text-white",
                variant === "danger" && "bg-red-600 text-white"
            )}
        >
            {children}
        </span>
    )
}
