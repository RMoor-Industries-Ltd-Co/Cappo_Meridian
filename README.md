# Cappo_Meridian

Project management hub for **Apex Meridian Group** (`apex-meridian-group.com`).
A single full-stack app that unifies the team's tooling — **ClickUp**, **Notion**,
**Google Drive**, and **Gmail** — behind one dashboard and a common API.

- **Web app + backend** in one Next.js (App Router) project, TypeScript throughout.
- **Connector layer** — each service is an isolated, swappable module implementing
  a shared `Connector` interface.
- **Unified model** — native objects (tasks, pages, files, messages) are normalized
  into `UnifiedItem`s so the UI treats every source the same way.

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

## Project structure

```
src/
  app/
    page.tsx                 # dashboard (connector status + unified feed)
    api/
      health/                # liveness
      connectors/status/     # connector health
      feed/                  # unified activity feed
      auth/google/           # OAuth start + callback
  lib/
    env.ts                   # zod-validated config
    types.ts                 # ConnectorStatus, UnifiedItem domain model
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

- [ ] Persist OAuth tokens + connector config per user (Postgres, encrypted).
- [ ] Write operations (create ClickUp tasks, Notion pages, send Gmail).
- [ ] Background sync + webhooks instead of on-request fetching.
- [ ] Cross-tool project view (link a ClickUp task ↔ Notion doc ↔ Drive folder).
- [ ] Auth/session for the dashboard itself.
