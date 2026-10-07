# FreeStack server — DEPLOY.md

## 0. Prereqs

- Docker Engine 24+ with Compose v2 (`docker compose version` should work).
- **RAM: 12 GB+ for the full stack** (~10–12 GB used), **6 GB+ for slim mode**
  (~5.3 GB worst-case limits, ~2.3 GB reserved — fits Oracle Always Free
  2 OCPU / 12 GB with headroom).
  Check on the target box:
  ```bash
  free -h && nproc
  ```
- 30 GB+ free disk (LibreTranslate models + volumes grow).
- Ports free on localhost: 3001, 5000, 5678, 8000, 8080, 8888, 9000, 9443
  (8081 too if you run slim/Vaultwarden).
- All published ports bind to **127.0.0.1 only** (security fix 2026-10-05):
  nothing here is reachable from the internet until you put Pangolin or
  Tailscale in front of it. This is deliberate — n8n, Uptime Kuma, Authentik
  and Infisical all create their admin account on first visit, and an
  internet-facing first-visit wizard is a takeover waiting to happen.
- All images are multi-arch (amd64 + arm64) — safe on Oracle Always Free ARM Ampere.

## 1. First boot

```bash
cd ~/workspace/free-stack/server   # or wherever you put this on the server
cp .env.example .env
chmod 600 .env   # secrets at rest: readable only by you
# --- generate every CHANGE_ME value (do NOT reuse across vars) ---
for v in POSTGRES_PASSWORD N8N_DB_PASSWORD AUTHENTIK_DB_PASSWORD \
         N8N_ENCRYPTION_KEY AUTHENTIK_SECRET_KEY \
         INFISICAL_ENCRYPTION_KEY INFISICAL_JWT_SIGNUP_SECRET \
         INFISICAL_JWT_REFRESH_SECRET SURREAL_PASS \
         REDIS_PASSWORD MONGO_ROOT_PASSWORD ROUTER_KEY; do
  echo "$v=$(openssl rand -hex 32)"
done
# paste the outputs into .env
```

SearXNG needs its own secret before first boot:

```bash
mkdir -p searxng
SEARXNG_SECRET=$(openssl rand -hex 32)
cat > searxng/settings.yml <<EOF
use_default_settings: true
server:
  secret_key: "${SEARXNG_SECRET}"
  limiter: false
  image_proxy: true
ui:
  static_use_hash: true
search:
  safe_search: 0
  autocomplete: "duckduckgo"
EOF
```

Then boot. Order matters on first run (postgres must init before apps):

```bash
docker compose up -d postgres redis mongo
docker compose up -d   # everything else; depends_on handles the rest
docker compose ps      # wait until all show healthy/running
docker compose logs -f libretranslate  # first boot downloads EN/ES/FR models (minutes)
```

## 1b. Router + n8n auth wiring (security fix 2026-10-05)

The AI failover router is fail-closed: it needs `ROUTER_KEY` set as a Worker
secret (`wrangler secret put ROUTER_KEY` — done during the Phase 1 wiring, see
`key-acquisition-2026-10-05.md`), and every caller must present the same token.

1. **n8n needs the token in its environment as `FREESTACK_ROUTER_KEY`** — the
   same value as `ROUTER_KEY`. In `docker-compose.yml`, add to the `n8n`
   service:
   ```yaml
   environment:
     - FREESTACK_ROUTER_KEY=${ROUTER_KEY}
   ```
   (`ROUTER_KEY` is already generated into `.env` by the loop in section 1.)
   The n8n HTTP nodes read it as `$env.FREESTACK_ROUTER_KEY`. Without this,
   router calls from workflows fail with 401.
2. The GitHub Actions side uses `AI_ROUTER_KEY` (same value) via
   `gh secret set AI_ROUTER_KEY --repo <ops-repo>` — run that on the server
   with `gh`, not in compose.

## 1c. Post-deploy hardening (after first green deploy)

- **Pin image digests (M7):** six services run `:latest` (n8n, infisical,
  surrealdb, libretranslate, searxng, vaultwarden). After the first green
  deploy, run `docker compose images --digests`, pin the working digests in
  compose, and redeploy. Risk if skipped: non-reproducible builds +
  supply-chain drift.
- **Consider `deploy.resources.limits` (L5):** once you've watched real RAM/CPU
  numbers for a week (Uptime Kuma + `docker stats`), add memory limits so one
  runaway container can't starve the 12 GB box. Infisical is the usual hog;
  start there.

## 2. Initial logins

| Service | URL | First login |
|---|---|---|
| n8n | http://host:5678 | owner account setup wizard |
| Uptime Kuma | http://host:3001 | create admin on first visit |
| Authentik | http://host:9000/if/flow/initial-setup/ | set `akadmin` password in the wizard |
| Infisical | http://host:8080 | first user becomes org admin |
| SurrealDB | http://host:8000 | user `root` / `SURREAL_PASS` from .env |
| SearXNG | http://host:8888 | no login |
| LibreTranslate | http://host:5000 | no login |

## 3. Slim mode (Oracle 2/12) — `docker-compose.slim.yml`

Use slim mode when the target box is Oracle Always Free ARM Ampere
(**2 OCPU / 12 GB RAM** — PROVEN current as of the June 2026 quota cut; the
full stack at ~10–12 GB is marginal there) or any box under ~8 GB.

The slim override (`docker-compose.slim.yml`) is merged on top of the base
file. It **drops** Infisical (+ its MongoDB), LibreTranslate (~1.5–2 GB of
models — the single biggest saver), and SurrealDB via the `heavy` profile,
**adds** Vaultwarden (~50 MB) as the secrets vault, and puts memory
**limits** on everything that remains (~5.3 GB worst case, ~2.3 GB reserved).

