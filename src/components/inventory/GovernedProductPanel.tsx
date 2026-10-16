"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Kpi } from "@/components/ui/Kpi";
import type { GovernedProductRow } from "@/app/api/inventory/governed/route";

interface SyncRun {
  id: string;
  ran_at: string;
  status: string;
  products_seen: number;
  mapped_count: number;
  unmapped_count: number;
  reconciliation_failures: number;
  error: string | null;
}
interface SyncFailure {
  id: string;
  subject_type: string;
  subject_id: string;
  reason: string;
  detail: string | null;
  created_at: string;
}
interface Payload {
  configured: { notion: boolean; shopify: boolean; db: boolean };
  notionErrors: { source: string; message: string }[];
  products: GovernedProductRow[];
  mappedCount: number;
  lastSyncRun: SyncRun | null;
  needsAttention: SyncFailure[];
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

/**
 * Governed Product data (Notion Official Product Catalog + Shopify
 * reconciliation) — a read-only panel added alongside the existing
 * ClickUp/Notion-wiki DomainModule on the Inventory page, not replacing it.
 * Every section renders a meaningful empty state when its source isn't
 * configured, rather than hiding or fabricating data.
 */
export function GovernedProductPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [nonce, setNonce] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/inventory/governed")
      .then((r) => r.json())
      .then((d: Payload) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const products = data?.products ?? [];
  const launched = products.filter((p) => p.isLaunched).length;
  const onHold = products.filter((p) => p.isOnHold).length;
  const retired = products.filter((p) => p.isRetired).length;
  const incomplete = products.filter((p) => !p.isComplete).length;
  const inventoryEligible = products.filter((p) => p.inventoryEligible);
  const mappedEligible = inventoryEligible.filter((p) => p.shopifyVariantId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <SectionTitle
          title="Governed Product Data"
          action={
            <button
              onClick={() => {
                setLoading(true);
                setNonce((n) => n + 1);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-panel text-subtle hover:text-fg"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          }
        />
      </div>

      {!loading && !data?.configured.notion && (
        <Card className="p-4 text-sm text-subtle">
          Connect Notion to populate the governed product registry.{" "}
          <Link href="/settings" className="text-gold hover:underline">Open Settings</Link>
        </Card>
      )}

      {!loading && data?.configured.notion && data.products.length === 0 && (
        <Card className="p-4 text-sm text-subtle">
          Notion is connected, but the Official Product Catalog has no rows yet.
        </Card>
      )}

      {!loading && data && data.notionErrors.length > 0 && (
        <Card className="p-4 text-sm text-neg">
          {data.notionErrors.map((e) => (
            <p key={e.source}>
              {e.source}: {e.message}
            </p>
          ))}
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Catalog Records" value={loading ? "—" : String(products.length)} period="Notion" />
        <Kpi label="Launch Ready / Active" value={loading ? "—" : String(launched)} period="launched" />
        <Kpi label="On Hold / Retired" value={loading ? "—" : String(onHold + retired)} period="paused" />
        <Kpi label="Needs Attention" value={loading ? "—" : String(incomplete)} period="incomplete records" />
      </div>

      {/* Sync health */}
      <Card className="p-5">
        <SectionTitle title="Shopify Sync Health" />
        {!data?.configured.shopify ? (
          <p className="text-sm text-subtle">
            Shopify isn&apos;t configured — inventory availability and SKU reconciliation are
            unavailable until <code className="rounded bg-white/5 px-1.5 py-0.5 text-gold">SHOPIFY_STORE_DOMAIN</code> and{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 text-gold">SHOPIFY_ADMIN_API_ACCESS_TOKEN</code> are set.
          </p>
        ) : !data?.configured.db ? (
          <p className="text-sm text-subtle">
            Shopify is configured, but no database is connected to store reconciliation results.
          </p>
        ) : !data?.lastSyncRun ? (
          <p className="text-sm text-subtle">
            Shopify and the database are both connected, but no sync has run yet. Trigger one via{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 text-gold">POST /api/inventory/sync</code>.
          </p>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-subtle">
              Last run {fmtDate(data.lastSyncRun.ran_at)} ·{" "}
              <span className={data.lastSyncRun.status === "success" ? "text-pos" : "text-neg"}>
                {data.lastSyncRun.status}
              </span>{" "}
              · {data.lastSyncRun.mapped_count}/{data.lastSyncRun.products_seen} mapped
              {data.lastSyncRun.reconciliation_failures > 0 && (
                <> · {data.lastSyncRun.reconciliation_failures} needing attention</>
              )}
            </p>
            {inventoryEligible.length > 0 && (
              <p className="text-xs text-subtle">
                {mappedEligible.length}/{inventoryEligible.length} inventory-eligible products reconciled to a
                Shopify SKU.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Product registry */}
      <Card className="flex flex-col p-5">
        <SectionTitle title="Product Registry" action={<span className="text-xs text-subtle">{products.length}</span>} />
        {loading ? (
          <p className="py-6 text-center text-sm text-subtle">Loading…</p>
        ) : products.length === 0 ? (
          <p className="py-6 text-center text-sm text-subtle">No governed product records to show.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-3 font-semibold">Name</th>
                  <th className="pb-2 pr-3 font-semibold">Role</th>
                  <th className="pb-2 pr-3 font-semibold">Gate</th>
                  <th className="pb-2 pr-3 font-semibold">Suppliers</th>
                  <th className="pb-2 pr-3 font-semibold">Available</th>
                  <th className="pb-2 font-semibold">Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => (
                  <tr key={p.notionId}>
                    <td className="py-2 pr-3">
                      <span className={p.isComplete ? "text-fg" : "text-neg"}>{p.name}</span>
                      {!p.isComplete && (
                        <span className="ml-2 rounded-full border border-neg/40 px-1.5 py-0.5 text-[10px] text-neg">
                          incomplete
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-subtle">{p.architectureRole}</td>
                    <td className="py-2 pr-3 text-subtle">{p.developmentGate || "—"}</td>
                    <td className="py-2 pr-3 text-subtle">
                      {p.supplierNames.length > 0 ? p.supplierNames.join(", ") : "—"}
                    </td>
                    <td className="py-2 pr-3 text-subtle">
                      {!p.inventoryEligible
                        ? "n/a"
                        : p.availableQuantity === null
                          ? "unknown"
                          : p.availableQuantity}
                      {p.inventoryEligible && p.inventoryStale && (
                        <span className="ml-1.5 rounded-full border border-neg/40 px-1.5 py-0.5 text-[10px] text-neg">
                          stale
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-subtle">{fmtDate(p.lastVerified)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Needs attention */}
      {data && data.needsAttention.length > 0 && (
        <Card className="p-5">
          <SectionTitle
            title="Records Requiring Attention"
            action={<span className="text-xs text-subtle">{data.needsAttention.length}</span>}
          />
          <ul className="flex flex-col divide-y divide-border">
            {data.needsAttention.map((f) => (
              <li key={f.id} className="py-2 text-sm">
                <span className="text-neg">{f.reason}</span>{" "}
                <span className="text-subtle">— {f.detail ?? f.subject_id}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
