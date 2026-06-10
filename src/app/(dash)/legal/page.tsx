import { Scale } from "lucide-react";
import { DomainModule } from "@/components/modules/DomainModule";

export default function LegalPage() {
  return (
    <DomainModule
      domain="Legal"
      blurb="Contracts, IP, and compliance — ClickUp #legal + Notion records."
      icon={<Scale size={22} strokeWidth={1.75} />}
    />
  );
}
