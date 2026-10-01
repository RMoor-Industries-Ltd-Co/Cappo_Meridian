import { Client } from "@notionhq/client";
import { env } from "@/lib/env";
import { HVN_LEXICON_PAGE } from "@/lib/notionSchema";
import {
  splitEntries,
  splitTags,
  parseTrainingAudiences,
  parseCorpusStatus,
  parseTrainingDifficulty,
  type TrainingAudience,
  type CorpusStatus,
} from "@/lib/training/corpusText";

export interface LexiconTerm {
  id: string;
  name: string;
  category: string;
  meaning: string;
  use: string;
  plainMeaning: string;
  example: string;
  /** Training-corpus fields (Lexicon-Lingo directive §4) — enrich Conversation, never replace the definition fields above. */
  trainingSentences: string[];
  professionalScenarios: string[];
  transitionPhrases: string[];
  revealGuidance: string | null;
  wordBankDistractors: string[];
  trainingAudiences: TrainingAudience[];
  trainingDifficulty: number | null;
  corpusStatus: CorpusStatus;
}

type AnyBlock = {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
};

type RichTextToken = { plain_text: string };

let client: Client | null = null;
function getClient(): Client {
  if (!env.NOTION_API_KEY) throw new Error("NOTION_API_KEY not set");
  if (!client) client = new Client({ auth: env.NOTION_API_KEY });
  return client;
}

