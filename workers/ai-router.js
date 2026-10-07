/**
 * ai-router.js — OpenAI-compatible AI failover router across FREE inference lanes.
 *
 * POST /v1/chat/completions  → tries lanes in priority order, fails over on
 *                                429 / 5xx / timeout / network error /
 *                                lane-scoped 4xx (401/403/404 = dead key or
 *                                dead model → next lane, NOT a client error).
 * GET  /health                 → JSON lane status (rpm used, breaker state,
 *                                cooldowns, last success/fail).
 * GET  /                       → tiny info blurb.
 * GET  /admin/lanes            → merged lane registry (builtin + KV).
 * POST /admin/lanes            → upsert a keyless lane {name, baseUrl, ...}.
 * DELETE /admin/lanes/:name   → remove a KV registry lane.
 *                                (All /admin/* routes need the ROUTER_KEY.)
 * GET  /admin/incidents        → breaker-trip forensics: newest-first incident
 *                                log with deterministic failure signatures +
 *                                repeat-offender backoff escalation.
 *
 * Lane priority (KEYED tier — trusted, configured via secrets):
 *   1. gemini     Google AI Studio (Gemini)   — x-goog-api-key header
 *   2. groq       Groq                        — OpenAI-compatible
 *   3. mistral    Mistral La Plateforme       — OpenAI-compatible
 *   4. zai        z.ai (Zhipu GLM, intl door) — OpenAI-compatible, OPTIONAL
 *   5. nvidia     NVIDIA NIM (build.nvidia)   — OpenAI-compatible
 *   6. openrouter OpenRouter :free models      — OpenAI-compatible
 *   7. sambanova  SambaNova Cloud             — OpenAI-compatible, OPTIONAL
 *   8. deepseek   DeepSeek (PAID lane)          — OpenAI-compatible, OPTIONAL
 *   9. github-models GitHub Models (free tier)  — OpenAI-compatible, OPTIONAL
 *
 * Lane priority (KEYLESS tier — tried only after ALL keyed lanes fail):
 *  10. pollinations Pollinations.AI           — OpenAI-compatible, keyless
 *  11. kilo         Kilo gateway kilo-auto/free — auto-router, NEVER pin :free
 *  12. ovh          OVHcloud anonymous        — 2 req/min, parses rate-limit hdrs
 *  13. llm7         LLM7.io (keyless, no auth header) — slowest, deep fallback only
 *
 * COMPARTMENTATION — the keyless tier is FRAGMENTS-ONLY. These lanes are
 * UNTRUSTED (anonymous/shared pools, weakest contracts). NEVER send them
 * secrets, PII, credentials, API keys, or full business context — only task
 * fragments. See runbook-2026-10-05.md (FRIEND/FOE/NEUTRAL). Sensitive work
 * must stay on keyed lanes or fail closed.
 *
 * Secrets (wrangler secret put <NAME>): ROUTER_KEY (REQUIRED — bearer token
 * for ALL routes; missing secret = 503 fail-closed), GEMINI_KEY, GROQ_KEY,
 * MISTRAL_KEY,
 * ZAI_KEY, NVIDIA_KEY, OPENROUTER_KEY, SAMBANOVA_KEY, DEEPSEEK_KEY. Optional model overrides:
 * GEMINI_MODEL, GROQ_MODEL, MISTRAL_MODEL, ZAI_MODEL, NVIDIA_MODEL,
 * OPENROUTER_MODEL, SAMBANOVA_MODEL, DEEPSEEK_MODEL, plus
 * POLLINATIONS_MODEL, OVH_MODEL (kilo/llm7 models are fixed by design).
 * NEVER hard-code real keys in this file.
 *
 * Callers send:  Authorization: Bearer <ROUTER_KEY>
 * Optional caller headers:
 *   x-fail-closed: true   → keyless (untrusted) lanes are skipped; if no keyed
 *                            lane can serve, the request fails instead of
 *                            leaking to anonymous pools.
 *   x-deadline-ms: N      → overall request deadline in ms (clamped 5s–300s,
 *                            default 90s). Bounds worst-case latency: every lane
 *                            attempt gets min(lane timeout, time remaining).
 *   x-hedge-after-ms: N   → after N ms (1s–30s) with no response from a keyed
 *                            lane, fire the next keyed lane in parallel; first
 *                            success wins, loser is aborted. Cuts tail latency
 *                            (cold starts) at the cost of one extra attempt.
 *                            Never hedges into the keyless tier, never streams.
 *   x-cache-ttl: N        → exact-match response cache for N seconds (1–300).
 *                            Non-streaming only. For batch/canary traffic that
 *                            repeats identical prompts. x-cache: HIT/MISS told.
 *   x-keyless-only: true  → skip ALL keyed lanes; $0 anonymous-only mode.
 *                            For orchestrator waves that must burn zero
 *                            budget and zero Muse allowance.
 *   x-lb: weighted|priority|efficiency → lane ordering within tier. Default
 *                            efficiency (env LB_MODE overrides); priority =
 *                            legacy order; weighted = static rpmLimit weights.
 *
 * Resilience design (see AUDIT-G1-2026-10-05.md for the full rationale):
 * - ONE logical deadline per request; attempts never outlive it.
 * - Circuit breaker per lane: 3 consecutive 5xx/timeout/network failures
 *   opens the breaker with escalating backoff (30s → 60s → 120s → 300s).
 *   429s are quota signals, not breakage: they honor retry-after and reset
 *   the consecutive-failure counter (a 429 proves the lane is alive).
 * - No same-lane retries inside one request — failover IS the retry, so one
 *   client request can never amplify into N calls against one lane.
 * - Cooldowns carry ±25% jitter so isolates don't thundering-herd on recovery.
 * - Admission control: global in-flight cap + global RPM backstop (429s).
 *   Per-isolate state is approximate on the edge — see README for the
 *   Durable Object upgrade path if traffic ever outgrows one operator.
 * - All-lanes-429 returns 429 (back off), not 502 (our fault) — honest status.
 * - SSE streams that die mid-flight get a `: router upstream aborted` comment
 *   sentinel (legal SSE, ignored by clients) instead of silent truncation.
 *
 * Design notes:
 * - Per-lane RPM tracked in-memory (sliding 60s window). Workers isolates do
 *   NOT share module state, so counts are approximate per-isolate. For exact
 *   global accounting: per-isolate write-behind snapshots in Workers KV
 *   (see "Durable allocator state"), merged at cold start.
 * - Only Gemini needs request/response translation; the rest are
 *   OpenAI-compatible and pass through untouched (keeps CPU far under the
 *   10ms free-tier budget).
 * - Fail over on 429 / 5xx / timeout / network error / 401 / 403 / 404.
 *   400 / 413 / 422 are caller-caused — returned immediately, no failover.
 * - stream:true is proxied on OpenAI-compatible lanes. Gemini is skipped for
 *   streaming (no SSE translation implemented).
 * - Keyless lane llm7 gets a 60s per-attempt timeout (verified ~37s replies);
 *   all other lanes use the 20s default. On 429s the router honors
 *   `retry-after`, falling back to OVHcloud-style `ratelimit-reset`
 *   (seconds-until-reset or epoch) when retry-after is absent.
 */

const TIMEOUT_MS = 20_000; // per-lane attempt budget
const REQUEST_DEADLINE_MS = 90_000; // logical-request deadline (x-deadline-ms overrides)
const MAX_BODY_BYTES = 1_048_576; // 1MB hard cap, enforced on the byte stream
const BREAKER_FAILS = 3; // consecutive 5xx/timeout/network failures to open
const BREAKER_BACKOFF_S = [30, 60, 120, 300]; // escalating, indexed by openCount
const COOLDOWN_JITTER = 0.25; // ±25%
const GLOBAL_RPM_DEFAULT = 600; // admission backstop (env GLOBAL_RPM_LIMIT)
const MAX_INFLIGHT_DEFAULT = 50; // admission backstop (env MAX_INFLIGHT)
const CACHE_MAX_ENTRIES = 200;

/* ------------------------------------------------------------------ */
/* Lane definitions                                                    */
/* ------------------------------------------------------------------ */

