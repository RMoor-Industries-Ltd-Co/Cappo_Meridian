# Notion workspace schema — AMG Partner Hub

The AMG wiki lives in Notion under the **AMG Partner Hub** page
(`c433a327db39459ab7325913a8fc9b37`). It is organized as interrelated databases on
**two tagging axes**, so any record can be sliced by either:

- **Business Unit / Brand** — the ownership hierarchy (`AMG → HVN Global LLC → HVN Store`,
  plus future brands/IP). Self-relating, so new brands are one new row, no restructuring.
- **Domain** — the dashboard's function modules (Marketing, Sales, Inventory, Affiliates,
  Budget, Operations, Legal, Research). Constant company-wide.

The Cappo dashboard mirrors this: **modules = Domains**, **entity/brand filter = Business
Units & Brands**.

## Database IDs

Notion API `2025-09-03` (data-source model): the **data source id** (`ds`) is what you
query and what relations reference; the **database id** (`db`) identifies the container.

| Database | Role | database_id | data_source_id |
|---|---|---|---|
| Business Units & Brands | Spine — ownership tree (self-relation `Parent`) | `2c267bc5-dd95-4dd7-9b0c-63e4c96720d2` | `f9142501-d297-4a98-85cc-abb18cbc6f68` |
| Domains | Spine — function modules | `b0871ef9-f7ef-4e4e-ab14-d196aa7e5d71` | `dbef653f-0da4-4155-afe2-f85462fc5254` |
| Capture / Ideas | Intake inbox (entry-form button target) | `f94b60b3-1ff3-4c42-965b-bb4869a91e7a` | `d934f89f-09e6-4358-8b69-42fc185fcda6` |
| Product Catalog | SKU/item level (home for HVN brainstorm) | `4ee232b0-a965-4608-84f8-cc9573ed858a` | `c60f6845-4623-4180-88d3-5f429f101275` |
| Glossary / Lingo | Terminology / brand language | `9f045222-95d9-4fd5-8e7d-16f3692cb126` | `a73b64fb-3c7a-42c3-94fa-6f7fa2cf4db5` |
| Documents | Drive links only (files live in Drive) | `07a72f10-0097-409e-8581-63cd5a1f12a1` | `b51c1074-ebb3-49df-8c04-b1fcc64d7ba8` |
| Decisions Log | Partner decisions | `6a74a49e-1e72-48f8-a2a7-885c0f138e33` | `3e93ee35-65cd-4e51-bd0d-8ee4cb5bc388` |
| Action Register | Partner action items (links to ClickUp) | `d5ec31f9-bd14-4d1d-96d3-1d2feec6baba` | `0fa2bf9a-405f-4853-ad29-8cdf135429da` |
| Meeting Notes | One index for Fathom / Gemini / ClickUp / Notion notes | `a949c287-7131-4068-916e-cfaed08be949` | `13b15cab-6c7c-4738-bd3f-6bb50ec228b1` |

Each content database carries `Brand` (relation → Business Units & Brands) and `Domain`
(relation → Domains).

## Meeting Notes — single index across tools

`Meeting Notes` has `Source` (Fathom / Gemini / ClickUp / Notion / Other), `Source Link`
(deep link back to the original), and `Summary` (notes shown in-dashboard). The dashboard
reads this database so partners see every meeting's notes in one place while the source
link still jumps to the original recording/transcript. Auto-pulling summaries from each
tool's API (Fathom, ClickUp) or Drive (Gemini notes Docs) is a fast-follow.
