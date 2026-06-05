import { BookText } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export default function OperationsPage() {
  return (
    <PlaceholderPage
      icon={BookText}
      title="Operations"
      blurb="Process documentation and SOPs."
      planned={[
        "SOP library (Notion / Drive)",
        "Process owners & reviews",
        "Onboarding playbooks",
        "Document version tracking",
        "Checklists & runbooks",
        "Search across all docs",
      ]}
    />
  );
}