function laneDefs(env) {
  return [
    {
      name: "gemini",
      priority: 1,
      tier: "keyed",
      key: env.GEMINI_KEY,
      model: env.GEMINI_MODEL || "gemini-2.5-flash",
      rpmLimit: 15,
      supportsStream: false,
      buildRequest(body, model, key) {
        return {
          // Key via x-goog-api-key header — never in the URL (URLs land in logs).
          url:
            "https://generativelanguage.googleapis.com/v1beta/models/" +
            encodeURIComponent(model) +
            ":generateContent",
          init: {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify(openaiToGemini(body)),
          },
        };
      },
      toOpenAI: (data, model) => geminiToOpenAI(data, model),
      isErrorPayload: (data) => !!data?.error,
    },
    {
      name: "groq",
      priority: 2,
      tier: "keyed",
      key: env.GROQ_KEY,
      model: env.GROQ_MODEL || "llama-3.3-70b-versatile",
      rpmLimit: 30,
      supportsStream: true,
      buildRequest: (body, model, key) =>
        openaiCompatRequest("https://api.groq.com/openai/v1", body, model, key),
    },
    {
      name: "mistral",
      priority: 3,
      tier: "keyed",
      key: env.MISTRAL_KEY,
      model: env.MISTRAL_MODEL || "mistral-small-latest",
      rpmLimit: 60, // ~1 req/s on the free Experiment plan
      supportsStream: true,
      buildRequest: (body, model, key) =>
        openaiCompatRequest("https://api.mistral.ai/v1", body, model, key),
    },
    {
      name: "zai",
      priority: 4,
      tier: "keyed",
      optional: true, // skipped cleanly when ZAI_KEY missing — router works without it
      key: env.ZAI_KEY,
      model: env.ZAI_MODEL || "glm-4.7-flash", // free Flash tier on the intl door (z.ai)
      rpmLimit: 10, // no published RPM; ~50 req/day community budget — stay polite
      supportsStream: true,
      // CN vendor (Zhipu) — treat like NIM: bulk/fragments OK, keep sensitive PII off.
      buildRequest: (body, model, key) =>
        openaiCompatRequest("https://api.z.ai/api/paas/v4", body, model, key),
    },
    {
      name: "nvidia",
      priority: 5,
      tier: "keyed",
      key: env.NVIDIA_KEY,
      model: env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct",
      rpmLimit: 40,
      supportsStream: true,
      buildRequest: (body, model, key) =>
        openaiCompatRequest("https://integrate.api.nvidia.com/v1", body, model, key),
    },
    {
      name: "openrouter",
      priority: 6,
      tier: "keyed",
      key: env.OPENROUTER_KEY,
      model: env.OPENROUTER_MODEL || "openrouter/free",
      // Intra-lane load balancing: rotate across free models instead of
      // pinning one. Candidates are efficiency-ordered per request; a 429'd
      // or dead model is skipped via its own cooldown/breaker while the lane
      // keeps serving. Env override: OPENROUTER_MODELS="a,b,c".
      // openrouter/free (auto-router) stays last as the catch-all.
      models: splitModels(env.OPENROUTER_MODELS) || [
        "nvidia/nemotron-3.5-lightning:free", // live-probed 200 (2026-10-06)
        "google/gemma-4-31b-it:free", // live-probed 429 (recovers; rotation handles it)
        "thinkingmachines/inkling:free", // 1M ctx, on the live free list
        "poolside/laguna-s-2.1:free", // on the live free list
        "openrouter/free", // auto-router catch-all (live-probed 200)
      ],
      rpmLimit: 20,
      supportsStream: true,
      buildRequest: (body, model, key) =>
        openaiCompatRequest("https://openrouter.ai/api/v1", body, model, key, {
          "HTTP-Referer": "https://cutecity.cc",
          "X-Title": "CuteTentacleCloudCity",
        }),
    },
    {
      name: "sambanova",
      priority: 7,
      tier: "keyed",
      optional: true, // skipped cleanly when SAMBANOVA_KEY missing — router works without it
      key: env.SAMBANOVA_KEY,
      model: env.SAMBANOVA_MODEL || "Meta-Llama-3.3-70B-Instruct", // fast 70B on the free 200K tok/day tier
      rpmLimit: 15, // no published RPM; 200K tokens/day/model is the real guard — stay polite
      supportsStream: true,
      // US vendor, fast inference. Training policy unverified — bulk work OK,
      // keep the most-sensitive PII on verified friend lanes.
      buildRequest: (body, model, key) =>
        openaiCompatRequest("https://api.sambanova.ai/v1", body, model, key),
    },
    {
      name: "deepseek",
      priority: 8,
      tier: "keyed",
      optional: true, // skipped cleanly when DEEPSEEK_KEY missing
      key: env.DEEPSEEK_KEY,
      model: env.DEEPSEEK_MODEL || "deepseek-flash", // live-probed 200 (2026-10-06)
      rpmLimit: 30, // no published RPM; paid API, limits are generous
      supportsStream: true,
      // PAID lane (not $0): bills per token from the first call. Off-peak is
      // 50% off — peak is Sun–Thu 18:00–21:00 & 23:00–03:00 America/Vancouver
      // (01:00–04:00 & 06:00–10:00 UTC weekdays). Prefer off-peak for batch.
      // CN vendor — bulk/fragments OK, keep sensitive PII off.
      // Both models are reasoners: tiny max_tokens budgets return empty
      // content (budget spent reasoning); real caller budgets are unaffected.
      buildRequest: (body, model, key) =>
        openaiCompatRequest("https://api.deepseek.com/v1", body, model, key),
    },
    {
      name: "github-models",
      priority: 9,
      tier: "keyed",
      optional: true, // skipped cleanly when GITHUB_MODELS_KEY missing
      key: env.GITHUB_MODELS_KEY,
      model: env.GITHUB_MODELS_MODEL || "openai/gpt-4o-mini",
      rpmLimit: 10, // free tier is rate-limited; stay polite, no published RPM
      supportsStream: true,
      // GitHub Models free inference for every GitHub user (PAT with Models
      // account permission). OpenAI-compatible. US vendor (Microsoft).
      buildRequest: (body, model, key) =>
        openaiCompatRequest("https://models.github.ai/inference", body, model, key),
    },
    /* -------------------------------------------------------------- */
    /* KEYLESS TIER — FRAGMENTS-ONLY. Untrusted anonymous lanes.        */
    /* Never secrets / PII / credentials / full context. See header.    */
    /* -------------------------------------------------------------- */
    {
      name: "pollinations",
      priority: 10,
      tier: "keyless",
      fragmentsOnly: true,
      keyless: true,
      model: env.POLLINATIONS_MODEL || "openai",
      rpmLimit: 30, // no published limit; 429 cooldowns are the real guard
      supportsStream: true,
      buildRequest: (body, model) =>
        keylessCompatRequest("https://text.pollinations.ai/openai", body, model),
    },
    {
      name: "kilo",
      priority: 11,
      tier: "keyless",
      fragmentsOnly: true,
      keyless: true,
      // ALWAYS use the kilo-auto/free auto-router. NEVER pin a :free model
      // directly — one hung 60s in live testing; the auto-router fails over
      // internally and answered in ~2s.
      model: "kilo-auto/free",
      rpmLimit: 10, // advertised ~200 req/hr/IP; 429 cooldowns guard the rest
      supportsStream: true,
      buildRequest: (body, model) =>
        keylessCompatRequest("https://api.kilo.ai/api/gateway", body, model),
    },
    {
      name: "ovh",
      priority: 12,
      tier: "keyless",
      fragmentsOnly: true,
      keyless: true,
      model: env.OVH_MODEL || "Qwen3.5-9B", // non-reasoning; gpt-oss dumps reasoning tokens
      rpmLimit: 2, // PROVEN: 2 req/min, shared GLOBAL pool — expect 429s
      supportsStream: true,
      buildRequest: (body, model) =>
        keylessCompatRequest("https://oai.endpoints.kepler.ai.cloud.ovh.net/v1", body, model),
    },
    {
      name: "llm7",
      priority: 13,
      tier: "keyless",
      fragmentsOnly: true,
      keyless: true,
      model: "default", // dynamic catalog — never hardcode the resolved model
      rpmLimit: 2, // ~1-request concurrency per IP; slowest lane, deep fallback
      timeoutMs: 60_000, // verified ~37s replies; default 20s would always trip
      supportsStream: true,
      buildRequest: (body, model) =>
        keylessCompatRequest("https://api.llm7.io/v1", body, model),
    },
  ];
}

/** Shared builder for OpenAI-compatible lanes. Lane's configured model wins. */
function openaiCompatRequest(base, body, model, key, extraHeaders = {}) {
  const out = { ...body, model, stream: body.stream === true };
  return {
    url: base + "/chat/completions",
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key,
        ...extraHeaders,
      },
      body: JSON.stringify(out),
    },
  };
}

/**
 * Shared builder for KEYLESS lanes (FRAGMENTS-ONLY tier). No Authorization
 * header is ever sent — verified 2026-10-06 that llm7.io returns 200 with no
 * auth header, so no placeholder literal is needed or wanted here.
 */
function keylessCompatRequest(base, body, model, authHeader = null, extraHeaders = {}) {
  const out = { ...body, model, stream: body.stream === true };
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  if (authHeader) headers.Authorization = authHeader;
  return {
    url: base + "/chat/completions",
    init: { method: "POST", headers, body: JSON.stringify(out) },
  };
}

/* ------------------------------------------------------------------ */
/* Gemini adapters (the only non-OpenAI lane)                          */
/* ------------------------------------------------------------------ */

function msgText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content
      .filter((p) => p && (p.type === "text" || typeof p.text === "string"))
      .map((p) => p.text || "")
      .join("");
  return String(content ?? "");
}

