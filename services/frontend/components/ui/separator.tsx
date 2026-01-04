import * as React from "react"

type SeparatorProps = React.HTMLAttributes<HTMLDivElement>

export function Separator({ className = "", ...props }: SeparatorProps) {
    return <div role="separator" className={`border-b ${className}`} {...props} />
}
