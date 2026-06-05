import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="amg-canvas flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="relative flex-1 overflow-y-auto">
          {/* Poured-gold accent cascading from the top of the canvas */}
          <div className="gold-pour" aria-hidden />
          <div className="relative z-10 mx-auto max-w-[1400px] px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