function openaiToGemini(body) {
  const contents = [];
  let systemText = null;
  for (const m of body.messages || []) {
    if (m.role === "system") {
      systemText = (systemText ? systemText + "\n" : "") + msgText(m.content);
      continue;
    }
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: msgText(m.content) }],
    });
  }
  const generationConfig = {};
  if (body.temperature !== undefined) generationConfig.temperature = body.temperature;
  if (body.max_tokens !== undefined) generationConfig.maxOutputTokens = body.max_tokens;
  if (body.top_p !== undefined) generationConfig.topP = body.top_p;
  if (body.stop !== undefined)
    generationConfig.stopSequences = Array.isArray(body.stop) ? body.stop : [body.stop];

  const out = { contents };
  if (systemText) out.systemInstruction = { parts: [{ text: systemText }] };
  if (Object.keys(generationConfig).length) out.generationConfig = generationConfig;
  return out;
}

function geminiToOpenAI(g, model) {
  const cand = g?.candidates?.[0] || {};
  const text = (cand.content?.parts || []).map((p) => p.text || "").join("");
  const finish =
    { STOP: "stop", MAX_TOKENS: "length", SAFETY: "content_filter", RECITATION: "content_filter" }[
      cand.finishReason
    ] || "stop";
  const u = g?.usageMetadata || {};
  return {
    id: "chatcmpl-" + Math.random().toString(36).slice(2),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      { index: 0, message: { role: "assistant", content: text }, finish_reason: finish },
    ],
    usage: {
      prompt_tokens: u.promptTokenCount || 0,
      completion_tokens: u.candidatesTokenCount || 0,
      total_tokens: u.totalTokenCount || 0,
    },
  };
}

/* ------------------------------------------------------------------ */
/* In-memory per-lane state (hot per-isolate layer; durable baseline in KV) */
/* ------------------------------------------------------------------ */

const state = {}; // name -> { ts:[], ok, fail, hedged, consecFail, openCount, lastOk, lastFail, lastError, cooldownUntil, skips:{} }
const rt = { inflight: 0, ts: [] }; // global admission state (per-isolate)
const cache = new Map(); // cacheKey -> { exp, status, bodyText, headers, failClosed }

function st(name) {
  return (state[name] ||= {
    ts: [],
    ok: 0,
    fail: 0,
    hedged: 0,
    consecFail: 0,
    openCount: 0,
    lastOk: null,
    lastFail: null,
    lastError: null,
    cooldownUntil: 0,
    skips: {},
    // Weekly budget allocator fields (hot layer; flushed to KV write-behind).
    tokTotal: 0, // observed completion tokens, all time this isolate
    latTotalMs: 0,
    latN: 0,
    wReq: 0, // requests this UTC week
    wTokens: 0, // tokens this UTC week
  });
}

/* ------------------------------------------------------------------ */
/* Weekly budget allocator — pacing + efficiency + weekly accounting.   */
/*                                                                     */
/* Rate ceilings are DOCUMENTED (verified Oct 2026), not guessed:       */
/* kilo 200 req/hr, ovh 120 req/hr (2/min). Pollinations/LLM7 publish   */
/* no cap → uncapped. Token buckets pace spend evenly instead of        */
/* burst-then-429: a burst of 300 against kilo's 200/hr wastes 100+     */
/* attempts on 429s; pacing spends the same 200 with zero waste. That   */
/* is what maximizes sustained weekly throughput on rate-limited lanes.*/
/* ------------------------------------------------------------------ */
const PACE_CEIL_PER_HR = { kilo: 200, ovh: 120 };
const pace = {}; // name -> { tokens, updated }
function paceTake(name) {
  const ceil = PACE_CEIL_PER_HR[name];
  if (!ceil) return true; // uncapped lane: no pacing needed
  const now = Date.now();
  let p = pace[name];
  if (!p) p = pace[name] = { tokens: ceil, updated: now };
  p.tokens = Math.min(ceil, p.tokens + ((now - p.updated) / 1000) * (ceil / 3600));
  p.updated = now;
  if (p.tokens < 1) return false;
  p.tokens -= 1;
  return true;
}
function paceLeft(name) {
  const ceil = PACE_CEIL_PER_HR[name];
  if (!ceil) return null;
  const now = Date.now();
  const p = pace[name];
  if (!p) return ceil;
  return Math.floor(Math.min(ceil, p.tokens + ((now - p.updated) / 1000) * (ceil / 3600)));
}

/** Monday 00:00 UTC of the week containing ts. */
function weekStartOf(ts) {
  const d = new Date(ts);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.getTime();
}
// NOTE: top-level Date.now() is UNRELIABLE in Workers (observed: 0 at module
// eval → weekStartOf(0) = -259200000). weekStart is adopted on the first
// request instead; a spurious value here used to nuke hydrated KV state via
// the rollover reset in recordAttempt (proven 2026-10-07 via /admin/debug).
let weekStart = 0;

function tokensOf(data) {
  const u = data && data.usage;
  const t = u && (u.total_tokens ?? (u.prompt_tokens || 0) + (u.completion_tokens || 0));
  return Number.isFinite(t) && t > 0 ? Math.floor(t) : 0;
}

/** Efficiency score: success-rate × observed tokens/sec. Higher is better. */
function effScore(name) {
  // In production, state is hydrated from the shared KV doc at request start,
  // so efficiency ordering reflects cross-request history, not just this isolate.
  const s = state[name];
  if (!s || s.latN === 0) return null; // unexplored
  const sr = s.ok / Math.max(1, s.ok + s.fail);
  return sr * (s.tokTotal / Math.max(1, s.latTotalMs / 1000));
}

function prune(name) {
  const s = st(name);
  const now = Date.now();
  s.ts = s.ts.filter((t) => now - t < 60_000);
  return s;
}

function recordAttempt(name) {
  const s = prune(name);
  // UTC-week rollover: reset weekly counters once per isolate.
  // weekStart is adopted (not reset) on the first request — top-level
  // Date.now() is unreliable in Workers and a bogus initial value used to
  // wipe hydrated KV state here.
  const ws = weekStartOf(Date.now());
  if (weekStart === 0) {
    weekStart = ws;
  } else if (ws !== weekStart) {
    weekStart = ws;
    for (const k of Object.keys(state)) {
      state[k].wReq = 0;
      state[k].wTokens = 0;
    }
  }
  s.ts.push(Date.now());
  s.wReq += 1;
}
function recordSuccess(name, info) {
  const s = st(name);
  s.ok += 1;
  s.consecFail = 0;
  s.openCount = 0;
  s.lastOk = new Date().toISOString();
  if (info) {
    const t = info.tokens || 0;
    s.tokTotal += t;
    s.wTokens += t;
    if (info.ms != null) {
      s.latTotalMs += info.ms;
      s.latN += 1;
    }
  }
}
/** A 429 proves the lane is alive — quota signal, not breakage. */
function recordThrottle(name, msg, cooldownSec) {
  const s = st(name);
  s.fail += 1;
  s.consecFail = 0; // alive, just throttled
  s.lastFail = new Date().toISOString();
  s.lastError = String(msg).slice(0, 300);
  setCooldown(name, cooldownSec);
}
/**
 * 5xx / timeout / network / lane-scoped 4xx. Opens the circuit breaker after
 * BREAKER_FAILS consecutive failures, with escalating backoff. Before the
 * breaker opens there is deliberately NO cooldown — fail fast per request,
 * recover fast on blips.
 */
function recordError(name, msg) {
  const s = st(name);
  s.fail += 1;
  s.consecFail += 1;
  s.lastFail = new Date().toISOString();
  s.lastError = String(msg).slice(0, 300);
  if (s.consecFail >= BREAKER_FAILS) {    const sig = classifySig(msg);
    let bIdx = Math.min(s.openCount, BREAKER_BACKOFF_S.length - 1);
    // Repeat offender: same lane, same signature 3+ times in the trailing
    // hour → back off one extra step. Deterministic operational memory.
    if (isRepeatOffender(name, sig) && bIdx < BREAKER_BACKOFF_S.length - 1) bIdx += 1;
    recordIncident(name, sig, BREAKER_BACKOFF_S[bIdx]);
    setCooldown(name, BREAKER_BACKOFF_S[bIdx]);
    s.openCount += 1;
  }
}
/** Lost a hedge race — not a failure, no cooldown, just telemetry. */
function recordHedged(name) {
  st(name).hedged += 1;
}
function recordSkip(name, reason) {
  const s = st(name);
  s.skips[reason] = (s.skips[reason] || 0) + 1;
}

