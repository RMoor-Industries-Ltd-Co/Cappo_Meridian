import { Wallet } from "lucide-react";
import { ModuleBoard } from "@/components/modules/ModuleBoard";

export default function BudgetPage() {
  return (
    <ModuleBoard
      tag="budget"
      title="Budget"
      blurb="Spend, forecasts, and approvals — AMG ClickUp tasks tagged #budget."
      icon={<Wallet size={22} strokeWidth={1.75} />}
    />
  );
}
