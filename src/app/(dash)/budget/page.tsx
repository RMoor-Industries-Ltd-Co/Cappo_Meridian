import { Wallet } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export default function BudgetPage() {
  return (
    <PlaceholderPage
      icon={Wallet}
      title="Budget"
      blurb="Spend, forecasts, and financial health."
      planned={[
        "Spend by department",
        "Budget vs. actual by quarter",
        "Burn rate & runway",
        "Upcoming expenses",
        "Cash-flow projection",
        "Approval workflow",
      ]}
    />
  );
}
