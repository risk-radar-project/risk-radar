import type { ComponentProps, ReactNode } from "react"

export function TableRow({ children, className, ...props }: { children: ReactNode } & ComponentProps<"tr">) {
    return <tr className={`border-b border-zinc-800 ${className || ""}`} {...props}>{children}</tr>
}
