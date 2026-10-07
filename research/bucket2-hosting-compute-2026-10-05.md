# BUCKET 2 — Code/Build/Host/Compute Deep Sweep
Date: 2026-10-05. Research-only. ~115 raw candidates touched, shortlist of 15 below.
Trinary legend: PROVEN = verified in this sweep (Oct 2026 sources). DISPROVEN = verified dead/false. UNKNOWN = couldn't verify / conflicting.

## Critical context changes since baseline assumptions
- **Oracle Always Free ARM was CUT in June 2026** (enforced Aug 18, 2026): 4 OCPU/24 GB → **2 OCPU/12 GB** shared across up to 2 instances (1,500 OCPU-hours + 9,000 GB-hours/mo). x86 micros untouched (2× E2.1.Micro, 1 OCPU/1 GB each). 200 GB block storage, **10 TB/mo outbound** unchanged. Card required. Idle-instance reclamation reports persist on Reddit/GitHub.
- **AWS restructured free tier (July 2025)**: new accounts get **$100–200 credits / 6 months**, NOT 12-month EC2/RDS. Lambda 1M req/mo + 400k GB-s still **perpetually** free. API Gateway free 12-mo → **billable from request 1** on new accounts. Public IPv4 charged since Feb 2024 (~$3.60/mo/IP; new accounts get no 750h IPv4 exemption). DynamoDB 25 GB always free BUT only provisioned mode (on-demand bills from request 1). CloudFront 1 TB/mo always free.
- **Render free bandwidth cut ~April 2026**: 100 GB → **5 GB/mo** on Hobby workspace (per Render docs cited by researchers; older guides still say 100 GB — verify live). Web services: 750 h/mo, sleep 15 min, 512 MB/0.1 CPU. Free Postgres 1 GB **expires 30 days** after creation.
- **Netlify is credit-based (Sept 2025)**: 300 credits/mo free (~15 GB bw at 20 credits/GB); deploys cost credits; **sites pause (not throttle)** at zero.
- **HuggingFace Spaces compute effectively paywalled in 2026**: new free accounts report 0 CPU quota; creating Gradio/Docker compute Spaces requires PRO ($9/mo). Static Spaces still free. ZeroGPU: 2 spaces, ~5 min/day for accounts in good standing (30+ days).
- **Railway = trial only**: $5 one-time (30 days), then Free plan = **$1/mo non-rolling credit** (~one tiny idle app). Card: not required for trial.
- **Hetzner: NO free tier** (PROVEN/DISPROVEN). €20 referral credit exists per some 2026 sources; others say discontinued — DISPUTED. Prices raised June 15, 2026.

## RANKED SHORTLIST (top 15)

### 1. Oracle Cloud Always Free — oracle.com/cloud/free
- Limits: 2 OCPU / 12 GB ARM (A1.Flex, up to 2 VMs share quota), 2× x86 E2.1.Micro (1 OCPU/1 GB each), 200 GB block storage, **10 TB/mo outbound**, forever.
- Signup: card required (+$1 auth hold); stay inside "Always Free Eligible" labels for first 30 days.
- Gotchas: capacity errors ("out of capacity" common — retry/switch region); idle-instance reclamation risk (keepalive advised); commercial use allowed.
- Jurisdiction: US. Verdict: **PROVEN** (always-free). Role: **primary off-server always-on host** (n8n failover, Docker, Coolify/CapRover). FRIEND — biggest free VM on Earth, but capacity friction is real.

### 2. Google Cloud Always Free — cloud.google.com/free
- Limits: 1× e2-micro (0.25 vCPU burst/2, 1 GB RAM, 30 GB disk, **1 GB egress/mo**, US regions only: us-west1/central1/east1); **Cloud Run 2M requests/mo** (180k vCPU-s, 360k GB-s, 1 GB egress); **Cloud Functions 2M invocations/mo** (400k GB-s); Cloud Build **120 min/day**; BigQuery **1 TB queries/mo**; Firestore 50k reads/day; Secret Manager 6 versions; Pub/Sub 10 GB/mo.
- Signup: card required; trial ($300/90d) **pauses** at exhaustion — no auto-charge (best anti-surprise in industry).
- Gotchas: e2-micro region-locked; 1 GB egress is tiny; commercial use allowed.
- Jurisdiction: US. Verdict: **PROVEN**. Role: **serverless burst + analytics brain** (Cloud Run scale-to-zero microservices, BigQuery). FRIEND.

