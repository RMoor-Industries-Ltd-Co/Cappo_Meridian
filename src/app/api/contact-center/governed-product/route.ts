import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getGovernedCatalog, governedProductsForSupplier } from "@/lib/connectors/products";

export const dynamic = "force-dynamic";

/**
 * GET /api/contact-center/governed-product?supplier=<name> — the Notion-
 * governed, approval-gated product facts for a supplier (see
 * `governedProductsForSupplier` in connectors/products.ts for the approval
 * rule). Additive to Contact Center's existing hardcoded `directoryFor()`
 * panel, not a replacement for it — see that function's doc comment for the
 * phase-out plan.
 */
export async function GET(req: NextRequest) {
  const supplier = req.nextUrl.searchParams.get("supplier")?.trim();
  if (!supplier) return NextResponse.json({ products: [] });
  if (!env.NOTION_API_KEY) return NextResponse.json({ products: [], notionConfigured: false });

  try {
    const catalog = await getGovernedCatalog();
    const products = governedProductsForSupplier(catalog, supplier);
    return NextResponse.json({ products, notionConfigured: true });
  } catch (err) {
    return NextResponse.json(
      { products: [], notionConfigured: true, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
