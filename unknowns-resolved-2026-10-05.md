# FreeStack Unknowns — Resolved 2026-10-05
Researched by Lucidota subagent. Trinary verdicts: PROVEN / DISPROVEN / UNKNOWN (+why). No signups, no credentials.

## 1. SurrealDB Cloud free tier — PROVEN
**Why:** Official docs (surrealdb.com/docs + docs GitHub repo, crawled 5 days ago) state it directly.
**Key numbers:** $0; free instance type; **1 GB storage allowance, cannot expand**; **auto-pauses after 7 days without use**; "limited resources for development and evaluation" (third-party: ~0.25 vCPU, 1 GB memory; "database runs temporarily and resets periodically").
**Implication:** Dev/eval only — NOT a production host (same 7-day-pause trap as Supabase). For Zackary's Rust+SurrealDB stack: use Cloud free for prototyping; production = self-hosted SurrealDB (single binary, trivial on his server or Oracle Always Free — free forever, no limits).
Source: https://surrealdb.com/docs/manage/organisations/faqs

## 2. Beam.cloud no-card signup — UNKNOWN
**Why:** 4 searches + opened docs.beam.cloud and beam.cloud homepage — no public source states the card requirement either way. Circumstantial (per-millisecond pay-as-you-go billing; GPU trial-farming economics per industry reporting) suggests a card is likely required for anything beyond signup, but that is inference, not proof. Only honest resolution is a signup-time check (not authorized).
**Key numbers (PROVEN separately):** $30/month free tier, recurring (multiple 2026 sources); serverless GPUs (4090s from $0.69/hr); sub-second cold starts; BYOC supported.
**Implication:** Treat as card-likely until proven otherwise — do NOT build the GPU plan around hosted Beam. Escape hatch: Beam's runtime is open-source (beta9, AGPL-3.0) — self-host on his server or Oracle free tier if hosted needs a card.
Source ($30 tier): https://github.com/tizkovatereza/awesome-ai-sandboxes

## 3. Koyeb current free-tier shape — CORRECTED (sweep was wrong)
**Why:** 2026-09-29 comparison quoting Koyeb's own FAQ + multiple user deploy guides.
**Key numbers:** 1 free web service/org: 512 MB RAM, 0.1 vCPU, 2 GB SSD (Frankfurt/Washington); 1 free Postgres (1 GB storage, 5 h active compute/mo, sleeps after 5 min idle); **credit card REQUIRED** (fraud prevention; $29 pre-auth, may skip if verifiable another way); **scale-to-zero after 1 h idle, cannot be disabled** (wake 1–5 s); ~100 GB outbound per recent user reports. **Acquired by Mistral AI Feb 2026** (team joined March; "Mistral Compute" — service continues).
**Sweep corrections:** "NO SLEEP" → DISPROVEN (sleeps after 1 h). "No card" → DISPROVEN (card required). Role as "always-on microservice" is dead; demote to sleep-tolerant tertiary. Card = hard blocker under the no-card constraint.
Source: https://snapdeploy.dev/blog/koyeb-vs-free-container-tier

## 4. Render free bandwidth 5 GB vs 100 GB — PROVEN: 5 GB
**Why:** Research verified 2026-07 against render.com/pricing + free-tier docs. The 100 GB figure is stale (pre-April-2026 restructure); even a 6-day-old ops doc flags third-party disagreement and marks 100 GB unverified.
**Key numbers:** Hobby free: **5 GB/mo outbound included**, $0.15/GB overage; 750 instance-h/mo; 512 MB/0.1 CPU; sleeps after 15 min idle; free Postgres expires 30 days (then deleted). **Kill-switch risk: bandwidth exhausted + no payment method on file = services SUSPENDED.**
**Implication:** Render stays "staging only" — and with the suspend-on-exhaustion behavior, never put anything load-bearing there without a card.
Source: https://github.com/yuanbop/frugal/blob/HEAD/research/round2/heroku-render.md

## 5. Lightning AI monthly credit refresh — PARTIALLY RESOLVED (conflict documented)
**Why:** Two credible source classes disagree.
**PROVEN (official pricing page, rendered 2026-09-24):** $0 plan, **no credit card** ("No credit card. No commitments"); phone verification per third-party guides; **up to 30 credits to start** (~75 T4-16GB hrs or ~31 L4-24GB hrs; T4 on-demand $0.55/GPU-hr beyond credits); 1 Studio free 24/7 (restart required every 4 h); 50 GB persistent storage; 15 req/min model APIs; single GPUs, up to 2 concurrent.
**UNKNOWN (conflicting):** Refresh cadence. Official page language ("to start") reads as a ONE-TIME starter grant. A third-party PLG/onboarding curriculum claims **15 credits/month, refreshed on the 1st** (only consumed credits replenished — use 4, get 4 back; no rollover; 1 credit = $1; one account per phone number). Cannot reconcile without a live account.
**Implication:** Bank the 30-credit starter (~75 T4 hrs) as one-time; do NOT plan a monthly 15-credit income until verified by signup. L4 access (24 GB, bf16) is the prize — best free big-VRAM lane if it holds.
Sources: https://github.com/shubhampandey567/ascent/blob/HEAD/docs/research/2026-09/notes/free-compute-apis.md · https://github.com/vpjoem/training-lab/blob/HEAD/curriculum/track-lightning-plg/01-platform-overview/lesson.md

