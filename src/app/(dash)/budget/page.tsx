import { redirect } from "next/navigation";

/** Budget was renamed to Financials — preserved as a compatibility redirect for deep links. */
export default function BudgetPage() {
  redirect("/financials");
}
