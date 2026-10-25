import { redirect } from "next/navigation";

/** Campaigns consolidated into Commerce Operations — preserved as a compatibility redirect. */
export default function CampaignsPage() {
  redirect("/commerce-operations?tab=promotions");
}
