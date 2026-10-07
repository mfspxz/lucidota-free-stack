# ai-router — free-tier AI failover router (Cloudflare Worker)

OpenAI-compatible `POST /v1/chat/completions` endpoint that fans out across
**thirteen** free inference lanes with automatic failover: 9 keyed lanes, then a
4-lane **keyless tier** that needs no signup at all.

| # | Lane | Free deal (verified Oct 2026) | Why this position |
|---|------|-------------------------------|-------------------|
| 1 | Google AI Studio (Gemini) | ~500–1.5K req/day, no card, frontier quality | Biggest daily volume + best quality → primary |
| 2 | Groq | 30 RPM, up to ~14K req/day small models, fastest | Speed lane; absorbs bursts when Gemini throttles |
| 3 | Mistral La Plateforme | ~1B tokens/month budget | Bulk monthly capacity; EU-hosted |
| 4 | z.ai (Zhipu GLM, intl door) | free Flash tiers (~50 req/day), no card, non-CN phone OK | Extra bulk lane, OpenAI-compatible. **OPTIONAL** — router works without it. CN vendor: fragments/public work only, keep sensitive PII off |
| 5 | NVIDIA NIM (build.nvidia.com) | ~10K req/day, no card, inference-only | Extra free lane, OpenAI-compatible |
| 6 | OpenRouter `:free` | 50 req/day (1K/day after one-time $10 credit) | Keyed failover + model variety |
| 7 | SambaNova Cloud (api.sambanova.ai) | 200K tokens/day/model, no card, fast | Extra free lane, OpenAI-compatible. **OPTIONAL** — router works without it. Training policy unverified: bulk work OK, keep most-sensitive PII on verified friend lanes |
| 8 | GitHub Models (models.github.ai) | free tier for every GitHub user, PAT with Models permission | OpenAI-compatible, Microsoft-hosted. **OPTIONAL** — router works without it. Dormant until `GITHUB_MODELS_KEY` is set. |

## Keyless tier (priorities 10–13) — FRAGMENTS-ONLY

Tried only after ALL keyed lanes fail or are unconfigured. **Zero signup,
zero keys.** Every lane verified live Oct 2026
(`keyless-lanes-verified-2026-10-05.md`).

| # | Lane | Free deal | Notes |
|---|------|-----------|-------|
| 10 | Pollinations.AI (`text.pollinations.ai/openai`) | keyless, fastest (~1s) | Weakest contract — works today, could gate tomorrow. Opportunistic. |
| 11 | Kilo gateway (`kilo-auto/free`) | keyless, ~200 req/hr/IP | **ALWAYS the auto-router — never pin a `:free` model directly** (one hung 60s in testing; auto-router answered in ~2s). |
| 12 | OVHcloud anonymous | keyless, **2 req/min** (PROVEN, shared global pool) | Parses `x-ratelimit-limit-minute` / `ratelimit-reset` headers; expect 429s, that's the documented mode. EU-hosted, vendor states no training. Non-reasoning model (`Qwen3.5-9B`) to dodge the gpt-oss reasoning-token quirk. |
| 13 | LLM7.io (`Bearer unused`, model `default`) | keyless, slowest (~37s verified) | Deep fallback only. 60s per-attempt timeout (default 20s would always trip). Never hardcode the resolved model — catalog is dynamic. |

**Compartmentation:** the keyless tier is **FRAGMENTS-ONLY / never sensitive**.
These are anonymous shared pools with the weakest contracts — never send them
secrets, PII, credentials, API keys, or full business context. Only task
fragments. If a request is sensitive and no keyed lane is available, the
caller should fail closed rather than degrade to keyless. (`/health` flags
each lane with `tier` and `fragmentsOnly`.)

Failover triggers: **429, 5xx, timeout (20s; 60s for llm7), network error, or a
lane error payload**. Other 4xx (bad request / bad key / unknown model) are
returned immediately — retrying another lane can't fix them. 429s set a
per-lane cooldown (honors `Retry-After`, falls back to OVHcloud-style
`ratelimit-reset` which may be seconds-until-reset or epoch seconds).

## Deploy