/* ------------------------------------------------------------------ */
/* Incident forensics — the XCOR-genuine subset. Every breaker trip is  */
/* recorded with a deterministic failure signature (operational memory).*/
/* Same lane + same signature 3+ times in the trailing hour marks a    */
/* repeat offender → the next trip backs off one extra step. Hot layer is  */
/* per-isolate; history is persisted to KV (durable:incidents:v1).      */
/* ------------------------------------------------------------------ */
const INCIDENTS_MAX = 100;
const REPEAT_WINDOW_MS = 3600_000;
const REPEAT_THRESHOLD = 3;
const incidents = []; // oldest-first: {ts, lane, sig, consecFail, backoffSec}
function classifySig(msg) {
  const m = String(msg || "").toLowerCase();
  if (/timed? ?out|abort/.test(m)) return "timeout";
  if (/network|fetch failed|econnrefused|enotfound|edns|socket/.test(m)) return "network";
  if (/too many requests|\b429\b|rate.?limit/.test(m)) return "rate-limit";
  const h = m.match(/\b(5\d{2})\b/);
  if (h) return "http-" + h[1];
  if (/\b401\b|\b403\b|unauthorized|forbidden/.test(m)) return "auth";
  if (/\b404\b|not found/.test(m)) return "not-found";
  return "unknown";
}
function recordIncident(name, sig, backoffSec) {
  incidents.push({
    ts: new Date().toISOString(),
    lane: name,
    sig,
    consecFail: st(name).consecFail,
    backoffSec,
  });
  if (incidents.length > INCIDENTS_MAX) incidents.splice(0, incidents.length - INCIDENTS_MAX);
  dirtyIncidents = true;
}
function isRepeatOffender(name, sig) {
  const cutoff = Date.now() - REPEAT_WINDOW_MS;
  let n = 0;
  for (const i of incidents) {
    if (i.lane === name && i.sig === sig && Date.parse(i.ts) >= cutoff && ++n >= REPEAT_THRESHOLD) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Durable allocator state — single shared KV document.                 */
/*                                                                     */
/* PROVEN 2026-10-07: Cloudflare does NOT reuse isolates across        */
/* requests for this worker (5 rapid requests → 5 isolate IDs). Any */
/* per-isolate write-behind scheme silently loses data. So:             */
/*   shared:v1 → { v, weekStart, updated,                            */
/*     pace:    { lane: { tokens, updated } },                          */
/*     lanes:   { lane: { wReq, wTokens, ok, fail, tokTotal,            */
/*                         latTotalMs, latN, hedged } },                */
/*     breakers:{ lane: { consecFail, openCount, cooldownUntil,         */
/*                         lastError } },                              */
/*     incidents: [ { ts, lane, sig, consecFail, backoffSec } ] }       */
/* Per request: hydrate in-memory working copy from the doc (1 KV get  */
/* on the hot path), run the existing logic untouched, then            */
/* read-modify-write the doc back in ctx.waitUntil (never on the       */
/* response path). Merge rules are conservative under concurrency:     */
/* counters are deltas, pacing buckets take the MIN, breaker fields    */
/* take the MAX. Exact under zero concurrency; approximate under race. */
/* KV missing/unreachable → in-memory only, fully degraded, never    */
/* fatal.                                                              */
/* ------------------------------------------------------------------ */
const SHARED_KEY = "shared:v1";
let dirtyIncidents = false; // set by recordIncident, consumed by persistShared
const SHARED_VERSION = 3; // v2 doc corrupted by the weekStart bug (2026-10-07); v3 starts clean
const LANE_COUNTER_FIELDS = ["wReq", "wTokens", "ok", "fail", "tokTotal", "latTotalMs", "latN", "hedged"];
let sharedOk = false;

function freshShared(ws) {
  return { v: SHARED_VERSION, weekStart: ws, updated: null, pace: {}, lanes: {}, breakers: {}, incidents: [] };
}
function blankLaneCounters() {
  return { wReq: 0, wTokens: 0, ok: 0, fail: 0, tokTotal: 0, latTotalMs: 0, latN: 0, hedged: 0 };
}

/**
 * Hydrate the in-memory working copy from the shared doc.
 * Returns a baseline snapshot for delta computation, or null when
 * KV is unavailable (in-memory-only degraded mode).
 */
async function hydrateShared(env) {
  const kv = env && env.LANES_KV;
  if (!kv) return null;
  const ws = weekStartOf(Date.now());
  try {
    let doc = await kv.get(SHARED_KEY, "json");
    if (!doc || doc.v !== SHARED_VERSION || doc.weekStart !== ws) doc = freshShared(ws);
    const base = { lanes: {}, breakers: new Set(Object.keys(doc.breakers || {})) };
    for (const [name, c] of Object.entries(doc.lanes || {})) {
      const s = st(name);
      base.lanes[name] = {};
      for (const f of LANE_COUNTER_FIELDS) {
        const v = Number(c[f]) || 0;
        s[f] = v;
        base.lanes[name][f] = v;
      }
    }
    for (const [name, p] of Object.entries(doc.pace || {})) {
      if (PACE_CEIL_PER_HR[name])
        pace[name] = { tokens: Math.min(PACE_CEIL_PER_HR[name], Number(p.tokens) || 0), updated: Date.parse(p.updated) || Date.now() };
    }
    const now = Date.now();
    for (const [name, b] of Object.entries(doc.breakers || {})) {
      if (Number(b.cooldownUntil) > now) {
        const s = st(name);
        s.consecFail = Number(b.consecFail) || 0;
        s.openCount = Number(b.openCount) || 0;
        s.cooldownUntil = Number(b.cooldownUntil) || 0;
        s.lastError = b.lastError || null;
      }
    }
    if (Array.isArray(doc.incidents) && doc.incidents.length) {
      const seen = new Set(incidents.map((i) => i.ts + "|" + i.lane + "|" + i.sig));
      for (const i of doc.incidents) {
        const k = (i.ts || "") + "|" + (i.lane || "") + "|" + (i.sig || "");
        if (!seen.has(k) && i.ts && i.lane) {
          incidents.push(i);
          seen.add(k);
        }
      }
      incidents.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
      if (incidents.length > INCIDENTS_MAX) incidents.splice(0, incidents.length - INCIDENTS_MAX);
    }
    sharedOk = true;
    return base;
  } catch (_) {
    return null; // KV read failure → degraded, never fatal
  }
}

/** This request's deltas vs the hydrate baseline (absolute for pace/breakers). */
function deltasSince(base) {
  const d = { lanes: {}, pace: {}, breakers: {}, incidents: dirtyIncidents };
  const bl = (base && base.lanes) || {};
  for (const [name, s] of Object.entries(state)) {
    const b = bl[name] || {};
    const lane = {};
    for (const f of LANE_COUNTER_FIELDS) {
      const v = (Number(s[f]) || 0) - (Number(b[f]) || 0);
      if (v) lane[f] = v;
    }
    if (Object.keys(lane).length) d.lanes[name] = lane;
    if (PACE_CEIL_PER_HR[name] && pace[name])
      d.pace[name] = { tokens: Math.max(0, Math.floor(pace[name].tokens || 0)), updated: new Date().toISOString() };
    const now = Date.now();
    if (s.cooldownUntil > now || s.consecFail > 0) {
      d.breakers[name] = {
        consecFail: s.consecFail || 0,
        openCount: s.openCount || 0,
        cooldownUntil: s.cooldownUntil || 0,
        lastError: s.lastError || null,
      };
    } else if (base && base.breakers.has(name)) {
      d.breakers[name] = null; // tombstone: breaker cleared this request
    }
  }
  return d;
}

/**
 * Read-modify-write the shared doc with this request's deltas.
 * Runs in ctx.waitUntil — never on the response path.
 */
async function persistShared(env, base) {
  const kv = env && env.LANES_KV;
  if (!kv) return;
  try {
    const d = deltasSince(base);
    const changed =
      Object.keys(d.lanes).length || Object.keys(d.pace).length || Object.keys(d.breakers).length || d.incidents;
    if (!changed) return;
    const ws = weekStartOf(Date.now());
    let doc = await kv.get(SHARED_KEY, "json");
    if (!doc || doc.v !== SHARED_VERSION || doc.weekStart !== ws) doc = freshShared(ws);
    for (const [name, lane] of Object.entries(d.lanes)) {
      const t = (doc.lanes[name] ||= blankLaneCounters());
      for (const [f, v] of Object.entries(lane)) t[f] = (Number(t[f]) || 0) + v;
    }
    for (const [name, p] of Object.entries(d.pace)) {
      const cur = doc.pace[name];
      // MIN wins: most conservative bucket across concurrent writers.
      doc.pace[name] = !cur ? p : { tokens: Math.min(Number(cur.tokens) || 0, p.tokens), updated: p.updated };
    }
    for (const [name, b] of Object.entries(d.breakers)) {
      if (b === null) {
        delete doc.breakers[name];
      } else {
        const cur = doc.breakers[name] || {};
        // MAX wins: most protective breaker state across writers.
        doc.breakers[name] = {
          consecFail: Math.max(Number(cur.consecFail) || 0, b.consecFail),
          openCount: Math.max(Number(cur.openCount) || 0, b.openCount),
          cooldownUntil: Math.max(Number(cur.cooldownUntil) || 0, b.cooldownUntil),
          lastError: b.lastError || cur.lastError || null,
        };
      }
    }
    if (d.incidents) {
      const seen = new Set((doc.incidents || []).map((i) => i.ts + "|" + i.lane + "|" + i.sig));
      doc.incidents = doc.incidents || [];
      for (const i of incidents.slice(-INCIDENTS_MAX)) {
        const k = i.ts + "|" + i.lane + "|" + i.sig;
        if (!seen.has(k)) {
          doc.incidents.push(i);
          seen.add(k);
        }
      }
      if (doc.incidents.length > INCIDENTS_MAX) doc.incidents.splice(0, doc.incidents.length - INCIDENTS_MAX);
      dirtyIncidents = false;
    }
    doc.updated = new Date().toISOString();
    await kv.put(SHARED_KEY, JSON.stringify(doc));
  } catch (_) {
    /* background persist must never fail the request */
  }
}

/** Cooldown with ±jitter so isolates don't thundering-herd on recovery. */
function setCooldown(name, baseSec) {
  const j = 1 + (Math.random() * 2 - 1) * COOLDOWN_JITTER;
  st(name).cooldownUntil = Date.now() + Math.max(1, baseSec * j) * 1000;
}

const isThrottled = (name, limit) => prune(name).ts.length >= limit;
const inCooldown = (name) => Date.now() < st(name).cooldownUntil;
const cooldownRemainingS = (name) =>
  Math.max(0, Math.round((st(name).cooldownUntil - Date.now()) / 1000));

function parseRetryAfter(v) {
  if (!v) return 60;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 600) : 60;
}

/**
 * Cooldown for a 429: prefer `retry-after`; fall back to OVHcloud-style
 * `ratelimit-reset`, which may be seconds-until-reset OR epoch seconds.
 */
function cooldownFor429(headers) {
  const ra = headers.get("retry-after");
  if (ra) return parseRetryAfter(ra);
  const reset = headers.get("ratelimit-reset");
  if (reset) {
    const n = parseInt(reset, 10);
    if (Number.isFinite(n) && n > 0) {
      const nowS = Math.floor(Date.now() / 1000);
      const wait = n > nowS ? n - nowS : n; // epoch → delta; small → seconds
      if (wait > 0) return Math.min(wait, 600);
    }
  }
  return 60;
}

/* cyrb53 — non-crypto hash for cache keys (not a security boundary). */
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
}

