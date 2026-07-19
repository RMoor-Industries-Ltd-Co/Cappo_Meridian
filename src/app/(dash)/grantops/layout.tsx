import type { ReactNode } from "react";
import { Landmark } from "lucide-react";
import { SubNav } from "@/components/grantops/SubNav";

export default function GrantOpsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong bg-panel text-gold">
          <Landmark size={22} strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-fg">Funding Command Center</h1>
          <p className="max-w-2xl text-sm text-subtle">
            AMG coordinates; operating entities apply. Research and score opportunities, let
            CAPPO govern the decision and ALLIE prepare the materials — with a human approving
            before anything is ever submitted. No portal auto-login, no external submission
            without sign-off.
          </p>
        </div>
      </div>
      <SubNav />
      {children}
    </div>
  );
}
