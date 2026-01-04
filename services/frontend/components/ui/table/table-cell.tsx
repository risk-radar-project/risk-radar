import type { ComponentProps, ReactNode } from "react"

export function TableCell({ children, className, ...props }: { children: ReactNode } & ComponentProps<"td">) {
    return <td className={`px-3 py-2 ${className || ""}`} {...props}>{children}</td>
}