/* ------------------------------------------------------------------ */
/* Request handling                                                    */
/* ------------------------------------------------------------------ */

const jsonHeaders = () => ({ "Content-Type": "application/json" });
const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { ...jsonHeaders(), ...extra } });
const err = (status, message, extra = {}) =>
  json({ error: { message, type: "router_error" } }, status, extra);

/** Read the request body with a hard byte cap — works even when the client
 *  uses chunked encoding (no content-length). Returns { tooLarge } or { text }. */
async function readCappedBody(request) {
  const cl = parseInt(request.headers.get("content-length") || "0", 10);
  if (cl > MAX_BODY_BYTES) return { tooLarge: true };
  if (!request.body) return { text: "" };
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        try { await reader.cancel(); } catch (_) {}
        return { tooLarge: true };
      }
      chunks.push(value);
    }
  } catch (_) {
    return { tooLarge: true };
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return { text: new TextDecoder().decode(out) };
}

/**
 * Wrap an upstream SSE stream so a mid-flight death emits a legal SSE comment
 * sentinel instead of silently truncating the client's stream.
 */
function sseWithSentinel(upstreamBody) {
  const reader = upstreamBody.getReader();
  const enc = new TextEncoder();
  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (_) {
        try {
          controller.enqueue(enc.encode(": router upstream aborted\n\n"));
        } catch (_) {}
        controller.close();
      }
    },
    cancel() {
      try { reader.cancel(); } catch (_) {}
    },
  });
}

/**
 * Degraded-output guard (audit-kit G2 finding #1, 2026-10-06). A completion is
 * usable iff at least one choice carries non-empty text content,
 * reasoning_content (deepseek-class reasoners answer there), or tool_calls.
 * Exported for the test harness.
 */
function isDegradedCompletion(out) {
  const choices = out && out.choices;
  if (!Array.isArray(choices) || choices.length === 0) return true;
  return choices.every((c) => {
    const m = (c && (c.message || c.delta)) || {};
    const content = typeof m.content === "string" ? m.content.trim() : "";
    const reasoning =
      typeof m.reasoning_content === "string" ? m.reasoning_content.trim() : "";
    const tools = Array.isArray(m.tool_calls) && m.tool_calls.length > 0;
    return content === "" && reasoning === "" && !tools;
  });
}

/**
 * Attempt ONE model on a lane. Never throws — every outcome is a result object.
 * Stats are keyed per "lane::model" so breakers, 429 cooldowns and effScore
 * are per-model: a dead model never kills the lane. ctx: { timeoutMs,
 * parentSignal? }.
 */
async function attemptModel(lane, model, body, stream, ctx) {
  // Single-model lanes keep every stat under the lane name (legacy behavior:
  // lane breakers and 429 cooldowns keep working). Multi-model lanes get
  // per-model keys so one dead model can't sink the lane.
  const mkey = lane.models ? modelKey(lane.name, model) : lane.name;
  const { url, init } = lane.buildRequest(body, model, lane.key);
  const timeoutMs = ctx.timeoutMs;
  const controller = new AbortController();
  const parent = ctx.parentSignal;
  const onParentAbort = () => {
    try { controller.abort(parent.reason); } catch (_) {}
  };
  if (parent) {
    if (parent.aborted) onParentAbort();
    else parent.addEventListener("abort", onParentAbort, { once: true });
  }
  const timer = setTimeout(() => {
    try { controller.abort("lane-timeout"); } catch (_) {}
  }, timeoutMs);
  const t0 = Date.now();
  recordAttempt(mkey);

  const done = () => {
    clearTimeout(timer);
    if (parent) parent.removeEventListener("abort", onParentAbort);
  };

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    done();

    if (res.status === 429) {
      const wait = cooldownFor429(res.headers);
      recordThrottle(mkey, "429 rate limited", wait);
      try { await res.body?.cancel(); } catch (_) {}
      return { action: "next", error: mkey + ": 429", was429: true };
    }
    if (res.status >= 500) {
      recordError(mkey, "model 5xx: " + res.status);
      try { await res.body?.cancel(); } catch (_) {}
      return { action: "next", error: mkey + ": 5xx " + res.status };
    }
    if (res.status === 401 || res.status === 402 || res.status === 403) {
      // Key is dead — abort the whole lane and trip the lane breaker instead
      // of burning the remaining models on a doomed key.
      recordError(mkey, "key dead " + res.status);
      if (mkey !== lane.name) recordError(lane.name, "key dead " + res.status);
      try { await res.body?.cancel(); } catch (_) {}
      return { action: "next", abortLane: true, error: mkey + ": key " + res.status };
    }
    if (res.status === 404) {
      // Model is dead — rotate to the next model, the lane survives.
      recordError(mkey, "model 404");
      try { await res.body?.cancel(); } catch (_) {}
      return { action: "next", error: mkey + ": model 404" };
    }
    if (!res.ok) {
      // Other 4xx (400/413/422…): caller-caused. Failover won't help.
      // Recorded as a fail but NOT a breaker trip — the lane is healthy.
      const s = st(mkey);
      s.fail += 1;
      s.lastFail = new Date().toISOString();
      s.lastError = "model 4xx: " + res.status;
      const text = await res.text().catch(() => "");
      let payload;
      try { payload = JSON.parse(text); } catch (_) { payload = { error: { message: text.slice(0, 500) } }; }
      return { action: "return", response: json(payload, res.status, { "x-lane": lane.name, "x-model": model }) };
    }

    if (stream) {
      recordSuccess(mkey, { tokens: 0, ms: Date.now() - t0 });
      return {
        action: "return",
        response: new Response(sseWithSentinel(res.body), {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "x-lane": lane.name,
            "x-model": model,
          },
        }),
      };
    }

    const data = await res.json().catch(() => ({}));
    if (lane.isErrorPayload && lane.isErrorPayload(data)) {
      recordError(mkey, "model error payload: " + JSON.stringify(data.error).slice(0, 200));
      return { action: "next", error: mkey + ": error payload" };
    }
    recordSuccess(mkey, { tokens: tokensOf(data), ms: Date.now() - t0 });
    const out = lane.toOpenAI ? lane.toOpenAI(data, model) : data;
    if (isDegradedCompletion(out)) {
      // G2 audit finding #1 (2026-10-06): degraded output. A 200 with an empty
      // completion is not a success — it was logged as success (inflating
      // per-lane reliability) and returned empty to the caller with no
      // failover. Fail over like any other lane failure. Exceptions: reasoner
      // models answering in reasoning_content, and tool_calls with empty text
      // (both are usable completions, not degraded).
      recordError(mkey, "degraded: empty completion");
      try { await res.body?.cancel(); } catch (_) {}
      return { action: "next", error: mkey + ": empty completion" };
    }
    return { action: "return", response: json(out, 200, { "x-lane": lane.name, "x-model": model }) };
  } catch (e) {
    done();
    const reason = controller.signal.reason;
    if (reason === "hedge-done" || (parent && parent.aborted && parent.reason === "hedge-done")) {
      // Lost a hedge race — not a failure. No fail count, no cooldown.
      recordHedged(mkey);
      return { action: "next", error: mkey + ": hedge lost", hedged: true };
    }
    const msg =
      reason === "lane-timeout" || e?.name === "AbortError"
        ? "timeout after " + timeoutMs + "ms"
        : "network: " + (e?.message || e);
    recordError(mkey, msg);
    return { action: "next", error: mkey + ": " + msg };
  }
}

