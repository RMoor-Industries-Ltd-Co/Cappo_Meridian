# Deployment Architecture

## Server

| | Value |
|---|---|
| **Domain** | `cappo.apex-meridian-group.com` |
| **IP** | `173.230.138.81` |
| **Purpose** | Cappo Management Dashboard — AMG project hub (ClickUp, Notion, Drive, Gmail, AI) |
| **Stack path** | `/opt/cappo/` |
| **Deployed via** | Manual deploy (Doppler + Docker Compose) |
| **Doppler project** | `cappo-meridian / prd` |
| **User** | `amg-admin` |

**Rule: this server is for Cappo only. It is not the Allen-I-Verse server and not the Master Atelier server.**

---

## Services

```
cappo-web-1   ghcr.io/piaar/cappo-meridian:latest
cappo-db-1    postgres:17-alpine
caddy         caddy:2-alpine
```

---

## Files at `/opt/cappo/`

- `docker-compose.yml` — main stack (web + db + caddy)
- `Caddyfile` — routes `cappo.apex-meridian-group.com` → `web:3000`

---

## How to Deploy

### Restart with updated env vars (no image change)

```bash
# SSH into 173.230.138.81 as amg-admin
export DOPPLER_TOKEN="dp.st.prd.YOUR_TOKEN"
cd /opt/cappo
doppler run -- docker compose up -d --force-recreate web
```

### Pull a new image and restart

```bash
export DOPPLER_TOKEN="dp.st.prd.YOUR_TOKEN"
cd /opt/cappo
echo "YOUR_GHCR_TOKEN" | docker login ghcr.io -u PIAAR --password-stdin
docker pull ghcr.io/piaar/cappo-meridian:latest
doppler run -- docker compose up -d --force-recreate web
```

### Verify it's up

```bash
curl -s https://cappo.apex-meridian-group.com/api/health
# Should return {"status":"ok"} or similar
```

---

## docker-compose.yml (canonical reference)

The `environment:` block for the `web` service must include ALL of these. If a var is in Doppler but missing here, the container never receives it.

```yaml
environment:
  - TOKEN_STORE_PATH=/data/google-tokens.json
  - APP_BASE_URL
  - GOOGLE_WORKSPACE_DOMAIN
  - CLICKUP_API_TOKEN
  - CLICKUP_TEAM_ID
  - CLICKUP_SPACE_ID
  - NOTION_API_KEY
  - GOOGLE_CLIENT_ID
  - GOOGLE_CLIENT_SECRET
  - GOOGLE_REDIRECT_URI
  - AUTH_SECRET
  - AUTH_URL
  - AUTH_TRUST_HOST
  - ANTHROPIC_API_KEY
  - CLAUDE_API_KEY
  - OPENAI_API_KEY
  - OPENAI_MODEL
  - PERPLEXITY_API_KEY
  - PERPLEXITY_MODEL
  - DATABASE_URL
  - AGENT_API_KEY
```

**If you add a new env var, it must appear here AND in Doppler `cappo-meridian / prd`.**

---

## Auth: Google OAuth (NextAuth v5)

- **Provider:** Google OAuth 2.0
- **Gate:** `@apex-meridian-group.com` Workspace accounts only
- **NextAuth vars:** `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST` (all required)
- **`AUTH_URL`** must be `https://cappo.apex-meridian-group.com` — NextAuth uses this to construct the OAuth redirect URI

### Google Cloud Console — required redirect URIs

```
https://cappo.apex-meridian-group.com/api/auth/callback/google
https://cappo.apex-meridian-group.com/api/connectors/google/callback
```

---

## Root Cause of June 2026 Login Outage

Two missing env vars caused `Error 400: invalid_request` from Google:

1. **`AUTH_URL` missing from docker-compose.yml** — Without it, NextAuth v5 auto-detects the base URL from the container's internal address (`0.0.0.0:3000`), producing `redirect_uri=https://0.0.0.0:3000/api/auth/callback/google`. Google rejects this immediately.
2. **`AUTH_TRUST_HOST` missing from docker-compose.yml** — Required in containerized deployments so NextAuth trusts the reverse proxy host header.

Both vars were correctly set in Doppler but never listed in `docker-compose.yml`, so the container never received them. Fixed by adding both to the environment block.

---

## Updating the Server's docker-compose.yml

The server at `/opt/cappo/` is **not a git repo** — files must be updated manually.

To sync after a change merged to `main`:

```bash
sudo tee /opt/cappo/docker-compose.yml < /dev/stdin
# paste the updated file content
```

Or use `sudo nano /opt/cappo/docker-compose.yml` to edit directly.

Always run `doppler run -- docker compose up -d --force-recreate web` after editing.
