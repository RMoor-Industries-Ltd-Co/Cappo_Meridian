import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { gmailSend } from "@/lib/connectors/gmail";

const scoreSchema = z.object({
  founder: z.enum(["Founder 55", "Founder 88"]),
  mode: z.enum(["Quick Quiz", "Term Match", "Sentence Completion", "Master Quiz"]),
  score: z.number().int().nonnegative(),
  total: z.number().int().positive().max(500),
  categories: z.array(z.string().min(1).max(100)).min(1).max(20),
  xp: z.number().int().nonnegative().max(100_000),
  timestamp: z.string().datetime(),
  metrics: z.record(z.string(), z.number().finite()).optional(),
}).refine((value) => value.score <= value.total, { message: "score cannot exceed total" });

export async function POST(req: NextRequest) {
  try {
    const parsed = scoreSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid training result." }, { status: 400 });
    }
    const { founder, mode, score, total, categories, xp, timestamp, metrics } = parsed.data;
    const date = new Date(timestamp);
    const subject = `AMG Training Report — ${founder} — ${mode} — ${date.toLocaleDateString()}`;
    const metricLines = Object.entries(metrics ?? {}).map(([key, value]) => `${key}: ${value}`);
    const emailBody = [
      "AMG LEXICON TRAINING REPORT",
      "============================",
      `Founder: ${founder}`,
      `Mode: ${mode}`,
      `Date: ${date.toLocaleString()}`,
      `Score: ${score}/${total} (${Math.round((score / total) * 100)}%)`,
      `XP Earned: ${xp}`,
      `Categories Covered: ${categories.join(", ")}`,
      ...metricLines,
      "",
      "Sent from Cappo Meridian · Apex Meridian Group",
    ].join("\n");
    await gmailSend("board@apex-meridian-group.com", subject, emailBody);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[training/score] failed to send report:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ok: false, error: "The training report could not be sent." }, { status: 500 });
  }
}