/**
 * Attempt ONE lane: rotate across its models (intra-lane load balancing)
 * until one serves. Models are efficiency-ordered per request; a throttled
 * or dead model is skipped next time via its own cooldown/breaker. The lane
 * only fails over when every model is exhausted or the key is dead.
 * Same result contract as the old single-model attemptLane.
 */
async function attemptLane(lane, body, stream, ctx) {
  const models = lane.models && lane.models.length ? orderModels(lane) : [lane.model];
  if (models.length === 0) {
    return { action: "next", error: lane.name + ": all models cooling down" };
  }
  const errors = [];
  let all429 = true;
  for (const model of models) {
    const r = await attemptModel(lane, model, body, stream, ctx);
    if (r.action === "return") return r;
    errors.push(r.error);
    if (!r.was429) all429 = false;
    if (r.abortLane) break; // dead key — don't burn the remaining models
  }
  return {
    action: "next",
    error: lane.name + ": [" + errors.join("; ") + "]",
    was429: all429 && errors.length > 0,
  };
}

/**
 * Hedged attempt: start lane A; if it hasn't responded after hedgeAfterMs,
 * start lane B (next keyed lane) in parallel. First success wins; the loser
 * is aborted (recorded as hedged, not failed). Returns { action, response?,
 * errors[], consumed } where consumed = 1 or 2 lanes used.
 */
async function hedgedAttempt(a, b, body, stream, ctx, hedgeAfterMs) {
  const errors = [];
  const acA = new AbortController();
  const acB = new AbortController();
  let hedgeStarted = false;
  let timer;
  const pa = attemptLane(a, body, stream, { ...ctx, parentSignal: acA.signal }).then((r) => ({
    ...r,
    lane: a,
  }));
  const pb = new Promise((resolve) => {
    timer = setTimeout(() => {
      hedgeStarted = true;
      resolve(
        attemptLane(b, body, stream, { ...ctx, parentSignal: acB.signal }).then((r) => ({
          ...r,
          lane: b,
        }))
      );
    }, hedgeAfterMs);
  });
  const quiet = (p) => p.catch(() => {});
  quiet(pa);
  quiet(pb);

  const first = await Promise.race([pa, pb]);
  if (first.action === "return") {
    clearTimeout(timer);
    try { acA.abort("hedge-done"); } catch (_) {}
    try { acB.abort("hedge-done"); } catch (_) {}
    return { action: "return", response: first.response, winner: first.lane.name, errors, consumed: hedgeStarted ? 2 : 1 };
  }
  errors.push({ error: first.error, was429: !!first.was429 });
  if (first.lane === b) {
    // Hedge finished first but failed; primary was already slow enough to
    // trigger the hedge — abandon it and fail over rather than wait.
    try { acA.abort("hedge-done"); } catch (_) {}
    try { acB.abort("hedge-done"); } catch (_) {}
    return { action: "next", errors, consumed: 2 };
  }
  // Primary failed fast; hedge may not have started yet.
  clearTimeout(timer);
  if (!hedgeStarted) {
    try { acA.abort("hedge-done"); } catch (_) {}
    return { action: "next", errors, consumed: 1 };
  }
  const second = await pb;
  try { acB.abort("hedge-done"); } catch (_) {}
  if (second.action === "return")
    return { action: "return", response: second.response, winner: b.name, errors, consumed: 2 };
  errors.push({ error: second.error, was429: !!second.was429 });
  return { action: "next", errors, consumed: 2 };
}

function laneEligible(lane, ctx) {
  if (!lane.key && !lane.keyless) { recordSkip(lane.name, "no-key"); return false; }
  if (lane.keyless && ctx.failClosed) { recordSkip(lane.name, "fail-closed"); return false; }
  if (ctx.keylessOnly && !lane.keyless) { recordSkip(lane.name, "keyless-only"); return false; }
  if (ctx.stream && !lane.supportsStream) { recordSkip(lane.name, "no-stream"); return false; }
  if (isThrottled(lane.name, lane.rpmLimit)) { recordSkip(lane.name, "rpm-limit"); return false; }
  if (inCooldown(lane.name)) { recordSkip(lane.name, "cooldown"); return false; }
  return true;
}

/* ------------------------------------------------------------------ */
/* Dynamic lane registry (KV) + weighted load balancing                 */
/* ------------------------------------------------------------------ */

const KV_LANES_KEY = "lanes";

/** Declarative KV record → live lane (keyless OpenAI-compatible only). */
function kvLaneToLane(kv) {
  if (!kv || typeof kv.name !== "string" || typeof kv.baseUrl !== "string") return null;
  return {
    name: kv.name,
    priority: Number.isFinite(kv.priority) ? kv.priority : 50,
    tier: "keyless",
    keyless: true,
    fragmentsOnly: true,
    model: kv.model || "default",
    rpmLimit: kv.rpmLimit || 10,
    supportsStream: kv.supportsStream !== false,
    timeoutMs: kv.timeoutMs,
    weight: kv.weight > 0 ? kv.weight : 1,
    source: "kv",
    buildRequest: (body, model) =>
      keylessCompatRequest(kv.baseUrl, body, model, null, kv.headers || {}),
  };
}

/** Builtin lanes merged with the KV registry. KV wins on name collision. */
async function resolveLanes(env) {
  const builtin = laneDefs(env);
  let extra = [];
  try {
    if (env.LANES_KV) extra = (await env.LANES_KV.get(KV_LANES_KEY, "json")) || [];
  } catch (_) { /* KV unavailable → builtins only */ }
  if (!Array.isArray(extra)) extra = [];
  const kvLanes = extra.map(kvLaneToLane).filter(Boolean);
  const kvNames = new Set(kvLanes.map((l) => l.name));
  return [...builtin.filter((l) => !kvNames.has(l.name)), ...kvLanes];
}

function laneWeight(l) {
  if (l.weight > 0) return l.weight;
  return Math.max(1, Math.round((l.rpmLimit || 10) / 10));
}

/** Weighted shuffle (Efraimidis–Spirakis). Stateless, per-request, no coordination. */
function shuffleWeighted(lanes) {
  const keyed = lanes.map((l) => ({ l, k: -Math.log(1 - Math.random()) / laneWeight(l) }));
  keyed.sort((a, b) => a.k - b.k);
  return keyed.map((x) => x.l);
}

const TIER_RANK = { keyed: 0, keyless: 1 };

/** Load-balanced order: tier rank preserved, weighted shuffle within each tier. */
function orderLanes(lanes, mode) {
  if (mode === "priority") return lanes;
  if (mode === "efficiency") return orderEfficiency(lanes);
  const groups = new Map();
  for (const l of lanes) {
    const t = l.tier || "keyed";
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(l);
  }
  return [...groups.keys()]
    .sort((a, b) => (TIER_RANK[a] ?? 9) - (TIER_RANK[b] ?? 9))
    .flatMap((t) => shuffleWeighted(groups.get(t)));
}

/**
 * Efficiency mode (weekly budget allocator): within each tier, best observed
 * lane first. Score = success_rate × tokens/sec from real observations.
 * Unexplored lanes get the mean explored score (so new lanes still get tried,
 * deterministically); with zero observations anywhere, falls back to priority.
 */
function orderEfficiency(lanes) {
  const groups = new Map();
  for (const l of lanes) {
    const t = l.tier || "keyed";
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(l);
  }
  return [...groups.keys()]
    .sort((a, b) => (TIER_RANK[a] ?? 9) - (TIER_RANK[b] ?? 9))
    .flatMap((t) => {
      const g = groups.get(t);
      const known = g.map((l) => effScore(l.name)).filter((s) => s !== null);
      if (known.length === 0) return g;
      const mean = known.reduce((a, b) => a + b, 0) / known.length;
      return [...g].sort((a, b) => {
        const sa = effScore(a.name) ?? mean;
        const sb = effScore(b.name) ?? mean;
        if (sb !== sa) return sb - sa;
        return (a.priority || 99) - (b.priority || 99); // deterministic tiebreak
      });
    });
}

/* ------------------------------------------------------------------ */
/* Intra-lane model load balancing. A lane may carry `models`: an      */
/* ordered candidate list (env override: comma-separated). Per-request */
/* the candidates are efficiency-ordered — observed success-rate ×     */
/* tokens/sec, unexplored models get the mean so they still get tried  */
/* — and models with an open breaker or active 429 cooldown are        */
/* skipped. Stats live under "lane::model" keys.                       */
/* ------------------------------------------------------------------ */
function splitModels(v) {
  if (typeof v !== "string") return null;
  const list = v.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : null;
}
const modelKey = (laneName, model) => laneName + "::" + model;

function orderModels(lane) {
  const alive = (lane.models || []).filter((m) => !inCooldown(modelKey(lane.name, m)));
  const known = alive
    .map((m) => effScore(modelKey(lane.name, m)))
    .filter((s) => s !== null);
  if (known.length === 0) return alive;
  const mean = known.reduce((a, b) => a + b, 0) / known.length;
  // Array.prototype.sort is stable: ties keep the configured list order.
  return [...alive].sort((a, b) => {
    const sa = effScore(modelKey(lane.name, a)) ?? mean;
    const sb = effScore(modelKey(lane.name, b)) ?? mean;
    return sb - sa;
  });
}

