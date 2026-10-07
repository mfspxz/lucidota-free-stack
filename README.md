# FreeStack — Master Index
Operation FreeStack ("Cute Tentacle Cloud City") · built 2026-10-05 (PDT)

## Mission
Build Zackary a 100%-free, 24/7 "do whatever I want" company stack — R&D, marketing, advertising, research, bug testing — with Lucidota as the main operator: free AI inference lanes fanned out in parallel, Cloudflare + n8n + GitHub Actions as the always-on glue, triple-redundant per layer with smart failover, and strict compartmentation so no single provider ever sees the full picture. No incorporation, no credit cards.

## File index
30 entries. Statuses: research = point-in-time findings · built = working artifact · validated = independently verified · maintained = living log.
| File | What it is | Status |
|---|---|---|
| `MASTER-PLAN-2026-10-05.md` | Original strategy: the five-layer stack (brains/build/create/glue/operator) | research |
| `sweep-2026-10-05.md` | Deep sweep: 8 buckets, ~766 raw candidates → ranked shortlists, all trinary-labeled (PROVEN/DISPROVEN/UNKNOWN), redundancy map | research |
| `unknowns-resolved-2026-10-05.md` | Round-2 verifications (SurrealDB Cloud, Axiom, WeatherAPI, Upstash, CacheFly killed, Tebi dead) | validated |
| `architecture.mmd` | Triple-redundant architecture diagram v2 with failover paths + death scenarios | built |
| `zenith-v2-2026-10-05.md` | Peak-output config: ~450M tok/week sustained, lane-by-lane math | research |
| `runbook-2026-10-05.md` | Compartmentation runbook + 24-hour deploy checklist + workload split table | research |
| `key-acquisition-2026-10-05.md` | API key acquisition runbook: 16 keys, 4 phases, ~75–90 min, all no-card (SambaNova ⚠️ disputed at signup), vault handoff flow | research |
| `keyless-lanes-verified-2026-10-05.md` | Zero-signup AI lanes verified with real requests (Pollinations, Kilo, OVHcloud, LLM7 PROVEN; UnoRouter/OrcaRouter DISPROVEN) | validated |
| `security-review-2026-10-05.md` | Red-team pass: 0 critical, 3 HIGH + 8 med + 8 low — 9 fixed in place, follow-ups listed | validated |
| `operator-handbook-2026-10-05.md` | Lucidota's day-to-day SOPs: lane selection policy, quota monitoring thresholds, weekly rituals, incident response, escalation rules, monthly checklist | built |
| `watchlist-2026-10-05.md` | Free-tier watchlist: upcoming tiers/betas/programs to re-check, with dated re-check calendar (e.g. day-of-incorporation application list) | maintained |
| `validation-2026-10-05.md` | Final integration validation report: 15/15 router tests, all JSON/YAML valid, no real secrets, no dangling paths | validated |
| `hour-log-2026-10-05.md` | Timestamped work log for the build hour (18:33–19:33 PDT) | maintained |
| `gpu-compute-research-2026-10-05.md` | Bucket 6: NVIDIA buddy-claim verdict (no-card PROVEN, unlimited/train DISPROVEN) + credit programs | validated |
| `bucket1/BUCKET1-AI-INFERENCE-REPORT-2026-10-05.md` | Bucket 1 deep dive: 15 shortlisted AI inference lanes | research |
| `research/bucket2-hosting-compute-2026-10-05.md` | Bucket 2 deep dive: hosting/compute (Oracle ARM cut, Koyeb, Deno Deploy) | research |
| `bucket-5-data-apis-2026-10-05.md` | Bucket 5: top-15 data APIs (Tavily, Exa, GDELT unlimited/no-key, MET Norway, Nominatim) | research |
| `bucket-8-monitoring-identity-2026-10-05.md` | Bucket 8: monitoring/auth (Uptime Kuma, Authentik, Logto, Infisical, Grafana) | research |
| `workers/ai-router.js` | Cloudflare Worker: free-tier AI failover router (570 lines, 11 lanes — 7 keyed + 4 keyless, 15/15 tests green, ROUTER_KEY auth, fail-closed option) | built |
| `workers/test-router.mjs` | QA harness for the router (15 scenarios, all green) | built |
| `workers/README.md` | Router docs | built |
| `github-actions/nightly-ai-batch.yml` | 03:00 UTC research batch → commit | built |
| `github-actions/weekly-content.yml` | Sunday posts + email | built |
| `github-actions/failover-drill.yml` | Monday canary; fails loudly if <3 healthy lanes | built |
| `n8n/` | n8n workflow exports (content-pipeline, heartbeat-healthcheck, nightly-digest, tos-watcher) — valid JSON, ship inactive | built |
| `server/docker-compose.yml` | Self-host stack: 11 services, valid YAML, multi-arch (Oracle ARM) | built |
| `server/docker-compose.slim.yml` | Slim override for Oracle 2 OCPU/12 GB: drops Infisical/LibreTranslate/SurrealDB, adds Vaultwarden, 5.3 GB total limits | built |
| `server/DEPLOY.md` | Server deploy instructions | built |
| `server/.env.example` | Env template for the stack | built |
| `server/initdb/init-users.sh` | DB init script | built |
| `../tentacle-corp/` | Brand track: creative brief (East Van aesthetic), brand guide, logo prompt pack, logo assets (4 concepts + final), content calendar, ad concepts, email sequence, flyer, infra worker + n8n pipelines | built |

