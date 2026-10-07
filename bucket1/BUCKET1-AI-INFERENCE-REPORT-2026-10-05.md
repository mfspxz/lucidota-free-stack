# BUCKET 1 — AI Inference APIs: Deep Sweep Report
**Date:** 2026-10-05 | **Operation FreeStack** | **Raw candidates scanned: ~96**

Method: web sweep of pricing pages, changelogs, GitHub free-tier trackers (12britz/awesome-free-models, chid/free-ai, mvalentsev/awesome-free-ai-coding, vhmns14/free-ai-api-tiers, drvivek34/awesome-free-llm-apis, pratik-desgn/free-ai-harness, luongnv89/freetokens, felipetruman/free-llm-hub), HN/Reddit-style threads, and vendor docs. No signups, no accounts created.

Trinary labels: **PROVEN** = live-verified by a third party or stated plainly on official docs. **DISPROVEN** = official docs or consistent reporting say no. **UNKNOWN** = conflicting/no public info, with WHY.

Baseline (already known — carried, not re-ranked): Google AI Studio (Flash-only free tier now, no published RPM table, quotas in-account), Groq (free plan ~30 RPM), Mistral La Plateforme (experiment tier), OpenRouter `:free` (~50 req/day; 1K/day w/ $10 lifetime credit), Cohere (trial key ~1K calls/mo, non-commercial only), HuggingFace Inference Providers ($0.10/mo free), Cloudflare Workers AI (10K neurons/day), GitHub Models (free prototyping tier). Cerebras: NOT free (skipped per task; note: current scheme is $5 credits after adding a verified card, 30-day expiry — consistent with "not free").

---

## RANKED SHORTLIST (top 15)

