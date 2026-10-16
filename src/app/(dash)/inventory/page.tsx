import { Boxes } from "lucide-react";
import { DomainModule } from "@/components/modules/DomainModule";
import { GovernedProductPanel } from "@/components/inventory/GovernedProductPanel";

export default function InventoryPage() {
  return (
    <div className="flex flex-col gap-8">
      <DomainModule
        domain="Inventory"
        blurb="Stock, SKUs, and supply — ClickUp #inventory + the HVN Product Catalog."
        icon={<Boxes size={22} strokeWidth={1.75} />}
      />
      {/* Governed product data (Notion Official Product Catalog + read-only
          Shopify reconciliation) — additive to the ClickUp/Notion-wiki module
          above, not a replacement for it. See CAPPO Milestone 5. */}
      <GovernedProductPanel />
    </div>
  );
}
