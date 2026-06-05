import { Users } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export default function AffiliatesPage() {
  return (
    <PlaceholderPage
      icon={Users}
      title="Affiliates"
      blurb="Partner network, referrals, and payouts."
      planned={[
        "Affiliate roster & tiers",
        "Referral tracking",
        "Commission & payout ledger",
        "Top performers leaderboard",
        "Partner onboarding status",
        "Link / code performance",
      ]}
    />
  );
}