## 24-hour deploy order
1. **Keys first (hr 0–2, all no-card):** Google AI Studio, Groq, Mistral, NVIDIA NIM, Tavily, Exa, QStash, Upstash → straight into self-hosted Infisical. [`key-acquisition-2026-10-05.md`]
2. **Cloudflare (hr 2–4, existing account):** activate Workers, Pages, D1, R2, Queues, Workers AI, Web Analytics; reserve 5 cron triggers. [`runbook-2026-10-05.md`]
3. **Server Docker stack (hr 4–8):** n8n, Uptime Kuma, Authentik, Umami, Huginn, LibreTranslate, SearXNG, Pangolin, Infisical, Activepieces CE (standby). [`server/docker-compose.yml`, `server/DEPLOY.md`]
4. **Private mesh (hr 8–10):** Tailscale across server + devices (100-device budget); NetBird CE config as standby. [`runbook-2026-10-05.md`]
5. **GitHub (hr 10–12):** private ops repo + Actions, secret-scan workflow, Upptime public watchdog. [`github-actions/`]
6. **Data layer (hr 12–14):** Neon Postgres, Upstash Redis, Backblaze B2, Tigris, Cloudinary; first pg_dump → B2 scheduled. [`sweep-2026-10-05.md`]
7. **DNS (hr 14–16):** deSEC secondary, dual-authoritative with Cloudflare; HE.net + 1984.is configs prepared as tertiary. [`runbook-2026-10-05.md`]
8. **Comms (hr 16–18):** Brevo, Sender, Buffer, Publer, Notion, Tally. [`sweep-2026-10-05.md`]
9. **Router + drill (hr 18–24):** deploy ai-router to Workers, run failover drill, confirm ≥3 healthy lanes. [`workers/README.md`, `github-actions/failover-drill.yml`]

## Zenith number
**~450M tokens/week sustained ≈ 4.5× the Muse free tier (100M/wk), running OUTSIDE the Muse meter.**
Assumptions: proven free-tier limits only (Mistral 1B tok/mo budget, NVIDIA NIM 10K req/day × ~2K avg tokens, AI Studio ~1.5K req/day × ~3K, Z.AI ~1K req/day, Groq 500K TPD, SambaNova rotation); real only with parallel fan-out across ≥6 lanes, since per-lane RPM limits bind. [`zenith-v2-2026-10-05.md`]

## Compartmentation
**Golden rule: no single provider ever gets the full picture.**
- **FRIEND** — sensitive OK: all self-hosted (n8n, Kuma, Authentik, Infisical, SurrealDB), OVHcloud, Groq, EU privacy providers.
- **NEUTRAL** — fragments only: Google, Mistral, Cloudflare, GitHub.
- **FOE** — never sensitive or structural: NVIDIA NIM (trains on inputs), Kilo gateway, xAI, UptimeRobot (personal-only), Storj (bankrupt), TeraBox.
- Keys live in self-hosted Infisical only. Workload split: code / data / keys / compute on separate providers. [`runbook-2026-10-05.md`]

## How to light it up
1. **Keys:** Zackary grabs API keys (no cards needed) and hands them to Lucidota through the secure vault — order and flow in [`key-acquisition-2026-10-05.md`].
2. **Router secrets:** Lucidota stores them with `wrangler secret put <NAME>` on the Cloudflare account, then `wrangler deploy` for `workers/ai-router.js`. [`workers/README.md`]
3. **Deploy:** server stack via `docker compose up -d` per [`server/DEPLOY.md`]; import n8n workflows from `n8n/`; push `github-actions/` into the ops repo; run the failover drill to confirm ≥3 healthy lanes before calling it live.