```bash
cd ~/workspace/free-stack/workers
npx wrangler login
npx wrangler secret put ROUTER_KEY    # REQUIRED — bearer token for ALL routes
npx wrangler secret put GEMINI_KEY
npx wrangler secret put GROQ_KEY
npx wrangler secret put MISTRAL_KEY
npx wrangler secret put ZAI_KEY       # optional lane
npx wrangler secret put NVIDIA_KEY
npx wrangler secret put OPENROUTER_KEY
npx wrangler secret put SAMBANOVA_KEY # optional lane
npx wrangler secret put GITHUB_MODELS_KEY # optional lane (free GitHub PAT, Models permission)
npx wrangler deploy
```

Every route requires `Authorization: Bearer <ROUTER_KEY>` (missing secret =
503 fail-closed; wrong token = 401). This is what stops strangers from
burning your free-tier quotas. Optional caller headers:

| Header | Effect |
|---|---|
| `x-fail-closed: true` | Skip the untrusted keyless tier entirely (fail rather than leak to anonymous pools) |
| `x-deadline-ms: N` | Overall request deadline, ms (clamped 5s–300s, default 90s). Bounds worst-case latency |
| `x-hedge-after-ms: N` | After N ms (1s–30s) with no response, fire the next *keyed* lane in parallel; first success wins. Cuts tail latency (cold starts). Never hedges into keyless, never streams |
| `x-cache-ttl: N` | Exact-match response cache for N seconds (1–300). Non-streaming only. `x-cache: HIT/MISS` tells you |

Every chat response carries `x-lane` (who served it) and
`x-fallback-attempts` (how many lanes failed before success).

Minimal `wrangler.toml` (create beside `ai-router.js`):

```toml
name = "ai-router"
main = "ai-router.js"
compatibility_date = "2026-10-01"

# Optional model overrides (defaults are baked into ai-router.js)
# [vars]
# GEMINI_MODEL = "gemini-2.5-flash"
# GROQ_MODEL = "llama-3.3-70b-versatile"
# MISTRAL_MODEL = "mistral-small-latest"
# ZAI_MODEL = "glm-4.7-flash"
# NVIDIA_MODEL = "meta/llama-3.3-70b-instruct"
# OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free"
# SAMBANOVA_MODEL = "Meta-Llama-3.3-70B-Instruct"
```

Any lane whose `*_KEY` secret is missing is skipped automatically
(`configured: false` in `/health`). Keyless lanes (7–10) need no secrets and
are always configured. You can run with zero keys — the keyless tier serves
on its own.

## Testing

```bash
cd ~/workspace/free-stack/workers
node test-router.mjs   # 25 scenarios, each in a fresh process
```

Scenarios: all-429 across 11 lanes → 429 + retry-after · keyed 429 → next lane ·
20s timeout → failover · 400 → no failover · /health (11 lanes, tiers) ·
no-keys → keyless serves · Gemini translation both ways · stream skip ·
**(9)** all 7 keyed 429 → pollinations serves ·
**(10)** keyless 429 (pollinations) → kilo serves ·
**(11)** zai serves when ZAI_KEY present; skipped cleanly (no-key) when absent ·
**(12)** no ROUTER_KEY → 503 fail-closed, zero lane attempts ·
**(13)** wrong bearer token → 401 · **(14)** `x-fail-closed` → keyless skipped, 429 ·
**(15)** sambanova serves when SAMBANOVA_KEY present (keyed 1–6 429); skipped cleanly (no-key) when absent ·
**(16)** `x-deadline-ms` → 504 inside the deadline, never a 220s hang ·
**(17)** groq 401 (revoked key) → mistral serves; dead keys fail over ·
**(18)** circuit breaker: 3× groq 500 → breaker opens, 4th request skips groq ·
**(19)** admission control: GLOBAL_RPM_LIMIT=2 → 3rd request 429 ·
**(20)** `x-cache-ttl` → HIT on repeat, MISS on new prompt ·
**(21)** `x-hedge-after-ms` → groq hedge wins in ~0.5s, gemini not marked failed ·
**(22)** 2MB chunked body → 413, zero lane calls ·
**(23)** mid-stream death → `: router upstream aborted` sentinel ·
**(24)** cooldown jitter lands in 75–125s for retry-after 100 ·
**(25)** `x-fallback-attempts` header counts failovers.

## Usage

