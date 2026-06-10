import { TrendingUp } from "lucide-react";
import { DomainModule } from "@/components/modules/DomainModule";

export default function SalesPage() {
  return (
    <DomainModule
      domain="Sales"
      blurb="Pipeline and deals — ClickUp #sales + Notion records."
      icon={<TrendingUp size={22} strokeWidth={1.75} />}
    />
  );
}
