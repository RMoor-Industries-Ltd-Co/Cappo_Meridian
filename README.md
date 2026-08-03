# Cappo_Meridian

Project management hub for **Apex Meridian Group**.
A single full-stack app that unifies the team's tooling — **ClickUp**, **Notion**,
**Google Drive**, and **Gmail** — behind one dashboard and a common API.
Deployed to the `cappo.` subdomain of the AMG domain.

- **Web app + backend** in one Next.js (App Router) project, TypeScript throughout.
- **Modular SPA shell** — an icon rail navigates ten business-function modules with
  client-side transitions, so it feels like a single-page app across many pages.
- **Connector layer** — each service is an isolated, swappable module implementing
  a shared `Connector` interface.
- **Unified model** — native objects (tasks, pages, files, messages) are normalized
  into `UnifiedItem`s so the UI treats every source the same way.

## Design

Dark, premium surface with a molten **"poured gold"** accent — AMG brand gold
cascades from the top of the canvas like liquid metal (`.gold-pour` /
`.amg-canvas` in [`globals.css`](src/app/globals.css)). Theme tokens (surfaces,
gold ramp, status colors) are defined as CSS variables and exposed to Tailwind v4
via `@theme`.

## Modules

The icon rail exposes ten business-operation functions:

`Overview · Marketing · Sales · Research · Inventory · Affiliates · Budget · Operations · Legal · Messages`

- **Overview** — company pulse from the AMG ClickUp space, with a **quarter
  selector** (Company / Q1–Q4). Defaults to the current quarter and shows a
  "quarter ends in N days" hint as the next quarter approaches.
- **Research** — an AI research workspace (Claude-powered, on the roadmap) with a
  collapsible side rail that tracks project folders, files, and Claude responses.
- **Meetings** — meeting intelligence. Ingests transcripts from Gemini, Fathom,
  Notion, and ClickUp (all discovered through their notification emails),
  distills them into a living registry of current and future initiatives, and
  composes the daily board digest. See below.
- **Messages** — unified inbox from the Gmail connector.
- **Settings** — integration status + Google OAuth connect.
- The remaining modules are styled scaffolds wired to fill in from the connectors.

## Stack

| Concern        | Choice                                  |
| -------------- | --------------------------------------- |
| Framework      | Next.js 16 (App Router) + React 19      |
| Language       | TypeScript                              |
| Styling        | Tailwind CSS v4                         |
| Config/schema  | Zod                                     |
| Integrations   | ClickUp REST, `@notionhq/client`, `googleapis` |

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in the credentials you have
pnpm dev                     # http://localhost:3000
```

The dashboard boots with **zero** credentials — each connector card shows whether
it's configured, connected, or needs action.

## Configuration

See [`.env.example`](.env.example) for the full list. All credentials are optional.

| Connector | Env var(s)                                              | Where to get it |
| --------- | ------------------------------------------------------- | --------------- |
| ClickUp   | `CLICKUP_API_TOKEN`, `CLICKUP_TEAM_ID` (opt)            | ClickUp → Settings → Apps → API Token |
| Notion    | `NOTION_API_KEY`                                        | https://www.notion.so/my-integrations (share pages with the integration) |
| Drive+Gmail | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google Cloud Console → OAuth 2.0 Client (Web) |

### Google OAuth setup

1. In Google Cloud Console, create an **OAuth 2.0 Client ID** (type: *Web application*).
2. Add `http://localhost:3000/api/auth/google/callback` as an Authorized redirect URI.
3. Enable the **Google Drive API** and **Gmail API** for the project.
4. Set the three `GOOGLE_*` vars, run `pnpm dev`, and click **Connect Google** on a
   Drive/Gmail card.

> **Token storage is dev-only.** Tokens are written to `.google-tokens.json`
> (gitignored). For production, replace `loadTokens`/`saveTokens` in
> [`src/lib/connectors/google.ts`](src/lib/connectors/google.ts) with a real,
> encrypted, per-user datastore.

## API

| Route                     | Description                                  |
| ------------------------- | -------------------------------------------- |
| `GET /api/health`         | Liveness probe                               |
| `GET /api/connectors/status` | Health of all four connectors             |
| `GET /api/feed`           | Merged recent activity across connectors     |
| `GET /api/auth/google`    | Start Google OAuth consent                    |
| `GET /api/auth/google/callback` | OAuth redirect target                   |
| `POST /api/meetings/sync` | Ingest new transcripts, then analyze them    |
| `POST /api/meetings/digest` | Compose the board digest (`{preview:true}` to not send) |

