import { Boxes } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/PlaceholderPage";

export default function InventoryPage() {
  return (
    <PlaceholderPage
      icon={Boxes}
      title="Inventory"
      blurb="Stock levels, SKUs, and supply tracking."
      planned={[
        "Stock levels by SKU",
        "Low-stock alerts",
        "Supplier & reorder tracking",
        "Inventory valuation",
        "Movement history",
        "Warehouse / location view",
      ]}
    />
  );
}