### 1. NVIDIA NIM (build.nvidia.com) — US
- **URL:** https://build.nvidia.com | API: `https://integrate.api.nvidia.com/v1` (OpenAI-compatible)
- **Free limits:** up to **40 RPM, 10,000 requests/day** per key. No per-token meter — rate is the only scarcity. 120+ open-weight models (Nemotron 3 Ultra/Super, Kimi K3, GLM 5.3, DeepSeek V4.1 Flash, Gemma 4 31B, Llama 3.2 vision…).
- **Friction:** no card; **phone verification required** (bounds multi-accounting). Excludes 14 countries (Canada fine).
- **ToS gotchas:** trial/prototyping terms — "Evaluation only, not production"; **inputs/outputs may be used to train/improve NVIDIA products** (vendor's words). Model ids rename without notice.
- **Jurisdiction:** US. **Verdict:** PROVEN. **Role:** primary bulk-text workhorse — no token cap makes it the biggest recurring free lane.
- **Friend/Foe: FOE for sensitive data** — NVIDIA explicitly logs for training. Fragments/fine for non-sensitive dev work.

### 2. Z.AI (Zhipu/GLM international) — CN
- **URL:** https://z.ai | API: OpenAI-compatible
- **Free limits:** GLM-4.7-Flash, GLM-4.5-Flash, GLM-4.6V-Flash at **$0/token ongoing** — not a trial. Reported ~**1 req/s, ~1,000 req/day** (Flash tier).
- **Friction:** registration, no card reported.
- **ToS gotchas:** CN jurisdiction; "free indefinitely" is current pricing, not a contract — can change with platform announcements.
- **Verdict:** PROVEN. **Role:** secondary bulk-text / reasoning fallback.
- **Friend/Foe: NEUTRAL** — use fragments only; CN data-sovereignty considerations.

### 3. SambaNova Cloud — US
- **URL:** https://cloud.sambanova.ai | API: `https://api.sambanova.ai/v1` (OpenAI-compatible)
- **Free limits:** **200,000 tokens/day per model** free tier when no payment method is linked; plus a one-time $5 signup credit (expires in 3 months). Own RDU chips; Llama 3.3 70B, DeepSeek V3.1/V3.2, Qwen, GPT-OSS-120B, MiniMax M2.7.
- **Friction:** no card for free tier; email signup.
- **ToS gotchas:** SambaCloud ToS grants commercial license (no evaluation-only clause per third-party read); verify in current ToS before production use.
- **Verdict:** PROVEN. **Role:** secondary bulk-text (70B-class models).
- **Friend/Foe: NEUTRAL.**

### 4. OVHcloud AI Endpoints — EU (France)
- **URL:** https://www.ovhcloud.com/en/public-cloud/ai-endpoints/ | API: `https://oai.endpoints.kepler.ai.cloud.ovh.net/v1` (OpenAI-compatible)
- **Free limits:** **completely anonymous, no signup, no key, no card: 2 requests/min per IP per model** (20+ models: Llama, Qwen3.x, DeepSeek, Mistral, gpt-oss-120b…). Authenticated (400 RPM) requires a paid Public Cloud project — free path is anonymous-only.
- **Friction:** zero.
- **ToS gotchas:** 2/min is shared across all anonymous callers per model in practice — expect 429s at busy times; no token cap otherwise.
- **Verdict:** PROVEN (official docs state the anonymous lane). **Role:** zero-friction emergency lane / health-check lane.
- **Friend/Foe: FRIEND** — vendor states inputs are NOT used to train models; EU-hosted (Gravelines), GDPR-friendly. Safest for sensitive-ish fragments.

### 5. UnoRouter — EU (Germany)
- **URL:** https://unorouter.com | API: `https://api.unorouter.com/v1` (OpenAI, Anthropic, Gemini wire formats)
- **Free limits:** 190+ models with `:free` suffix (DeepSeek V4 Flash/Pro, GLM 5.2, Qwen3.5 397B, Nemotron 3 Ultra, Kimi, Mistral lanes…); **~1 RPM per model per user**, 429 + Retry-After, output capped 8K tokens. Fully open source (github.com/unorouter).
- **Friction:** Discord or GitHub sign-in for key; no card.
- **ToS gotchas:** third-party relay — upstream provider logging policies vary; free pools are shared.
- **Verdict:** PROVEN. **Role:** model-rotation fallback pool — rotate `:free` models to multiply throughput.
- **Friend/Foe: NEUTRAL** — open-source stack is a plus, but it's a relay; fragments only.

### 6. Kilo Code gateway — (Anaconda-owned; jurisdiction unconfirmed)
- **URL:** https://kilo.ai | API: `https://api.kilo.ai/api/gateway` (OpenAI-compatible, keyless)
- **Free limits:** **anonymous, no key, no account: 200 requests/hour per IP** on whatever the gateway marks "free" — ~21 ids (Nemotron 3 Ultra/Super, Step 3.7 Flash, Laguna S 2.1, North Mini Code, Inkling Small…). List rotates every few days.
- **Friction:** none. Excludes Iran/Syria/Cuba/North Korea (Canada fine).
- **ToS gotchas:** **every free id carries mayTrainOnYourPrompts** — documented. Model list is volatile; pin nothing.
- **Verdict:** PROVEN. **Role:** keyless coding-agent lane (it's built for Codex/CLIs).
- **Friend/Foe: FOE for sensitive data** (explicit prompt-training on free lane).

### 7. OrcaRouter — (jurisdiction unconfirmed)
- **URL:** https://www.orcarouter.ai | API: `https://api.orcarouter.ai/v1` (OpenAI/Anthropic/Gemini)
- **Free limits:** 4 models at **$0/token permanent**: `deepseek/deepseek-v4-pro-free`, `deepseek/deepseek-v4-flash-free`, `qwen/qwen3.8-27b-free`, `tencent/hy3-free`, plus `orcarouter/free` auto-router. Small daily request quota, resets 00:00 UTC; per-request token cap. (Verified against their public pricing endpoint.)
- **Friction:** API key registration; no card.
- **ToS gotchas:** limits intentionally unpublished; free lineup rotates.
- **Verdict:** PROVEN. **Role:** tertiary fallback / router lane.
- **Friend/Foe: NEUTRAL** — small operator; fragments only.

### 8. Aion Labs — IL (Israel)
- **URL:** https://www.aionlabs.ai | API: `https://api.aionlabs.ai/v1` (OpenAI-compatible; also callable via Puter.js)
- **Free limits:** recurring **~20,000 tokens/day** free (15 RPM reported), no card. 7 models (Aion 1.0/2.0/2.5…).
- **Friction:** registration only, no card.
- **ToS gotchas:** small new vendor; terms may be eval-oriented — read ToS before production use.
- **Verdict:** PROVEN (multi-source + freetokens verification 2026-09). **Role:** small daily lane for cron/background tasks.
- **Friend/Foe: NEUTRAL.**

### 9. Agnes AI — SG (Singapore)
- **URL:** https://platform.agnes-ai.com | API: `https://apihub.agnes-ai.com/v1` (OpenAI-compatible)
- **Free limits:** own Flash models (**agnes-2.5-flash, agnes-3.0-flash**) charged **$0 in/out today** ("free to use indefinitely" per FAQ, but priced as promo — can end with platform announcement). Image generation also free at every resolution. **30 RPM allowed, 10 effective on text models**; no daily figure published.
- **Friction:** registration; no card. Bonus quota may require real-name verification (unclear for Canadians).
- **ToS gotchas:** inputs may train models **unless you opt out** (toggle exists — do it). Singapore law.
- **Verdict:** PROVEN. **Role:** free image + video gen lane (rare) + text fallback.
- **Friend/Foe: NEUTRAL** — turn training opt-out on; fragments otherwise.

### 10. LLM7.io — UK
- **URL:** https://token.llm7.io | API: OpenAI-compatible, keyless anonymous lane
- **Free limits:** anonymous **1 req/sec, 10/min, 60/hour, 500,000 tokens/24h**; free token raises to 15→30 RPM. 30+ models (DeepSeek R1, Qwen2.5 Coder, Gemini Flash-Lite…).
- **Friction:** none anonymous.
- **ToS gotchas:** small UK operator; abuse-sensitive.
- **Verdict:** PROVEN (freetokens verified offer). **Role:** zero-friction backup lane.
- **Friend/Foe: NEUTRAL.**

### 11. Pollinations.AI — DE (Germany)
- **URL:** https://pollinations.ai | Legacy: `https://text.pollinations.ai/openai`; new: `https://gen.pollinations.ai/v1`
- **Free limits:** legacy **anonymous lane answers gpt-oss-20b with no key** (OpenAI-compatible, probed live 2026-10-01); new gen host requires free key with Pollen credits. Image/video/audio also served. Anonymous rate: unstated now (old docs said 1 req/15s — superseded).
- **Friction:** none for legacy lane.
- **ToS gotchas:** legacy lane is unmaintained — could vanish; keyed tier details unverified.
- **Verdict:** PROVEN for the legacy lane (it answers); UNKNOWN on keyed free-tier depth.
- **Role:** last-resort keyless lane. **Friend/Foe: NEUTRAL** — fragments only, assume fragility.

### 12. Vercel AI Gateway — US
- **URL:** https://vercel.com (AI Gateway) 
- **Free limits:** **$5/month in gateway credits, refreshing every 30 days**; routes to 200+ models / 40+ providers. No card.
- **Friction:** Vercel signup.
- **ToS gotchas:** $5/mo aggregate cap across providers — thin but monthly recurring.
- **Verdict:** PROVEN. **Role:** gateway layer with budget caps + fallbacks (not raw inference, but a control plane).
- **Friend/Foe: NEUTRAL.**

### 13. Modal — US
- **URL:** https://modal.com
- **Free limits:** **$30/month in compute credits on the Starter plan, recurring** (does not roll over). Scale-to-zero: you pay only for active inference seconds — ~22 hrs of A10G or ~60K small extraction jobs/mo. Run any open-weight model (Llama 3.1 8B, Qwen2.5…) yourself.
- **Friction:** signup; no card reported for Starter.
- **ToS gotchas:** compute lane, not an inference API — he has to deploy the model. Credits expire monthly.
- **Verdict:** PROVEN. **Role:** self-hosted inference compute — the "run his own stack free" lane (fits the own-server plan; Modal covers GPU he doesn't have).
- **Friend/Foe: FRIEND** — his own models, his own data path. Privacy-clean.

### 14. SiliconFlow — SG/CN
- **URL:** https://siliconflow.com (global) / https://cloud.siliconflow.cn | API: `https://api.siliconflow.cn/v1`
- **Free limits:** **¥0-priced models**: embeddings (BGE-M3, bge-large), rerankers, ASR, image (Kwai-Kolors), OCR-VL models. Text-LLM free tier has shrunk (small Qwen free tier gone from current price page). New-user **¥14 (~$2) signup credit** + **¥16 real-name verification voucher** (campaign through 2026-12-31) — real-name likely blocks Canadians for the voucher.
- **Friction:** phone verification required.
- **ToS gotchas:** real-name verification; CN jurisdiction; free-model list needs login to view.
- **Verdict:** PROVEN (¥0 models + signup credit). **Role:** free embeddings/rerank/ASR/image lane — covers RAG plumbing for $0.
- **Friend/Foe: NEUTRAL** — CN jurisdiction; non-sensitive data only.

### 15. Zhipu BigModel (open.bigmodel.cn) — CN
- **URL:** https://open.bigmodel.cn | API: `https://open.bigmodel.cn/api/paas/v4/` (OpenAI-compatible)
- **Free limits:** **20M free tokens on signup** (+ up to 200M via referrals); GLM-4.7-Flash / 4.5-Flash / 4.6V-Flash have free tiers. International signup reported working (open.bigmodel.cn works abroad; confirm).
- **Friction:** registration; no card reported.
- **ToS gotchas:** CN jurisdiction; token grant is one-time, not recurring — treat as dev/testing fuel, then the permanent Flash free tier takes over.
- **Verdict:** PROVEN. **Role:** bulk test fuel (20M tokens is a lot) + permanent free Flash lane.
- **Friend/Foe: NEUTRAL.**

Also worth naming (just outside the 15): **LongCat direct API (Meituan, CN)** — 500K tokens/day free quota, email signup reportedly works outside mainland China (PROVEN quota; UNKNOWN on Canadian signup friction — strong if accessible); **xKiro** — 5M tokens/day on free models (UNKNOWN, thinly sourced); **Ollama Cloud $0 plan** — monthly starter credits, 1 concurrent, no card, **explicitly no logging/training** (PROVEN, FRIEND); **Scaleway Generative APIs (FR)** — 1M free tokens one-time + 60 min Whisper (PROVEN trial; good EU option).

---

## NOTABLE REJECTS (with why)

- **Together AI** — DISPROVEN. Official billing docs: "does not currently offer free trials. Access requires a minimum $5 credit purchase." Only a token $0 model (Ternary Bonsai 27B) exists. Cheap-paid only.
- **DeepInfra** — DISPROVEN. Pricing page: "You have to add a card or pre-pay or you won't be able to use our services." No free tier at all.
- **Chutes.ai** — DISPROVEN. Own pricing page: "We do not offer a free tier at this time." Bittensor-subsidised cheap paid only ($0–$0.30/1M on some models).
- **Replicate** — DISPROVEN. No formal free tier; "try free" on select models, then billing required.
- **Lambda** — DISPROVEN. Pay-per-token only, no free tier/credits anywhere in docs.
- **Perplexity Sonar API** — DISPROVEN as free API. No permanent free tier; API credits $25–50 trial for new accounts, $5/mo only with a $20/mo Pro sub. (Chat product is free; API is not.)
- **Writer.com (Palmyra)** — DISPROVEN. 14-day trial requiring a credit card; no free tier or credits on AI Studio pricing.
- **glhf.chat** — DEAD. Rebranded to Synthetic (paid only); domain returns Cloudflare 522.
- **Lepton AI** — DEAD. Acquired by NVIDIA; ceased operations 2025-05-20.
- **Infermatic** — REJECTED as API. Free Plan ($0/mo) exists but official pricing grid: **"API Access: No API"** on the free account (API needs $15–20/mo Plus). UI-only free.
- **OpenAI API** — DISPROVEN as free. The "$100/month" row is a usage *limit*, not credit. Effectively pay-from-day-one.
- **Anthropic API** — one-time ~$5 credit after phone verification; no standing free tier.
- **Fireworks AI** — $1 one-time signup credit, 10 RPM, no card; account suspended when it runs out. Trial only — fine as a probe, useless as a recurring lane.
- **Nebius Token Factory** — ~$1 trial credit (30-day); $25 Builder Program credit (90-day expiry, one account/email). Trials only.
- **xAI Grok API** — $25 one-time promo credit (30-day expiry); optional **$150/mo via data-sharing opt-in that is IRREVERSIBLE and feeds ALL prompts/responses into model training** — FOE for anything sensitive. Card required for billing account per some reports. Recurring free is conditional on a privacy poison pill → rejected for production use.
- **Novita AI** — $0.50–$1 one-time signup credit, no card. Trial only. (Also: ToS bars commercial use without written permission — double disqualifier.)
- **Hyperbolic** — $1–$5 promo credit after phone verification. Trial only.
- **Inference.net** — $1 on signup (some sources say $25 via survey — conflicting); trial only.
- **AI21 Studio** — $10 trial; sources conflict on 7 days vs 3 months expiry. Trial only. Jamba models only.
- **DeepSeek direct API** — ~5M signup tokens (30-day expiry), then pay-go. Trial only. (Free chat web is not an API.)
- **Moonshot/Kimi direct API** — ¥15 (~$2) signup credit. Trial only. (Free Kimi chat is not an API.)
- **MiniMax API** — trial credits only (30-day expiry; some promos through 2026-11-07). No permanent free tier.
- **01.AI / Yi API** — initial trial credits only. No standing free tier.
- **Upstage / NLP Cloud** — $10 (3 mo) / $15 (phone verification) trials. Trial only.
- **PPIO (ppio.com)** — ¥5 (~$0.70) signup credit ≈5M tokens. Tiny trial; CN, unverified international access.
- **Baseten** — unspecified one-time workspace experiment credits + startup program (up to $2.5K Model APIs, application-gated). No standing free tier. (Their Model API is cheap-paid.)
- **ZenMux** — "free" requires positive balance and tiny per-window quota. Not free.
- **Venice.ai** — free tier is the *app*, not the API (API needs Pro/funded balance).
- **Kluster.ai** — UNKNOWN leaning reject: current site looks like an AI code-review product; legacy listings claim inference free tier/$5 credits. Could not confirm on official pages.
- **Jina AI / Voyage AI** — one-time grants only (10M tokens non-commercial / 200M embeddings one-time). Not recurring.
- **Deepgram ($200), AssemblyAI ($50), Gladia (€50)** — one-time audio credits, no card. One-shot fuel, not recurring lanes. (Useful for STT/TTS one-offs, not for Bucket 1's 24/7 goal.)
- **SiliconFlow real-name ¥16 voucher** — inaccessible without CN real-name verification; discount, not a lane.

---

## TOP 3 UNKNOWNS WORTH RESOLVING

1. **xAI's actual current offer** — Two detailed sources (2026) describe $25 promo signup + $150/mo irreversible data-sharing program; a third says the $25 beta credits ended in 2024 and rate docs start at $0 spend. Can't resolve without the xAI console/docs. Worth one live-browser check at docs.x.ai (or x.ai pricing) since $150/mo recurring would be the single biggest free grant if the privacy cost were acceptable.
2. **Kluster.ai identity crisis** — legacy free-tier trackers list it as an inference provider with free tier / $5 credits; current web presence looks like a code-review SaaS. Official pages gave no clean answer. Resolve via kluster.ai + platform.kluster.ai directly (needs live browser; docs JS-heavy).
3. **CN real-name / international signup friction** — Zhipu open.bigmodel.cn, SiliconFlow, Z.AI, LongCat direct API all claim international accessibility, but real-name verification requirements and bonus-credit eligibility for a Canadian phone/email are unconfirmed. One signup-flow probe per service (live browser) would convert 4 PROVEN-conditional rows into clean PROVEN or DISPROVEN.

---

## Stack-building notes for the parent

- The "big five" recurring no-card text lanes: **NVIDIA NIM, Z.AI, SambaNova, Kilo gateway, UnoRouter/OrcaRouter**. NIM + Z.AI + SambaNova alone cover bulk; Kilo/Uno/Orca are rotation fallbacks.
- **Privacy-clean subset:** OVHcloud (anonymous, no training), Ollama Cloud (explicit no-logging), Modal (own models on rented GPU), Google/Groq baselines. Everything else = fragments only.
- **EU lanes exist:** OVHcloud (anonymous), Scaleway (1M one-time), UnoRouter (Germany). **SG lane:** Agnes, SiliconFlow. **CN lanes:** Z.AI, Zhipu, LongCat — strongest token volumes, weakest data-sovereignty posture.
- **Audio/specialty fuel (one-time but big):** Deepgram $200, AssemblyAI $50, Cartesia 20K credits/mo recurring (TTS!), Lemonfox daily free audio, SiliconFlow free ASR, Scaleway 60 min Whisper one-time.
- **Compute lanes for self-hosting (recurring):** Modal $30/mo, plus Oracle Cloud always-free ARM (2 OCPU/12GB since the June 2026 cut — runs small models), Google Colab, Kaggle ~30 GPU hrs/week.
- Gateway control planes worth wiring: **OpenRouter `:free`** (baseline) + **Vercel AI Gateway** ($5/mo recurring) + LiteLLM/OpenCode Zen-style routing.
