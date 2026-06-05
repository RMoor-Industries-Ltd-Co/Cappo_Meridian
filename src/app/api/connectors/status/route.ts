import { NextResponse } from "next/server";
import { getAllStatuses } from "@/lib/connectors";

export const dynamic = "force-dynamic";

export async function GET() {
  const statuses = await getAllStatuses();
  return NextResponse.json({ connectors: statuses });
}