### 3. Deno Deploy — deno.com/deploy
- Limits: **1M requests/mo**, 20 GB egress/mo (was 100 GB in older guides — current pricing page says 20 GB), 15 CPU-hours/mo, 350 GiB-h memory-time, 1 GiB KV, 450k KV reads/300k writes, 20 active apps, 50 custom domains. Over-limit → org paused until next cycle.
- Signup: no card; commercial use allowed.
- Gotchas: JS/TS/WASM only; 50 ms CPU/request cap; Deno Cron can burn budget.
- Jurisdiction: US. Verdict: **PROVEN**. Role: **edge API layer** (webhooks, cron receivers). FRIEND.

### 4. Koyeb — koyeb.com
- Limits: 1 free web service, **512 MB RAM / 0.1 vCPU**, 2 GB SSD, **100 GB outbound/mo**, **no sleep**, 5 custom domains; free Postgres (1 GB, limited active hours). No card (per 2026 guides).
- Gotchas: single instance; regions Frankfurt/Washington DC; Postgres not always-on.
- Jurisdiction: EU (France). Verdict: **PROVEN-ish** (Apr 2026-verified guides; confirm regions live). Role: **always-on microservice** (warm webhook receiver). FRIEND.

### 5. Aiven Free Tier — aiven.io
- Limits: **always-on** Apache Kafka, **PostgreSQL**, **MySQL**, **OpenSearch** (+ Valkey/Redis-compatible) free: 1 CPU / 1 GB RAM / ~5 GB storage each; no time limit.
- Signup: no card.
- Gotchas: no connection pooling on free PG; forum-only support; limited regions; no SLA.
- Jurisdiction: EU (Finland). Verdict: **PROVEN** (official site + 2026 guides). Role: **managed DB/cache/message queue without self-hosting**. FRIEND — no-card managed Postgres is rare.

### 6. CockroachDB Cloud — cockroachlabs.com
- Limits: **50M request units/mo + 10 GiB storage free**, serverless, Postgres wire protocol.
- Signup: no card to start (card required for multiple clusters).
- Gotchas: BSL license; overage $0.20/M RU.
- Jurisdiction: US. Verdict: **PROVEN**. Role: **distributed SQL spare** (if Neon ever chokes). FRIEND.

### 7. TiDB Cloud Starter — tidbcloud.com
- Limits: free serverless MySQL-compatible cluster; older docs: 25 GB row + 25 GB column storage, 250M RUs/mo per org; **TiDB Zero**: ephemeral instances via single API call, no sign-up, expire after 30 days.
- Signup: free account; Zero needs nothing.
- Gotchas: foreign-key support native (unlike PlanetScale); paid overages metered.
- Jurisdiction: US (PingCAP). Verdict: **PROVEN-ish** (vendor docs + Sept 2026 guides). Role: **MySQL-compatible spare / agent-provisioned test DBs**. FRIEND.

### 8. Kinsta Static Site Hosting — kinsta.com/static-site-hosting
- Limits: **100 static sites free**, **100 GB bandwidth/mo**, 600 build min/mo, custom domains + SSL, 260+ CDN locations, git deploy (GitHub/GitLab/Bitbucket).
- Signup: no card mentioned.
- Gotchas: static only; 1 concurrent build; commercial use not explicitly forbidden in launch materials.
- Jurisdiction: US. Verdict: **PROVEN** (launched Oct 2023, still listed 2026, vendor committed "free forever"). Role: **tertiary static host / landing-page fleet**. FRIEND.

### 9. AWS Lambda (always-free) — aws.amazon.com/lambda
- Limits: **1M requests/mo + 400,000 GB-s compute/mo, forever**; 15-min max duration; 10 GB ephemeral.
- Signup: card required.
- Gotchas: **API Gateway free tier is 12-mo-only for legacy accounts / gone for new accounts** — use Lambda **Function URLs** to stay free; cold-start INIT billed since Aug 2025; public IPv4 charges; ARM Graviton 20% cheaper.
- Jurisdiction: US. Verdict: **PROVEN** (always-free core). Role: **serverless compute overflow** (scheduled jobs via EventBridge). NEUTRAL — free core is real but the AWS billing minefield is the worst in class.