Both meeting routes accept either a signed-in session or the `x-agent-key`
header (`AGENT_API_KEY`), which is how a scheduled caller drives them.

## Meeting intelligence

AMG records meetings across four transcription services and none of them share a
store. The one signal common to all is a notification email, so every source is
discovered through Gmail and then followed to wherever the transcript actually
lives — a Drive Doc for Gemini, the message body for the rest.

```
Gmail notifications ─→ ingest ─→ meetings + meeting_transcripts
                                          │
                                    analyze (Claude)
                                          │
                          initiatives + initiative_mentions
                                          │
                              digest ─→ Gmail ─→ board@
```

Three properties are worth knowing:

**The registry evolves, it doesn't accumulate.** Each transcript is analyzed
against the *existing* registry (compacted to slug + title + one-line summary),
and the model emits reconciliation operations — create / update / close — rather
than a fresh list of what it saw. One programme discussed in six meetings ends up
as one initiative with six mentions.

**Every claim is traceable.** Each operation carries a verbatim excerpt, stored
as an `initiative_mentions` row against the meeting that produced it. The
`/meetings` page shows this audit trail inline.

**Context is hierarchical, not cumulative.** The digest reads open initiatives +
the last 7 days of meeting briefs + the current quarter's rollup. Re-summarizing
every transcript daily would not survive the first quarter.

Ingestion is idempotent (`UNIQUE (source, source_ref)`), and the digest is
idempotent per calendar day (`UNIQUE (sent_for)`) — so a retry, or a double cron
firing, cannot mail the board twice.

### Scheduling

Not wired up by default: `DIGEST_ENABLED` gates the scheduled sender, and the
intended rollout is to send by hand from the `/meetings` page for several days
first. Once the output is trusted, add to the host's crontab:

```cron
20 6 * * *  curl -fsS -X POST -H "x-agent-key: $AGENT_API_KEY" https://cappo.apex-meridian-group.com/api/meetings/sync
40 6 * * *  curl -fsS -X POST -H "x-agent-key: $AGENT_API_KEY" https://cappo.apex-meridian-group.com/api/meetings/digest
```

## Project structure

```
src/
  app/
    layout.tsx               # root: fonts + dark canvas
    globals.css              # theme tokens + poured-gold treatment
    (dash)/                  # dashboard shell (sidebar + topbar)
      layout.tsx
      page.tsx               # Overview (ClickUp + quarter selector)
      research/              # AI research workspace (collapsible rail)
      messages/              # unified inbox
      settings/              # integrations + Google OAuth
      marketing/ sales/ inventory/ affiliates/ budget/ operations/ legal/
    api/
      health/                # liveness
      connectors/status/     # connector health
      feed/                  # unified activity feed
      auth/google/           # OAuth start + callback
  components/
    brand/Starburst.tsx      # AMG golden mark
    shell/                   # Sidebar, Topbar, PlaceholderPage
    ui/                      # Card, Kpi, Sparkline
    overview/QuarterTabs.tsx
  lib/
    env.ts                   # zod-validated config
    types.ts                 # ConnectorStatus, UnifiedItem domain model
    nav.ts                   # the ten modules
    quarters.ts              # fiscal-quarter helpers
    connectors/
      connector.ts           # Connector interface
      clickup.ts notion.ts drive.ts gmail.ts
      google.ts              # shared OAuth client + token store
      index.ts               # registry + aggregate helpers
```

## Adding a connector

1. Implement the `Connector` interface from `src/lib/connectors/connector.ts`.
2. Map the service's objects into `UnifiedItem` in `listRecent`.
3. Register it in `src/lib/connectors/index.ts`.

## Roadmap

**AI research (Research module)**
- [ ] OAuth sign-in so both partners can log in from separate computers, backed by
      a **shared AMG Claude account** kept separate from personal accounts.
- [ ] In-app Claude research interface (chat + file upload) on the Research page.
- [ ] Persist project folders, files, and Claude responses; render them in the
      collapsible side rail.

**Platform**
- [ ] Dashboard auth/session (Google Workspace OAuth, gated to the AMG domain).
- [ ] Persist OAuth tokens + connector config per user (Postgres, encrypted).
- [ ] Wire each module's KPIs to live connector data (quarter-scoped).
- [ ] Map ClickUp quarter folders/lists to the Overview quarter selector.
- [ ] Write operations (create ClickUp tasks, Notion pages, send Gmail).
- [ ] Background sync + webhooks instead of on-request fetching.
- [ ] Cross-tool project view (link a ClickUp task ↔ Notion doc ↔ Drive folder).