```bash
cd ~/workspace/free-stack/server   # or wherever you put this on the server
cp .env.example .env && chmod 600 .env
# generate secrets exactly as in §1, PLUS the vaultwarden token:
VAULTWARDEN_ADMIN_TOKEN=$(openssl rand -base64 48)
# (set VAULTWARDEN_DOMAIN in .env too; the full §1 loop is harmless in slim
# mode — unused vars are simply never read.)

mkdir -p searxng   # same settings.yml bootstrap as §1

# first boot (mongo/infisical never start — they're profile-excluded):
docker compose -f docker-compose.yml -f docker-compose.slim.yml up -d postgres redis
docker compose -f docker-compose.yml -f docker-compose.slim.yml up -d
docker compose -f docker-compose.yml -f docker-compose.slim.yml ps
```

First-login table is the same as §2, except **Infisical → Vaultwarden** at
`http://host:8081` (admin token from `.env`; signups disabled) and no
LibreTranslate/SurrealDB.

Restoring a dropped service later (bigger box) — the volumes survive, so:

```bash
docker compose -f docker-compose.yml -f docker-compose.slim.yml \
  --profile heavy up -d surrealdb
# infisical also needs its INFISICAL_* vars in .env first (§1 loop covers them)
```

The old manual method (commenting services out of the base file) still works
but is deprecated — prefer the override file so the base stays canonical.

## 4. Putting Pangolin / Tailscale in front (later — NOT configured here)

> Prefer the Cloudflare Tunnel (§6) for internet access to SurrealDB/n8n/Kuma
> — it's configured in this repo and needs no open ports. Pangolin/Tailscale
> remain the answer for tailnet-only access (Authentik, vault UIs).

- **Pangolin**: run it on the same box (or its own), point it at these services as
  private targets (n8n:5678, authentik:9000, etc.), terminate TLS at Pangolin,
  then set `N8N_PROTOCOL=https` / `N8N_HOST=<your domain>` and
  `INFISICAL_SITE_URL=https://...` in `.env` and `docker compose up -d` again.
- **Tailscale**: `tailscale serve` / funnel can expose individual ports to your
  tailnet without any compose changes.
- Authentik becomes the SSO front door for n8n / Uptime Kuma / SearXNG via its
  proxy provider once DNS exists.

## 5. Troubleshooting

- `docker compose config` — validates the file (fails fast on missing secrets).
- Authentik image tag 404s: check https://docs.goauthentik.io for the current
  release tag and bump `authentik-server` + `authentik-worker` together.
- LibreTranslate `/languages` 404s for a long time = models still downloading.
  Give it 10+ min on first boot.
- `initdb/init-users.sh` runs ONLY on a fresh volume. If you change DB passwords
  later, update them inside postgres manually (`ALTER USER ... PASSWORD ...`).
- Backups: `docker compose exec postgres pg_dumpall -U freestack > backup.sql`
  plus volume snapshots of `surreal-data` and `n8n-data`.

## 6. Cloudflare Tunnel — SurrealDB (and n8n/Kuma) on the internet, $0

The $0-correct way to reach SurrealDB from anywhere: Workers can't run a
SurrealDB server (no persistent TCP compute on the free tier), so SurrealDB
stays on this box and a **Cloudflare Tunnel** (free, outbound-only, no open
ports, no static IP) carries it to your domain. Full architecture, honest
Workers-vs-tunnel framing, and Access/Zero Trust notes:
[`cloudflare-tunnel.md`](cloudflare-tunnel.md).

The `cloudflared` service is **opt-in** (`tunnel` profile — never starts
accidentally). Setup:

```bash
# 1. Zero Trust dashboard → Networks → Tunnels → Create tunnel (name: freestack)
#    Copy the token. In .env:
CLOUDFLARE_TUNNEL_TOKEN=CHANGE_ME__tunnel_token_from_dashboard

# 2. Edit cloudflared/config.yml — replace the three *.example.com hostnames
#    with your real domain. (cloudflared doesn't expand env vars; edit by hand.)

# 3. In the dashboard, same tunnel → Public Hostnames: add the three hostnames
#    (dashboard creates the DNS CNAMEs automatically).

# 4. Start it (full stack):
docker compose --profile tunnel up -d cloudflared
# slim mode:
docker compose -f docker-compose.yml -f docker-compose.slim.yml \
  --profile tunnel up -d cloudflared

# 5. Verify:
docker compose logs cloudflared   # "Registered tunnel connection"
curl https://db.<yourdomain>/health
```

Then lock down the admin surfaces: Zero Trust → Access → Applications, add
`n8n.<domain>` with an Allow policy for your email only (50 free seats —
more than enough). Leave the Kuma status page public, Access-protect its
`/dashboard`.

What this does NOT do: expose postgres/redis/mongo (internal only, forever),
the vault UIs (stay local/tailnet-only), or Authentik (tailnet-only for now).
If the token ever leaks: delete the tunnel in the dashboard (kills all
connections instantly), mint a new one, update `.env`, restart.

Slim-mode note: the tunnel's `depends_on` includes `surrealdb`, which slim
mode parks under the `heavy` profile. If you want `db.<domain>` live in slim
mode, start both profiles (see §3's restore pattern):
`--profile heavy --profile tunnel up -d surrealdb cloudflared`.
Otherwise the n8n/status hostnames work fine without it.