### 10. Render — render.com
- Limits: 750 free instance hours/mo (512 MB/0.1 CPU), **sleeps after 15 min idle** (~1-min cold start), 500 build min/mo, 5 GB outbound/mo (DISPUTED — see unknowns), 2 custom domains, free Postgres 1 GB **expires 30 days**.
- Signup: no card (card needed only for paid).
- Gotchas: sleep kills user-facing use; workers/private services have no free tier; no disk on free.
- Jurisdiction: US. Verdict: **PROVEN** (free tier exists). Role: **staging + background jobs only**. NEUTRAL — sleep + bandwidth cut hurt.

### 11. alwaysdata — alwaysdata.com
- Limits: 1 GB NVMe, **256 MB RAM**, **10 GB outbound/mo**, **SSH access**, Node.js/Python/PHP/Ruby/Go/Rust/Deno/Elixir/Java/Lua, **managed MySQL/PostgreSQL/MongoDB/CouchDB**, **no sleep**, no card.
- Gotchas: custom domain on free plan — DISPUTED (one source says no custom domains on free); tiny RAM; 0.25 CPU.
- Jurisdiction: France (EU). Verdict: **PROVEN-ish** (multiple 2026 guides). Role: **no-card always-on sandbox / lightweight API**. FRIEND.

### 12. Serv00 — serv00.com
- Limits: **3 GB storage**, 512 MB RAM, **SSH (FreeBSD shell)**, user background processes allowed (PM2 etc.), pre-installed Node/Python/Rust/C++/Java, no card.
- Gotchas: shared shell (not a VM); Polish operator; fair-use bandwidth.
- Jurisdiction: Poland (EU). Verdict: **PROVEN-ish** (multiple 2026 guides). Role: **no-card shell box** (bots, cron, dev). FRIEND.

### 13. Modal — modal.com
- Limits: **$30/mo recurring free compute credits** on Starter plan (covers ~50h T4 / 7.6h H100 / ~638 CPU core-hours); per-second billing; Python-native serverless; scheduled + web functions.
- Signup: **card required** (billing docs: "you must have a payment method on file to use Modal").
- Gotchas: credits may be $5 on some accounts (disputed); card blocks no-card ethos.
- Jurisdiction: US. Verdict: **PROVEN**. Role: **GPU/ML burst jobs** (media processing, model inference). NEUTRAL — the only free recurring GPU path, but card-required.

### 14. UptimeRobot — uptimerobot.com
- Limits: **50 monitors free**, 5-min checks, HTTP/ping/port/keyword/SSL/heartbeat, email alerts, no card.
- Gotchas: 5-min interval only; SMS paid; 3-mo data retention; positioned "hobby and non-profit."
- Jurisdiction: UK/US. Verdict: **PROVEN**. Role: **heartbeat/keepalive operator** (wakes sleeping tiers, watches everything). FRIEND.

### 15. Backblaze B2 — backblaze.com/b2
- Limits: **10 GB free forever** (S3-compatible API), egress **free up to 3× monthly stored byte-hours**, then $0.01/GB; unlimited egress via partner CDNs (Cloudflare etc.).
- Signup: card (verification). Verdict: **PROVEN**. Role: **backup/media bucket behind R2/Cloudflare**. FRIEND.

