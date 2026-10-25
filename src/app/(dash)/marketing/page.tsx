import { redirect } from "next/navigation";

export default function MarketingPage() {
  redirect("/commerce-operations?tab=marketing");
}
