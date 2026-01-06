"use client"

import { Button } from "@/components/ui/button"

export function EmptyState({
    title,
    description,
    actionLabel,
    onAction
}: {
    title: string
    description: string
    actionLabel?: string
    onAction?: () => void
}) {
    return (
        <div className="flex flex-col items-center justify-center py-10 text-center text-zinc-400">
            <h3 className="mb-2 text-lg font-semibold text-zinc-200">{title}</h3>
            <p className="text-sm">{description}</p>
            {actionLabel && onAction && (
                <Button variant="outline" className="mt-4" onClick={onAction}>
                    {actionLabel}
                </Button>
            )}
        </div>
    )
}