## Notable rejects (with why)
- **Fly.io** — no free tier for new accounts (PROVEN). Dead.
- **Hetzner** — no free tier (PROVEN). €20 referral credit disputed; prices raised June 2026.
- **Railway** — trial only: $5/30d then $1/mo credit (PROVEN). Not always-on-able.
- **Vercel Hobby** — non-commercial only (PROVEN, baseline).
- **Supabase** — pauses after 7 idle days (PROVEN, baseline).
- **PlanetScale** — free tier ended March 2024 (PROVEN). Dead.
- **Begin.com** — no documented free hosting tier (DISPROVEN).
- **Fleek IPFS** — hosting discontinued Jan 31, 2026 (PROVEN). Dead.
- **Replit** — free publishing = 1 project, expires 30 days, deployments sleep (PROVEN-ish). Dev tool, not infra.
- **HuggingFace Spaces (compute)** — new accounts effectively 0 CPU quota; compute Spaces need PRO (PROVEN-ish, 2026). Static Spaces still free — keep for static only.
- **ngrok free** — 1 GB/mo + interstitial warning page (PROVEN). Cloudflare Tunnel (already in stack) beats it.
- **Paperspace free GPU** — effectively never available (DISPROVEN-ish).
- **Alibaba Cloud** — trial only ($300 credit, $50 usable on ECS); no always-free tier (PROVEN-ish).
- **Netlify** — credit-based free (300 credits/mo ≈ 15 GB bw); sites **pause** at zero (PROVEN). Fragile for 24/7.
- **Stormkit cloud** — paid from $20/mo (PROVEN); self-hosted free is fine on his server but needs his infra.
- **Tiiny.host / Static.app** — 1 site, 3 MB upload, 5 GB/mo + banner / 7-day paid trial (PROVEN-ish). Too thin.
- **Wasabi** — no free tier, 1 TB minimum (DISPROVEN for free).
- **Azure for Students** — $100/yr, no card, but student-only (FOE for him).
- **Tigris** — no free tier found (UNKNOWN leaning no). R2/B2 win anyway.
- **000webhost** — reportedly shut down 2024 (UNKNOWN this sweep; excluded).
- **Storj** — no free tier found post-July-2026 simplified pricing (UNKNOWN).
- **Codeberg/SourceHut/GitLab Pages** — fine as OSS-leaning static redundancy (PROVEN-ish) but not ranked: Codeberg is OSS-focused, SourceHut free only during public alpha.
- **Azure Functions** — 1M exec + 400k GB-s/mo free grant is PROVEN, but Y1 Consumption is legacy (Flex Consumption is the new default; grant applies to Y1), plus card + Azure billing complexity → NEUTRAL, did not rank.
- **Azure Cosmos DB** — 1000 RU/s + 25 GB lifetime free (PROVEN), card required → NEUTRAL spare DB.
- **Glitch** — 1000 hrs/mo but sleeps after 5 min, Node-centric (PROVEN-ish) → NEUTRAL thin.
- **PythonAnywhere** — 1 web app free, but **outbound internet whitelisted** on free tier (PROVEN-ish) → NEUTRAL thin.
- **Coolify Cloud** — $5/mo min (PROVEN) → NEUTRAL; self-hosted version is free on his server.
- **Replicate/Inferless/Beam/Daytona** — one-time trial credits only (PROVEN) → TRIAL, not stack material.
- **Lightning AI** — ~15 credits/mo (~22 GPU-h), no card (PROVEN-ish, secondary source) → NEUTRAL GPU backup behind Modal.

## Top 3 unknowns worth resolving
1. **Render free bandwidth: 5 GB vs 100 GB/mo.** Render docs (cited by researchers) say Hobby cut to 5 GB in April 2026; older guides still say 100 GB. Resolve at render.com/docs/free — decides whether Render can serve any real traffic.
2. **Koyeb free tier current shape.** 2026 guides agree on free nano (512 MB/0.1 vCPU, no sleep, 100 GB egress, no card) but sources disagree on Postgres terms and whether outbound is still free. Resolve at koyeb.com/pricing — best no-card always-on candidate.

> **CORRECTION (2026-10-05, unknowns-resolved):** the "no sleep, no card" verdict was DISPROVEN — Koyeb requires a card ($29 pre-auth), sleeps after 1 h idle, and was acquired by Mistral AI. Demoted to sleep-tolerant tertiary; not in the no-card path.
3. **SurrealDB Cloud free tier.** Unverified this sweep; directly relevant (his homerolled stack is SurrealDB). Resolve at surrealdb.com/cloud pricing — could replace/augment Neon for his ontology graphs.

Secondary unknowns: alwaysdata custom domain on free (disputed); Hetzner €20 referral credit status; GitHub Pages commercial-use restriction claim (from Tiiny comparison table — unverified); TiDB Starter exact current RU/storage numbers.
