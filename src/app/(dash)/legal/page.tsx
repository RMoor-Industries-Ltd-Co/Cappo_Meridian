import { Scale } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export default function LegalPage() {
  return (
    <PlaceholderPage
      icon={Scale}
      title="Legal"
      blurb="Contracts, compliance, and entity documents."
      planned={[
        "Contract repository & status",
        "Renewal / expiry alerts",
        "Compliance checklist",
        "Entity & IP records",
        "Signature tracking",
        "Counsel & matter log",
      ]}
    />
  );
}
