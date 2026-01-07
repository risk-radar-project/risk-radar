import type { ReactNode } from "react"

export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="bg-background-light group/design-root relative flex min-h-screen w-full flex-col items-center justify-center p-4 dark:bg-[#181411]">
            <div className="layout-container flex h-full w-full max-w-md grow flex-col">
                <div className="flex flex-1 flex-col items-center justify-center py-5">
                    <div className="layout-content-container flex w-full flex-col items-center">{children}</div>
                </div>
            </div>
        </div>
    )
}
