import { TrendingUp } from "lucide-react";
import { ModuleBoard } from "@/components/modules/ModuleBoard";

export default function SalesPage() {
  return (
    <ModuleBoard
      tag="sales"
      title="Sales"
      blurb="Pipeline and deals — AMG ClickUp tasks tagged #sales."
      icon={TrendingUp}
    />
  );
}
