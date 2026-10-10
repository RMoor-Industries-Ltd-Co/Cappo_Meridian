/**
 * AMG Lexicon Training scorecard email — subject, plain-text fallback and branded HTML.
 * Pure string builders (the route owns auth, the logo attachment and the Gmail send) so every
 * training mode's report can be rendered and checked without sending anything.
 */
import { MASTER_PASS_PERCENT, MODES, modeLabel, type SessionMode } from "@/lib/training-quiz";

export const LOGO_CID = "amg-training-scorecard-logo";

export interface Scorecard {
  founder: string;
  date: Date;
  /** Mode key ("match" | "blank" | "quiz" | "master"); unknown values are shown as-is. */
  mode: string;
  score: number;
  total: number;
  percent: number;
  xp: number;
  categories: string[];
  missedTerms: string[];
  /** Whether the attempt cleared the mode's bar (only reported for the Master Quiz). */
  passed?: boolean;
}

export const isMaster = (mode: string) => mode === "master";

export function escapeHtml(value: string): string {
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

/** What the Mode tile's caption says under the mode name. */
function modeCaption(mode: string): string {
  if (isMaster(mode)) return "certification attempt";
  const tier = mode in MODES ? MODES[mode as SessionMode].tier.toLowerCase() : "";
  return tier ? `${tier} practice` : "lexicon practice";
}

function certificationLine(card: Scorecard): string | null {
  if (!isMaster(card.mode)) return null;
  return card.passed
    ? `Mastery threshold met (${MASTER_PASS_PERCENT}% with hearts remaining).`
    : `Mastery threshold not yet met (${MASTER_PASS_PERCENT}% with hearts remaining is required). Review the terms below and retry.`;
}

/** Single-line, header-safe subject. Non-Master modes keep the original report subject. */
export function buildSubject(card: Pick<Scorecard, "founder" | "date" | "mode">): string {
  const title = isMaster(card.mode) ? "AMG Master Quiz Certification Attempt" : "AMG Training Report";
  return `${title} — ${card.founder} — ${card.date.toLocaleDateString()}`.replace(/\s+/g, " ").trim();
}

export function buildTextScorecard(card: Scorecard): string {
  const title = isMaster(card.mode)
    ? "AMG MASTER QUIZ CERTIFICATION ATTEMPT"
    : "AMG LEXICON TRAINING SCORECARD";
  const certification = certificationLine(card);
  return [
    title,
    "================================",
    `Founder: ${card.founder}`,
    `Date: ${card.date.toLocaleString()}`,
    `Mode: ${modeLabel(card.mode)}`,
    `Score: ${card.score}/${card.total} (${card.percent}%)`,
    ...(certification ? [`Result: ${certification}`] : []),
    `XP Earned: ${card.xp}`,
    `Categories Covered: ${formatList(card.categories)}`,
    `Review Terms: ${formatList(card.missedTerms)}`,
    "",
    "Training recap: CAPPO recorded this result from the AMG lexicon training experience.",
    "Sent from Cappo Meridian · Apex Meridian Group",
  ].join("\n");
}

export function buildHtmlScorecard(card: Scorecard): string {
  const categories = formatList(card.categories);
  const missedTerms = formatList(card.missedTerms);
  const scoreColor = card.percent >= 80 ? "#18d189" : card.percent >= 60 ? "#ffd300" : "#ff7a7a";
  const master = isMaster(card.mode);
  const certification = certificationLine(card);
  const certColor = card.passed ? "#18d189" : "#ffd300";

  const eyebrow = master ? "Master Quiz Certification Attempt" : "Official Training Scorecard";
  const heading = master ? "AMG Master Quiz Certification Attempt" : "AMG Lexicon Training Recap";

  const certificationBlock = certification
    ? `
                <div style="margin:0 0 22px;padding:16px 18px;border:1px solid ${certColor};border-radius:14px;background:#15130d;">
                  <div style="font-size:13px;color:${certColor};text-transform:uppercase;letter-spacing:1.4px;font-weight:700;">${card.passed ? "Mastery Achieved" : "Not Yet Certified"}</div>
                  <p style="margin:8px 0 0;color:#ffffff;font-size:15px;line-height:1.5;">${escapeHtml(certification)}</p>
                </div>`
    : "";

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
                <div style="font-size:12px;letter-spacing:2.5px;text-transform:uppercase;color:#ffd300;font-weight:700;">${escapeHtml(eyebrow)}</div>
                <h1 style="margin:8px 0 0;font-size:28px;line-height:1.2;color:#ffffff;">${escapeHtml(heading)}</h1>
                <p style="margin:10px 0 0;color:#b9b39d;font-size:15px;line-height:1.5;">CAPPO recorded this result from the AMG lexicon training experience.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding:0 0 18px;">
                      <div style="font-size:13px;color:#b9b39d;text-transform:uppercase;letter-spacing:1.5px;">Founder</div>
                      <div style="font-size:22px;color:#ffffff;font-weight:700;">${escapeHtml(card.founder)}</div>
                    </td>
                    <td align="right" style="padding:0 0 18px;">
                      <div style="font-size:13px;color:#b9b39d;text-transform:uppercase;letter-spacing:1.5px;">Completed</div>
                      <div style="font-size:16px;color:#ffffff;">${escapeHtml(card.date.toLocaleString())}</div>
                    </td>
                  </tr>
                </table>
${certificationBlock}
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 22px;">
                  <tr>
                    <td style="width:33.3%;padding:14px;border:1px solid #302b17;border-radius:14px;background:#171510;">
                      <div style="font-size:12px;color:#b9b39d;text-transform:uppercase;letter-spacing:1.2px;">Score</div>
                      <div style="font-size:30px;color:${scoreColor};font-weight:800;">${card.percent}%</div>
                      <div style="font-size:13px;color:#f8f5e9;">${card.score}/${card.total} correct</div>
                    </td>
                    <td style="width:33.3%;padding:14px;border:1px solid #302b17;border-radius:14px;background:#171510;">
                      <div style="font-size:12px;color:#b9b39d;text-transform:uppercase;letter-spacing:1.2px;">XP Earned</div>
                      <div style="font-size:30px;color:#ffd300;font-weight:800;">${card.xp}</div>
                      <div style="font-size:13px;color:#f8f5e9;">training points</div>
                    </td>
                    <td style="width:33.3%;padding:14px;border:1px solid #302b17;border-radius:14px;background:#171510;">
                      <div style="font-size:12px;color:#b9b39d;text-transform:uppercase;letter-spacing:1.2px;">Mode</div>
                      <div style="font-size:22px;color:#ffffff;font-weight:800;">${escapeHtml(modeLabel(card.mode))}</div>
                      <div style="font-size:13px;color:#f8f5e9;">${escapeHtml(modeCaption(card.mode))}</div>
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
