import type { TdHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export function TableCell({ className, children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
    return (
        <td className={cn("px-3 py-2", className)} {...props}>
            {children}
        </td>
    )
}
