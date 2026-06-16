import { type NextRequest, NextResponse } from "next/server";
import { getSupplierWithCalls } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/contacts/:id — a supplier plus its recent call history. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json(await getSupplierWithCalls(id));
}