/* --- admin: lane registry (ROUTER_KEY-gated by the fetch dispatcher) --- */

async function readKvLanes(env) {
  try {
    const v = env.LANES_KV ? await env.LANES_KV.get(KV_LANES_KEY, "json") : null;
    return Array.isArray(v) ? v : [];
  } catch (_) { return []; }
}

async function writeKvLanes(env, lanes) {
  if (!env.LANES_KV) return err(503, "lane registry KV not bound");
  await env.LANES_KV.put(KV_LANES_KEY, JSON.stringify(lanes));
  return null;
}

function validateKvLane(kv) {
  if (!kv || typeof kv !== "object") return "body must be a lane object";
  if (typeof kv.name !== "string" || !/^[a-z0-9][a-z0-9_-]{1,40}$/.test(kv.name))
    return "name must match [a-z0-9_-]{2,41}";
  if (typeof kv.baseUrl !== "string" || !/^https:\/\/[^/\s]+/.test(kv.baseUrl))
    return "baseUrl must be an https URL";
  if (kv.weight !== undefined && !(kv.weight > 0 && kv.weight <= 100))
    return "weight must be 1..100";
  return null;
}

async function handleAdminLanesGet(env) {
  const lanes = await resolveLanes(env);
  return json({
    ok: true,
    count: lanes.length,
    lanes: lanes.map((l) => ({
      name: l.name,
      priority: l.priority,
      tier: l.tier || "keyed",
      keyless: !!l.keyless,
      fragmentsOnly: !!l.fragmentsOnly,
      model: l.model,
      weight: laneWeight(l),
      rpmLimit: l.rpmLimit,
      source: l.source || "builtin",
      configured: l.keyless ? true : !!l.key,
    })),
  });
}

async function handleAdminLanesPost(request, env) {
  let kv;
  try { kv = await request.json(); }
  catch (_) { return err(400, "invalid JSON body"); }
  const problem = validateKvLane(kv);
  if (problem) return err(400, problem);
  const lanes = await readKvLanes(env);
  const rec = {
    name: kv.name,
    baseUrl: kv.baseUrl.replace(/\/+$/, ""),
    model: kv.model || "default",
    tier: "keyless",
    keyless: true,
    fragmentsOnly: true,
    priority: Number.isFinite(kv.priority) ? kv.priority : 50,
    weight: kv.weight || 1,
    rpmLimit: kv.rpmLimit || 10,
    supportsStream: kv.supportsStream !== false,
    timeoutMs: kv.timeoutMs,
    headers: kv.headers || {},
  };
  const i = lanes.findIndex((l) => l.name === kv.name);
  if (i >= 0) lanes[i] = rec; else lanes.push(rec);
  const werr = await writeKvLanes(env, lanes);
  if (werr) return werr;
  return json({ ok: true, upserted: kv.name, total: lanes.length });
}

async function handleAdminLanesDelete(env, name) {
  const lanes = await readKvLanes(env);
  const kept = lanes.filter((l) => l.name !== name);
  if (kept.length === lanes.length) return err(404, "lane not in registry");
  const werr = await writeKvLanes(env, kept);
  if (werr) return werr;
  return json({ ok: true, removed: name, total: kept.length });
}

function cacheKeyFor(body, failClosed, keylessOnly) {
  return (
    "v1:" +
    cyrb53(
      JSON.stringify([
        body.model,
        body.messages,
        body.temperature,
        body.max_tokens,
        body.top_p,
        body.stop,
        !!failClosed,
        !!keylessOnly,
      ])
    )
  );
}

async function handleChatInner(request, env, body) {
  const stream = body.stream === true;
  const failClosed = request.headers.get("x-fail-closed") === "true";
  const keylessOnly = request.headers.get("x-keyless-only") === "true";
  // Default LB mode is efficiency: lanes order by OBSERVED merit
  // (success-rate × tokens/sec) within each tier, not by static weights.
  // Tiers remain trust boundaries (keyed first; x-fail-closed still excludes
  // keyless entirely) — but a free SOTA lane that proves itself outranks a
  // flaky keyed lane on merit, instead of waiting behind tier prejudice.
  const lbMode = request.headers.get("x-lb") || env.LB_MODE || "efficiency";

  // --- logical deadline: one budget for the whole request ---
  let deadlineMs = REQUEST_DEADLINE_MS;
  const hdl = request.headers.get("x-deadline-ms");
  if (hdl) {
    const n = parseInt(hdl, 10);
    if (Number.isFinite(n)) deadlineMs = Math.min(300_000, Math.max(5_000, n));
  }
  const deadlineAt = Date.now() + deadlineMs;

  // --- opt-in exact-match cache (non-streaming only) ---
  let cacheTtl = 0;
  const hct = request.headers.get("x-cache-ttl");
  if (hct && !stream) {
    const n = parseInt(hct, 10);
    if (Number.isFinite(n)) cacheTtl = Math.min(300, Math.max(1, n));
  }
  const ckey = cacheTtl ? cacheKeyFor(body, failClosed, keylessOnly) : null;
  if (ckey) {
    const hit = cache.get(ckey);
    if (hit && hit.exp > Date.now()) {
      return new Response(hit.bodyText, {
        status: hit.status,
        headers: { ...hit.headers, "x-cache": "HIT" },
      });
    } else if (hit) cache.delete(ckey);
  }

  // --- opt-in hedging (keyed tier, non-streaming only) ---
  let hedgeAfterMs = 0;
  const hh = request.headers.get("x-hedge-after-ms");
  if (hh && !stream) {
    const n = parseInt(hh, 10);
    if (Number.isFinite(n)) hedgeAfterMs = Math.min(30_000, Math.max(1_000, n));
  }

  const ctx = { stream, failClosed, keylessOnly };
  const lanes = orderLanes(
    (await resolveLanes(env)).filter((l) => laneEligible(l, ctx)),
    lbMode
  );
  const failures = [];
  let attempts = 0;

  for (let i = 0; i < lanes.length; i++) {
    const remaining = deadlineAt - Date.now();
    if (remaining <= 500) {
      return json(
        {
          error: {
            message: "request deadline exceeded before any lane succeeded",
            type: "router_error",
            attempts,
            failures,
          },
        },
        504
      );
    }
    const lane = lanes[i];
    // Weekly budget allocator: pacing. Empty bucket → skip this lane for this
    // request (fail over to spare capacity, don't burn attempts on 429s).
    if (!paceTake(lane.name)) {
      recordSkip(lane.name, "pacing");
      continue;
    }
    const timeoutMs = Math.min(lane.timeoutMs || TIMEOUT_MS, remaining);
    const next = lanes[i + 1];
    const canHedge =
      hedgeAfterMs > 0 && lane.tier === "keyed" && next && next.tier === "keyed";

    let r, consumed = 1, winner = null, errs = [];
    if (canHedge) {
      const h = await hedgedAttempt(lane, next, body, stream, { timeoutMs }, hedgeAfterMs);
      r = h.action === "return" ? { action: "return", response: h.response } : { action: "next" };
      consumed = h.consumed;
      winner = h.winner || null;
      errs = h.errors; // [{ error, was429 }]
    } else {
      r = await attemptLane(lane, body, stream, { timeoutMs });
      errs = r.action === "next" ? [{ error: r.error, was429: !!r.was429 }] : [];
    }
    i += consumed - 1;
    attempts += consumed;

    if (r.action === "return") {
      const resp = r.response;
      const outHeaders = {
        "x-fallback-attempts": String(failures.length),
        // The lane that actually served the response: the hedge winner when a
        // hedge fired, otherwise the primary lane for this walk step.
        "x-lane": winner || lane.name,
        "x-lb-mode": lbMode,
      };
      if (winner) outHeaders["x-hedge-winner"] = winner;
      const withMeta = new Response(resp.body, {
        status: resp.status,
        headers: { ...Object.fromEntries(resp.headers.entries()), ...outHeaders },
      });
      if (ckey && resp.status === 200) {
        // Cache the success (body must be buffered — non-streaming only).
        const bodyText = await withMeta.clone().text().catch(() => null);
        if (bodyText !== null) {
          if (cache.size >= CACHE_MAX_ENTRIES) {
            const oldest = cache.keys().next();
            if (!oldest.done) cache.delete(oldest.value);
          }
          const plain = {};
          withMeta.headers.forEach((v, k) => { plain[k] = v; });
          delete plain["x-cache"];
          cache.set(ckey, {
            exp: Date.now() + cacheTtl * 1000,
            status: withMeta.status,
            bodyText,
            headers: plain,
            failClosed,
          });
          outHeaders["x-cache"] = "MISS";
          return new Response(bodyText, { status: withMeta.status, headers: { ...plain, ...outHeaders } });
        }
      }
      return withMeta;
    }
    for (const e of errs) failures.push({ error: e.error, was429: !!e.was429 });
  }

  if (failures.length === 0) {
    return json(
      { error: { message: "all lanes failed or unavailable", type: "router_error", failures: [] } },
      502
    );
  }
  // Honest status: every attempt was a 429 → tell the caller to back off,
  // don't claim it's our fault (502).
  if (failures.every((f) => f.was429)) {
    let minWait = 60;
    for (const lane of lanes) {
      const rem = cooldownRemainingS(lane.name);
      if (rem > 0) minWait = Math.min(minWait, rem);
    }
    minWait = Math.max(1, Math.min(300, minWait));
    return json(
      {
        error: {
          message: "all lanes rate-limited",
          type: "router_error",
          failures: failures.map((f) => f.error),
        },
      },
      429,
      { "retry-after": String(minWait), "x-fallback-attempts": String(failures.length) }
    );
  }
  return json(
    {
      error: {
        message: "all lanes failed or unavailable",
        type: "router_error",
        failures: failures.map((f) => f.error),
      },
    },
    502,
    { "x-fallback-attempts": String(failures.length) }
  );
}

