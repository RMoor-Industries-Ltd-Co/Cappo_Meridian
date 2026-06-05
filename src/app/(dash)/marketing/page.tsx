import { Megaphone } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export default function MarketingPage() {
  return (
    <PlaceholderPage
      icon={Megaphone}
      title="Marketing"
      blurb="Campaigns, content calendar, and channel performance."
      planned={[
        "Campaign pipeline from ClickUp",
        "Content calendar (Notion sync)",
        "Channel performance metrics",
        "Asset library from Google Drive",
        "Email campaign status",
        "Quarterly marketing OKRs",
      ]}
    />
  );
}