## 6. NVIDIA NIM free credit caps — CHANGED (credit model retired)
**Why:** 13-day-old research commit documenting build.nvidia.com's current stated limits + NVIDIA forum moderator (2026-05-30). This also resolves the sweep's internal discrepancy: bucket 1 ("40 RPM / 10K req/day, no token meter") and bucket 6 ("1,000→5,000 finite credits") were both right at different times — NVIDIA moved from credits to rate limits.
**Key numbers (current):** **Up to 40 RPM + 10,000 requests/day**, varying by model/traffic; **no credits, no token meter**; no card; phone verification; 120+ models (Kimi K3, Nemotron 3, GLM-5.3, Llama, DeepSeek…); hosted prompts logged/used for training (FOE for sensitive — unchanged).
**Implication:** Better than the credit model for sustained use — no finite-exhaustion cliff, just a 10K/day ceiling. Zenith math in the sweep already assumed this shape; no change needed. Watch for model-specific free-endpoint deprecations (they rotate).
Source: https://github.com/mvalentsev/awesome-free-ai-coding/commit/01fa034b66fcce3c0984beb89b8f04672f6b1ee2

## 7. Mapbox card requirement — PROVEN: card required
**Why:** Verified 2026-07 against official Mapbox pricing docs + two independent 2026 guides. One older guide claiming no-card is outdated (295 days old).
**Key numbers:** Card required at signup even for $0 usage; billed monthly in arrears. Free: 50,000 map loads/mo, 100,000 geocoding req/mo, 100,000 directions/matrix/isochrone req each/mo, 200,000 vector tiles, 750,000 raster tiles, 50,000 static images; **Search Box only 500 sessions/mo** (blows up immediately — avoid).
**Implication:** Hard blocker under no-card constraint → demote Mapbox to "only if card added later." Nominatim (1 req/s keyless) + OpenRouteService (2K/day, no card) stay primary; MapLibre GL JS (open-source) + self-hosted tiles for rendering.
Source: https://github.com/yuanbop/frugal/blob/HEAD/research/round2/maps.md

## 8. ZeroTier free node count — PROVEN: 25
**Why:** Six independent 2026 sources agree (48-day-old guide, 43-day-old comparison, homelab guide, March 2026 comparison, 98-day-old tutorial, free-for-dev). The "10" figure appears in no current source.
**Key numbers:** Free: **25 devices, 1 network**. Self-hosted controller (Ztnet / network-controller) removes the limit entirely. (Tailscale free: 100 devices / 3 users — still the bigger mesh.)
**Implication:** 25 is plenty for server + agents + personal devices. Keep Tailscale primary (100 devices), ZeroTier as the L2-capable fallback.
Source: https://github.com/hostanywhere/hostanywhere/blob/HEAD/compare/zerotier.md

## Sweep corrections summary
- Koyeb: "no sleep, no card" → DISPROVEN on both; card required + 1 h idle sleep; acquired by Mistral AI.
- Render: 5 GB/mo Hobby bandwidth PROVEN; 100 GB figure stale; suspend-on-exhaustion risk added.
- Mapbox: card required PROVEN → demoted under no-card constraint.
- NVIDIA NIM: credit model retired → 40 RPM + 10K req/day rate model (better for sustained use).
- SurrealDB Cloud: free tier exists but is dev/eval-only (1 GB, 7-day pause); self-host for production.

## Still genuinely unknown
- Beam.cloud no-card signup (no public source; needs signup-time check).
- Lightning AI refresh cadence (one-time 30 credits vs 15/month — conflicting sources).

---

# Round 2 — resolved 2026-10-05 (evening)

## 9. Axiom free-tier numbers — PROVEN
**Why:** Re-verified against live axiom.co/pricing (2026-07 re-verification commit) + Axiom's own pricing announcement (crawled 9 days ago). Multiple independent sources agree.
**Key numbers:** Personal (free) tier: **500 GB/month data loading, 10 GB-hr/month query compute, 25 GB storage, 30-day max retention, 2 datasets, 1 user, 3 monitors**. **No credit card required.** Paid Cloud tier also carries an Always-Free allowance: 1 TB/month loading, 100 GB-hr compute, 100 GB storage.
**Implication:** Confirmed as the most generous free log/monitoring lane — 500 GB/mo ingest dwarfs Better Stack (3 GB) and Grafana Cloud (50 GB logs). Keep as monitoring primary; note Axiom Cloud paid tier starts at $25/mo platform fee + usage if exceeded.
Source: https://axiom.co/blog/reimagining-pricing

