import { BookText } from "lucide-react";
import { ModuleBoard } from "@/components/modules/ModuleBoard";

export default function OperationsPage() {
  return (
    <ModuleBoard
      tag="operations"
      title="Operations"
      blurb="Process, SOPs, and runbooks — AMG ClickUp tasks tagged #operations."
      icon={<BookText size={22} strokeWidth={1.75} />}
    />
  );
}