```bash
# Chat completion (OpenAI format). Lane's configured model is used.
curl -X POST https://ai-router.<you>.workers.dev/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ROUTER_KEY" \
  -d '{"messages":[{"role":"user","content":"hello"}]}' \
  -i   # check the x-lane response header to see who served it

# Sensitive prompt: fail closed instead of degrading to keyless lanes
curl -X POST https://ai-router.<you>.workers.dev/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ROUTER_KEY" \
  -H 'x-fail-closed: true' \
  -d '{"messages":[{"role":"user","content":"internal plan"}]}'

# Streaming also works (proxied on OpenAI-compatible lanes; Gemini is
# skipped for stream:true — no SSE translation implemented).
curl -N -X POST https://ai-router.<you>.workers.dev/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ROUTER_KEY" \
  -d '{"messages":[{"role":"user","content":"hi"}],"stream":true}'

# Lane status (also authenticated)
curl https://ai-router.<you>.workers.dev/health \
  -H "Authorization: Bearer $ROUTER_KEY"
```

`/health` returns per lane: `tier` (`keyed`/`keyless`), `fragmentsOnly`,
`configured`, `rpmUsed`/`rpmLimit`, `success`/`fail` counts, `lastSuccess`,
`lastFail`, `lastError`, `inCooldown`, `skips`
(no-key / rpm-limit / cooldown / no-stream).

## Known limits

- **10ms CPU (free tier):** the worker only does JSON translate + routing —
  no heavy compute, no buffering of streams. Well within budget.
- **In-memory RPM is per-isolate.** Cloudflare runs many isolates; the
  sliding-window counters are approximate under load. Good enough for polite
  free-tier citizenship. **Weekly accounting, pacing buckets, efficiency
  inputs, breaker states and the incident log are durable** (Oct 7, 2026):
  a single shared KV doc (`shared:v1`) is hydrated at request start (1 KV
  get on the hot path) and written back read-modify-write in
  `ctx.waitUntil` (never on the response path). Merge rules are
  conservative under concurrency: counters are deltas, pacing buckets take
  the MIN, breaker fields take the MAX. `/health` reports the hydrated
  totals and `durable:true`. KV missing → in-memory only, never fatal.
  - **Proven 2026-10-07:** isolates are NOT reused across requests for this
    worker (5 rapid requests → 5 isolate IDs), so any per-isolate
    write-behind scheme silently loses data — the first durable design did
    exactly that and was replaced.
  - **Bug found & fixed same night:** top-level `Date.now()` returns 0 at
    module eval in Workers → `weekStart` initialized to -259200000 →
    spurious week-rollover reset in `recordAttempt` wiped hydrated
    `wReq`/`wTokens` while `ok`/`fail` accumulated. Fixed by adopting
    `weekStart` lazily on first request. `GET /admin/incidents`,
    `POST /admin/flush`, `GET /admin/debug` for ops.
  A Durable Object rate-limit coordinator is the cleaner upgrade if
  traffic ever outgrows one operator (needs paid plan — parked).
- **No mid-stream failover.** Once bytes flow, the lane owns the stream. A
  mid-flight death now emits a `: router upstream aborted` SSE comment instead
  of silent truncation, so clients can tell the difference.
- **20s per-lane timeout (60s for llm7), 90s logical deadline.**
  Slow lanes fail over rather than hang clients; the deadline bounds the
  worst case even when every lane hangs. llm7's override is the only
  exception — verified ~37s replies.
- **Hedging and caching are opt-in** (`x-hedge-after-ms`, `x-cache-ttl`) —
  off by default so the conservative sequential path stays the default.
- **Keyless lanes are best-effort.** Pollinations' keyless contract is the
  weakest (docs push keys; keyless works today). Kilo upstream 429s are the
  documented failure mode. OVHcloud's 2/min is a *global* shared pool — the
  router treats its 429s as routine, not exceptional.
- **Gemini request/response translation only.** All other lanes are
  OpenAI-compatible and pass through byte-identical (minus the model
  override). Function-calling / tool payloads are passed through untouched
  on OpenAI lanes and are NOT translated for Gemini.
- **Secrets, not vars:** keys go in `wrangler secret put`, never in code,
  never in `[vars]`, never in git. The router never logs keys.
- **Compartmentation note:** this router sees prompt contents by design —
  it's trusted core infrastructure. Run it on your own Cloudflare account,
  and keep truly sensitive workloads on lanes you trust (see the
  friend/foe/neutral classifications in the sweep file).