## 10. WeatherAPI.com free commercial use — PROVEN
**Why:** WeatherAPI.com's own Terms and Conditions state it directly.
**Key numbers:** Free plan: **100K calls/month, 3-day forecast, 1-day history**. Terms grant "a limited, non-exclusive, non-transferable, revocable right to access, use, and view the standard (free) Services... **for your personal or commercial use**." Free users must credit WeatherAPI.com by name/logo; data may not be resold.
**Implication:** Confirmed as the commercial-safe free weather lane (unlike Open-Meteo free, which is non-commercial only). Keep as weather primary. ~95.5% uptime on free — pair with MET Norway (commercial-OK) as secondary.
Source: https://www.weatherapi.com/terms.aspx

## 11. Tebi (S3 storage) card friction — MOOT (service dead)
**Why:** Update note on the main Tebi guide: **"Tebi.io closed on March 31, 2026."** The card question is moot — there is no Tebi to sign up for.
**Key numbers (historical):** was 25 GB storage + 250 GB outbound free; card WAS required for the free tier + PAYG plan (14-day trial without card).
**Implication:** Strike Tebi from the plan entirely. Replacements already in the sweep: **Cloudflare R2** (10 GB, zero egress — primary), Backblaze B2, Tigris (zero egress). No action needed beyond the substitution.
Source: http://blog.51sec.org/2023/04/integrate-sharex-with-free-forever-s3.html (closure update note)

## 12. CacheFly 5 TB free CDN signup — DISPROVEN (stale listing)
**Why:** TrustRadius (multiple 2026 crawls) lists "Free Plan $0/mo, 5 TB, 1 domain, Core Network 19 PoPs" — but CacheFly's own live pricing page (loaded Oct 5, 2026) shows **Developer / Business / Enterprise tiers with no $0 free tier advertised at all**. The TrustRadius data is stale or describes a retired/legacy plan.
**Key numbers (official, current):** no free tier on cachefly.com/pricing; tiers start at Developer (1 domain, email support) with unpublished pricing, then Business, then Enterprise.
**Implication:** Remove CacheFly from the free CDN shortlist. The sweep's **Gcore (1 TB/mo free)** stands as the free-CDN primary; Cloudflare (unlimited, in-stack) remains the default anyway.
Source: https://www.cachefly.com/pricing/

