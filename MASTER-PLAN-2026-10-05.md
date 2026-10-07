# Operation FreeStack — Master Plan
Date: 2026-10-05. Researched by 4 parallel agents, verified against Oct 2026 sources. Synthesized by Lucidota.

Goal: a 24/7 "do whatever I want" company — R&D, marketing, advertising, research, bug testing — for $0, with Lucidota as the main operator.

## CORRECTIONS TO ASSUMPTIONS (verified)
- **Cerebras is NOT free anymore.** Old 1M-tokens/day free tier is gone; now $5 trial credits, card required, expire in 30 days. Excluded from the free stack.
- **Mailchimp free is gutted** (Feb 2026: 250 contacts / 500 emails / no automation). Use **Brevo** instead.
- **Vercel Hobby is non-commercial only.** Anything that makes money can't live there free. Use Cloudflare Pages.
- **Supabase free pauses after 7 idle days.** Fine as a database, unusable as the always-on layer.
- **Fly.io has no free tier** for new accounts. Skip.
- "Industry Canada" = ISED now (noted before, repeating because grant applications need the right name).

## THE STACK

### Layer 1 — Brains (free AI inference, programmatic)
| Service | Free deal | Use for |
|---|---|---|
| Google AI Studio (Gemini API) | No card, ~500–1,500 req/day on Flash models, 1M context | Primary workhorse: research, writing, codegen |
| Groq | No card, 30 RPM, up to 14.4K req/day on small models, fastest inference | High-frequency small calls, transcription (Whisper ~8h/day free) |
| Mistral La Plateforme | Phone verify only, **~1B tokens/month** | Bulk monthly burn, EU-hosted |
| OpenRouter :free | No card, 50 req/day (1,000/day after one-time $10 credit) | Failover / model variety |
| Cohere trial key | No card, never expires, 1,000 calls/month, non-commercial | Embeddings + rerank (RAG backbone) |
| Cloudflare Workers AI | ~10K neurons/day, already on his account | In-edge inference next to Workers |
| GitHub Models | Free with GitHub account, per-model daily caps | Spare capacity |

Caveat: Google free-tier data may train their models; Mistral free requires opt-in to training. Fine for company work, keep secrets out.

> **Lane list is now 11 lanes (7 keyed + 4 keyless)** — the table above is the original research snapshot. Current operational order: Gemini → Groq → Mistral → z.ai → NVIDIA NIM → OpenRouter :free → SambaNova (⚠️ free tier disputed Sep 2026 — verify at signup), then keyless Pollinations → Kilo → OVHcloud → LLM7. See `workers/README.md`.

### Layer 2 — Build (ship software at $0)
- **Cloudflare (backbone):** Pages (unlimited sites + bandwidth, custom domains), Workers (100K req/day, never sleeps), D1 SQLite (5M rows read/day), R2 (10 GB, zero egress), KV. This hosts everything public-facing.
- **Google Antigravity** (identified — this is what Zackary meant): free agentic coding IDE, ~20 agent requests/day, no card. His coding agent alongside Lucidota.
- **GitHub:** unlimited private repos, Actions (2,000 min/mo private, unlimited public), Codespaces hours.
- **Neon:** free Postgres, 1 GB × up to 100 projects, pgvector/PostGIS — the database when SQLite won't cut it.
- **Supabase:** only where auth/realtime bundle is needed; accept the 7-day pause.

### Layer 3 — Create (marketing/advertising/content)
- **Canva free:** unlimited designs, 250K+ templates, no watermark on free assets.
- **CapCut free:** full video editor, auto-captions, TTS voiceover, no watermark if you stick to free assets — the ad machine.
- **Brevo free:** 100K contacts, 300 emails/day, CRM + API.
- **Buffer free:** 3 channels, 10 queued posts/channel, all major networks.
- **Pexels/Unsplash:** unlimited free commercial stock.
- **TTSMaker:** 20K chars/week, commercial OK — voiceovers; ElevenLabs free for quality-critical clips.
- **Notion free:** company brain/ops hub (solo).
- **Design.com / Namecheap logo maker:** free logo + brand kit, commercial license.
- **Figma free:** mockups.

### Layer 4 — Glue (24/7 automation)
- **n8n self-hosted on his server: UNLIMITED executions, $0.** This is the primary nervous system — AI agent nodes, 400+ integrations, 1-min cron.
- **Cloudflare Workers:** always-on webhook receivers + up to 5 cron triggers (1-min). Survives his server going down.
- **GitHub Actions:** heavy scheduled AI batch jobs (unlimited minutes on public repos).
- **cron-job.org:** free external heartbeat to keep things warm / ping health checks.
- **Pipedream:** 100 invocations/day for event-driven webhooks.

### Layer 5 — Lucidota (the operator)
Me. Main agent on a persistent VM with subagents, background processes, scheduled jobs, and browser. I sit above all four layers: I write the n8n workflows, call the free AI APIs directly via curl once keys are in the vault, run parallel research/build subagents, and keep the company's memory. The stack runs 24/7; I direct it whenever Zackary gives an order.

## HOW IT FITS TOGETHER
```
Zackary gives an idea
        │
   Lucidota (me) — breaks it into parallel work
        ├── subagents: research / code / content (burning free AI APIs)
        ├── n8n (his server): scheduled + event-driven workflows, unlimited
        ├── Cloudflare: public hosting, webhooks, cron, edge inference
        ├── GitHub: code, CI, heavy batch jobs
        └── Notion/Brevo/Buffer/Canva/CapCut: output & distribution
```

## 24/7 OPERATING RHYTHM
- **Always on:** n8n workflows (server) + Cloudflare cron/webhooks + cron-job.org heartbeat.
- **Scheduled:** GitHub Actions for heavy batch work (nightly research digests, weekly content batches).
- **On demand:** Zackary drops an idea in chat → I fan out subagents across the free AI APIs in parallel → results land in Notion/GitHub → scheduled jobs publish via Buffer/Brevo.
- **Quotas respected:** each free API has its lane (Gemini = volume, Groq = speed, Mistral = bulk, Cohere = embeddings) so no single limit chokes the system.

## SETUP CHECKLIST (Zackary's 5-minute jobs)
1. API keys: Google AI Studio, Groq, Mistral — no cards needed. Hand them to Lucidota via the secure vault.
2. Install n8n on his server (Lucidota can do this over SSH with access).
3. Cloudflare: already has the account. Workers AI + Pages + D1 ready to activate.
4. GitHub: repo for the company ops (private), Actions enabled.
5. Notion: company brain workspace.
6. Brevo + Buffer: connect, verify sender domain later.

## WHAT THIS CAN'T DO FREE (honest limits)
- No persistent GPU training; inference only.
- Supabase/Neon/Replit sleep or cold-start — Cloudflare is the only always-warm free compute.
- Free AI APIs are rate-limited: the system parallelizes *across providers*, not infinitely within one.
- Anything needing a credit card beyond trials: excluded by design.
- Weekly Muse quota still governs how much *Lucidota-directed* work happens; the n8n/Cloudflare/GitHub layers run independently of it.
