import type { ReactNode } from "react"

export function TableHead({ children }: { children: ReactNode }) {
    return <thead className="bg-zinc-900 text-sm text-zinc-300">{children}</thead>
}