## 13. Upstash Redis free limits — PROVEN
**Why:** Multiple independent 2026 sources (Sep 2026 skill doc, Aug 2026 cost audit, Sep 2026 comparison pulling vendor pricing pages) agree.
**Key numbers:** **500,000 commands/month, 256 MB storage, 10 GB bandwidth, 10 databases. No credit card. Permanent free tier** (since March 2025). Pay-as-you-go beyond: $0.20/100K commands. HTTP/REST + native Redis protocol.
**Implication:** Confirmed as the shared-state/rate-limit lane. **Warning: Upstash bills overages rather than pausing** — set a budget cap in the console at setup or a runaway loop becomes a bill. (Alternative if that's unacceptable: self-hosted Redis on his server, ~50 MB RAM.)
Source: https://tech-insider.org/upstash-vs-redis-cloud-vs-elasticache-2026/

---

# JOB 2 — Self-hosting server sizing (one box, all six services)

Per-service minimums (verified Oct 5, 2026; realistic figures, not marketing):

| Service | Min RAM | CPU | Disk | Notes |
|---|---|---|---|---|
| SurrealDB | ~0.2–0.5 GB | 1 core | 1 GB | Single Rust binary; lightest of the six |
| n8n (+ its DB) | 2 GB | 2 vCPU | 20 GB | Docs minimum; SQLite OK <3K exec/mo, Postgres beyond |
| Uptime Kuma | 0.5–1 GB | 1 core | 1–2 GB | SQLite built in; tiny |
| Authentik | ~1–1.5 GB | 2 cores (host) | ~1.5 GB | Server + worker + Postgres; Redis no longer required (since 2025.10) |
| Infisical | 4 GB (official min) | 2 cores | 20 GB | Heaviest: app + Postgres + Redis. Per-pod defaults: 1000Mi + 512Mi + 256Mi |
| LibreTranslate | 2 GB (3 langs) | 1 vCPU | 1–3 GB | 4 GB recommended for 11 langs; 8 GB+ for all 30+ |

**One-box minimum viable total: ~10–12 GB RAM, 4–6 vCPU, 60–80 GB SSD** (incl. ~1 GB for OS + Docker overhead).

**Optimizations that cut it ~30%:**
- Share ONE Postgres container across n8n + Authentik + Infisical (all three just need a PG database) — saves ~1–1.5 GB vs three separate instances.
- Run n8n on SQLite while under ~3K executions/month — saves a Postgres instance.
- LibreTranslate with `LT_LOAD_ONLY=en,es,fr,de` (4 langs) stays near 2 GB; don't load all 30+.
- Swap Infisical for **Vaultwarden** (~50 MB RAM) if the full Infisical feature set isn't needed — single biggest saving.

**Verdict (updated Oct 5, post-cut):** A typical small VPS (2 vCPU / 4 GB RAM, the $6–12/mo class) does **not** comfortably run all six — Infisical alone wants 4 GB. **Oracle Always Free (2 OCPU ARM / 12 GB RAM since the June 2026 cut, permanent)** handles the stack at $0 only in **slim mode**: Vaultwarden instead of Infisical, n8n on SQLite, LibreTranslate limited to a few languages — that lands ~4–6 GB, comfortable on 12 GB. The full stack's ~10–12 GB estimate is *marginal* against the quota, so don't deploy full on Oracle. Zackary's own server: specs unverified — if it has **12 GB+ RAM and 4+ cores** it runs everything; check with `free -h && nproc` before deploying. If his box is smaller, split: heavy trio (n8n, Infisical, Authentik) on his server, light trio (SurrealDB, Uptime Kuma, LibreTranslate-limited) on Oracle's 12 GB free ARM. *(Pre-cut verdict below retained as historical record: it assumed the 4 OCPU/24GB allocation that Oracle removed June 2026.)*

## Round 3 — CN lanes (2026-10-05)

**1. Zhipu BigModel / Z.AI — international signup friction: PROVEN navigable.**
- Two surfaces: domestic console `open.bigmodel.cn` and international `z.ai` / `api.z.ai` (Cline docs: international users sign up at z.ai/model-api; China users at open.bigmodel.cn; China pricing ~50% lower).
- Official Zhipu registration FAQ: registration **accepts overseas phone numbers**; official auth FAQ: calling the chat/completions API does **NOT** force real-name verification (实名认证) — only the Batch API requires it. (via awesome-free-llm-apis, citing docs.bigmodel.cn/cn/faq/registration-login.md and /authentication-issues.md)
- International free tier: GLM-4.7-Flash / GLM-4.5-Flash / GLM-4.6V-Flash priced **Free** on api.z.ai (OpenAI-compatible endpoint https://api.z.ai/api/paas/v4); new accounts get free starter credits (~50 req/day per community reports).
- Verdict: a Canadian CAN get the free tier — phone signup with a non-CN number is officially supported, no CN ID/real-name needed for API use. Pure **email-only** (no phone at all): UNKNOWN — not confirmed either way.
- Sources: docs.cline.bot/provider-config/zai; github.com/merth1470/awesome-free-llm-apis; GLM-5.2 free setup gist.

**2. SiliconFlow — DISPROVEN for email-only.**
- Registration at cloud.siliconflow.cn/account/login requires a **Chinese phone number** — three independent 2026 sources agree (mcp-video-gen README ×3 forks). Virtual-number workarounds exist (GrizzlySMS) but cost money and aren't email-only.
- Verdict: a Canadian with email-only CANNOT get the free tier through the front door. Demote to "needs CN number or skip."
- Sources: github.com/kevinten-ai/mcp-video-gen (and limaalexandrebr-a11y, aman-saxena26 forks).

**3. Practical routing: use the international door.**
- z.ai (not open.bigmodel.cn) is the correct signup for non-CN users. Same GLM models, Free-priced Flash tiers, no real-name gate on the API.

**4. DeepSeek API (bonus) — trial, not a free tier.**
- New developer accounts get **5M free trial tokens** (valid 30 days, **no credit card required**) — PROVEN across 4 sources.
- After trial: pay-per-token only; **no ongoing free API tier** — PROVEN. Web/mobile chat (chat.deepseek.com) permanently free — PROVEN.
- Current pricing (Oct 2026): V4.1-Flash ~$0.15/1M in / $0.60/1M out off-peak (2× at UTC peak windows); V4-Pro ~$0.66/$1.98 off-peak. Cache hits ~2% of sticker.
- Verdict: grab the 5M-token trial once (no card) as a one-shot boost; it is NOT a recurring free lane. Cheapest paid fallback after.
- Sources: github.com/harishpiyer/free-api-bazaar; techjacksolutions.com; github.com/airouter-dev/penny-pincher-provider; cabina.ai.
