import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPersonalBest, submitPersonalBest } from "@/lib/db";

const FOUNDER = z.enum(["Founder 55", "Founder 88"]);
const MODE = z.enum(["Lexicon-Lingo Match"]);

const submitSchema = z.object({
  founder: FOUNDER,
  mode: MODE,
  highestRound: z.number().int().nonnegative(),
  pairsMatched: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(1),
  maxBonusBankSeconds: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative().max(1_000_000),
});

/** GET /api/training/personal-best?founder=Founder+55&mode=Lexicon-Lingo+Match */
export async function GET(req: NextRequest) {
  const founder = FOUNDER.safeParse(req.nextUrl.searchParams.get("founder"));
  const mode = MODE.safeParse(req.nextUrl.searchParams.get("mode"));
  if (!founder.success || !mode.success) {
    return NextResponse.json({ ok: false, error: "Invalid founder or mode." }, { status: 400 });
  }
  try {
    const best = await getPersonalBest(founder.data, mode.data);
    return NextResponse.json({ ok: true, best });
  } catch (error) {
    console.error("[training/personal-best] read failed:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ok: true, best: null });
  }
}

export async function POST(req: NextRequest) {
  const parsed = submitSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid personal-best submission." }, { status: 400 });
  }
  const { founder, mode, highestRound, pairsMatched, accuracy, maxBonusBankSeconds, xp } = parsed.data;
  try {
    const result = await submitPersonalBest({
      founder,
      mode,
      highest_round: highestRound,
      pairs_matched: pairsMatched,
      accuracy,
      max_bonus_bank_secs: maxBonusBankSeconds,
      xp,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    // Database not configured (local dev) — the run still completes, it just
    // can't persist a personal best. Not a failure from the player's view.
    console.error("[training/personal-best] submit failed:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ok: true, best: null, isNewBest: false, persisted: false });
  }
}
