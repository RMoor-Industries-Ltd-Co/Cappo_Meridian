# Deploying Cappo_Meridian

CI/CD: push to `main` → GitHub Actions runs **typecheck + lint + build**, then
**rsyncs the repo to the Linode and rebuilds Docker** (`web` app + `caddy` for
HTTPS). Caddy auto-provisions a TLS cert for `cappo.apex-meridian-group.com`.

```
push main ──▶ checks (tsc/lint/build) ──▶ rsync ▶ docker compose up -d --build ──▶ /api/health
```

## One-time: GitHub repo secrets

Set under **Settings → Secrets and variables → Actions** (or via `gh secret set`):

| Secret | Value |
| --- | --- |
| `SSH_HOST` | `173.230.138.81` (or `cappo.apex-meridian-group.com`) |
| `SSH_USER` | the deploy user on the Linode (e.g. `deploy` or `root`) |
| `SSH_PRIVATE_KEY` | private key whose **public** key is in the server's `~/.ssh/authorized_keys` |

Generate a dedicated deploy key (don't reuse a personal key):

```bash
ssh-keygen -t ed25519 -f cappo_deploy -N "" -C "cappo-deploy"
# add cappo_deploy.pub to the server: ~SSH_USER/.ssh/authorized_keys
# add the private key cappo_deploy to GitHub as SSH_PRIVATE_KEY
gh secret set SSH_PRIVATE_KEY < cappo_deploy
gh secret set SSH_HOST --body "173.230.138.81"
gh secret set SSH_USER --body "deploy"
```

## One-time: Linode host prep

```bash
# install Docker + compose plugin
curl -fsSL https://get.docker.com | sh
# allow the deploy user to run docker (re-login after)
sudo usermod -aG docker "$USER"

# app dir
sudo mkdir -p /opt/cappo && sudo chown "$USER" /opt/cappo

# open the web ports
sudo ufw allow 80,443/tcp   # if ufw is enabled
```

Create **`/opt/cappo/.env`** (NOT in git) with production values:

```env
APP_BASE_URL=https://cappo.apex-meridian-group.com
AUTH_URL=https://cappo.apex-meridian-group.com
AUTH_TRUST_HOST=true
GOOGLE_WORKSPACE_DOMAIN=apex-meridian-group.com

AUTH_SECRET=<openssl rand -base64 32>
GOOGLE_CLIENT_ID=<from Google Cloud>
GOOGLE_CLIENT_SECRET=<from Google Cloud>
GOOGLE_REDIRECT_URI=https://cappo.apex-meridian-group.com/api/connectors/google/callback

CLICKUP_API_TOKEN=<pk_… from ClickUp>
NOTION_API_KEY=
```

(`rsync --delete` excludes `.env*`, so this file is preserved across deploys.)

## Google OAuth (production)

The OAuth client must list these (already added earlier):
- `https://cappo.apex-meridian-group.com/api/auth/callback/google` (login)
- `https://cappo.apex-meridian-group.com/api/connectors/google/callback` (connectors)

## DNS

`cappo.apex-meridian-group.com` A-record → the Linode IP (already set to
`173.230.138.81`). Ports 80/443 must reach the host for Caddy's cert challenge.

## Deploy

Push to `main` (or run the **CI & Deploy** workflow manually). First run may take
~30–60s for Caddy to obtain the TLS cert; the health-check step retries.

## Local container test

```bash
docker compose build web && docker compose up   # needs a local .env
```
