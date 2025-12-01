import type { ReactNode } from "react"

export function TableCell({ children }: { children: ReactNode }) {
    return <td className="px-3 py-2">{children}</td>
}
