import { Boxes } from "lucide-react";
import { DomainModule } from "@/components/modules/DomainModule";

export default function InventoryPage() {
  return (
    <DomainModule
      domain="Inventory"
      blurb="Stock, SKUs, and supply — ClickUp #inventory + the HVN Product Catalog."
      icon={<Boxes size={22} strokeWidth={1.75} />}
    />
  );
}
