import { Client } from "@notionhq/client";
import { env } from "@/lib/env";
import { HVN_LEXICON_OFFICIAL_DS } from "@/lib/notionSchema";

export interface LexiconTerm {
  id: string;
  name: string;
  category: string;
  meaning: string;
  use: string;
  plainMeaning: string;
  example: string;
}

type RichTextToken = { plain_text: string };
type NProp = {
  type?: string;
  title?: RichTextToken[];
  rich_text?: RichTextToken[];
  select?: { name: string } | null;
  status?: { name: string } | null;
  multi_select?: { name: string }[];
};
type NRow = {
  id: string;
  properties: Record<string, NProp>;
};

let client: Client | null = null;
function getClient(): Client {
  if (!env.NOTION_API_KEY) throw new Error("NOTION_API_KEY not set");
  if (!client) client = new Client({ auth: env.NOTION_API_KEY });
  return client;
}

type QueryArgs = Parameters<Client["dataSources"]["query"]>[0];

/** Fetch all rows from a data source, handling Notion cursor pagination. */
async function listAllRows(dataSourceId: string): Promise<NRow[]> {
  const results: NRow[] = [];
  let cursor: string | undefined;
  do {
    const res = await getClient().dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    } as QueryArgs);
    results.push(...(res.results as unknown as NRow[]));
    cursor = res.next_cursor ?? undefined;
  } while (cursor);
  return results;
}

const joinRt = (rt: RichTextToken[]) => rt.map((t) => t.plain_text).join("").trim();

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

function propByName(row: NRow, names: string[]): NProp | undefined {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  for (const [key, value] of Object.entries(row.properties)) {
    const normalized = key.toLowerCase().replace(/[_-]/g, " ").trim();
    if (wanted.has(normalized)) return value;
  }
  return undefined;
}

function titleAny(row: NRow, names: string[]): string {
  const named = propByName(row, names);
  if (named?.title) return joinRt(named.title);
  const firstTitle = Object.values(row.properties).find((p) => p.type === "title" && p.title);
  return firstTitle?.title ? joinRt(firstTitle.title) : "";
}

function textAny(row: NRow, names: string[]): string {
  const prop = propByName(row, names);
  if (!prop) return "";
  if (prop.rich_text) return joinRt(prop.rich_text);
  if (prop.title) return joinRt(prop.title);
  if (prop.select?.name) return prop.select.name;
  if (prop.status?.name) return prop.status.name;
  if (prop.multi_select?.length) return prop.multi_select.map((v) => v.name).join(", ");
  return "";
}

function statusOf(row: NRow): string {
  return textAny(row, ["status", "approval status", "term status"]).toLowerCase();
}

/** Fetch and parse all terms from the official HVN Lexicon Notion database. */
export async function getLexiconTerms(): Promise<LexiconTerm[]> {
  const rows = await listAllRows(HVN_LEXICON_OFFICIAL_DS);
  return rows
    .map((row) => {
      const name = titleAny(row, ["name", "term", "lexicon term"]).trim();
      if (!name || SKIP_TERMS.has(name.toLowerCase())) return null;
      const status = statusOf(row);
      if (status.includes("superseded") || status.includes("rejected")) return null;
      const category = textAny(row, ["category", "type", "domain"]) || categorize(name);
      const meaning = textAny(row, ["meaning", "definition", "formal definition", "description"]);
      const use = textAny(row, ["use", "usage", "use case", "when to use"]);
      const plainMeaning = textAny(row, ["plain meaning", "plain", "plain english", "simple meaning"]);
      const example = textAny(row, ["example", "example sentence", "sample use"]);
      return {
        id: row.id,
        name,
        category,
        meaning,
        use,
        plainMeaning,
        example,
      } satisfies LexiconTerm;
    })
    .filter((term): term is LexiconTerm => Boolean(term))
    .sort((a, b) => a.name.localeCompare(b.name));
}
