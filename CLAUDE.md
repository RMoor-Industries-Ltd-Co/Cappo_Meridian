# CLAUDE.md

Guidance for Claude (and humans) working in this repo. Read this first.

> **Cross-project contracts and architecture** live in [`rmg-piaar-system`](https://github.com/RMoor-Industries-Ltd-Co/rmg-piaar-system). Read that first for the full system picture — it governs standing rules and cross-repo decisions for the whole PIAAR ecosystem.

## Project

**Cappo_Meridian** — the project-management hub for **Apex Meridian Group (AMG)**.
A single Next.js (App Router) + TypeScript app that unifies the team's tooling —
**ClickUp**, **Notion**, **Google Drive**, **Gmail**, and **AI (Claude)** — behind one
dashboard. Deployed to the `cappo.` subdomain of the AMG domain.

See [`README.md`](README.md) for architecture, modules, and the connector model.

## Commands

```bash
pnpm install        # install deps
pnpm dev            # dev server → http://localhost:3000
pnpm build          # production build
pnpm lint           # eslint
npx tsc --noEmit    # type-check (no emit)
```

Package manager: **pnpm** (see `packageManager` in `package.json`). Node 22+.

## Git

- Active development branch: `claude/focused-johnson-8Jxdc`.
- Never push to `main` without explicit permission.
- Never commit secrets (see below). `.gitignore` blocks every `.env*` except `.env.example`.

## Secrets & source of truth

**The authoritative list of every variable name lives in [`.env.example`](.env.example).**
That file is the contract; it contains names + docs only, never real values.

Where the real values live:

| Context | Canonical store | Notes |
|---|---|---|
| **Local dev (the working laptop)** | `.env.local` in repo root | Gitignored. Disk-encrypted + fingerprint-secured machine. Create with `cp .env.example .env.local` and fill in. This is the human "always nearby" copy. |
| **Cloud / web sessions** | Environment variables configured on the Claude Code web **environment** | Persist across sessions, injected into the container, never in git. This is what Claude reads from in remote sessions (a laptop `.env.local` is NOT visible to the cloud container). |
| **Production** | The deployment host's environment (see `docker-compose.yml` / host secrets) | Not a synced file. |
| **Team backup / sharing** | Shared password-manager vault | Source of truth between partners; the place to recover or rotate from. |

Rules:
- **Never paste real secret values into chat or any committed file** — transcripts and git history are not secret stores.
- If a key may have leaked, **rotate it** (one click for the Anthropic key in the Console).
- The app reads all secrets from `process.env` (validated in [`src/lib/env.ts`](src/lib/env.ts)).
  Everything is optional — the dashboard shows each connector's configured/connected state.

### AI / Claude billing model

The AI module uses the **Anthropic API** (per-token, `ANTHROPIC_API_KEY`), **not** a
Claude.ai Pro/Max subscription — those are separate products and a subscription cannot
back an embedded app. One **shared AMG API key** (its own org/billing, separate from
personal Claude.ai accounts) powers AI for all dashboard users; partners do not each
need an AI account. Model: `claude-opus-4-8` (see [`src/lib/ai.ts`](src/lib/ai.ts)).

## Multi-partner access

- **Every logged-in partner gets an identical interface.** The dashboard has no
  per-user personalization or role-based UI branching — whoever authenticates
  (any account on `GOOGLE_WORKSPACE_DOMAIN`, or a `PARTNER_EMAILS` addition)
  sees the same modules, the same data, the same layout as anyone else. Don't
  introduce per-user customization without discussing it first — it breaks
  this expectation.
- **Gmail/Drive is one shared connection, not per-user.** `getAuthorizedClient()`
  (`lib/connectors/google.ts`) stores a single token row (`TOKEN_ID = "shared"`)
  — whichever partner completes the OAuth flow in Settings → Integrations
  connects Gmail/Drive for the whole team, independent of who's currently
  logged into the dashboard.
- **Following a Gmail link requires the matching Google session in the
  browser.** Links that open Gmail directly (e.g. a message permalink) only
  resolve if the browser is currently logged into the same Google account the
  link points at. If a partner's browser is signed into a personal Gmail
  account instead of the connected workspace account, the link lands in the
  wrong inbox or fails — expected Google behavior, not a bug. Sign into the
  correct Google account in that browser (or use a separate profile/incognito
  window) before following such links.

## Data placement conventions

Each tool has one job. Put data where it belongs:

- **Google Drive** = archive / storage / memory. **All files, images, and documents
  live here.**
- **Notion** = the company wiki + structured databases. Notion should hold **links to
  Drive files, not embeds/uploads.** Prefer many small, related databases over long
  free-form pages. Archive existing embeds in favor of Drive links unless keeping an
  embed is clearly more operationally useful.
- **ClickUp** = project management: tasks, statuses, swim lanes — the "what are we
  working on right now" layer.

## Lexicon sync (Notion → Cappo)

The HVN Lexicon Notion page is the source of truth for terms. `lib/lexiconSync.ts`
pulls it via `lib/connectors/lexicon.ts` and upserts into the Postgres `lexicon_terms`
table (keyed by Notion block id); the Lexicon page and Training quiz read from that
table (falling back to the static list in `lib/lexicon-data.ts` if the DB is empty or
unconfigured, e.g. local dev).

- **Daily automatic sync**: `lib/lexiconScheduler.ts`, started once per server
  instance from `instrumentation.ts`. This is a single-container deploy with no
  separate worker — it's an in-process check every hour that only actually syncs
  once ≥24h have passed since the last run (tracked in `lexicon_sync_runs`), so it
  survives restarts without duplicating work or needing a cron container.
- **Manual/on-demand sync**: `POST /api/lexicon/sync` with header `x-agent-key:
  $AGENT_API_KEY` (same auth pattern as `/api/agent`) — useful right after adding
  terms in Notion instead of waiting for the next scheduled pass.
- The "Add a Term" panel on the Training start screen already writes new
  submissions *to* Notion (`/api/training/suggest`) — combined with this sync, a
  submitted term round-trips into the Lexicon view/quiz on the next daily pass.

## Cappo executive report (pull-ready for ALLIE)

`lib/cappoReportScheduler.ts`, started from `instrumentation.ts` alongside the lexicon sync —
same in-process hourly-check pattern (state tracked in Postgres' `cappo_reports`, survives
restarts), but regenerates every ≥6h instead of ≥24h. Each run calls `runCappoAgent()` with a
fixed executive-status prompt and caches the result.

- **Pull the cached report**: `GET /api/agent/report` with header `x-agent-key:
  $AGENT_API_KEY` (same auth as `POST /api/agent`) — returns instantly, never triggers a live
  agent call. This is what ALLIE (`rmg-ai`'s `tools_cappo.py`) reads instead of delegating live
  work just to check AMG's status.
- Distinct from `POST /api/agent`, which stays for live, on-demand task delegation.

## Vale (HVN Havenry's concierge) — read access for HVN<->AMG coordination

Cappo can pull Vale's cached HVN showroom activity report directly (`vale_get_report` tool,
`src/lib/agent.ts`) — `GET`-ing hvnhavenry-com's `/api/agent/report` with `VALE_AGENT_KEY`
(Vale's own M2M secret, distinct from Cappo's `AGENT_API_KEY`). Aggregate showroom-interest
data only (interaction counts by prompt type, top-asked-about products) — never a specific
visitor's conversation. Available in both the ALLIE-delegation tool loop and the dashboard
chat.

## Chain of command (both system prompts state this explicitly)

Rahm → ALLEN (Chief of Staff, `rmg-ai`) → ALLIE (ALLEN's Director of Operations, runs
RMG/RMI) → Cappo (AMG's operations engine, one tier under ALLIE). Both `SYSTEM` (the
ALLIE-delegation path) and `SYSTEM_DASH` (the dashboard chat Rahm talks to directly) share
this via the `_CHAIN_OF_COMMAND` constant in `src/lib/agent.ts` — Cappo previously only
named ALLIE once in passing and never mentioned ALLEN at all, so he couldn't correctly
answer "who do you report to."

## GrantOps approval automation (native — Google Drive + ClickUp)

When a grant is **CAPPO-approved** (`cappoDecisionAction` → `approved_to_apply`,
`src/lib/grantops/actions.ts`), Cappo auto-scaffolds the application instead of leaving
it to manual setup. All three steps run natively in the approval server action — no
external automation platform:

1. **Auto-opens the application workspace** (`createApplication`) so the internal
   checklist (derived from `requiredDocuments`) exists immediately.
2. **Creates ClickUp deadline tasks** (`createDeadlineTasksForApplication`,
   `src/lib/grantops/automation.ts`) — one `Submit:` task due on the deadline plus a
   `Gather:` task per required document, tagged `grantops`, via `clickupCreateTask`.
3. **Creates the Google Drive workspace** (`createDriveWorkspace`) using the shared
   Google connection (`src/lib/connectors/driveFs.ts`): `driveEnsureFolder`
   (search-or-create under `GRANTOPS_DRIVE_PARENT_FOLDER_ID`) + a blank Google Doc per
   draft section via `driveCreateDoc`, then links the folder's `webViewLink` onto the
   application (`driveFolderUrl`) synchronously — no callback needed.

### Entity knowledge sources (Drive)
Each entity's context comes from a Drive folder Cappo reads via `readEntityKnowledge`
(`src/lib/grantops/knowledge.ts`). The folder resolves in priority order: the entity's
own `knowledgeFolderId` (set on the Entities page, "Drive knowledge folder" field) →
the `GRANTOPS_ENTITY_FOLDERS` env map (`{"RMI":"<folderId>"}`, durable across redeploys)
→ else an auto-created `{code} — {name}` subfolder under `GRANTOPS_KNOWLEDGE_FOLDER_ID`.
This lets e.g. RMI point at its existing shared **RECORDS BOOK** folder. `driveExportText`
(`connectors/driveFs.ts`) reads Google Docs, text, **and Word/PDF** (`.docx`/`.doc`/`.pdf`
are converted via a throwaway Google Doc copy — dependency-free). The connected account
(amg@) needs access to the folder — Editor for the Word/PDF conversion to work.

Everything is **best-effort**: any integration being unconfigured or down never blocks
the approval (a not-connected Drive logs + no-ops). An `automationFiredAt` guard prevents
a re-approval from double-scaffolding; `driveEnsureFolder` is idempotent, and the Drive
folder + ClickUp tasks are the durable records (Cappo's store is in-memory by design —
see `grantops/store.ts:11`). `GRANTOPS_DRIVE_PARENT_FOLDER_ID` unset → folders land in
My Drive root. Requires Cappo's Google connector to be connected (Settings → Integrations).

> This was briefly built as a Make.com webhook + callback; we reverted to native because
> Cappo already owns every Drive/ClickUp primitive, making it simpler, synchronous, and
> free of webhook/callback fragility.

## PIAAR initiatives — Cappo's one permitted GitHub write

`add_initiative` (`src/lib/agent.ts` + `src/lib/githubApp.ts`) appends a new row to
`rmg-piaar-system`'s `docs/INITIATIVES.md` registry — the cross-project tracked-work list.
This is the **only** file Cappo can write to; there is no general GitHub write capability
here. Uses the same `allen-piaar-control-bot` GitHub App identity `rmg-ai`'s ALLEN already
uses (RS256 JWT → installation access token, built with `node:crypto`, no `jsonwebtoken`
dependency) — the restriction to `INITIATIVES.md` is enforced at the tool layer, mirroring
`rmg-ai`'s own `tools_github.py` (`CONTENTS_WRITE_REPOS` allowlist), since the App itself is
shared org-wide. Requires `GITHUB_APP_ID`/`GITHUB_APP_INSTALLATION_ID`/`GITHUB_APP_PRIVATE_KEY`
copied from `allen-i-verse`'s Doppler project — see `.env.example`.