/** Fetch all blocks from a page, handling Notion cursor pagination. */
async function listAllBlocks(blockId: string): Promise<AnyBlock[]> {
  const results: AnyBlock[] = [];
  let cursor: string | undefined;
  do {
    const res = await getClient().blocks.children.list({
      block_id: blockId,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    results.push(...(res.results as unknown as AnyBlock[]));
    cursor = res.next_cursor ?? undefined;
  } while (cursor);
  return results;
}

const joinRt = (rt: RichTextToken[]) => rt.map((t) => t.plain_text).join("").trim();

interface ParsedBullets {
  meaning: string;
  use: string;
  plainMeaning: string;
  example: string;
  trainingSentences: string[];
  professionalScenarios: string[];
  transitionPhrases: string[];
  revealGuidance: string | null;
  wordBankDistractors: string[];
  trainingAudiences: TrainingAudience[];
  trainingDifficulty: number | null;
  corpusStatus: CorpusStatus;
}

/**
 * Field labels for the new training-corpus bullets (directive §4). Matched the same
 * way the original Meaning:/Use:/Plain Meaning:/Example: bullets already are — a
 * bullet item whose text starts with "Label:" contributes everything after the colon.
 * A field's bullet may be repeated (each occurrence appends) or hold multiple
 * newline-separated lines in one bullet (Notion shift-enter) — both are supported via
 * `splitEntries`/`splitTags`.
 */
const LIST_FIELD_LABELS: { re: RegExp; key: "trainingSentences" | "professionalScenarios" | "transitionPhrases" | "wordBankDistractors"; split: (raw: string) => string[] }[] = [
  { re: /^training sentences?:\s*/i, key: "trainingSentences", split: splitEntries },
  { re: /^professional scenarios?:\s*/i, key: "professionalScenarios", split: splitTags },
  { re: /^transition phrases?:\s*/i, key: "transitionPhrases", split: splitEntries },
  { re: /^word bank distractors?:\s*/i, key: "wordBankDistractors", split: splitTags },
];

/** Parse the bullet items inside a toggle block into term fields. */
function parseBullets(bullets: AnyBlock[]): ParsedBullets {
  let meaning = "", use = "", plainMeaning = "", example = "";
  let awaitExample = false;
  let revealGuidanceRaw: string | null = null;
  let trainingAudiencesRaw: string | null = null;
  let trainingDifficultyRaw: string | null = null;
  let corpusStatusRaw: string | null = null;
  const lists: Record<"trainingSentences" | "professionalScenarios" | "transitionPhrases" | "wordBankDistractors", string[]> = {
    trainingSentences: [],
    professionalScenarios: [],
    transitionPhrases: [],
    wordBankDistractors: [],
  };

  for (const b of bullets) {
    if (b.type !== "bulleted_list_item") continue;
    const rt = ((b.bulleted_list_item as { rich_text?: RichTextToken[] })?.rich_text ?? []);
    const text = joinRt(rt);

    if (/^meaning:/i.test(text)) { meaning = text.replace(/^meaning:\s*/i, ""); continue; }
    if (/^use:/i.test(text)) { use = text.replace(/^use:\s*/i, ""); continue; }
    if (/^plain meaning:/i.test(text)) { plainMeaning = text.replace(/^plain meaning:\s*/i, ""); continue; }
    if (/^example:?$/i.test(text)) { awaitExample = true; continue; }
    if (awaitExample && text) { example = text.replace(/^`|`$/g, "").trim(); awaitExample = false; continue; }

    if (/^reveal guidance:\s*/i.test(text)) { revealGuidanceRaw = text.replace(/^reveal guidance:\s*/i, ""); continue; }
    if (/^training audiences?:\s*/i.test(text)) { trainingAudiencesRaw = text.replace(/^training audiences?:\s*/i, ""); continue; }
    if (/^training difficulty:\s*/i.test(text)) { trainingDifficultyRaw = text.replace(/^training difficulty:\s*/i, ""); continue; }
    if (/^corpus status:\s*/i.test(text)) { corpusStatusRaw = text.replace(/^corpus status:\s*/i, ""); continue; }

    const listField = LIST_FIELD_LABELS.find(({ re }) => re.test(text));
    if (listField) {
      lists[listField.key].push(...listField.split(text.replace(listField.re, "")));
    }
  }

  return {
    meaning,
    use,
    plainMeaning,
    example,
    trainingSentences: lists.trainingSentences,
    professionalScenarios: lists.professionalScenarios,
    transitionPhrases: lists.transitionPhrases,
    revealGuidance: revealGuidanceRaw,
    wordBankDistractors: lists.wordBankDistractors,
    trainingAudiences: parseTrainingAudiences(trainingAudiencesRaw),
    trainingDifficulty: parseTrainingDifficulty(trainingDifficultyRaw),
    corpusStatus: parseCorpusStatus(corpusStatusRaw),
  };
}

const CATEGORY_RULES: [RegExp, string][] = [
  [/sanctum/i, "Sanctum"],
  [/chamber/i, "Atmos Chambers"],
  [/\banchor\b/i, "Prime Anchors"],
  [/reservoir|terrain basin/i, "Tempering Reservoirs"],
  [/ember line/i, "Ember Lines"],
  [/cachet inset|deeprest|repose cushion|stem comb|stem set|note hierarchy/i, "Product Formats"],
];

function categorize(name: string): string {
  for (const [re, cat] of CATEGORY_RULES) if (re.test(name)) return cat;
  return "Brand Language";
}

const SKIP_TERMS = new Set(["current note hierarchy"]);

/** Fetch and parse all terms from the HVN Lexicon Notion page. */
export async function getLexiconTerms(): Promise<LexiconTerm[]> {
  const topBlocks = await listAllBlocks(HVN_LEXICON_PAGE);
  const toggles = topBlocks.filter((b) => b.type === "toggle" && b.has_children);

  const BATCH = 8;
  const terms: LexiconTerm[] = [];
  for (let i = 0; i < toggles.length; i += BATCH) {
    const slice = toggles.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async (toggle) => {
        const nameRt = ((toggle.toggle as { rich_text?: RichTextToken[] })?.rich_text ?? []);
        const name = joinRt(nameRt);
        if (!name || SKIP_TERMS.has(name.toLowerCase())) return null;
        const children = await listAllBlocks(toggle.id);
        return {
          id: toggle.id,
          name,
          category: categorize(name),
          ...parseBullets(children),
        } satisfies LexiconTerm;
      }),
    );
    for (const t of results) if (t) terms.push(t);
  }

  return terms.sort((a, b) => a.name.localeCompare(b.name));
}
