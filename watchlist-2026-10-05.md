# FreeStack Watchlist — 2026-10-05
Upcoming free tiers, betas, and programs to re-check. Trinary labels: PROVEN / DISPROVEN / UNKNOWN.
Re-check cadence: monthly unless dated otherwise. No signups performed.

## 1. ANNOUNCED BUT NOT YET LIVE (free AI inference)

### Prime Intellect — Prime Inference free tier — UNKNOWN
- What: Prime Intellect announced public release of Prime Inference (OpenAI-compatible inference API, `api.pinference.ai/api/v1`) on **Oct 2, 2026**. GLM-5.3 serving path, tool calling.
- Status: LIVE as a product; **free tier for inference NOT specified in launch materials** — UNKNOWN whether any free credits exist. Their training stack has free options; do not assume inference does.
- Re-check: monthly (first check ~Nov 5, 2026).
- Action when it flips: if free credits/rate-limited tier announced, add as a router lane in `workers/ai-router.js` behind the PROVEN lanes; verify no-training ToS before routing anything sensitive.

### NVIDIA PAIR (Personal AI Router) — ANNOUNCED, availability UNKNOWN
- What: announced Sept 3, 2026 at IFA. Free open-source tool that auto-discovers home-network GPUs and routes inference across them — offline parallel agentic workflows. Integrates Ollama + LM Studio at launch. Windows/macOS/Linux, RTX 20+ / Apple M4.
- Status: announced; ship state UNKNOWN as of Oct 5.
- Re-check: monthly.
- Action when it flips: deploy on his server to orchestrate local Ollama models as a zero-cost private inference lane (FRIEND by construction — his hardware).

### OmniRoute free-quota aggregator — UNKNOWN (unverified claim)
- What: open-source gateway claiming to unify 236 providers behind one OpenAI endpoint and drain free-tier quotas (~1.6B tokens/month claimed). Source: single Medium article.
- Status: UNKNOWN — existence and numbers unverified.
- Re-check: once (verify repo exists, stars, last commit).
- Action: only adopt if repo is real and maintained; treat quota claims as marketing until tested.

### MiMo Code (Xiaomi) free coding tier — UNKNOWN
- What: reported no-login free coding tier, unlimited context, single-shell-command install.
- Status: UNKNOWN — single-source claim.
- Re-check: once.
- Action: verify, then evaluate vs Antigravity free.

## 2. STARTUP / DEVELOPER CREDIT PROGRAMS (rolling admissions)

### Anthropic — Claude for Startups — PROVEN (program exists); credits gated
- What: application-based; API credits + upgraded rate limits. No published amount.
- Eligibility: program membership open to anyone (no VC needed). **Credits require institutional equity funding + founded within 4 years** (PROVEN, conservative reading). Incorporation not explicitly stated — UNKNOWN, but VC backing implies it.
- Status: rolling, no deadline.
- Action: **apply the day of incorporation.** Parked until then.

### AWS Activate — Founders tier — PROVEN
- What: up to **$5,000** self-funded, no partner needed, apply directly. Higher tiers ($200K) need partner Org ID.
- Incorporation: "bootstrapped OK" (PROVEN tag); formal incorporation requirement UNKNOWN — check at apply time.
- Status: rolling.
- Action: attempt the Founders application pre-incorporation if the form allows; otherwise day-of-incorporation list.

### Google for Startups Cloud Program — Start tier — PROVEN (program); terms UNKNOWN in detail
- What: Start tier up to **$2,000** for pre-funded startups <5 years; Scale up to $200K; Scale AI up to $350K.
- Incorporation requirement: UNKNOWN from sources checked.
- Status: rolling.
- Action: check Start-tier eligibility; lowest bar of the cloud programs.

### AssemblyAI Startup Program — PROVEN
- What: 12 months recurring monthly credits on speech APIs for early-stage voice/audio teams; no funding needed; bootstrapped OK. Amount unpublished.
- Incorporation: not stated — UNKNOWN.
- Status: rolling.
- Action: apply when the voice pipeline (Whisper/TTS lanes) needs commercial-grade STT; check incorporation at apply.

