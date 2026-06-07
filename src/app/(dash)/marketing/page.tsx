import { Megaphone } from "lucide-react";
import { ModuleBoard } from "@/components/modules/ModuleBoard";

export default function MarketingPage() {
  return (
    <ModuleBoard
      tag="marketing"
      title="Marketing"
      blurb="Campaigns, content, and channels — AMG ClickUp tasks tagged #marketing."
      icon={<Megaphone size={22} strokeWidth={1.75} />}
    />
  );
}
