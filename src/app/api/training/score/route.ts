import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { gmailSendHtml } from "@/lib/connectors/gmail";

export const runtime = "nodejs";

interface ScoreBody {
  founder: string;
  score: number;
  total: number;
  mode?: string;
  categories: string[];
  xp: number;
  missedTerms?: string[];
  timestamp: string;
}

const LOGO_CID = "amg-training-scorecard-logo";
const REPORT_TO = "board@apex-meridian-group.com";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatList(values: string[]): string {
  const unique = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
  return unique.length ? unique.join(", ") : "None recorded";
}

function buildTextScorecard(input: {
  founder: string;
  date: Date;
  mode: string;
  score: number;
  total: number;
  percent: number;
  xp: number;
  categories: string[];
  missedTerms: string[];
}): string {
  return [
    "AMG LEXICON TRAINING SCORECARD",
    "================================",
    `Founder: ${input.founder}`,
    `Date: ${input.date.toLocaleString()}`,
    `Mode: ${input.mode}`,
    `Score: ${input.score}/${input.total} (${input.percent}%)`,
    `XP Earned: ${input.xp}`,
    `Categories Covered: ${formatList(input.categories)}`,
    `Review Terms: ${formatList(input.missedTerms)}`,
    "",
    "Training recap: CAPPO recorded this result from the AMG lexicon training experience.",
    "Sent from Cappo Meridian · Apex Meridian Group",
  ].join("\n");
}

function buildHtmlScorecard(input: {
  founder: string;
  date: Date;
  mode: string;
  score: number;
  total: number;
  percent: number;
  xp: number;
  categories: string[];
  missedTerms: string[];
}): string {
  const categories = formatList(input.categories);
  const missedTerms = formatList(input.missedTerms);
  const scoreColor = input.percent >= 80 ? "#18d189" : input.percent >= 60 ? "#ffd300" : "#ff7a7a";

  return `<!doctype html>
<html>
  <body style="margin:0;background:#070707;color:#f8f5e9;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#070707;padding:28px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:640px;max-width:94%;background:#11110f;border:1px solid #2d2916;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 18px;background:#0b0b0a;border-bottom:1px solid #2d2916;">
                <img src="cid:${LOGO_CID}" width="84" height="84" alt="Apex Meridian Group" style="display:block;width:84px;height:84px;margin:0 0 18px;">
                <div style="font-size:12px;letter-spacing:2.5px;text-transform:uppercase;color:#ffd300;font-weight:700;">Official Training Scorecard</div>
                <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2;color:#ffffff;">AMG Lexicon Training Recap</h1>
                <p style="margin:10px 0 0;color:#b9b39d;font-size:15px;line-height:1.5;">CAPPO recorded this result from the AMG lexicon training experience.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding:0 0 18px;">
                      <div style="font-size:13px;color:#b9b39d;text-transform:uppercase;letter-spacing:1.5px;">Founder</div>
                      <div style="font-size:22px;color:#ffffff;font-weight:700;">${escapeHtml(input.founder)}</div>
                    </td>
                    <td align="right" style="padding:0 0 18px;">
                      <div style="font-size:13px;color:#b9b39d;text-transform:uppercase;letter-spacing:1.5px;">Completed</div>
                      <div style="font-size:16px;color:#ffffff;">${escapeHtml(input.date.toLocaleString())}</div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 22px;">
                  <tr>
                    <td style="width:33.3%;padding:14px;border:1px solid #302b17;border-radius:14px;background:#171510;">
                      <div style="font-size:12px;color:#b9b39d;text-transform:uppercase;letter-spacing:1.2px;">Score</div>
                      <div style="font-size:30px;color:${scoreColor};font-weight:800;">${input.percent}%</div>
                      <div style="font-size:13px;color:#f8f5e9;">${input.score}/${input.total} correct</div>
                    </td>
                    <td style="width:33.3%;padding:14px;border:1px solid #302b17;border-radius:14px;background:#171510;">
                      <div style="font-size:12px;color:#b9b39d;text-transform:uppercase;letter-spacing:1.2px;">XP Earned</div>
                      <div style="font-size:30px;color:#ffd300;font-weight:800;">${input.xp}</div>
                      <div style="font-size:13px;color:#f8f5e9;">training points</div>
                    </td>
                    <td style="width:33.3%;padding:14px;border:1px solid #302b17;border-radius:14px;background:#171510;">
                      <div style="font-size:12px;color:#b9b39d;text-transform:uppercase;letter-spacing:1.2px;">Mode</div>
                      <div style="font-size:24px;color:#ffffff;font-weight:800;text-transform:capitalize;">${escapeHtml(input.mode)}</div>
                      <div style="font-size:13px;color:#f8f5e9;">lexicon practice</div>
                    </td>
                  </tr>
                </table>

                <div style="margin-top:12px;padding:18px;border-left:4px solid #ffd300;background:#15130d;">
                  <div style="font-size:13px;color:#ffd300;text-transform:uppercase;letter-spacing:1.4px;font-weight:700;">Categories Covered</div>
                  <p style="margin:8px 0 0;color:#ffffff;font-size:15px;line-height:1.5;">${escapeHtml(categories)}</p>
                </div>

                <div style="margin-top:14px;padding:18px;border-left:4px solid #6f6b58;background:#15130d;">
                  <div style="font-size:13px;color:#ffd300;text-transform:uppercase;letter-spacing:1.4px;font-weight:700;">Review Next</div>
                  <p style="margin:8px 0 0;color:#ffffff;font-size:15px;line-height:1.5;">${escapeHtml(missedTerms)}</p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;background:#0b0b0a;border-top:1px solid #2d2916;color:#8f8974;font-size:12px;line-height:1.5;">
                Sent from Cappo Meridian · Apex Meridian Group
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const body: ScoreBody = await req.json();
    const { founder, score, total, mode, categories, xp, missedTerms = [], timestamp } = body;

    const date = new Date(timestamp);
    const normalizedMode = mode ?? "quiz";
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;
    const subject = `AMG Training Report — ${founder} — ${date.toLocaleDateString()}`;

    const scorecard = {
      founder,
      date,
      mode: normalizedMode,
      score,
      total,
      percent,
      xp,
      categories,
      missedTerms,
    };
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
