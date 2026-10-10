import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { gmailSendHtml } from "@/lib/connectors/gmail";
import { MODES, type SessionMode } from "@/lib/training-quiz";
import {
  LOGO_CID,
  buildHtmlScorecard,
  buildSubject,
  buildTextScorecard,
  type Scorecard,
} from "@/lib/training-scorecard";

export const runtime = "nodejs";

interface ScoreBody {
  founder: string;
  score: number;
  total: number;
  /** "match" | "blank" | "quiz" | "master" (older clients may send only match/quiz). */
  mode?: string;
  categories: string[];
  xp: number;
  missedTerms?: string[];
  /** Whether the attempt cleared the mode's bar — meaningful for the Master Quiz. */
  passed?: boolean;
  timestamp: string;
}

const REPORT_TO = "board@apex-meridian-group.com";

export async function POST(req: NextRequest) {
  try {
    const body: ScoreBody = await req.json();
    const { founder, score, total, mode, categories, xp, missedTerms = [], passed, timestamp } = body;

    const date = new Date(timestamp);
    const normalizedMode = mode && mode in MODES ? (mode as SessionMode) : (mode ?? "quiz");
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;

    const scorecard: Scorecard = {
      founder,
      date,
      mode: normalizedMode,
      score,
      total,
      percent,
      xp,
      categories,
      missedTerms,
      passed,
    };
    const subject = buildSubject(scorecard);
    const text = buildTextScorecard(scorecard);
    const html = buildHtmlScorecard(scorecard);
    const logo = await readFile(path.join(process.cwd(), "public", "AMG-logo_000full.png"));

    await gmailSendHtml(REPORT_TO, subject, {
      text,
      html,
      inlineAttachments: [
        {
          filename: "AMG-logo_000full.png",
          contentType: "image/png",
          contentId: LOGO_CID,
          data: logo,
        },
      ],
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[training/score] failed to send report:", error);
    return NextResponse.json({ ok: false, error });
  }
}
