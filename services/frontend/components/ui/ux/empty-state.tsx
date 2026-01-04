"use client"

export function EmptyState({ title, description }: { title: string; description: string }) {
    return (
        <div className="py-10 text-center text-zinc-400">
            <h3 className="mb-2 text-lg font-semibold">{title}</h3>
            <p className="text-sm">{description}</p>
        </div>
    )
}
