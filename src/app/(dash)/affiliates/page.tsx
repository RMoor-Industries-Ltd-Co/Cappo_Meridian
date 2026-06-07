import { Users } from "lucide-react";
import { ModuleBoard } from "@/components/modules/ModuleBoard";

export default function AffiliatesPage() {
  return (
    <ModuleBoard
      tag="affiliates"
      title="Affiliates"
      blurb="Partners, referrals, and payouts — AMG ClickUp tasks tagged #affiliates."
      icon={<Users size={22} strokeWidth={1.75} />}
    />
  );
}
