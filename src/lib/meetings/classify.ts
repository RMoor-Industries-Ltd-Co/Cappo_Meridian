import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { CATEGORIES, FALLBACK_CATEGORY, resolveCategory } from "./naming";

/**
 * Extract the facts the archive's filename depends on, before analysis runs.
 *
 * WHY THIS EXISTS. The naming convention needs a category, a start time, and an
 * end time at the moment a transcript is filed — but none of those are reliably
 * available from the notification email:
 *
 *   - The email's timestamp is when the NOTIFICATION arrived, which can be
 *     minutes to hours after the meeting ended. Naming files from it would be
 *     wrong, consistently and invisibly.
 *   - The category is a judgement about content.
 *   - Attendees appear inside the transcript, not in the headers.
 *
 * So a single cheap pass reads the head of the transcript and returns all of
 * them. This is deliberately NOT the analysis step: it extracts stated facts and
 * assigns one label, nothing more.
 *
 * Everything degrades: with no API key, or on any failure, the caller gets an
 * honest fallback (notification time, unknown duration, GENERAL) rather than an
 * invented one.
 */

const EXTRACT_MODEL = "claude-haiku-4-5-20251001";
/** The head of a transcript carries the date line, attendee list, and agenda. */
const HEAD_CHARS = 6_000;

export interface MeetingMeta {
  category: string;
  title: string;
  /** ISO instant the meeting STARTED, or null when the transcript doesn't say. */
  startISO: string | null;
  /** ISO instant it ENDED, or null when unstated. */
  endISO: string | null;
  attendees: string[];
}

function getAnthropic(): Anthropic | null {
  const key = env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY;
  return key ? new Anthropic({ apiKey: key }) : null;
}

const TOOL = {
  name: "record_meeting_meta",
  description: "Record the meeting's category, title, times, and attendees as stated in the transcript.",
  input_schema: {
    type: "object" as const,
    properties: {
      category: {
        type: "string",
        description: `The single best-fitting category, chosen from exactly this list: ${CATEGORIES.join(", ")}. Use GENERAL when none clearly fits — do not invent a category.`,
      },
      title: {
        type: "string",
        description: "Short human title for the meeting, without service boilerplate like 'Notes from'.",
      },
      startISO: {
        type: ["string", "null"],
        description:
          "The instant the meeting STARTED, ISO 8601 with offset, ONLY if the transcript or email states a meeting date/time. Null if not stated. Never infer from when the notification was sent.",
      },
      endISO: {
        type: ["string", "null"],
        description: "The instant it ENDED, ISO 8601 with offset, only if stated or directly derivable from a stated duration. Null otherwise.",
      },
      attendees: {
        type: "array",
        items: { type: "string" },
        description: "Names or emails of people present, as stated. Empty when the transcript doesn't say.",
      },
    },
    required: ["category", "title", "startISO", "endISO", "attendees"],
  },
};

const SYSTEM = `You extract filing metadata from meeting transcripts for Apex Meridian Group's archive.

You are NOT summarizing or analyzing. You report only what the document states.

TIMES ARE THE POINT OF FAILURE. The notification email that carried this transcript was sent AFTER the meeting, so its timestamp is not the meeting time. Report startISO/endISO only when the transcript or email body actually states when the meeting took place. If it doesn't, return null. A null is correct and useful; a guess is silently wrong forever, because it becomes the filename.

CATEGORY is a closed list. Pick the best fit from the list given, or GENERAL. Never coin a new one.

ATTENDEES are those actually named as present. Do not include people merely mentioned.`;

/** Fallback used when extraction is unavailable or fails. */
function fallback(subject: string): MeetingMeta {
  return {
    category: FALLBACK_CATEGORY,
    title: subject,
    startISO: null,
    endISO: null,
    attendees: [],
  };
}

function isIso(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export async function extractMeta(
  subject: string,
  transcript: string,
  allowedCategories: readonly string[] = CATEGORIES,
): Promise<MeetingMeta> {
  const client = getAnthropic();
  if (!client) return fallback(subject);

  try {
    const res = await client.messages.create({
      model: EXTRACT_MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [
        {
          role: "user",
          content: `Email subject: ${subject}\n\nAllowed categories: ${allowedCategories.join(", ")}\n\nTranscript (head):\n${transcript.slice(0, HEAD_CHARS)}`,
        },
      ],
    });

    const block = res.content.find((c) => c.type === "tool_use");
    if (!block || block.type !== "tool_use") return fallback(subject);
    const input = block.input as Record<string, unknown>;

    const attendees = Array.isArray(input.attendees)
      ? input.attendees.filter((a): a is string => typeof a === "string" && a.trim().length > 0)
      : [];

    const startISO = isIso(input.startISO) ? input.startISO : null;
    let endISO = isIso(input.endISO) ? input.endISO : null;
    // An end before its start is a model slip, not a cross-midnight meeting —
    // the ISO instants carry the date, so a real overnight meeting still
    // compares correctly. Drop it rather than encode a negative duration.
    if (startISO && endISO && Date.parse(endISO) < Date.parse(startISO)) endISO = null;

    return {
      category: resolveCategory(typeof input.category === "string" ? input.category : null, allowedCategories),
      title: typeof input.title === "string" && input.title.trim() ? input.title.trim() : subject,
      startISO,
      endISO,
      attendees,
    };
  } catch {
    // Extraction is best-effort; a failure must not lose the transcript.
    return fallback(subject);
  }
}
