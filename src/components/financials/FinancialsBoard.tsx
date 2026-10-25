"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  HandCoins,
  TrendingUp,
  Receipt,
  Wallet,
  LineChart,
  FileBarChart,
} from "lucide-react";
import { DomainModule } from "@/components/modules/DomainModule";
import { Card } from "@/components/ui/Card";

/**
 * Financials — the renamed/expanded Budget destination. Section navigation
 * prepared per the Financial Management Expansion spec (9 sections); only
 * Overview carries forward the existing, live Budget functionality
 * (ClickUp #budget + Notion wiki via DomainModule) in this PR. The other
 * eight sections are explicitly planned-state placeholders — no simulated
 * financial data or nonfunctional controls — pending Phase 1 of the
 * Financials build (separate PR, separate Founder authorization).
 */
const SECTIONS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, implemented: true },
  { id: "accounts", label: "Accounts", icon: Landmark, implemented: false },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight, implemented: false },
  { id: "contributions", label: "Contributions", icon: HandCoins, implemented: false },
  { id: "revenue", label: "Revenue", icon: TrendingUp, implemented: false },
  { id: "expenses", label: "Expenses", icon: Receipt, implemented: false },
  { id: "budgets", label: "Budgets", icon: Wallet, implemented: false },
  { id: "forecasting", label: "Forecasting", icon: LineChart, implemented: false },
  { id: "reports", label: "Reports", icon: FileBarChart, implemented: false },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function FinancialsBoard() {
  const [section, setSection] = useState<SectionId>("overview");
  const active = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <h1 className="text-2xl font-semibold text-gold">Financials</h1>
        <p className="mt-1 text-sm text-subtle">
          Accounts, transactions, contributions, revenue, expenses, budgets, forecasting, and reports.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-0">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={[
                "flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-all",
                section === s.id
                  ? "border-border bg-panel text-gold border-gold/40"
                  : "border-transparent text-subtle hover:text-fg hover:bg-panel/60",
              ].join(" ")}
            >
              <Icon size={16} strokeWidth={1.75} className={section === s.id ? "text-gold" : "text-subtle"} />
              {s.label}
            </button>
          );
        })}
      </div>

      {active.implemented ? (
        <DomainModule
          domain="Budget"
          blurb="Spend, forecasts, and approvals — ClickUp #budget + Notion records."
          icon={<Wallet size={22} strokeWidth={1.75} />}
        />
      ) : (
        <Card className="flex flex-col items-start gap-2 p-6">
          <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">
            Planned
          </span>
          <h2 className="text-lg font-semibold text-fg">{active.label}</h2>
          <p className="max-w-xl text-sm text-subtle">
            The Founders have aligned on the Financials direction (Notion — Cappo Meridian Financial
            Management Expansion, Decision: Approved Direction). This section is reserved navigation for
            that build; its data model, ledger, and reporting have not been implemented yet. No figures
            shown here are real, simulated, or placeholder data — there is simply nothing to display until
            Phase 1 of the Financials build is authorized and delivered in a separate PR.
          </p>
        </Card>
      )}
    </div>
  );
}
