# FreeStack — First Week Playbook

**Read this first when you're back.** Five days, one doc. Each day has exact commands, what "done" looks like, and what to do when a step fails. Nothing here costs money, needs a card, or needs incorporation. If any signup asks for a credit card → STOP that signup only, note which service, tell Lucidota, move to the next step.

Your two reference docs: `key-acquisition-2026-10-05.md` (key details) and `server/DEPLOY.md` (deploy details). Brand work lives in `tentacle-corp/`. This playbook is the order of operations.

---

## Day 1 — Keys (~75–90 min)

Get all 16 keys. Work the phases in order; hand keys to Lucidota in batches via **Secure Vault** (say "Key ready: Groq" in chat — NEVER paste a key in chat).

**Phase 1 — router brains** (Google AI Studio → Groq → Mistral → NVIDIA NIM → OpenRouter → z.ai [optional] → SambaNova [⚠️ verify at signup])
**Phase 2 — control plane** (Cloudflare API token → GitHub PAT)
**Phase 3 — data** (Neon → Axiom → WeatherAPI)
**Phase 4 — search backbone** (Tavily → Exa → QStash → Upstash Redis)
**Bonus:** DeepSeek one-shot (5M trial tokens, 30-day expiry — grab it, we'll burn it on one big job)

Two traps to watch:
- **SambaNova (Phase 1):** free tier is ⚠️ DISPUTED for new accounts (possibly delisted Sept 2026). If the console asks for a card → abort immediately, tell Lucidota, move on. Router works fine without it.
- **Cloudflare R2:** activation MAY ask for a card. If it does → abort R2 only, continue everything else. Workers/Pages/D1/Queues need nothing.
- **Upstash Redis:** set a **budget cap in the console at signup** — it bills overages ($0.20/100K cmds) instead of pausing. Or skip it; self-hosted Redis is in the compose stack.

**Done when:** Lucidota confirms all keys are in the vault. Keys live in exactly three places: Infisical (self-host) → Doppler encrypted backup → local encrypted export. Never in chat, never in repos.

**If a step fails:** note the service + what it asked for, tell Lucidota, move on. The router runs fine on whatever subset you complete — keyless lanes (Pollinations, Kilo, OVHcloud, LLM7) need zero signup.

---

## Day 2 — Deploy (~2 hours)

### Morning: pick your box

```bash
free -h && nproc
```

- **12 GB+ RAM:** full stack.
- **Under ~8 GB** (or Oracle Always Free ARM — PROVEN 2 OCPU / 12 GB as of June 2026): **slim mode**.

### Afternoon: server stack

```bash
cd ~/workspace/free-stack/server
cp .env.example .env && chmod 600 .env
# generate every CHANGE_ME value (do NOT reuse across vars):
for v in POSTGRES_PASSWORD N8N_DB_PASSWORD AUTHENTIK_DB_PASSWORD \
         N8N_ENCRYPTION_KEY AUTHENTIK_SECRET_KEY \
         INFISICAL_ENCRYPTION_KEY INFISICAL_JWT_SIGNUP_SECRET \
         INFISICAL_JWT_REFRESH_SECRET SURREAL_PASS \
         REDIS_PASSWORD MONGO_ROOT_PASSWORD ROUTER_KEY; do
  echo "$v=$(openssl rand -hex 32)"
done
# paste the outputs into .env
```

SearXNG bootstrap, then boot (postgres first, then everything):

```bash
mkdir -p searxng
# (write settings.yml per DEPLOY.md §1 — needs a random secret_key)
docker compose up -d postgres redis mongo
docker compose up -d
docker compose ps   # all healthy/running = done
```

**Slim mode** (Oracle / small box) — same steps, but every compose command gets the override file:

```bash
docker compose -f docker-compose.yml -f docker-compose.slim.yml up -d postgres redis
docker compose -f docker-compose.yml -f docker-compose.slim.yml up -d
```

Slim drops Infisical→Vaultwarden (on :8081), drops LibreTranslate + SurrealDB, limits everything to ~5.3 GB worst case. Full DEPLOY.md §3 has the details.

### Evening: Cloudflare router

```bash
cd ~/workspace/free-stack/workers
npm i -g wrangler
wrangler login
wrangler deploy
# set the secrets (keys from Day 1 vault handoff; ROUTER_KEY = the value generated above):
wrangler secret put ROUTER_KEY
wrangler secret put GEMINI_KEY
wrangler secret put GROQ_KEY
wrangler secret put MISTRAL_KEY
wrangler secret put ZAI_KEY        # optional — skip if not acquired
wrangler secret put NVIDIA_KEY
wrangler secret put OPENROUTER_KEY
wrangler secret put SAMBANOVA_KEY  # optional — skip if disputed/not acquired
```

**Done when:** `curl https://<your-worker>.workers.dev/health` returns the lane list with all your keyed lanes present, and an authenticated `/v1/chat/completions` call succeeds:

```bash
curl https://<your-worker>.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer <ROUTER_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"say ok"}]}'
```

**If a step fails:**
- `wrangler deploy` errors → `wrangler whoami` to check login; secrets go via `wrangler secret put`, never in the file.
- `/health` 503 → `ROUTER_KEY` secret missing on the Worker. Set it.
- API calls 401 → wrong bearer token; it must match `ROUTER_KEY` exactly.
- `docker compose config` fails → a `:?` secret is missing from `.env`. The error names it.
- A container won't stay up → `docker compose logs <service>`; 9 times out of 10 it's a missing env var or a fresh-volume-only init script that didn't run.

---

## Day 3 — Verify (~1–2 hours)

One at a time. No batch activation.

**1. Router failover drill.** With the live URL, re-run the test harness logic: kill a lane (temp-remove its key via `wrangler secret delete`) and confirm traffic fails over to the next lane without your request failing. Restore the key after. Confirm `/health` shows all lanes healthy again.

**2. n8n workflows.** Import the four workflows from `n8n/` (`heartbeat-healthcheck.json`, `nightly-digest.json`, `content-pipeline.json`, `tos-watcher.json`). Before activating each: replace every placeholder URL/credential, attach Header Auth with the same `ROUTER_KEY` value (`FREESTACK_ROUTER_KEY` env — DEPLOY.md §1b). Activate **heartbeat first**, verify it posts to your alert channel, then the others one per hour.

**3. Heartbeat confirm.** The heartbeat posts every 5 minutes; the external cron-job.org heartbeat is the second pair of eyes. If both are silent for 15 minutes, the stack is down — that's the page.

**4. GitHub Actions.** Push the `github-actions/` workflows to your ops repo, set the `AI_ROUTER_KEY` repo secret (same value as `ROUTER_KEY`):

```bash
gh secret set AI_ROUTER_KEY --repo <ops-repo>
```

Run the failover-drill workflow manually once (Actions → failover-drill → Run workflow). It asserts ≥3 healthy lanes.

**Done when:** failover drill passes on the live router, all 4 n8n workflows are active and green, heartbeat is posting, and the Actions drill is green.

**If a step fails:** 401s from n8n → Header Auth not attached or wrong token value. Workflow stuck → check n8n execution log, then the workflow's sticky note (each documents its own store/prereqs). Actions drill failing → check `AI_ROUTER_KEY` secret exists and matches.

---

## Day 4 — Content (Tentacle Corp, first assets)

The brand brief is at `tentacle-corp/brief-2026-10-05.md` (East Van aesthetic: neon pink `#FF2E88`, asphalt, crane teal — corporate blue is banned). First logo concept is already in `tentacle-corp/assets/`.

**Production order** (free tools only):
1. Logo pack — Ideogram generations → refine in Canva → export PNG/SVG.
2. Social kit — Canva templates (profile, banner, post) in brand palette.
3. Launch video — CapCut, 30–60s, the "Eight arms. Zero budget. Uptime anyway." energy.
4. Launch email — Brevo, list from your existing contacts only.
5. Content queue — Buffer, schedule the first week of posts.

**Rule: nothing auto-ships.** The `weekly-content` Action drafts; a human (you, or Lucidota on your explicit say-so) does the voice pass before anything publishes.

**Done when:** logo pack + social kit + one launch video exist, and the first Buffer queue is scheduled.

**If a step fails:** Ideogram/Canva free limits hit → that's the signal to stop for the day, not to upgrade. Free limits reset; the stack doesn't need more than the free tier gives.

---

## Day 5 — Review (~1 hour)

**1. Quota burn check.** Hit the router `/health` endpoint, note per-lane usage. Ask: are we on pace to stay inside every free tier for the month? The lanes to watch: Gemini (1.5K req/day), Groq (14.4K/day), NVIDIA (10K/day), OpenRouter :free (50/day), Mistral (1B tokens/mo), Tavily (1,000 credits/mo), Upstash Redis (500K cmds/mo — and check the budget cap is set).

**2. What broke.** Review the week's n8n execution logs and Uptime Kuma. Anything red gets a note in `hour-log`-style: what, when, fixed or open.

**3. What to tune.** Lane order (is Groq actually fastest for your jobs?), n8n schedule times, anything in the operator handbook (`operator-handbook-2026-10-05.md`) that didn't match reality — update it.

**4. Weekly ritual starts now** (from the operator handbook): one provider's ToS re-verified per week (the 2026 die-off list is why), backups confirmed (B2 + Tigris), monthly key rotation on the calendar.

**Done when:** burn report written down somewhere durable, open issues listed with owners, next week's ToS check scheduled.

**If a step fails:** a lane is exhausted early → the router already failed over; the fix is re-weighting (put the exhausted lane later in the order) or shifting that job type to a bigger lane. A provider changed terms → that's what `tos-watcher` is for; confirm its alert fired.

---

## Standing rules (all week)

- **$0. No card. No incorporation.** Card asked → abort that signup, note it, move on.
- **Keys never in chat.** Vault handoff only. Breach suspicion → rotate that key within 1 hour.
- **No provider gets the whole picture.** Sensitive work stays on verified lanes or self-hosted; untrusted/free lanes get fragments. (`x-fail-closed: true` on anything that must never degrade to anonymous lanes.)
- **Lucidota handles, you decide.** Anything needing your money, credentials, identity, or a judgment call → escalated to you. Everything reversible and in-runbook → handled autonomously and logged.

*Playbook written 2026-10-05. Companion docs: `key-acquisition-2026-10-05.md`, `server/DEPLOY.md`, `operator-handbook-2026-10-05.md`, `watchlist-2026-10-05.md`, `tentacle-corp/brief-2026-10-05.md`.*
