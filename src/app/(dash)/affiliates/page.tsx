import { Users } from "lucide-react";
import { DomainModule } from "@/components/modules/DomainModule";

export default function AffiliatesPage() {
  return (
    <DomainModule
      domain="Affiliates"
      blurb="Partners, referrals, and payouts — ClickUp #affiliates + Notion records."
      icon={<Users size={22} strokeWidth={1.75} />}
    />
  );
}