### Baseten AI Startup Program — PROVEN
- What: up to **$25,000** dedicated inference/training + **$2,500** model APIs, no partner needed, new customers only.
- Incorporation: not stated — UNKNOWN.
- Status: rolling.
- Action: day-of-incorporation candidate; verify pre-incorporation eligibility.

### NVIDIA Inception — PROVEN; PARKED (incorporation mandatory)
- What: free, no equity, rolling; unlocks AWS Activate pathway (up to $100K), Nebius AI Lift (up to $150K cloud + $10K inference), DLI training, DGX Cloud Innovation Lab.
- Eligibility: incorporated, <10 yrs, ≥1 dev, working website. PROVEN.
- Action: **apply the day of incorporation** — unlocks the credit ladder.

## 3. FREE TIERS RUMORED / CHANGING (either direction)

### Gemini free API erosion — PROVEN trend, WATCH
- April 2026: Pro-class models quietly removed from the free API tier (no changelog; surfaced via 429s). Oct 9, 2026: consumer Gemini app cut to 1 model (reporting says API unaffected — treat as PROVEN for app, UNKNOWN for future API impact).
- Re-check: monthly.
- Action: if free API quotas tighten, re-weight `ai-router.js` lane order (Groq → primary, Mistral bulk unchanged). The router exists precisely for this.

### Reddit free data routes dying — PROVEN, dated
- RSS feeds end **Nov 13, 2026**; unauthenticated public API ends **Mar 2027**; developers must register + be approved by **Jan 12, 2027** and move to Devvit (Reddit-hosted apps).
- Re-check: Dec 2026 (confirm Devvit free terms).
- Action: migrate any research scraping off Reddit free endpoints before Nov 13; evaluate Devvit only if free tier is real.

### Groq Llama 3.x retirement — PROVEN (already happened)
- Llama 3.x models retired from Groq 2026-08-16 per changelog. Lane models in the router must track current roster.
- Re-check: quarterly (lane model roster audit).
- Action: keep `*_MODEL` env overrides current; the README documents this.

### Industry direction — CONTEXT (not a watch item per se)
- OpenAI halved its $200 Pro plan usage Oct 30, 2026 and added a $500 tier. Flat-rate unlimited is ending industry-wide. Expect free tiers to keep tightening; the multi-lane router + monthly re-checks are the structural defense.

## 4. SEASONAL / EVENT-BASED GRANTS

### Hacktoberfest 2026 — LIVE NOW (October)
- What: stickers/badges for participation; PRs don't count toward rewards (deliberate); Fests have prizes.
- Action: low value for credits; skip unless attending a Fest for networking.

### MLH / GDG hackathons & DevFests — RECURRING
- What: Groq offers **$10 API credits/participant + $300 prize** for best Groq project (console.groq.com/hackathon). Google Developer Groups events hand out **~$25 Google Cloud credits** (must claim during event; works with Vertex AI, not AI Studio billing).
- Re-check: event calendars quarterly.
- Action: attend/enter 1–2 local AI hackathons per quarter — credits + prize money + the project doubles as marketing.

### GitHub Education / Student packs — NOT APPLICABLE
- Requires student status. DISPROVEN as an avenue for Zackary.

### Cloud seasonal promos (Alibaba AI Catalyst $120K etc.) — WATCH
- Alibaba Cloud AI Catalyst: $120K, no partner needed (regional — likely APAC-weighted). Worth a look if expanding lanes; geo-eligibility UNKNOWN.
- Re-check: the free-startup-credits repo (tayyabakmal1) monthly — it's human-verified and dated.

## RE-CHECK CALENDAR
| Date | Check |
|---|---|
| ~Nov 5, 2026 | Prime Inference free tier? NVIDIA PAIR shipped? Gemini API limits changed? Reddit Devvit terms? |
| ~Dec 5, 2026 | Same sweep + Anthropic/AWS/Google program terms unchanged? |
| Quarterly | Router lane model roster audit; hackathon calendar scan; free-startup-credits repo diff |
| Day of incorporation | Anthropic, AWS Activate, Google Start, Baseten, NVIDIA Inception — apply all five |
