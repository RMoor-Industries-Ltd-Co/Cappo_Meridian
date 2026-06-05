import { NextResponse } from "next/server";
import { getUnifiedFeed } from "@/lib/connectors";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await getUnifiedFeed();
  return NextResponse.json({ items });
}
