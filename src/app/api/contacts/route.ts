import { type NextRequest, NextResponse } from "next/server";
import { listSuppliers, upsertSupplier, logCall, setCallClickup } from "@/lib/db";
import { clickupCreateTask } from "@/lib/connectors/clickup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    return NextResponse.json({ suppliers: await listSuppliers() });
  } catch (e) {
    return NextResponse.json({ suppliers: [], error: e instanceof Error ? e.message : String(e) });
  }
}

// Outcome → pipeline stage, plus an optional AMG ClickUp follow-up task.
const ACTION: Record<
  string,
  { stage: string; task?: (n: string) => string; tag?: string; dueDays?: number; useCallback?: boolean }
> = {
  "Reached": { stage: "contacted" },
  "Voicemail": { stage: "contacted" },
  "No Answer": { stage: "contacted" },
  "Call Back": { stage: "contacted", task: (n) => `Call back: ${n}`, tag: "sourcing", useCallback: true },
  "Ordered Sample": { stage: "sample", task: (n) => `Sample follow-up: ${n}`, tag: "sourcing", dueDays: 14 },
  "Submit for Next Steps": { stage: "negotiating", task: (n) => `Next steps: ${n}`, tag: "sourcing", dueDays: 3 },
  "Not Interested": { stage: "rejected" },
  "OOB": { stage: "oob" },
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const supplierIn = (body?.supplier ?? {}) as Record<string, unknown>;
  const call = (body?.call ?? {}) as Record<string, unknown>;
  if (!supplierIn.name) return NextResponse.json({ error: "supplier name required" }, { status: 400 });

  const outcome = (call.outcome as string) ?? "Logged";
  const cfg = ACTION[outcome];
  if (cfg?.stage) supplierIn.stage = cfg.stage;

  try {
    const supplier = await upsertSupplier(supplierIn);
    const log = await logCall(supplier.id, {
      rep: (call.rep as string) ?? null,
      outcome,
      notes: (call.notes as string) ?? null,
      durationSeconds: (call.durationSeconds as number) ?? null,
      callbackAt: (call.callbackAt as string) ?? null,
    });
    let clickupUrl: string | null = null;
    if (cfg?.task) {
      try {
        const dueMs =
          cfg.useCallback && call.callbackAt
            ? new Date(call.callbackAt as string).getTime()
            : cfg.dueDays
              ? Date.now() + cfg.dueDays * 86400000
              : undefined;
        const t = await clickupCreateTask({ name: cfg.task(supplier.name), tag: cfg.tag, dueMs });
        clickupUrl = t.url;
        await setCallClickup(log.id, t.url);
      } catch {
        /* ClickUp follow-up is best-effort */
      }
    }
    return NextResponse.json({ supplier, call: { ...log, clickup_url: clickupUrl } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
