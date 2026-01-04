import type { ReactNode } from "react"

export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="bg-background-light group/design-root relative flex min-h-screen w-full flex-col items-center justify-center p-4 dark:bg-[#181411]">
            <div className="layout-container flex h-full w-full max-w-md grow flex-col">
                <div className="flex flex-1 flex-col items-center justify-center py-5">
                    <div className="layout-content-container flex w-full flex-col items-center">
                        <h1 className="tracking-light pt-6 pb-3 text-center text-[32px] leading-tight font-bold text-white">
                            RiskRadar
                        </h1>
                        <p className="px-4 pt-1 pb-3 text-center text-base leading-normal font-normal text-zinc-400 dark:text-white">
                            Zaloguj się lub Utwórz konto, aby rozpocząć.
                        </p>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    )
}
