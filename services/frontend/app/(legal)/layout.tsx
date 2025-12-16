import type { ReactNode } from "react";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#2a221a] text-zinc-300">
      <div className="flex bg-[#2a221a]">
        {children}
      </div>
    </div>
  );
}