async function handleChat(request, env) {
  // --- admission control (cheap routes exempt) ---
  const maxInflight = parseInt(env.MAX_INFLIGHT || "", 10) || MAX_INFLIGHT_DEFAULT;
  const globalRpm = parseInt(env.GLOBAL_RPM_LIMIT || "", 10) || GLOBAL_RPM_DEFAULT;
  if (rt.inflight >= maxInflight)
    return err(429, "router at capacity (in-flight limit)", { "retry-after": "5" });
  const now = Date.now();
  rt.ts = rt.ts.filter((t) => now - t < 60_000);
  if (rt.ts.length >= globalRpm) {
    const waitS = Math.max(1, Math.ceil((rt.ts[0] + 60_000 - now) / 1000));
    return err(429, "router global rate limit exceeded", { "retry-after": String(waitS) });
  }
  rt.inflight += 1;
  rt.ts.push(now);
  try {
    const capped = await readCappedBody(request);
    if (capped.tooLarge) return err(413, "request body too large (1MB max)");
    let body;
    try {
      body = JSON.parse(capped.text || "");
    } catch (_) {
      return err(400, "invalid JSON body");
    }
    if (!body || !Array.isArray(body.messages)) return err(400, "body.messages must be an array");
    return await handleChatInner(request, env, body);
  } finally {
    rt.inflight -= 1;
  }
}

async function handleHealth(env) {
  const lanes = {};
  for (const lane of await resolveLanes(env)) {
    const s = prune(lane.name);
    lanes[lane.name] = {
      priority: lane.priority,
      tier: lane.tier || "keyed",
      fragmentsOnly: !!lane.fragmentsOnly,
      model: lane.model,
      weight: laneWeight(lane),
      source: lane.source || "builtin",
      configured: lane.keyless ? true : !!lane.key, // keyless lanes need no key
      // healthy = usable right now (configured and not cooling down).
      // The failover-drill workflow asserts on this field.
      healthy: (lane.keyless ? true : !!lane.key) && !inCooldown(lane.name),
      rpmUsed: s.ts.length,
      rpmLimit: lane.rpmLimit,
      success: s.ok,
      fail: s.fail,
      hedged: s.hedged,
      consecFail: s.consecFail,
      breakerOpen: inCooldown(lane.name) && s.consecFail >= BREAKER_FAILS,
      cooldownSecsRemaining: cooldownRemainingS(lane.name),
      lastSuccess: s.lastOk,
      lastFail: s.lastFail,
      lastError: s.lastError,
      inCooldown: inCooldown(lane.name),
      skips: s.skips,
      // Weekly budget allocator telemetry (hydrated from shared KV doc).
      weekly: { req: s.wReq, tokens: s.wTokens },
      pacing: { ceilPerHr: PACE_CEIL_PER_HR[lane.name] || null, bucketLeft: paceLeft(lane.name) },
      effScore: effScore(lane.name),
      // Intra-lane load balancing: per-model health for lanes with a pool.
      ...(lane.models
        ? {
            models: lane.models.map((m2) => {
              const k = modelKey(lane.name, m2);
              const ms = st(k);
              return {
                model: m2,
                ok: ms.ok,
                fail: ms.fail,
                consecFail: ms.consecFail,
                inCooldown: inCooldown(k),
                breakerOpen: inCooldown(k) && ms.consecFail >= BREAKER_FAILS,
                effScore: effScore(k),
                weekly: { req: ms.wReq, tokens: ms.wTokens },
                lastError: ms.lastError,
              };
            }),
          }
        : {}),
    };
  }
  const now = Date.now();
  rt.ts = rt.ts.filter((t) => now - t < 60_000);
  return json({
    ok: true,
    ts: new Date().toISOString(),
    durable: sharedOk, // true once the shared KV doc has hydrated this request
    router: { inflight: rt.inflight, rpmUsed: rt.ts.length },
    lanes,
  });
}

/**
 * Router auth: every route requires Authorization: Bearer <ROUTER_KEY>.
 * Missing ROUTER_KEY secret → 503 fail-closed (loud, not open).
 * Constant-time comparison to avoid timing oracles on the token.
 */
function checkAuth(request, env) {
  if (!env.ROUTER_KEY) return err(503, "router key not configured — set ROUTER_KEY secret");
  const want = "Bearer " + env.ROUTER_KEY;
  const got = request.headers.get("authorization") || "";
  if (got.length !== want.length) return err(401, "unauthorized");
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0 ? null : err(401, "unauthorized");
}

export default {
  async fetch(request, env, ctx) {
    // Hydrate the in-memory working copy from the shared KV doc (1 read on
    // the hot path; in-memory-only degraded mode when KV is unavailable).
    const base = await hydrateShared(env);
    // Persist this request's deltas in the background — never on the response
    // path. waitUntil keeps the isolate alive for the write, which is what
    // makes durability work when isolates never see a second request.
    // (No ctx in the test harness → persist inline so scenarios stay deterministic.)
    const done = () => persistShared(env, base);
    const url = new URL(request.url);
    const gate = () => checkAuth(request, env);
    if (request.method === "GET" && url.pathname === "/health") {
      const a = gate();
      if (a) return a;
      return handleHealth(env);
    }
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/v1")) {
      const a = gate();
      if (a) return a;
      const lanes = await resolveLanes(env);
      return json({
        name: "ai-router",
        routes: [
          "POST /v1/chat/completions",
          "GET /health",
          "GET /admin/lanes",
          "POST /admin/lanes",
          "DELETE /admin/lanes/:name",
          "GET /admin/incidents",
          "POST /admin/flush",
        ],
        lanes: lanes.map((l) => ({ name: l.name, priority: l.priority, tier: l.tier || "keyed", weight: laneWeight(l), source: l.source || "builtin", configured: l.keyless ? true : !!l.key })),
      });
    }
    if (request.method === "GET" && url.pathname === "/admin/lanes") {
      const a = gate();
      if (a) return a;
      return handleAdminLanesGet(env);
    }
    if (request.method === "POST" && url.pathname === "/admin/lanes") {
      const a = gate();
      if (a) return a;
      return handleAdminLanesPost(request, env);
    }
    if (request.method === "DELETE" && url.pathname.startsWith("/admin/lanes/")) {
      const a = gate();
      if (a) return a;
      const name = decodeURIComponent(url.pathname.slice("/admin/lanes/".length));
      return handleAdminLanesDelete(env, name);
    }
    if (request.method === "GET" && url.pathname === "/admin/incidents") {
      const a = gate();
      if (a) return a;
      return json({ incidents: incidents.slice(-50).reverse() });
    }
    if (request.method === "POST" && url.pathname === "/admin/flush") {
      const a = gate();
      if (a) return a;
      await persistShared(env, base); // awaited: caller knows the write landed
      return json({ ok: true, durable: sharedOk, flushedAt: new Date().toISOString() });
    }
    if (request.method === "GET" && url.pathname === "/admin/debug") {
      const a = gate();
      if (a) return a;
      const kv = env && env.LANES_KV;
      let doc = null;
      try {
        doc = kv ? await kv.get(SHARED_KEY, "json") : null;
      } catch (_) {}
      const snap = {};
      for (const [k, s] of Object.entries(state))
        snap[k] = { wReq: s.wReq, wTokens: s.wTokens, ok: s.ok, fail: s.fail, tokTotal: s.tokTotal };
      return json({ moduleWeekStart: weekStart, nowWeekStart: weekStartOf(Date.now()), mem: snap, docLanes: doc && doc.lanes });
    }
    if (request.method === "POST" && url.pathname === "/v1/chat/completions") {
      const r = gate();
      if (r) return r;
      try {
        return await handleChat(request, env);
      } finally {
        if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(done());
        else await done();
      }
    }
    return err(404, "not found");
  },
};

/* Named exports for the node test harness (test-router.mjs). The worker
   runtime only uses `default`; Cloudflare ignores extra exports. */
export { classifySig, recordError, recordSuccess, recordIncident, isRepeatOffender, incidents, isDegradedCompletion };
/* Weekly budget allocator exports (test harness). */
export { paceTake, paceLeft, pace, PACE_CEIL_PER_HR, tokensOf, effScore, orderLanes, orderEfficiency, weekStartOf };
/* Durable allocator-state exports (test harness). */
export { hydrateShared, persistShared, deltasSince, SHARED_KEY, SHARED_VERSION };
