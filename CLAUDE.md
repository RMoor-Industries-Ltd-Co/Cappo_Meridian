# CLAUDE.md

Guidance for Claude (and humans) working in this repo. Read this first.

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
