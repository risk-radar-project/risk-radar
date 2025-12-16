import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-background-light dark:bg-[#181411] p-4 group/design-root">
      <div className="layout-container flex h-full grow flex-col w-full max-w-md">
        <div className="flex flex-1 flex-col items-center justify-center py-5">
          <div className="layout-content-container flex w-full flex-col items-center">
            <h1 className="text-white tracking-light text-[32px] font-bold leading-tight text-center pb-3 pt-6">
              RiskRadar
            </h1>
            <p className="text-zinc-400 dark:text-white text-base font-normal leading-normal pb-3 pt-1 px-4 text-center">
              Zaloguj się lub Utwórz konto, aby rozpocząć.
            </p>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

