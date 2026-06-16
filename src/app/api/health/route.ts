import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  // Pinging db() also ensures the schema and seeds the supplier directory,
  // so a deploy's health check warms the Contact Center on first boot.
  let database = "unconfigured";
  try {
    const p = await db();
    if (p) {
      await p.query("SELECT 1");
      database = "up";
    }
  } catch {
    database = "down";
  }
  return NextResponse.json({ status: "ok", service: "cappo-meridian", database });
}
