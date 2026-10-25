import { redirect } from "next/navigation";

export default function SalesPage() {
  redirect("/commerce-operations?tab=sales");
}
