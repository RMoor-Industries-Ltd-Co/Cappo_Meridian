import { NextRequest, NextResponse } from "next/server";
import { gmailSend } from "@/lib/connectors/gmail";

interface ScoreBody {
  founder: string;
  score: number;
  total: number;
  categories: string[];
  xp: number;
  timestamp: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: ScoreBody = await req.json();
    const { founder, score, total, categories, xp, timestamp } = body;

    const date = new Date(timestamp);
    const subject = `AMG Training Report — ${founder} — ${date.toLocaleDateString()}`;

    const emailBody = [
      "AMG LEXICON TRAINING REPORT",
      "============================",
      `Founder: ${founder}`,
      `Date: ${date.toLocaleString()}`,
      `Score: ${score}/${total} (${Math.round((score / total) * 100)}%)`,
      `XP Earned: ${xp}`,
      `Categories Covered: ${categories.join(", ")}`,
      "",
      "Sent from Cappo Meridian · Apex Meridian Group",
    ].join("\n");

    await gmailSend("board@apex-meridian-group.com", subject, emailBody);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[training/score] failed to send report:", error);
    return NextResponse.json({ ok: false, error });
  }
}
