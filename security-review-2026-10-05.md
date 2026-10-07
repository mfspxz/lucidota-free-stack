# FreeStack Security Review — 2026-10-05
Red-team pass over the built artifacts, thinking like an attacker AND a careless deployer.
Scope: `workers/ai-router.js`, `workers/test-router.mjs`, `server/docker-compose.yml`,
`server/.env.example`, `server/DEPLOY.md`, `n8n/*.json`, `github-actions/*.yml`.

**Result: 0 critical · 3 high · 8 medium · 8 low. 9 issues FIXED in place (all re-validated:
`node --check` clean, 14/14 router tests green, all JSON/YAML parse).**

## HIGH (all fixed)

### H1 — AI router had ZERO authentication (workers/ai-router.js)
Any route (`POST /v1/chat/completions`, `GET /health`, `GET /`) was callable by
anyone who discovered the `workers.dev` URL. An attacker — or a curious crawler —
could burn every free-tier quota (Gemini 1.5K/day, Groq 14.4K/day, Mistral 1B/mo,
NVIDIA 10K/day) in minutes: total denial of the AI layer at $0 cost to them.
`/health` additionally leaked per-lane error strings and skip counters (recon).
**Fix:** `ROUTER_KEY` bearer-token check on every route (constant-time compare);
missing secret → 503 fail-closed, wrong token → 401. All callers updated:
3 n8n HTTP nodes (via `$env.FREESTACK_ROUTER_KEY`), 3 GitHub Actions workflows
(via `secrets.AI_ROUTER_KEY`), test harness, README usage docs.

### H2 — Every compose service bound to 0.0.0.0 (server/docker-compose.yml)
n8n, Uptime Kuma, Authentik, and Infisical all create their admin account on
**first visit**. On a VPS, whoever reached the port first owned the stack —
a textbook first-visit takeover race.
**Fix:** all published ports now bind `127.0.0.1` only. Remote access goes
through Pangolin or Tailscale (same-box proxies unaffected). DEPLOY.md documents why.

### H3 — Failover drill could never pass (github-actions/failover-drill.yml × workers/ai-router.js)
The drill asserted on a per-lane `healthy` field that `/health` never returned
(it emits `configured`/`inCooldown`, not `healthy`) — so the canary failed
loudly forever: alert fatigue, then ignored alerts.
**Fix:** `/health` now emits `healthy: configured && !inCooldown` per lane.

## MEDIUM (5 fixed, 3 reported)

### M1 — Gemini API key in URL query string (workers/ai-router.js) — FIXED
`?key=` puts the key in Cloudflare edge logs, upstream access logs, and any
proxy in between. Now sent as `x-goog-api-key` header. (Test asserts the key
is NOT in the URL.)

### M2 — Keyless tier had no enforcement of "fragments-only" (workers/ai-router.js) — FIXED
The `fragmentsOnly` flag was documentation-only: a sensitive prompt would
silently degrade to untrusted anonymous lanes (Pollinations/Kilo/OVH/LLM7).
Now callers can send `x-fail-closed: true` → keyless lanes are skipped and the
request 502s instead of leaking. (Test: `failclosed` scenario.)

### M3 — Redis had no password (server/docker-compose.yml) — FIXED
Shared by Authentik + Infisical; previously any container on the network had
full access. Now `--requirepass ${REDIS_PASSWORD}`, with
`AUTHENTIK_REDIS__PASSWORD` and Infisical's `REDIS_URL` updated.

### M4 — MongoDB had no auth (server/docker-compose.yml) — FIXED
`MONGO_INITDB_ROOT_USERNAME/PASSWORD` added; Infisical `MONGO_URL` now carries
creds (hex-only passwords — URL-safe by construction).

### M5 — n8n content webhook had no auth (n8n/content-pipeline.json) — FIXED
Unauthenticated `POST /freestack-content` → anyone reaching n8n could trigger
AI generation and burn router quota. Now `headerAuth` with a placeholder
credential (operator creates it on import, mirroring the existing GitHub PAT pattern).

### M6 — SurrealDB root password visible in process list (server/docker-compose.yml) — REPORTED
`--pass ${SURREAL_PASS}` appears in `docker inspect` / host `ps`. SurrealDB's
`surreal start` has no verified env-var alternative for the root password
(checked docs 2026-10-05), so this stays — mitigated by the 127.0.0.1 binding
(only host-shell attackers can see it, and they already own `.env`).

### M7 — Six images pinned to `:latest` (server/docker-compose.yml) — REPORTED
n8n, infisical, surrealdb, libretranslate, searxng, vaultwarden. Non-reproducible
builds + supply-chain drift. Left as-is (can't safely pick versions blind);
recommend pinning digests after the first known-good deploy.

### M8 — `permissions: contents: write` at workflow level (github-actions/*.yml) — FIXED
Moved to job-level `permissions` in nightly-ai-batch.yml and weekly-content.yml
(least privilege; failover-drill.yml needs no permissions at all).

## LOW (reported)
- **L1** `/health` `lastError` strings leak upstream error text — mitigated by H1's auth gate.
- **L2** No request body size cap on the router — added a 1MB `content-length` guard (partial; chunked bodies bypass it — auth remains the real control).
- **L3** Per-lane RPM state is per-isolate in-memory (approximate under load) — already documented in README.
- **L4** `initdb/init-users.sh` breaks if a DB password contains a single quote — DEPLOY.md mandates hex-only; acceptable.
- **L5** No `deploy.resources.limits` — a runaway container can starve the 12GB box. Consider caps at deploy time.
- **L6** GHA pins `actions/checkout@v4` / `setup-python@v5` by major tag, not SHA — acceptable for this threat model.
- **L7** No `timeout-minutes` on GHA jobs — the 120s in-script timeouts bound the AI calls; runner hang risk is minimal.
- **L8** `Math.random()` for response IDs — not security-relevant.

## Positive notes (things done right)
- **No hardcoded secrets anywhere.** `.env.example` is all `CHANGE_ME` placeholders; initdb reads env; router reads `wrangler secret`.
- **Placeholder domains are inert.** `*.example.workers.dev`, `alerts.example.com`, `drafts.example.internal` use RFC-reserved `example.*` — they can never resolve to an attacker domain. No silent-exfiltration risk.
- **n8n workflows ship `active: false`** — nothing fires on import.
- **SearXNG drops Linux capabilities** (`cap_drop: [ALL]`).
- **Authentik telemetry/update checks disabled; n8n diagnostics off.**

## Follow-ups for the operator (not fixed here)
1. Set `ROUTER_KEY` + `AI_ROUTER_KEY` during key acquisition (add to key-acquisition-2026-10-05.md).
2. n8n `$env.FREESTACK_ROUTER_KEY` must exist in n8n's environment (same value as `ROUTER_KEY`).
3. Create the n8n "Header Auth" credential on first import of content-pipeline.json.
4. Pin image digests after first green deploy (M7).
5. Consider `deploy.resources.limits` (L5) once real RAM numbers are observed.
