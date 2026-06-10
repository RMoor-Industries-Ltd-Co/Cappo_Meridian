import { Megaphone } from "lucide-react";
import { DomainModule } from "@/components/modules/DomainModule";

export default function MarketingPage() {
  return (
    <DomainModule
      domain="Marketing"
      blurb="Campaigns, content, and channels — ClickUp #marketing + Notion records."
      icon={<Megaphone size={22} strokeWidth={1.75} />}
    />
  );
}
