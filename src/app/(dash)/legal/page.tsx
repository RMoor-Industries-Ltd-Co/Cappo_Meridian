import { Scale } from "lucide-react";
import { ModuleBoard } from "@/components/modules/ModuleBoard";

export default function LegalPage() {
  return (
    <ModuleBoard
      tag="legal"
      title="Legal"
      blurb="Contracts, IP, and compliance — AMG ClickUp tasks tagged #legal."
      icon={Scale}
    />
  );
}
