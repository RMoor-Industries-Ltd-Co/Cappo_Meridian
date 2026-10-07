import { Client } from "@notionhq/client";
import { env } from "@/lib/env";
import { NOTION_DS } from "@/lib/notionSchema";
import {
  splitEntries,
  splitTags,
  parseCorpusStatus,
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

interface NProp {
  type?: string;
  title?: { plain_text: string }[];
  rich_text?: { plain_text: string }[];
  select?: { name: string } | null;
  multi_select?: { name: string }[];
  number?: number | null;
}
interface NRow {
  id: string;
  properties: Record<string, NProp>;
}

let client: Client | null = null;
function getClient(): Client {
  if (!env.NOTION_API_KEY) throw new Error("NOTION_API_KEY not set");
  if (!client) client = new Client({ auth: env.NOTION_API_KEY });
  return client;
}

const plain = (rt?: { plain_text: string }[]) => (rt ?? []).map((t) => t.plain_text).join("");
const titleOf = (r: NRow, key: string) => plain(r.properties[key]?.title).trim();
const textOf = (r: NRow, key: string) => plain(r.properties[key]?.rich_text).trim();
const selectOf = (r: NRow, key: string) => r.properties[key]?.select?.name ?? null;
const multiSelectOf = (r: NRow, key: string) => (r.properties[key]?.multi_select ?? []).map((o) => o.name);
const numberOf = (r: NRow, key: string) => r.properties[key]?.number ?? null;

/** Fetch every row of a Notion data source, handling cursor pagination. */
async function queryAllRows(dataSourceId: string): Promise<NRow[]> {
  const results: NRow[] = [];
  let cursor: string | undefined;
  do {
    const res = await getClient().dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    } as Parameters<Client["dataSources"]["query"]>[0]);
    results.push(...(res.results as unknown as NRow[]));
    cursor = res.next_cursor ?? undefined;
  } while (cursor);
  return results;
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

/**
 * Fetch and parse all terms from the Lexicon Official Database (Conversation Corpus
 * Integration follow-up directive — "the Text Reference remains terminology authority,
 * but the Lexicon Official Database is the operational training corpus"). Reads the
 * database's own properties directly rather than parsing bullet text, since this source
 * is a real Notion database (unlike the legacy HVN_LEXICON_PAGE toggle-block page it
 * replaces). The database is kept reconciled against the Text Reference by a separate,
 * manual content-authoring pass — this function only ingests what's currently there.
 */
export async function getLexiconTerms(): Promise<LexiconTerm[]> {
  const rows = await queryAllRows(NOTION_DS.lexicon);

  const terms: LexiconTerm[] = [];
  for (const row of rows) {
    const name = titleOf(row, "Name");
    if (!name || SKIP_TERMS.has(name.toLowerCase())) continue;

    terms.push({
      id: row.id,
      name,
      category: categorize(name),
      meaning: textOf(row, "Meaning"),
      use: textOf(row, "Use"),
      plainMeaning: textOf(row, "Plain Meaning"),
      example: textOf(row, "Example"),
      trainingSentences: splitEntries(textOf(row, "Training Sentences")),
      professionalScenarios: splitTags(textOf(row, "Professional Scenarios")),
      transitionPhrases: splitEntries(textOf(row, "Transition Phrases")),
      revealGuidance: textOf(row, "Reveal Guidance") || null,
      wordBankDistractors: splitTags(textOf(row, "Word Bank Distractors")),
      trainingAudiences: multiSelectOf(row, "Training Audiences") as TrainingAudience[],
      trainingDifficulty: numberOf(row, "Training Difficulty"),
      corpusStatus: parseCorpusStatus(selectOf(row, "Corpus Status")),
    });
  }

  return terms.sort((a, b) => a.name.localeCompare(b.name));
}
