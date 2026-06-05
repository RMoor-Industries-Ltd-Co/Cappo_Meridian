import { TrendingUp } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export default function SalesPage() {
  return (
    <PlaceholderPage
      icon={TrendingUp}
      title="Sales"
      blurb="Pipeline, deals, and revenue tracking."
      planned={[
        "Deal pipeline by stage",
        "Revenue vs. quarter target",
        "Win/loss analysis",
        "Client accounts overview",
        "Quote & contract status",
        "Forecast vs. actuals",
      ]}
    />
  );
}
