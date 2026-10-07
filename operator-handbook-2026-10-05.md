# FreeStack Operator's Handbook
Date: 2026-10-05. For Lucidota — day-to-day SOPs for running the stack.
Context: runbook-2026-10-05.md (compartmentation + kill-switches), security-review-2026-10-05.md (fixed: router auth, 127.0.0.1 bindings, failover drill, keyless fail-closed).

## 1. Lane selection policy

The AI router (`workers/ai-router.js`, authenticated via `ROUTER_KEY` bearer token, fail-closed 503 if secret missing) tries keyed lanes in priority order automatically. **The operator's job is choosing the right lane class per job, not micromanaging rotation.**

| Job type | Lane order | Notes |
|---|---|---|
| Bulk volume (research, batch, content drafts) | Google AI Studio → Mistral → NVIDIA NIM → OpenRouter :free | NIM gets PUBLIC fragments only — it trains on inputs (eval-only ToS). Never credentials, strategy, or PII. |
| Latency-sensitive (interactive answers, quick turns) | Groq → Gemini Flash | Groq is the fastest lane; keep its RPM headroom for interactive use, don't burn it on batch. |
| Privacy-sensitive (business plan, strategy, anything key-adjacent) | OVHcloud anonymous → Groq → self-host | OVHcloud is the ONLY lane stating no training. Send `x-fail-closed: true` so the router 502s instead of degrading to untrusted keyless lanes (Pollinations/Kilo/LLM7). |
| Code generation / review | Gemini (1M context) → Groq → Mistral Codestral | Public-safe code on NEUTRAL lanes fine. Proprietary algorithms, billing logic, key-handling code: self-host ONLY. |
| Embeddings / rerank | Cohere trial → SiliconFlow ¥0 → self-host | Cohere trial is non-commercial — overflow to self-host before any commercial RAG. |
| Multimodal (image/vision) | Gemini → Agnes AI (training opt-out toggle ON) | Verify opt-out per session; defaults matter. |

### Compartmentation rules, plain
- **No provider EVER gets the full picture.** No single AI lane receives more than ~1/3 of any sensitive document's context in one request. Chunk and distribute.
- **Trust classes:** FRIEND (sensitive OK) = self-hosted everything, OVHcloud, Groq, EU privacy providers, Oracle/GCP. NEUTRAL (fragments only) = Google AI Studio, Mistral, Cloudflare, GitHub, Brevo, PostHog. FOE (never sensitive, never structural) = NVIDIA NIM, Kilo gateway, xAI, UptimeRobot, Storj, TeraBox, Recraft free, OpenWeatherMap One Call 3.0.
- **Keys** live in exactly three places: Infisical self-host (source of truth), Doppler free (encrypted backup), local encrypted export. Never in repos, never in prompts, never in chat.
- **New provider = new classification first.** No exceptions. Classify before first use, document the one-line justification.

## 2. Quota monitoring routine

### Automated (already built)
- **n8n heartbeat-healthcheck.json** — every 5 min: pings router `/health`, Cloudflare, n8n itself. Failures → alert webhook + failover note.
- **cron-job.org external heartbeat** — 1-min, survives server death. If it stops, that's the n8n-death signal.
- **failover-drill.yml** — Mondays 06:00 UTC: GETs router `/health`, asserts ≥3 healthy lanes (`healthy = configured && !inCooldown`). Fails loudly (`::error::`) otherwise.
- **healthchecks.io** — cron watchdog for n8n scheduled jobs.

### Operator routine (Lucidota)
- **Daily (30 seconds):** GET router `/health`. Confirm ≥4 lanes healthy, note any in cooldown. If a lane has been in cooldown >24h, demote it in the sweep file and investigate.
- **Weekly (Monday, after the drill):** pull per-lane RPM usage vs limits (15/30/60/40/20 RPM per lane). Project burn: will any bulk lane exhaust before its weekly/monthly reset? If yes, shift bulk jobs to the next lane preemptively — don't wait for 429s.
- **Thresholds:**
  - 1 lane in cooldown → automatic, no action. Router handles it.
  - 2 lanes down → handle autonomously, note in weekly summary to Zackary (FYI only).
  - **<3 healthy lanes → drill fails → ESCALATE immediately.** Interactive capacity is at risk.
  - Any lane's projected exhaustion would hit interactive (latency/privacy) lanes → preemptively move bulk off them; notify Zackary.

## 3. Weekly rituals

- **Monday:** failover drill runs (automated). Review its result. Then: **ToS re-verification, one provider per week on rotation.** The 2026 die-off list is why: Brave Search API (killed Feb 2026), Storj (bankrupt Jul 2026), Render (bandwidth gutted), Oracle ARM (halved), MailerLite (gutted), Piwik PRO (free killed), nft.storage/web3.storage (free uploads dead), Internxt (cut to 1GB). Check the provider's pricing page + changelog + one community source (Reddit/HN/GitHub issues). Any change → update the sweep file, re-classify if needed, and if it's a primary, warm its secondary THAT DAY.
- **Backup verification:** confirm Neon `pg_dump` landed in B2 AND Tigris (check timestamps + sane file sizes). Confirm weekly email/social list exports in MEGA vault. A backup you haven't verified is a rumor.
- **Prompt audit (spot-check):** review a sample of router/n8n execution logs. Confirm FOE lanes received public fragments only. Confirm no key-shaped strings in any prompt sent to a NEUTRAL/FOE lane.
- **DNS check (quarterly, not weekly):** `dig` across all four authoritative providers — parallel DNS should show zero difference.

