import { Wallet } from "lucide-react";
import { DomainModule } from "@/components/modules/DomainModule";

export default function BudgetPage() {
  return (
    <DomainModule
      domain="Budget"
      blurb="Spend, forecasts, and approvals — ClickUp #budget + Notion records."
      icon={<Wallet size={22} strokeWidth={1.75} />}
    />
  );
}
