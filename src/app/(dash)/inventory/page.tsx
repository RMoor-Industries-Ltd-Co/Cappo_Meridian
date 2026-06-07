import { Boxes } from "lucide-react";
import { ModuleBoard } from "@/components/modules/ModuleBoard";

export default function InventoryPage() {
  return (
    <ModuleBoard
      tag="inventory"
      title="Inventory"
      blurb="Stock, SKUs, and supply — AMG ClickUp tasks tagged #inventory."
      icon={<Boxes size={22} strokeWidth={1.75} />}
    />
  );
}
