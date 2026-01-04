"use client"

export function EmptyState({ title, description }: { title: string; description: string }) {
    return (
        <div className="text-center py-10 text-zinc-400">
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            <p className="text-sm">{description}</p>
        </div>
    )
}
