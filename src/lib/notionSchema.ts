/**
 * Data-source IDs for the AMG Partner Hub Notion wiki.
 * See `docs/notion-schema.md` for the full schema. Notion API 2025-09-03 queries
 * and relations use the data-source id (not the database id).
 */
export const AMG_HUB_PAGE = "c433a327db39459ab7325913a8fc9b37";

/**
 * Legacy HVN Lexicon page — a single page of toggle blocks.
 * Retained only for provenance; quiz/training should use the Official Database below.
 */
export const HVN_LEXICON_PAGE = "35ae4a150469806bacf3d520191e555d";

/**
 * Lexicon Official Database — canonical operational source for quiz/training.
 * Recorded by AMGPx as page 3eae4a150469804fa16ef3d115ec9ed2 and collection/data source
 * collection://3eae4a15-0469-80b1-b702-000b0b4160bb.
 */
export const HVN_LEXICON_OFFICIAL_PAGE = "3eae4a150469804fa16ef3d115ec9ed2";
export const HVN_LEXICON_OFFICIAL_DS = "3eae4a15-0469-80b1-b702-000b0b4160bb";

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
} as const;
