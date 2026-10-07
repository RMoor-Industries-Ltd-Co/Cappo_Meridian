/**
 * Data-source IDs for the AMG Partner Hub Notion wiki.
 * See `docs/notion-schema.md` for the full schema. Notion API 2025-09-03 queries
 * and relations use the data-source id (not the database id).
 */
export const AMG_HUB_PAGE = "c433a327db39459ab7325913a8fc9b37";

/**
 * The HVN Lexicon page — single page of toggle blocks, one per term. Superseded as the
 * training-corpus ingestion source by `NOTION_DS.lexicon` (the Lexicon Official Database) as
 * of the Conversation Corpus Integration's follow-up reconciliation — see
 * "Lexicon Official Database" in the AMG Partner Hub, whose callout names
 * `HVN_LEXICON_TEXT_REFERENCE` as the terminology authority and this page as "secondary
 * visual companion only." Kept here only as a historical reference; nothing reads it anymore.
 */
export const HVN_LEXICON_PAGE = "35ae4a150469806bacf3d520191e555d";

/** The HVN Lexicon - Text Reference page — the terminology authority (Meaning/Use/Plain Meaning/Example). Read-only reference; not queried directly by the sync (see NOTION_DS.lexicon). */
export const HVN_LEXICON_TEXT_REFERENCE_PAGE = "3d5e4a150469800a9215ceb95e916e00";

export const NOTION_DS = {
  bu: "f9142501-d297-4a98-85cc-abb18cbc6f68",
  domains: "dbef653f-0da4-4155-afe2-f85462fc5254",
  capture: "d934f89f-09e6-4358-8b69-42fc185fcda6",
  catalog: "c60f6845-4623-4180-88d3-5f429f101275",
  glossary: "a73b64fb-3c7a-42c3-94fa-6f7fa2cf4db5",
  documents: "b51c1074-ebb3-49df-8c04-b1fcc64d7ba8",
  decisions: "3e93ee35-65cd-4e51-bd0d-8ee4cb5bc388",
  actions: "0fa2bf9a-405f-4853-ad29-8cdf135429da",
  meetings: "13b15cab-6c7c-4738-bd3f-6bb50ec228b1",
  /** Lexicon Official Database — the operational training corpus (Conversation Corpus Integration follow-up). */
  lexicon: "3eae4a15-0469-80b1-b702-000b0b4160bb",
} as const;
