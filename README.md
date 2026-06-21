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
2. Add `http://localhost:3000/api/connectors/google/callback` as an Authorized
   redirect URI (and the production `https://cappo.…/api/connectors/google/callback`).
3. Enable the **Google Drive API** and **Gmail API** for the project.
4. Set the three `GOOGLE_*` vars, run `pnpm dev`, and click **Connect Google** on a
   Drive/Gmail card.

> **Token storage.** When `DATABASE_URL` is set, OAuth tokens are persisted in
> Postgres (`google_tokens` table), encrypted at rest with AES-256-GCM via
> `SECRET_ENCRYPTION_KEY`. With no database (local dev) they fall back to a
> gitignored `.google-tokens.json` file. See
> [`src/lib/connectors/google.ts`](src/lib/connectors/google.ts).

## API

| Route                     | Description                                  |
| ------------------------- | -------------------------------------------- |
| `GET /api/health`         | Liveness probe                               |
| `GET /api/connectors/status` | Health of all four connectors             |
| `GET /api/feed`           | Merged recent activity across connectors     |
| `GET /api/auth/google`    | Start Google OAuth consent                    |
| `GET /api/auth/google/callback` | OAuth redirect target                   |

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
- [x] Persist Google OAuth tokens in Postgres, encrypted at rest (shared
      account; per-user rows are a future extension).
- [ ] Wire each module's KPIs to live connector data (quarter-scoped).
- [ ] Map ClickUp quarter folders/lists to the Overview quarter selector.
- [ ] Write operations (create ClickUp tasks, Notion pages, send Gmail).
- [ ] Background sync + webhooks instead of on-request fetching.
- [ ] Cross-tool project view (link a ClickUp task ↔ Notion doc ↔ Drive folder).