## 4. Incident response — exact steps in order

### A. Single lane death (429 storm / lane down)
1. Do nothing first — the router auto-rotates in seconds. Verify via `/health` that the lane shows `inCooldown`.
2. If the lane recovers <24h: log it, move on.
3. If dead >24h: demote it in the sweep file, shift its workload permanently, investigate cause (ToS change? provider issue?).
4. Escalate to Zackary only if it was the primary bulk lane — informational, not urgent.

### B. Whole provider death (outage)
1. Confirm via independent source (status page, second provider, DownDetector) — don't trust the provider's own page alone.
2. Execute the kill-switch table (runbook §4): switch traffic to secondary. DNS needs NO action (parallel-authoritative).
3. Verify secondary is actually serving (health check + one real request).
4. Update the runbook + sweep file with the incident date.
5. Inform Zackary (FYI) with: what died, what's serving now, time-to-recover observed.

### C. Quota exhaustion (lane hits limit before reset)
1. Expected case — router rotates. Verify.
2. If ALL bulk lanes are exhausted: pause non-critical batch jobs (nightly digest can wait a day; weekly content can slip). Protect latency + privacy lanes for interactive use.
3. If interactive capacity is degraded: **escalate to Zackary** — this affects his direct experience.
4. Post-mortem: was burn abnormal? A bug (retry storm, runaway n8n loop) looks exactly like organic exhaustion. Check logs before blaming the quota.

### D. Suspected key compromise — URGENT, do all of this
1. **Revoke** the provider's tokens immediately (Infisical → provider dashboard). Minutes matter.
2. **Rotate** every key that provider ever saw — 1-hour rule.
3. **Switch** the lane to its secondary; update router secrets (`wrangler secret put`).
4. **Audit:** pull logs, determine exactly what was sent through that key, classify the exposure (public fragments / sensitive / credentials).
5. **Re-classify or delist** the provider; update the runbook.
6. **Notify Zackary immediately** with the exposure classification. This is the one incident class that is always an escalation, no matter how small it looks.

### E. Suspected training on sensitive data (FOE compromise)
Same as D, plus: treat the provider as compromised FOE permanently — delist, never re-add without Zackary's explicit decision.

## 5. Escalate vs. autonomous

**Handle autonomously:** lane rotation and cooldowns; failover execution; routine ToS checks; backup verification; pausing non-critical batch jobs; demoting dead lanes in docs; pinning image digests after a green deploy (security review M7); setting `deploy.resources.limits` once real RAM numbers are observed (L5); spot-check prompt audits; updating the sweep file with corrections.

**Escalate to Zackary:**
- **Immediately:** suspected key compromise (D), suspected training on sensitive data (E), <3 healthy lanes sustained, anything that could cost money (Upstash overage risk, any card-required activation prompt).
- **Same day (informational):** primary provider death, interactive capacity degraded, a ToS change that kills a primary's free tier, any new provider classification that changes trust posture.
- **Needs his action/decision:** API key acquisition (he pastes into the vault — never in chat), card-required activations (Oracle, GCP, Modal, Beam if card needed), incorporation decision (unlocks Inception + credit ladders — parked until he says so), quarterly kill-switch drill scheduling.
- **FYI in weekly summary:** 2-lane outages handled, burn-rate projections, demotions, corrections applied.

**The test:** if it needs his money, his credentials, his identity, or his decision — escalate. If it's reversible, documented, and inside the runbook — handle it.

## 6. Monthly review checklist

- [ ] **Key rotation:** router key (`ROUTER_KEY`) + highest-exposure lane keys rotated. Full rotation quarterly (all keys, all three storage locations verified afterward).
- [ ] **Access review:** list everything holding keys — n8n credentials, GHA repo secrets, `wrangler secret`s, Doppler, Infisical. Remove anything stale. Confirm `n8n` `$env.FREESTACK_ROUTER_KEY` matches `ROUTER_KEY`.
- [ ] **$0 audit:** confirm no card-required activation happened, no trial auto-converted, no overage billed (check Upstash usage vs cap especially).
- [ ] **Zenith recompute:** are the free-tier limits still what the sweep says? Update `zenith-v2` if anything moved. (Free tiers die monthly in 2026 — assume drift.)
- [ ] **ToS rotation status:** 4+ providers re-verified this month? Catch up if behind.
- [ ] **Kill-switch drill:** quarterly — pick one primary, simulate death, confirm secondary takeover, record observed time-to-recover vs runbook estimate.
- [ ] **Artifact hygiene:** pin any `:latest` image digests after green deploys (M7); review `deploy.resources.limits` (L5); confirm n8n workflows still ship `active: false` on fresh import.
- [ ] **Sweep file:** all corrections from the month applied, corrections log current, no UNKNOWN older than 60 days without a re-check attempt.
- [ ] **Report to Zackary:** one tight monthly summary — uptime, incidents, quota headroom, money spent ($0 target), what's next.
