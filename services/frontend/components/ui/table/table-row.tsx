import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export function TableRow({ className, children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
    return (
        <tr className={cn("border-b border-zinc-800", className)} {...props}>
            {children}
        </tr>
    )
}
