import { Client } from "@notionhq/client";
import { env } from "@/lib/env";
import { HVN_LEXICON_PAGE } from "@/lib/notionSchema";

export interface LexiconTerm {
  id: string;
  name: string;
  category: string;
  meaning: string;
  use: string;
  plainMeaning: string;
  example: string;
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

/** Parse the bullet items inside a toggle block into term fields. */
function parseBullets(bullets: AnyBlock[]): {
  meaning: string;
  use: string;
  plainMeaning: string;
  example: string;
} {
  let meaning = "", use = "", plainMeaning = "", example = "";
  let awaitExample = false;
  for (const b of bullets) {
    if (b.type !== "bulleted_list_item") continue;
    const rt = ((b.bulleted_list_item as { rich_text?: RichTextToken[] })?.rich_text ?? []);
    const text = joinRt(rt);
    if (/^meaning:/i.test(text)) meaning = text.replace(/^meaning:\s*/i, "");
    else if (/^use:/i.test(text)) use = text.replace(/^use:\s*/i, "");
    else if (/^plain meaning:/i.test(text)) plainMeaning = text.replace(/^plain meaning:\s*/i, "");
    else if (/^example:?$/i.test(text)) awaitExample = true;
    else if (awaitExample && text) { example = text.replace(/^`|`$/g, "").trim(); awaitExample = false; }
  }
  return { meaning, use, plainMeaning, example };
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
