#!/usr/bin/env node
/**
 * test-router.mjs — QA harness for ai-router.js (Cloudflare Worker, free-tier AI failover router).
 *
 * Two modes:
 *   node test-router.mjs                 → runner: spawns one child process per
 *                                          scenario (fresh module state each
 *                                          time, so per-lane cooldowns can't
 *                                          leak between tests), asserts, prints
 *                                          a pass/fail summary.
 *   node test-router.mjs --scenario=NAME → runs a single scenario in-process and
 *                                          prints JSON between RESULT_BEGIN/END.
 *
 * The global fetch is mocked per scenario to simulate lane behaviors.
 * The router is loaded from a .mjs copy in /tmp so ESM `export default`
 * parses regardless of any package.json `type` setting.
 */
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const SELF = fileURLToPath(import.meta.url);
const HERE = path.dirname(SELF);
const ROUTER_SRC = path.join(HERE, "ai-router.js");
const ROUTER_COPY = "/tmp/ai-router-under-test.mjs";

const SCENARIO_ARG = process.argv.find((a) => a.startsWith("--scenario="));
const SCENARIO = SCENARIO_ARG ? SCENARIO_ARG.split("=")[1] : null;

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

async function loadWorker() {
  const src = await readFile(ROUTER_SRC, "utf8");
  await writeFile(ROUTER_COPY, src);
  const mod = await import(pathToFileURL(ROUTER_COPY).href);
  return mod.default;
}

/** Full module (default + named exports) for white-box scenarios. */
async function loadWorkerFull() {
  const src = await readFile(ROUTER_SRC, "utf8");
  await writeFile(ROUTER_COPY, src);
  return import(pathToFileURL(ROUTER_COPY).href);
}

/** In-memory Workers-KV stand-in: get/put/delete/list({prefix}). */
function mockKV() {
  const store = new Map();
  return {
    store,
    puts: 0,
    async get(k, type) {
      const v = store.get(k);
      if (v == null) return null;
      return type === "json" ? JSON.parse(v) : v;
    },
    async put(k, v) {
      this.puts++;
      store.set(k, String(v));
    },
    async delete(k) {
      store.delete(k);
    },
    async list({ prefix = "" } = {}) {
      return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) };
    },
  };
}

/**
 * rules: array of [urlSubstring, behavior]
 * behavior: { status, headers, json, text } | { hang: true } | { throw: "msg" }
 * unmatched URLs → 599 (loud failure so missing rules are obvious).
 * `bodies` (optional array) collects each request's raw body string AND headers
 * for assertions.
 */
function mockFetchFactory(rules, calls, bodies, hdrs) {
  return async (url, init = {}) => {
    const u = String(url);
    calls.push(u);
    if (bodies) bodies.push({ body: init.body ?? null, headers: init.headers ?? {} });
    if (hdrs) hdrs.push(init.headers ?? null);
    const rule = rules.find(([m]) => u.includes(m));
    const b = rule ? rule[1] : { status: 599, json: { error: { message: "no mock rule for " + u } } };
    if (b.hang) {
      return new Promise((_, reject) => {
        const sig = init.signal;
        const onAbort = () => {
          const e = new Error("The operation was aborted.");
          e.name = "AbortError";
          reject(e);
        };
        if (!sig) return; // router always passes a signal; hang forever otherwise
        if (sig.aborted) onAbort();
        else sig.addEventListener("abort", onAbort, { once: true });
      });
    }
    if (b.throw) throw new Error(b.throw);
    if (b.sseThenAbort) {
      // Emits one SSE chunk, then the upstream stream errors mid-flight.
      // Pull-based so the chunk is genuinely delivered before the error
      // (enqueue+error in the same sync start() discards the chunk in Node).
      const enc = new TextEncoder();
      let n = 0;
      return new Response(
        new ReadableStream({
          pull(c) {
            n++;
            if (n === 1)
              c.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'));
            else c.error(new Error("upstream died mid-stream"));
          },
        }),
        { status: 200, headers: new Headers({ "Content-Type": "text/event-stream" }) }
      );
    }
    const headers = new Headers(b.headers || { "Content-Type": "application/json" });
    const bodyText = b.json !== undefined ? JSON.stringify(b.json) : b.text || "";
    return new Response(bodyText, { status: b.status ?? 200, headers });
  };
}

const openaiOk = (content, model = "llama-3.3-70b-versatile") => ({
  id: "chatcmpl-test123",
  object: "chat.completion",
  created: 1,
  model,
  choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
});

const ENV_ALL = {
  ROUTER_KEY: "k-router",
  GEMINI_KEY: "k-gemini",
  GROQ_KEY: "k-groq",
  MISTRAL_KEY: "k-mistral",
  ZAI_KEY: "k-zai",
  NVIDIA_KEY: "k-nvidia",
  OPENROUTER_KEY: "k-or",
  SAMBANOVA_KEY: "k-sambanova",
  GITHUB_MODELS_KEY: "k-github",
  // Deterministic lane order for the suite: the default weighted shuffle uses
  // Math.random(), which makes exact call-count assertions flaky by design.
  // Weighted-mode behavior gets its own statistical scenario, not these.
  LB_MODE: "priority",
};

const CHAT_BODY = { model: "ignored-by-router", messages: [{ role: "user", content: "ping" }] };

const postChat = (worker, env, body = CHAT_BODY, extraHeaders = {}) => {
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  // env.ROUTER_KEY present → send the bearer token (extraHeaders can override
  // it, which is how the wrongkey scenario forges a bad token).
  if (env.ROUTER_KEY && !headers.Authorization)
    headers.Authorization = "Bearer " + env.ROUTER_KEY;
  return worker.fetch(
    new Request("http://localhost/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
    env
  );
};

/** Authenticated GET helper (all routes now require the router key). */
const authedGet = (worker, env, path, extraHeaders = {}) => {
  const headers = { ...extraHeaders };
  if (env.ROUTER_KEY && !headers.Authorization)
    headers.Authorization = "Bearer " + env.ROUTER_KEY;
  return worker.fetch(new Request("http://localhost" + path, { headers }), env);
};

const hostOf = (u) => {
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
};

/* ------------------------------------------------------------------ */
/* Scenarios (each runs in its own process → fresh router module state) */
/* ------------------------------------------------------------------ */

const scenarios = {
  /** (1) Every lane 429s → all 11 attempted, 502 returned. */
  async all429() {
    const calls = [];
    const r429 = (msg, headers = {}) => ({
      status: 429,
      headers: { "retry-after": "5", ...headers },
      json: { error: { message: msg } },
    });
    globalThis.fetch = mockFetchFactory(
      [
        ["generativelanguage.googleapis.com", r429("gemini quota")],
        ["api.groq.com", r429("groq rate limit")],
        ["api.mistral.ai", r429("mistral rate limit")],
        ["api.z.ai", r429("zai rate limit")],
        ["integrate.api.nvidia.com", r429("nvidia rate limit")],
        ["openrouter.ai", r429("openrouter rate limit")],
        ["api.sambanova.ai", r429("sambanova quota")],
        ["models.github.ai", r429("github models rate limit")],
        ["text.pollinations.ai", r429("pollinations busy")],
        ["api.kilo.ai", r429("kilo upstream 429")],
        // ovh answers 429 WITHOUT retry-after but WITH ratelimit-reset (epoch)
        ["ovh.net", {
          status: 429,
          headers: { "ratelimit-reset": String(Math.floor(Date.now() / 1000) + 45) },
          json: { error: { message: "ovh shared pool exhausted" } },
        }],
        ["api.llm7.io", r429("llm7 busy")],
      ],
      calls
    );
    const worker = await loadWorker();
    const res = await postChat(worker, ENV_ALL);
    const body = await res.json();
    return {
      status: res.status,
      retryAfter: res.headers.get("retry-after"),
      numCalls: calls.length,
      hosts: calls.map(hostOf),
      failures: body?.error?.failures ?? null,
      message: body?.error?.message ?? null,
    };
  },

  /** (2) Lane 1 (gemini) 429 → fail over to lane 2 (groq) which succeeds. */
  async failover429() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [
        [
          "generativelanguage.googleapis.com",
          { status: 429, headers: { "retry-after": "5" }, json: { error: { message: "quota" } } },
        ],
        ["api.groq.com", { status: 200, json: openaiOk("groq says hi") }],
      ],
      calls
    );
    const worker = await loadWorker();
    const res = await postChat(worker, ENV_ALL);
    const body = await res.json();
    return {
      status: res.status,
      xLane: res.headers.get("x-lane"),
      content: body?.choices?.[0]?.message?.content ?? null,
      numCalls: calls.length,
      hosts: calls.map(hostOf),
    };
  },

  /** (3) Lane 1 hangs past the 20s per-lane timeout → fail over to lane 2. */
  async timeout() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [
        ["generativelanguage.googleapis.com", { hang: true }],
        ["api.groq.com", { status: 200, json: openaiOk("groq after timeout") }],
      ],
      calls
    );
    const worker = await loadWorker();
    const t0 = Date.now();
    const res = await postChat(worker, ENV_ALL);
    const elapsedMs = Date.now() - t0;
    const body = await res.json();
    return {
      status: res.status,
      xLane: res.headers.get("x-lane"),
      content: body?.choices?.[0]?.message?.content ?? null,
      numCalls: calls.length,
      hosts: calls.map(hostOf),
      elapsedMs,
    };
  },

  /** (4) Lane 1 returns 400 → NO failover; 400 returned immediately. */
  async badrequest() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [
        [
          "generativelanguage.googleapis.com",
          {
            status: 400,
            json: { error: { message: "API key not valid", code: 400, status: "INVALID_ARGUMENT" } },
          },
        ],
        ["api.groq.com", { status: 200, json: openaiOk("must never be reached") }],
      ],
      calls
    );
    const worker = await loadWorker();
    const res = await postChat(worker, ENV_ALL);
    const body = await res.json();
    return {
      status: res.status,
      xLane: res.headers.get("x-lane"),
      errMessage: body?.error?.message ?? null,
      numCalls: calls.length,
      hosts: calls.map(hostOf),
    };
  },

  /** (5) GET /health → JSON with all 12 lanes present, tiers + fragmentsOnly flagged. */
  async health() {
    const calls = [];
    globalThis.fetch = mockFetchFactory([], calls); // any fetch call would be a bug
    const worker = await loadWorker();
    const res = await authedGet(worker, ENV_ALL, "/health");
    const body = await res.json();
    const lanes = body.lanes || {};
    return {
      status: res.status,
      laneNames: Object.keys(lanes).sort(),
      configured: Object.fromEntries(Object.entries(lanes).map(([k, v]) => [k, !!v.configured])),
      priorities: Object.fromEntries(Object.entries(lanes).map(([k, v]) => [k, v.priority])),
      tiers: Object.fromEntries(Object.entries(lanes).map(([k, v]) => [k, v.tier])),
      fragmentsOnly: Object.fromEntries(Object.entries(lanes).map(([k, v]) => [k, !!v.fragmentsOnly])),
      numCalls: calls.length,
    };
  },

  /** (6) No lane keys (but router key present) → keyed skipped, keyless serves. */
  async nokeys() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [["text.pollinations.ai", { status: 200, json: openaiOk("pollinations keyless hi") }]],
      calls
    );
    const worker = await loadWorker();
    const env = { ROUTER_KEY: "k-router", LB_MODE: "priority" }; // router key set, no lane keys
    const res = await postChat(worker, env);
    const body = await res.json();
    const hres = await authedGet(worker, env, "/health");
    const hbody = await hres.json();
    const hlaneNames = Object.keys(hbody.lanes || {}).sort();
    return {
      status: res.status,
      xLane: res.headers.get("x-lane"),
      content: body?.choices?.[0]?.message?.content ?? null,
      numCalls: calls.length,
      hosts: calls.map(hostOf),
      healthStatus: hres.status,
      healthLaneNames: hlaneNames,
      healthConfigured: Object.fromEntries(
        Object.entries(hbody.lanes || {}).map(([k, v]) => [k, !!v.configured])
      ),
    };
  },

  /** (7) Gemini 200 → request translated OpenAI→Gemini, response translated back. */
  async gemini200() {
    const calls = [];
    const bodies = [];
    const hdrs = [];
    globalThis.fetch = mockFetchFactory(
      [
        [
          "generativelanguage.googleapis.com",
          {
            status: 200,
            json: {
              candidates: [
                { content: { parts: [{ text: "gemini translated hi" }] }, finishReason: "STOP" },
              ],
              usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 6, totalTokenCount: 18 },
            },
          },
        ],
      ],
      calls,
      bodies,
      hdrs
    );
    const worker = await loadWorker();
    const res = await postChat(worker, ENV_ALL, {
      model: "x",
      messages: [
        { role: "system", content: "be nice" },
        { role: "user", content: "ping" },
      ],
      temperature: 0.5,
      max_tokens: 50,
    });
    const body = await res.json();
    return {
      status: res.status,
      xLane: res.headers.get("x-lane"),
      object: body?.object ?? null,
      content: body?.choices?.[0]?.message?.content ?? null,
      finish: body?.choices?.[0]?.finish_reason ?? null,
      usage: body?.usage ?? null,
      numCalls: calls.length,
      geminiUrl: calls[0] || null,
      sentBody: bodies[0] ? JSON.parse(bodies[0].body) : null,
      sentHeaders: bodies[0] ? bodies[0].headers : null,
      sentHeaders: hdrs[0] || null,
    };
  },

  /** (8) stream:true → gemini skipped (no SSE translation), groq SSE passes through. */
  async streamSkip() {
    const calls = [];
    const sse = 'data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n\n';
    globalThis.fetch = mockFetchFactory(
      [
        [
          "api.groq.com",
          { status: 200, headers: { "Content-Type": "text/event-stream" }, text: sse },
        ],
      ],
      calls
    );
    const worker = await loadWorker();
    const res = await postChat(worker, ENV_ALL, {
      model: "x",
      messages: [{ role: "user", content: "ping" }],
      stream: true,
    });
    const text = await res.text();
    return {
      status: res.status,
      xLane: res.headers.get("x-lane"),
      contentType: res.headers.get("content-type"),
      text,
      numCalls: calls.length,
      hosts: calls.map(hostOf),
    };
  },

  /** (9) All 7 keyed lanes 429 → keyless tier (pollinations) serves. */
  async keylessFallback() {
    const calls = [];
    const r429 = { status: 429, headers: { "retry-after": "5" }, json: { error: { message: "quota" } } };
    globalThis.fetch = mockFetchFactory(
      [
        ["generativelanguage.googleapis.com", r429],
        ["api.groq.com", r429],
        ["api.mistral.ai", r429],
        ["api.z.ai", r429],
        ["integrate.api.nvidia.com", r429],
        ["openrouter.ai", r429],
        ["api.sambanova.ai", r429],
        ["models.github.ai", r429],
        ["text.pollinations.ai", { status: 200, json: openaiOk("pollinations to the rescue") }],
      ],
      calls
    );
    const worker = await loadWorker();
    const res = await postChat(worker, ENV_ALL);
    const body = await res.json();
    return {
      status: res.status,
      xLane: res.headers.get("x-lane"),
      content: body?.choices?.[0]?.message?.content ?? null,
      numCalls: calls.length,
      hosts: calls.map(hostOf),
    };
  },

  /** (10) Keyless 429 (pollinations) → next keyless lane (kilo) serves. */
  async keyless429() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [
        [
          "text.pollinations.ai",
          { status: 429, headers: { "retry-after": "5" }, json: { error: { message: "busy" } } },
        ],
        ["api.kilo.ai", { status: 200, json: openaiOk("kilo auto-router hi") }],
      ],
      calls
    );
    const worker = await loadWorker();
    const res = await postChat(worker, { ROUTER_KEY: "k-router", LB_MODE: "priority" }); // router key set, no lane keys
    const body = await res.json();
    return {
      status: res.status,
      xLane: res.headers.get("x-lane"),
      content: body?.choices?.[0]?.message?.content ?? null,
      numCalls: calls.length,
      hosts: calls.map(hostOf),
    };
  },

  /** (11) zai serves when configured (priority 4); skipped cleanly when ZAI_KEY missing. */
  async zaiOptional() {
    const calls = [];
    const r429 = { status: 429, headers: { "retry-after": "5" }, json: { error: { message: "quota" } } };
    globalThis.fetch = mockFetchFactory(
      [
        ["generativelanguage.googleapis.com", r429],
        ["api.groq.com", r429],
        ["api.mistral.ai", r429],
        ["api.z.ai", { status: 200, json: openaiOk("zai says ni hao") }],
        ["integrate.api.nvidia.com", { status: 200, json: openaiOk("nvidia fallback hi") }],
      ],
      calls
    );
    const worker = await loadWorker();
    // Phase A: ZAI_KEY present → lanes 1–3 429, zai (priority 4) serves.
    const resA = await postChat(worker, ENV_ALL);
    const bodyA = await resA.json();
    const callsA = calls.length;
    const hostsA = calls.map(hostOf);
    // Phase B: ZAI_KEY absent → zai skipped (no-key), nvidia serves instead.
    const envB = { ...ENV_ALL };
    delete envB.ZAI_KEY;
    const resB = await postChat(worker, envB);
    const bodyB = await resB.json();
    const hres = await authedGet(worker, envB, "/health");
    const hbody = await hres.json();
    return {
      aStatus: resA.status,
      aLane: resA.headers.get("x-lane"),
      aContent: bodyA?.choices?.[0]?.message?.content ?? null,
      aCalls: callsA,
      aHosts: hostsA,
      bStatus: resB.status,
      bLane: resB.headers.get("x-lane"),
      bContent: bodyB?.choices?.[0]?.message?.content ?? null,
      totalCalls: calls.length,
      zaiSkips: hbody?.lanes?.zai?.skips ?? null,
    };
  },

  /** (31) GitHub Models lane (priority 9): serves when GITHUB_MODELS_KEY present, skipped when absent. */
  async githubModels() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [
        ["models.github.ai", { status: 200, json: openaiOk("github models hi") }],
        ["text.pollinations.ai", { status: 200, json: openaiOk("pollinations keyless hi") }],
      ],
      calls
    );
    const worker = await loadWorker();
    // Phase A: only GITHUB_MODELS_KEY set → lanes 1–8 skipped (no keys), github-models serves.
    const envA = { ROUTER_KEY: "k-router", GITHUB_MODELS_KEY: "k-github", LB_MODE: "priority" };
    const resA = await postChat(worker, envA);
    const bodyA = await resA.json();
    const callsA = calls.length;
    const hostsA = calls.map(hostOf);
    // Phase B: no lane keys → github-models skipped, keyless tier serves.
    const envB = { ROUTER_KEY: "k-router", LB_MODE: "priority" };
    const resB = await postChat(worker, envB);
    const bodyB = await resB.json();
    return {
      aStatus: resA.status,
      aLane: resA.headers.get("x-lane"),
      aContent: bodyA?.choices?.[0]?.message?.content ?? null,
      aCalls: callsA,
      aHosts: hostsA,
      bStatus: resB.status,
      bLane: resB.headers.get("x-lane"),
      bContent: bodyB?.choices?.[0]?.message?.content ?? null,
    };
  },

  /** (12) No ROUTER_KEY configured → 503 fail-closed, no lane attempted. */
  async noauthkey() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [["api.groq.com", { status: 200, json: openaiOk("must never be reached") }]],
      calls
    );
    const worker = await loadWorker();
    const res = await postChat(worker, {}); // no ROUTER_KEY in env at all
    const body = await res.json();
    const hres = await worker.fetch(new Request("http://localhost/health"), {});
    return {
      chatStatus: res.status,
      chatMessage: body?.error?.message ?? null,
      healthStatus: hres.status,
      numCalls: calls.length,
    };
  },

  /** (13) Wrong bearer token → 401, no lane attempted. */
  async wrongkey() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [["api.groq.com", { status: 200, json: openaiOk("must never be reached") }]],
      calls
    );
    const worker = await loadWorker();
    const res = await postChat(worker, ENV_ALL, CHAT_BODY, {
      Authorization: "Bearer wrong-token",
    });
    const body = await res.json();
    return {
      status: res.status,
      message: body?.error?.message ?? null,
      numCalls: calls.length,
    };
  },

  /** (14) x-fail-closed: true → keyless lanes skipped, 502 instead of leaking. */
  async failclosed() {
    const calls = [];
    const r429 = { status: 429, headers: { "retry-after": "5" }, json: { error: { message: "quota" } } };
    globalThis.fetch = mockFetchFactory(
      [
        ["generativelanguage.googleapis.com", r429],
        ["api.groq.com", r429],
        ["api.mistral.ai", r429],
        ["api.z.ai", r429],
        ["integrate.api.nvidia.com", r429],
        ["openrouter.ai", r429],
        ["api.sambanova.ai", r429],
        ["models.github.ai", r429],
        ["text.pollinations.ai", { status: 200, json: openaiOk("must never be reached") }],
      ],
      calls
    );
    const worker = await loadWorker();
    const res = await postChat(worker, ENV_ALL, CHAT_BODY, { "x-fail-closed": "true" });
    const body = await res.json();
    return {
      status: res.status,
      numCalls: calls.length,
      hosts: calls.map(hostOf),
      failures: body?.error?.failures ?? null,
      keylessAttempted: calls.some((u) => u.includes("pollinations")),
    };
  },

  /** (15) sambanova (priority 7) serves when keyed lanes 1–6 fail and key present; skipped cleanly when absent. */
  async sambanovaOptional() {
    const calls = [];
    const r429 = { status: 429, headers: { "retry-after": "5" }, json: { error: { message: "quota" } } };
    globalThis.fetch = mockFetchFactory(
      [
        ["generativelanguage.googleapis.com", r429],
        ["api.groq.com", r429],
        ["api.mistral.ai", r429],
        ["api.z.ai", r429],
        ["integrate.api.nvidia.com", r429],
        ["openrouter.ai", r429],
        ["api.sambanova.ai", { status: 200, json: openaiOk("sambanova says hi") }],
        ["models.github.ai", r429],
        ["text.pollinations.ai", { status: 200, json: openaiOk("pollinations fallback hi") }],
      ],
      calls
    );
    const worker = await loadWorker();
    // Phase A: SAMBANOVA_KEY present → lanes 1–6 429, sambanova (priority 7) serves.
    const resA = await postChat(worker, ENV_ALL);
    const bodyA = await resA.json();
    const callsA = calls.length;
    const hostsA = calls.map(hostOf);
    // Phase B: SAMBANOVA_KEY absent → sambanova skipped (no-key), pollinations serves.
    const envB = { ...ENV_ALL };
    delete envB.SAMBANOVA_KEY;
    const resB = await postChat(worker, envB);
    const bodyB = await resB.json();
    const hres = await authedGet(worker, envB, "/health");
    const hbody = await hres.json();
    return {
      aStatus: resA.status,
      aLane: resA.headers.get("x-lane"),
      aContent: bodyA?.choices?.[0]?.message?.content ?? null,
      aCalls: callsA,
      aHosts: hostsA,
      bStatus: resB.status,
      bLane: resB.headers.get("x-lane"),
      bContent: bodyB?.choices?.[0]?.message?.content ?? null,
      totalCalls: calls.length,
      sambanovaSkips: hbody?.lanes?.sambanova?.skips ?? null,
    };
  },

  /** (16) x-deadline-ms bounds worst-case latency: hanging lanes → 504, not a 220s hang. */
  async deadline() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [
        ["generativelanguage.googleapis.com", { hang: true }],
        ["api.groq.com", { hang: true }],
      ],
      calls
    );
    const worker = await loadWorker();
    const t0 = Date.now();
    const res = await postChat(worker, ENV_ALL, CHAT_BODY, { "x-deadline-ms": "2500" });
    const elapsedMs = Date.now() - t0;
    const body = await res.json();
    return {
      status: res.status,
      numCalls: calls.length,
      elapsedMs,
      message: body?.error?.message ?? null,
      attempts: body?.error?.attempts ?? null,
    };
  },

  /** (17) groq 401 (revoked key) → fail over to mistral. One dead key must not 401 the router. */
  async authFailover() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [
        [
          "generativelanguage.googleapis.com",
          { status: 429, headers: { "retry-after": "5" }, json: { error: { message: "quota" } } },
        ],
        ["api.groq.com", { status: 401, json: { error: { message: "invalid api key" } } }],
        ["api.mistral.ai", { status: 200, json: openaiOk("mistral after groq 401") }],
      ],
      calls
    );
    const worker = await loadWorker();
    const res = await postChat(worker, ENV_ALL);
    const body = await res.json();
    return {
      status: res.status,
      xLane: res.headers.get("x-lane"),
      fallbackAttempts: res.headers.get("x-fallback-attempts"),
      content: body?.choices?.[0]?.message?.content ?? null,
      numCalls: calls.length,
      hosts: calls.map(hostOf),
    };
  },

  /** (18) Circuit breaker: 3 consecutive groq 500s → breaker opens with backoff; req4 skips groq. */
  async breaker() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [
        ["generativelanguage.googleapis.com", { status: 500, json: { error: { message: "gemini down" } } }],
        ["api.groq.com", { status: 500, json: { error: { message: "groq exploded" } } }],
        ["api.mistral.ai", { status: 200, json: openaiOk("mistral steady") }],
      ],
      calls
    );
    const worker = await loadWorker();
    const statuses = [];
    const callsPer = [];
    for (let i = 0; i < 4; i++) {
      const before = calls.length;
      const res = await postChat(worker, ENV_ALL);
      statuses.push(res.status);
      callsPer.push(calls.length - before);
      await res.json();
    }
    const hres = await authedGet(worker, ENV_ALL, "/health");
    const hbody = await hres.json();
    const g = hbody?.lanes?.groq || {};
    return {
      statuses,
      callsPer,
      totalCalls: calls.length,
      groqConsecFail: g.consecFail,
      groqBreakerOpen: g.breakerOpen,
      groqCooldownS: g.cooldownSecsRemaining,
      groqSkips: g.skips,
    };
  },

  /** (18b) Incident forensics: breaker trips are logged with deterministic
      signatures and served newest-first on GET /admin/incidents (authed only). */
  async incidentForensics() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [
        ["generativelanguage.googleapis.com", { status: 500, json: { error: { message: "gemini down" } } }],
        ["api.groq.com", { status: 500, json: { error: { message: "groq exploded" } } }],
        ["api.mistral.ai", { status: 200, json: openaiOk("mistral steady") }],
      ],
      calls
    );
    const worker = await loadWorker();
    // x-lb: priority → deterministic lane order (default weighted shuffle uses
    // Math.random and would make trip counts nondeterministic).
    const PRI = { "x-lb": "priority" };
    for (let i = 0; i < 3; i++) {
      const res = await postChat(worker, ENV_ALL, CHAT_BODY, PRI);
      await res.json();
    }
    const ires = await authedGet(worker, ENV_ALL, "/admin/incidents");
    const ibody = await ires.json();
    const unauth = await worker.fetch(new Request("http://localhost/admin/incidents"), ENV_ALL);
    return {
      incidentStatus: ires.status,
      incidents: ibody?.incidents ?? null,
      unauthStatus: unauth.status,
    };
  },

  /** (18c) Repeat offender: unit-level proof that operational memory escalates
      backoff for a flapping lane (same sig 3+ times/hour → +1 backoff step). */
  async repeatOffender() {
    const src = await readFile(ROUTER_SRC, "utf8");
    await writeFile(ROUTER_COPY, src);
    const mod = await import(pathToFileURL(ROUTER_COPY).href);
    const sigCases = {
      "lane 5xx: 503": "http-503",
      "timeout after 20000ms": "timeout",
      "fetch failed: socket hang up": "network",
      "HTTP 429 slow down": "rate-limit",
      "lane auth/model 401": "auth",
      "something weird": "unknown",
    };
    const sigResults = {};
    for (const [msg, want] of Object.entries(sigCases)) sigResults[msg] = mod.classifySig(msg);
    // Flapping lane: trip → recover (counters reset) → trip … 4 trips total.
    const backs = [];
    for (let trip = 0; trip < 4; trip++) {
      for (let f = 0; f < 3; f++) mod.recordError("flap", "lane 5xx: 503");
      backs.push(mod.incidents[mod.incidents.length - 1].backoffSec);
      mod.recordSuccess("flap");
    }
    // Ring-buffer cap (checked last: the spam evicts the flap incidents).
    const repeatNow = mod.isRepeatOffender("flap", "http-503");
    const wrongSig = mod.isRepeatOffender("flap", "timeout");
    const wrongLane = mod.isRepeatOffender("other", "http-503");
    for (let i = 0; i < 105; i++) mod.recordIncident("spam", "unknown", 30);
    return {
      sigResults,
      wantSigs: sigCases,
      backs,
      repeatNow,
      wrongSig,
      wrongLane,
      ringLen: mod.incidents.length,
      lastLane: mod.incidents[mod.incidents.length - 1].lane,
    };
  },

  /** (19) Admission control: GLOBAL_RPM_LIMIT=2 → 3rd rapid request gets 429. */
  /** (26a) Pacing: kilo bucket depletes after 200 takes, refills over time; uncapped lanes never block. */
  async pacing() {
    const src = await readFile(ROUTER_SRC, "utf8");
    await writeFile(ROUTER_COPY, src);
    const mod = await import(pathToFileURL(ROUTER_COPY).href);
    const takes = [];
    for (let i = 0; i < 200; i++) takes.push(mod.paceTake("kilo"));
    const empty = mod.paceTake("kilo");
    const leftAfter = mod.paceLeft("kilo");
    mod.pace["kilo"].updated = Date.now() - 3600_000;
    mod.pace["kilo"].tokens = 0;
    const refilled = mod.paceTake("kilo");
    return {
      allFirst200: takes.every(Boolean),
      blocked201st: empty === false,
      leftAfterDepleted: leftAfter,
      refilledAfterHour: refilled === true,
      uncappedTake: mod.paceTake("pollinations"),
      uncappedLeft: mod.paceLeft("pollinations"),
      ceilKilo: mod.PACE_CEIL_PER_HR.kilo,
      ceilOvh: mod.PACE_CEIL_PER_HR.ovh,
    };
  },

  /** (26b) Efficiency ordering: best observed lane first; unexplored get mean; no data → priority. */
  async efficiency() {
    const src = await readFile(ROUTER_SRC, "utf8");
    await writeFile(ROUTER_COPY, src);
    const mod = await import(pathToFileURL(ROUTER_COPY).href);
    const lanes = [
      { name: "pollinations", tier: "keyless", priority: 8 },
      { name: "kilo", tier: "keyless", priority: 9 },
      { name: "ovh", tier: "keyless", priority: 10 },
      { name: "llm7", tier: "keyless", priority: 11 },
    ];
    const noObs = mod.orderLanes(lanes, "efficiency").map((l) => l.name);
    mod.recordSuccess("ovh", { tokens: 3000, ms: 1000 });
    mod.recordSuccess("kilo", { tokens: 100, ms: 5000 });
    mod.recordSuccess("kilo", { tokens: 100, ms: 5000 });
    const ranked = mod.orderLanes(lanes, "efficiency").map((l) => l.name);
    return {
      noObs,
      ranked,
      ovhScore: mod.effScore("ovh"),
      kiloScore: mod.effScore("kilo"),
      unexplored: mod.effScore("llm7"),
    };
  },

  /** (26c) Weekly accounting: requests + tokens land in /health weekly fields. */
  async weeklyAccounting() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [
        ["generativelanguage.googleapis.com", { status: 500, json: { error: { message: "down" } } }],
        ["api.groq.com", { status: 200, json: openaiOk("groq ok") }],
      ],
      calls
    );
    const worker = await loadWorker();
    const res = await postChat(worker, ENV_ALL);
    await res.json();
    const hres = await authedGet(worker, ENV_ALL, "/health");
    const h = await hres.json();
    const groq = h.lanes.groq || {};
    return {
      status: res.status,
      xLane: res.headers.get("x-lane"),
      wReq: groq.weekly && groq.weekly.req,
      wTokens: groq.weekly && groq.weekly.tokens,
      pacing: groq.pacing,
      eff: groq.effScore,
    };
  },
  async admission() {
    const calls = [];
    const geminiOk = {
      candidates: [
        { content: { parts: [{ text: "gemini ok" }] }, finishReason: "STOP" },
      ],
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2, totalTokenCount: 7 },
    };
    globalThis.fetch = mockFetchFactory(
      [["generativelanguage.googleapis.com", { status: 200, json: geminiOk }]],
      calls
    );
    const worker = await loadWorker();
    const env = { ...ENV_ALL, GLOBAL_RPM_LIMIT: "2" };
    const r1 = await postChat(worker, env);
    await r1.json();
    const r2 = await postChat(worker, env);
    await r2.json();
    const r3 = await postChat(worker, env);
    const b3 = await r3.json();
    return {
      s1: r1.status,
      s2: r2.status,
      s3: r3.status,
      retryAfter: r3.headers.get("retry-after"),
      message: b3?.error?.message ?? null,
      numCalls: calls.length,
    };
  },

  /** (20) x-cache-ttl: identical 2nd request served from cache; different prompt misses. */
  async cacheHit() {
    const calls = [];
    const geminiOk = (text) => ({
      candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2, totalTokenCount: 7 },
    });
    globalThis.fetch = mockFetchFactory(
      [["generativelanguage.googleapis.com", { status: 200, json: geminiOk("cached answer") }]],
      calls
    );
    const worker = await loadWorker();
    const H = { "x-cache-ttl": "60" };
    const r1 = await postChat(worker, ENV_ALL, CHAT_BODY, H);
    const b1 = await r1.json();
    const r2 = await postChat(worker, ENV_ALL, CHAT_BODY, H);
    const b2 = await r2.json();
    const r3 = await postChat(
      worker,
      ENV_ALL,
      { model: "x", messages: [{ role: "user", content: "a different prompt" }] },
      H
    );
    await r3.json();
    return {
      c1: r1.headers.get("x-cache"),
      c2: r2.headers.get("x-cache"),
      c3: r3.headers.get("x-cache"),
      content1: b1?.choices?.[0]?.message?.content ?? null,
      content2: b2?.choices?.[0]?.message?.content ?? null,
      numCalls: calls.length,
    };
  },

  /** (21) Hedging: gemini hangs → after 500ms groq fires in parallel and wins. */
  async hedgeWin() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [
        ["generativelanguage.googleapis.com", { hang: true }],
        ["api.groq.com", { status: 200, json: openaiOk("groq hedge wins") }],
      ],
      calls
    );
    const worker = await loadWorker();
    const t0 = Date.now();
    const res = await postChat(worker, ENV_ALL, CHAT_BODY, { "x-hedge-after-ms": "500" });
    const elapsedMs = Date.now() - t0;
    const body = await res.json();
    const hres = await authedGet(worker, ENV_ALL, "/health");
    const hbody = await hres.json();
    const g = hbody?.lanes?.gemini || {};
    return {
      status: res.status,
      xLane: res.headers.get("x-lane"),
      hedgeWinner: res.headers.get("x-hedge-winner"),
      content: body?.choices?.[0]?.message?.content ?? null,
      numCalls: calls.length,
      elapsedMs,
      geminiFail: g.fail,
      geminiHedged: g.hedged,
    };
  },

  /** (22) 2MB chunked body (no content-length) → 413, not a memory bomb. */
  async bodyCap() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [["api.groq.com", { status: 200, json: openaiOk("must never be reached") }]],
      calls
    );
    const worker = await loadWorker();
    const big = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode("x".repeat(2 * 1024 * 1024)));
        c.close();
      },
    });
    const req = new Request("http://localhost/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer k-router" },
      body: big,
      duplex: "half",
    });
    const res = await worker.fetch(req, ENV_ALL);
    const body = await res.json();
    return {
      status: res.status,
      message: body?.error?.message ?? null,
      numCalls: calls.length,
    };
  },

  /** (23) SSE stream dying mid-flight → client sees the abort sentinel, not silent truncation. */
  async sseSentinel() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [["api.groq.com", { sseThenAbort: true }]],
      calls
    );
    const worker = await loadWorker();
    const res = await postChat(worker, ENV_ALL, {
      model: "x",
      messages: [{ role: "user", content: "ping" }],
      stream: true,
    });
    const text = await res.text();
    return {
      status: res.status,
      contentType: res.headers.get("content-type"),
      text,
      numCalls: calls.length,
    };
  },

  /** (24) Cooldown jitter: retry-after 100 → health shows 75–125s, not exactly 100. */
  async jitterBounds() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [
        [
          "api.groq.com",
          { status: 429, headers: { "retry-after": "100" }, json: { error: { message: "slow down" } } },
        ],
        ["api.mistral.ai", { status: 200, json: openaiOk("mistral ok") }],
      ],
      calls
    );
    const worker = await loadWorker();
    await postChat(worker, ENV_ALL);
    const hres = await authedGet(worker, ENV_ALL, "/health");
    const hbody = await hres.json();
    return {
      cooldownS: hbody?.lanes?.groq?.cooldownSecsRemaining ?? null,
      groqInCooldown: hbody?.lanes?.groq?.inCooldown ?? null,
    };
  },

  /** (25) x-fallback-attempts header counts failed attempts before success. */
  async fallbackAttemptsHeader() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [
        [
          "generativelanguage.googleapis.com",
          { status: 429, headers: { "retry-after": "5" }, json: { error: { message: "quota" } } },
        ],
        ["api.groq.com", { status: 200, json: openaiOk("groq ok") }],
      ],
      calls
    );
    const worker = await loadWorker();
    const res = await postChat(worker, ENV_ALL);
    await res.json();
    return {
      status: res.status,
      xLane: res.headers.get("x-lane"),
      fallbackAttempts: res.headers.get("x-fallback-attempts"),
      numCalls: calls.length,
    };
  },

  /* Intra-lane model load balancing (openrouter pool). These mocks inspect
   * the request body's model field to simulate per-model behavior. */
  _orMock(tried, rules) {
    return async (url, init = {}) => {
      const u = String(url);
      if (u.includes("api.sambanova.ai")) {
        return new Response(JSON.stringify(openaiOk("sambanova serves")), { status: 200 });
      }
      if (!u.includes("openrouter.ai")) {
        return new Response(JSON.stringify({ error: { message: "t" } }),
          { status: 429, headers: { "retry-after": "5" } });
      }
      const m = JSON.parse(init.body).model;
      tried.push(m);
      const r = rules(m);
      if (r.delayMs) await new Promise((res) => setTimeout(res, r.delayMs));
      return new Response(JSON.stringify(r.json), { status: r.status, headers: r.headers || {} });
    };
  },

  /** (31) First pool model 429s → second serves; x-model names the winner. */
  async modelRotate429() {
    const tried = [];
    globalThis.fetch = scenarios._orMock(tried, (m) =>
      m === "nvidia/nemotron-3.5-lightning:free"
        ? { status: 429, headers: { "retry-after": "5" }, json: { error: { message: "throttled" } } }
        : { status: 200, json: openaiOk("gemma serves", m) }
    );
    const worker = await loadWorker();
    const res = await postChat(worker, ENV_ALL);
    const body = await res.json();
    return {
      status: res.status,
      xLane: res.headers.get("x-lane"),
      xModel: res.headers.get("x-model"),
      content: body?.choices?.[0]?.message?.content ?? null,
      tried,
    };
  },

  /** (32) 401 on first model → key is dead: lane aborts WITHOUT trying other models. */
  async modelKeyDead() {
    const tried = [];
    globalThis.fetch = scenarios._orMock(tried, () => ({
      status: 401, json: { error: { message: "bad key" } },
    }));
    const worker = await loadWorker();
    const res = await postChat(worker, ENV_ALL);
    await res.json();
    return { status: res.status, xLane: res.headers.get("x-lane"), tried };
  },

  /** (33) A 429-cooled model is skipped on the next request; the pool keeps serving. */
  async modelCooldownSkip() {
    const perReq = [];
    let tried = [];
    globalThis.fetch = scenarios._orMock(tried, (m) =>
      m === "nvidia/nemotron-3.5-lightning:free"
        ? { status: 429, headers: { "retry-after": "5" }, json: { error: { message: "throttled" } } }
        : { status: 200, json: openaiOk("ok", m) }
    );
    const worker = await loadWorker();
    await (await postChat(worker, ENV_ALL)).json();
    perReq.push([...tried]); tried.length = 0;
    const res2 = await postChat(worker, ENV_ALL);
    await res2.json();
    perReq.push([...tried]);
    return { perReq, xModel2: res2.headers.get("x-model") };
  },

  /** (34) Efficiency ordering: after observations, the faster model is tried first. */
  async modelEfficiencyOrder() {
    const perReq = [];
    let tried = [];
    let req = 0;
    const env = { ...ENV_ALL, OPENROUTER_MODELS: "aaa-slow:free,bbb-fast:free" };
    globalThis.fetch = async (url, init = {}) => {
      const u = String(url);
      if (!u.includes("openrouter.ai")) {
        return new Response(JSON.stringify({ error: { message: "t" } }),
          { status: 429, headers: { "retry-after": "5" } });
      }
      const m = JSON.parse(init.body).model;
      tried.push(m);
      if (m === "aaa-slow:free" && req === 1) {
        return new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500 });
      }
      if (m === "aaa-slow:free") {
        await new Promise((r) => setTimeout(r, 150));
        return new Response(JSON.stringify(openaiOk("slow ok", m)), { status: 200 });
      }
      return new Response(JSON.stringify(openaiOk("fast ok", m)), { status: 200 });
    };
    const worker = await loadWorker();
    for (let i = 1; i <= 3; i++) {
      req = i;
      tried = [];
      await (await postChat(worker, env)).json();
      perReq.push([...tried]);
    }
    return { perReq };
  },

  /** (35) DeepSeek paid lane serves when lanes 1–7 throttle and DEEPSEEK_KEY is set. */
  async deepseekServes() {
    const calls = [];
    const bodies = [];
    const r429 = (msg) => ({ status: 429, headers: { "retry-after": "5" }, json: { error: { message: msg } } });
    globalThis.fetch = mockFetchFactory(
      [
        ["generativelanguage.googleapis.com", r429("gemini quota")],
        ["api.groq.com", r429("groq quota")],
        ["api.mistral.ai", r429("mistral quota")],
        ["api.z.ai", r429("zai quota")],
        ["integrate.api.nvidia.com", r429("nvidia quota")],
        ["openrouter.ai", r429("openrouter quota")],
        ["api.sambanova.ai", r429("sambanova quota")],
        ["api.deepseek.com", { status: 200, json: openaiOk("deepseek says hi", "deepseek-flash") }],
      ],
      calls, bodies
    );
    const worker = await loadWorker();
    const env = { ...ENV_ALL, DEEPSEEK_KEY: "k-deepseek" };
    const res = await postChat(worker, env);
    const body = await res.json();
    const dsModels = bodies
      .map((b) => { try { return JSON.parse(b.body).model; } catch { return null; } })
      .filter((m) => m && m.includes("deepseek"));
    return {
      status: res.status,
      xLane: res.headers.get("x-lane"),
      xModel: res.headers.get("x-model"),
      content: body?.choices?.[0]?.message?.content ?? null,
      numCalls: calls.length,
      dsModels,
    };
  },

  /** (37) G2 audit finding: 200 with EMPTY completion is degraded output, not
   *  success. gemini 429s (skipped), groq 200s with empty content (must be
   *  treated as failure -> fail over), zai 200s with a real answer. */
  async emptyCompletion() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [
        [
          "generativelanguage.googleapis.com",
          { status: 429, headers: { "retry-after": "5" }, json: { error: { message: "quota" } } },
        ],
        ["api.groq.com", { status: 200, json: openaiOk("") }],
        [
          "api.mistral.ai",
          { status: 429, headers: { "retry-after": "5" }, json: { error: { message: "mistral quota" } } },
        ],
        ["api.z.ai", { status: 200, json: openaiOk("zai real answer") }],
      ],
      calls
    );
    const worker = await loadWorker();
    const res = await postChat(worker, ENV_ALL);
    const body = await res.json();
    return {
      status: res.status,
      xLane: res.headers.get("x-lane"),
      content: body?.choices?.[0]?.message?.content ?? null,
      numCalls: calls.length,
      hosts: calls.map(hostOf),
    };
  },

  /** (38) Unit: the degraded-output guard itself. Empty is degraded; a normal
   *  answer, reasoning_content (deepseek reasoners), or tool_calls are usable. */
  async degradedGuard() {
    const src = await readFile(ROUTER_SRC, "utf8");
    await writeFile(ROUTER_COPY, src);
    const mod = await import(pathToFileURL(ROUTER_COPY).href);
    const g = mod.isDegradedCompletion;
    const reasoning = openaiOk("");
    reasoning.choices[0].message.reasoning_content = "thinking hard";
    const tools = openaiOk("");
    tools.choices[0].message.tool_calls = [{ id: "c1", type: "function", function: { name: "f", arguments: "{}" } }];
    return {
      emptyIsDegraded: g(openaiOk("")),
      whitespaceIsDegraded: g(openaiOk("   ")),
      normalIsUsable: !g(openaiOk("hello")),
      reasoningIsUsable: !g(reasoning),
      toolCallsIsUsable: !g(tools),
      emptyChoicesIsDegraded: g({ choices: [] }),
      noChoicesIsDegraded: g({}),
    };
  },

  /** (39) Durable state: shared KV doc hydrates /health across "isolates". */
  async durableMergeBaseline() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [
        ["text.pollinations.ai", { status: 500, json: { error: { message: "boom 500" } } }],
        ["api.kilo.ai", { status: 200, json: openaiOk("hi") }],
      ],
      calls
    );
    const full = await loadWorkerFull();
    const worker = full.default;
    const ws = full.weekStartOf(Date.now());
    const kv = mockKV();
    // Pre-seed the shared doc (simulates history written by prior isolates).
    kv.store.set(
      "shared:v1",
      JSON.stringify({
        v: 3,
        weekStart: ws,
        updated: new Date().toISOString(),
        pace: { kilo: { tokens: 150, updated: new Date().toISOString() } },
        lanes: {
          kilo: { wReq: 7, wTokens: 7000, ok: 7, fail: 1, tokTotal: 7000, latTotalMs: 7000, latN: 7, hedged: 0 },
        },
        breakers: {},
        incidents: [],
      })
    );
    const env = { ROUTER_KEY: "k-router", LB_MODE: "priority", LANES_KV: kv };
    const res = await postChat(worker, env); // pollinations 500 → kilo ok
    const body = await res.json();
    const h = await authedGet(worker, env, "/health");
    const hb = await h.json();
    const kilo = hb.lanes.kilo;
    const doc = JSON.parse(kv.store.get("shared:v1"));
    return {
      chatStatus: res.status,
      chatOk: !!body?.choices?.[0]?.message?.content,
      durable: hb.durable,
      kiloWeeklyReq: kilo.weekly.req, // 7 seeded + 1 live
      kiloWeeklyTokens: kilo.weekly.tokens, // 7000 + 15 (mock usage)
      kiloSuccess: kilo.success, // 7 + 1
      kiloFail: kilo.fail, // 1 seeded + 0 live
      pollinationsFail: hb.lanes.pollinations.fail, // live only
      bucketNotFull: kilo.pacing.bucketLeft < 200, // seeded 150, not reset to 200
      effScoreType: typeof kilo.effScore,
      docKiloWReq: doc.lanes.kilo.wReq, // writeback landed: 7 + 1
      docPaceKilo: doc.pace.kilo.tokens, // 150 - 1 take
    };
  },

  /** (40) Durable state: deltas + breaker-trip incidents persist to the shared doc. */
  async durableFlushWrites() {
    const calls = [];
    globalThis.fetch = mockFetchFactory(
      [
        // pollinations fails 3x → breaker opens → incident recorded (http-500)
        ["text.pollinations.ai", { status: 500, json: { error: { message: "boom 500" } } }],
        ["api.kilo.ai", { status: 200, json: openaiOk("hi") }],
      ],
      calls
    );
    const full = await loadWorkerFull();
    const worker = full.default;
    const kv = mockKV();
    const env = { ROUTER_KEY: "k-router", LB_MODE: "priority", LANES_KV: kv };
    await postChat(worker, env);
    await postChat(worker, env);
    await postChat(worker, env);
    const doc = JSON.parse(kv.store.get("shared:v1"));
    const inc = doc.incidents || [];
    return {
      docExists: !!doc,
      docVersion: doc.v,
      kiloWReq: doc.lanes.kilo.wReq,
      kiloWTokens: doc.lanes.kilo.wTokens,
      paceKilo: doc.pace.kilo.tokens, // 200 - 3 takes
      incidentSig: inc.length ? inc[inc.length - 1].sig : null,
      incidentLane: inc.length ? inc[inc.length - 1].lane : null,
      breakerKilo: !!doc.breakers.kilo,
      breakerPollinations: !!doc.breakers.pollinations,
    };
  },

  /** (41) Durable state: no KV binding → fully degraded, requests still work. */
  async durableNoKV() {
    const calls = [];
    globalThis.fetch = mockFetchFactory([["api.kilo.ai", { status: 200, json: openaiOk("hi") }]], calls);
    const worker = await loadWorker();
    const env = { ROUTER_KEY: "k-router", LB_MODE: "priority" }; // no LANES_KV
    const res = await postChat(worker, env);
    const body = await res.json();
    const h = await authedGet(worker, env, "/health");
    const hb = await h.json();
    return {
      chatStatus: res.status,
      chatOk: !!body?.choices?.[0]?.message?.content,
      durable: hb.durable,
      kiloWeeklyReq: hb.lanes.kilo.weekly.req,
    };
  },
};

/* ------------------------------------------------------------------ */
/* Scenario mode                                                       */
/* ------------------------------------------------------------------ */

if (SCENARIO) {
  const fn = scenarios[SCENARIO];
  if (!fn) {
    console.error(`unknown scenario: ${SCENARIO}`);
    process.exit(2);
  }
  try {
    const result = await fn();
    console.log("RESULT_BEGIN");
    console.log(JSON.stringify(result));
    console.log("RESULT_END");
    process.exit(0);
  } catch (e) {
    console.error(`scenario ${SCENARIO} threw:`, e);
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ */
/* Runner mode                                                         */
/* ------------------------------------------------------------------ */

const tests = [
  {
    name: "all429",
    note: "all 12 attempted lanes 429 → 429 (honest back-off signal, not 502); openrouter rotates its 5-model pool so 16 upstream attempts",
    check(r) {
      assert.equal(r.status, 429, `expected 429, got ${r.status}`);
      assert.ok(r.retryAfter, "expected a retry-after header on all-429");
      assert.equal(r.numCalls, 16, `expected 16 upstream attempts (12 lanes, openrouter x5), got ${r.numCalls}`);
      for (const h of [
        "generativelanguage.googleapis.com",
        "api.groq.com",
        "api.mistral.ai",
        "api.z.ai",
        "integrate.api.nvidia.com",
        "openrouter.ai",
        "api.sambanova.ai",
        "models.github.ai",
        "text.pollinations.ai",
        "api.kilo.ai",
        "oai.endpoints.kepler.ai.cloud.ovh.net",
        "api.llm7.io",
      ])
        assert.ok(r.hosts.includes(h), `lane never attempted: ${h}`);
      assert.ok(Array.isArray(r.failures) && r.failures.length === 12, "expected 12 recorded failures");
      assert.ok(
        (r.message || "").includes("rate-limited"),
        `expected rate-limited message, got: ${r.message}`
      );
    },
  },
  {
    name: "failover429",
    note: "gemini 429 → groq serves, x-lane=groq, body passes through",
    check(r) {
      assert.equal(r.status, 200, `expected 200, got ${r.status}`);
      assert.equal(r.xLane, "groq", `expected x-lane=groq, got ${r.xLane}`);
      assert.equal(r.content, "groq says hi", "response body did not pass through");
      assert.equal(r.numCalls, 2, `expected 2 attempts, got ${r.numCalls}`);
      assert.ok(r.hosts[0].includes("generativelanguage"), "first attempt should be gemini");
    },
  },
  {
    name: "timeout",
    note: "gemini hangs → 20s timeout → groq serves",
    check(r) {
      assert.equal(r.status, 200, `expected 200, got ${r.status}`);
      assert.equal(r.xLane, "groq", `expected x-lane=groq, got ${r.xLane}`);
      assert.equal(r.content, "groq after timeout");
      assert.equal(r.numCalls, 2, `expected 2 attempts, got ${r.numCalls}`);
      assert.ok(
        r.elapsedMs >= 19000,
        `expected ~20s timeout wait before failover, got ${r.elapsedMs}ms`
      );
    },
  },
  {
    name: "badrequest",
    note: "gemini 400 → returned immediately, no failover",
    check(r) {
      assert.equal(r.status, 400, `expected 400, got ${r.status}`);
      assert.equal(r.xLane, "gemini", `expected x-lane=gemini, got ${r.xLane}`);
      assert.equal(r.numCalls, 1, `must NOT fail over on 400 (got ${r.numCalls} calls)`);
      assert.equal(r.errMessage, "API key not valid", "lane error payload not passed through");
    },
  },
  {
    name: "health",
    note: "/health lists all 13 lanes, tiers + fragmentsOnly flagged",
    check(r) {
      assert.equal(r.status, 200, `expected 200, got ${r.status}`);
      assert.deepEqual(r.laneNames, ["deepseek", "gemini", "github-models", "groq", "kilo", "llm7", "mistral", "nvidia", "openrouter", "ovh", "pollinations", "sambanova", "zai"]);
      assert.ok(
        Object.entries(r.configured).every(([k, v]) => v === true || k === "deepseek"),
        "all lanes except deepseek (no key in test env) should report configured=true"
      );
      assert.equal(r.configured.deepseek, false, "deepseek without DEEPSEEK_KEY must report configured=false");
      assert.deepEqual(
        Object.values(r.priorities).sort((a, b) => a - b),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
        "lane priorities should be 1..13"
      );
      for (const k of ["gemini", "groq", "mistral", "zai", "nvidia", "openrouter", "sambanova", "deepseek"])
        assert.equal(r.tiers[k], "keyed", `${k} should be tier=keyed`);
      for (const k of ["pollinations", "kilo", "ovh", "llm7"]) {
        assert.equal(r.tiers[k], "keyless", `${k} should be tier=keyless`);
        assert.equal(r.fragmentsOnly[k], true, `${k} should be fragmentsOnly`);
      }
      assert.equal(r.fragmentsOnly.gemini, false, "keyed lanes must not be fragmentsOnly");
      assert.equal(r.numCalls, 0, "health check must not call any lane");
    },
  },
  {
    name: "nokeys",
    note: "no keys → keyed lanes skipped, keyless tier serves",
    check(r) {
      assert.equal(r.status, 200, `expected 200, got ${r.status}`);
      assert.equal(r.xLane, "pollinations", `expected x-lane=pollinations, got ${r.xLane}`);
      assert.equal(r.content, "pollinations keyless hi");
      assert.equal(r.numCalls, 1, `only the keyless lane should be attempted (got ${r.numCalls})`);
      assert.ok(r.hosts[0].includes("text.pollinations.ai"), "first attempt should be pollinations");
      assert.equal(r.healthStatus, 200, "health must still work with no keys");
      assert.deepEqual(r.healthLaneNames, ["deepseek", "gemini", "github-models", "groq", "kilo", "llm7", "mistral", "nvidia", "openrouter", "ovh", "pollinations", "sambanova", "zai"]);
      for (const k of ["gemini", "groq", "mistral", "zai", "nvidia", "openrouter", "sambanova", "deepseek", "github-models"])
        assert.equal(r.healthConfigured[k], false, `${k} should report configured=false without key`);
      for (const k of ["pollinations", "kilo", "ovh", "llm7"])
        assert.equal(r.healthConfigured[k], true, `${k} is keyless: always configured`);
    },
  },
  {
    name: "gemini200",
    note: "gemini 200 → OpenAI↔Gemini translation both directions",
    check(r) {
      assert.equal(r.status, 200, `expected 200, got ${r.status}`);
      assert.equal(r.xLane, "gemini", `expected x-lane=gemini, got ${r.xLane}`);
      assert.equal(r.numCalls, 1);
      assert.ok(
        (r.geminiUrl || "").includes(":generateContent"),
        "should hit Gemini generateContent endpoint"
      );
      assert.ok(
        !(r.geminiUrl || "").includes("k-gemini"),
        "API key must NOT be in the URL (header auth — URLs land in logs)"
      );
      assert.equal(
        r.sentHeaders?.["x-goog-api-key"],
        "k-gemini",
        "API key should ride the x-goog-api-key header"
      );
      // request translation: OpenAI messages → Gemini format
      assert.ok(r.sentBody, "expected a translated request body");
      assert.equal(r.sentBody.systemInstruction?.parts?.[0]?.text, "be nice");
      assert.equal(r.sentBody.contents?.[0]?.parts?.[0]?.text, "ping");
      assert.equal(r.sentBody.generationConfig?.temperature, 0.5);
      assert.equal(r.sentBody.generationConfig?.maxOutputTokens, 50);
      // response translation: Gemini → OpenAI format
      assert.equal(r.object, "chat.completion");
      assert.equal(r.content, "gemini translated hi");
      assert.equal(r.finish, "stop");
      assert.equal(r.usage?.total_tokens, 18);
    },
  },
  {
    name: "streamSkip",
    note: "stream:true → gemini skipped, groq SSE proxied",
    check(r) {
      assert.equal(r.status, 200, `expected 200, got ${r.status}`);
      assert.equal(r.xLane, "groq", `expected x-lane=groq, got ${r.xLane}`);
      assert.equal(r.numCalls, 1, `gemini must be skipped for streams (got ${r.numCalls} calls)`);
      assert.ok(r.hosts[0].includes("api.groq.com"), "only groq should be attempted");
      assert.ok(
        (r.contentType || "").includes("text/event-stream"),
        `expected SSE content-type, got ${r.contentType}`
      );
      assert.ok(r.text.includes("hi"), "SSE body should pass through");
    },
  },

  {
    name: "keylessFallback",
    note: "all 8 keyed 429 → keyless tier (pollinations) serves; openrouter rotates 5 models first",
    check(r) {
      assert.equal(r.status, 200, `expected 200, got ${r.status}`);
      assert.equal(r.xLane, "pollinations", `expected x-lane=pollinations, got ${r.xLane}`);
      assert.equal(r.content, "pollinations to the rescue");
      assert.equal(r.numCalls, 13, `expected 12 keyed attempts (openrouter x5) + 1 keyless, got ${r.numCalls}`);
      assert.ok(r.hosts[12].includes("text.pollinations.ai"), "13th attempt should be pollinations");
    },
  },
  {
    name: "keyless429",
    note: "keyless 429 (pollinations) → next keyless lane (kilo) serves",
    check(r) {
      assert.equal(r.status, 200, `expected 200, got ${r.status}`);
      assert.equal(r.xLane, "kilo", `expected x-lane=kilo, got ${r.xLane}`);
      assert.equal(r.content, "kilo auto-router hi");
      assert.equal(r.numCalls, 2, `expected 2 keyless attempts, got ${r.numCalls}`);
      assert.ok(r.hosts[0].includes("text.pollinations.ai"), "first attempt should be pollinations");
      assert.ok(r.hosts[1].includes("api.kilo.ai"), "second attempt should be kilo");
    },
  },
  {
    name: "zaiOptional",
    note: "zai (priority 4) serves when ZAI_KEY present; skipped cleanly when absent",
    check(r) {
      assert.equal(r.aStatus, 200, `phase A: expected 200, got ${r.aStatus}`);
      assert.equal(r.aLane, "zai", `phase A: expected x-lane=zai, got ${r.aLane}`);
      assert.equal(r.aContent, "zai says ni hao");
      assert.equal(r.aCalls, 4, `phase A: expected 4 attempts (gemini,groq,mistral,zai), got ${r.aCalls}`);
      assert.ok(r.aHosts[3].includes("api.z.ai"), "phase A 4th attempt should be z.ai");
      assert.equal(r.bStatus, 200, `phase B: expected 200, got ${r.bStatus}`);
      assert.equal(r.bLane, "nvidia", `phase B: expected x-lane=nvidia, got ${r.bLane}`);
      assert.equal(r.bContent, "nvidia fallback hi");
      assert.equal(r.totalCalls, 5, `phase B: expected exactly 1 more attempt (nvidia), got ${r.totalCalls} total`);
      assert.ok(
        (r.zaiSkips || {})["no-key"] >= 1,
        "zai should record a no-key skip when ZAI_KEY is absent"
      );
    },
  },
  {
    name: "githubModels",
    note: "github-models (priority 9) serves when GITHUB_MODELS_KEY present; skipped cleanly when absent",
    check(r) {
      assert.equal(r.aStatus, 200, `phase A: expected 200, got ${r.aStatus}`);
      assert.equal(r.aLane, "github-models", `phase A: expected x-lane=github-models, got ${r.aLane}`);
      assert.equal(r.aContent, "github models hi");
      assert.equal(r.aCalls, 1, `phase A: expected exactly 1 attempt (github-models), got ${r.aCalls}`);
      assert.ok(r.aHosts[0].includes("models.github.ai"), "phase A attempt should hit models.github.ai");
      assert.equal(r.bStatus, 200, `phase B: expected 200, got ${r.bStatus}`);
      assert.equal(r.bLane, "pollinations", `phase B: expected x-lane=pollinations, got ${r.bLane}`);
      assert.equal(r.bContent, "pollinations keyless hi");
    },
  },
  {
    name: "noauthkey",
    note: "no ROUTER_KEY → 503 fail-closed on chat AND health, zero lane attempts",
    check(r) {
      assert.equal(r.chatStatus, 503, `expected 503, got ${r.chatStatus}`);
      assert.ok((r.chatMessage || "").includes("ROUTER_KEY"), "should name the missing secret");
      assert.equal(r.healthStatus, 503, `health must also fail closed, got ${r.healthStatus}`);
      assert.equal(r.numCalls, 0, `no lane may be attempted without router key (got ${r.numCalls})`);
    },
  },
  {
    name: "wrongkey",
    note: "wrong bearer token → 401, zero lane attempts",
    check(r) {
      assert.equal(r.status, 401, `expected 401, got ${r.status}`);
      assert.equal(r.numCalls, 0, `no lane may be attempted with bad token (got ${r.numCalls})`);
    },
  },
  {
    name: "failclosed",
    note: "x-fail-closed → keyless lanes skipped, 429 (all keyed throttled), no leak to anonymous pools",
    check(r) {
      assert.equal(r.status, 429, `expected 429, got ${r.status}`);
      assert.equal(r.numCalls, 12, `expected 12 keyed attempts (openrouter x5), got ${r.numCalls}`);
      assert.equal(r.keylessAttempted, false, "keyless lanes must NOT be attempted when fail-closed");
      assert.ok(Array.isArray(r.failures) && r.failures.length === 8, "expected 8 recorded failures");
    },
  },
  {
    name: "modelRotate429",
    note: "openrouter pool: first model 429 → second serves; x-model names the winner",
    check(r) {
      assert.equal(r.status, 200, `expected 200, got ${r.status}`);
      assert.equal(r.xLane, "openrouter", `expected x-lane=openrouter, got ${r.xLane}`);
      assert.equal(r.xModel, "google/gemma-4-31b-it:free", `x-model should name winner, got ${r.xModel}`);
      assert.deepEqual(r.tried, ["nvidia/nemotron-3.5-lightning:free", "google/gemma-4-31b-it:free"]);
      assert.equal(r.content, "gemma serves");
    },
  },
  {
    name: "modelKeyDead",
    note: "openrouter 401 → key dead: lane aborts WITHOUT burning other models; sambanova serves",
    check(r) {
      assert.equal(r.status, 200, `expected 200, got ${r.status}`);
      assert.equal(r.xLane, "sambanova", `expected failover to sambanova, got ${r.xLane}`);
      assert.equal(r.tried.length, 1, `dead key must abort the pool after 1 try, got ${r.tried.length}`);
    },
  },
  {
    name: "modelCooldownSkip",
    note: "429-cooled model is skipped on the next request; pool keeps serving",
    check(r) {
      assert.deepEqual(r.perReq[0], ["nvidia/nemotron-3.5-lightning:free", "google/gemma-4-31b-it:free"]);
      assert.equal(r.perReq[1][0], "google/gemma-4-31b-it:free",
        `2nd request must skip the cooling model, tried: ${r.perReq[1]}`);
      assert.equal(r.xModel2, "google/gemma-4-31b-it:free");
    },
  },
  {
    name: "modelEfficiencyOrder",
    note: "after observations, the faster model is tried first (efficiency ordering)",
    check(r) {
      assert.equal(r.perReq[0][0], "aaa-slow:free", "req1: list order (no observations)");
      assert.equal(r.perReq[2][0], "bbb-fast:free",
        `req3: faster model must go first, tried: ${r.perReq[2]}`);
    },
  },
  {
    name: "deepseekServes",
    note: "lanes 1–7 throttled → deepseek (paid lane 8) serves with DEEPSEEK_KEY",
    check(r) {
      assert.equal(r.status, 200, `expected 200, got ${r.status}`);
      assert.equal(r.xLane, "deepseek", `expected x-lane=deepseek, got ${r.xLane}`);
      assert.equal(r.xModel, "deepseek-flash", `expected x-model=deepseek-flash, got ${r.xModel}`);
      assert.equal(r.content, "deepseek says hi");
      assert.deepEqual(r.dsModels, ["deepseek-flash"]);
      // 5 (lanes 1–5) + 5 (openrouter pool) + 1 (sambanova) + 1 (deepseek)
      assert.equal(r.numCalls, 12, `expected 12 attempts, got ${r.numCalls}`);
    },
  },
  {
    name: "sambanovaOptional",
    note: "sambanova (priority 7) serves when keyed 1–6 fail; skipped cleanly without key",
    check(r) {
      assert.equal(r.aStatus, 200, `phase A: expected 200, got ${r.aStatus}`);
      assert.equal(r.aLane, "sambanova", `phase A: expected x-lane=sambanova, got ${r.aLane}`);
      assert.equal(r.aContent, "sambanova says hi");
      assert.equal(r.aCalls, 11, `phase A: expected 11 attempts (lanes 1–7, openrouter x5), got ${r.aCalls}`);
      assert.ok(r.aHosts[10].includes("api.sambanova.ai"), "phase A 11th attempt should be sambanova");
      assert.equal(r.bStatus, 200, `phase B: expected 200, got ${r.bStatus}`);
      assert.equal(r.bLane, "pollinations", `phase B: expected x-lane=pollinations, got ${r.bLane}`);
      assert.equal(r.bContent, "pollinations fallback hi");
      assert.equal(r.totalCalls, 13, `phase B: expected 2 more attempts (github-models 429, then pollinations; lanes 1–6 + openrouter models in 5s 429-cooldown from phase A), got ${r.totalCalls} total`);
      assert.ok(
        (r.sambanovaSkips || {})["no-key"] >= 1,
        "sambanova should record a no-key skip when SAMBANOVA_KEY is absent"
      );
    },
  },
  {
    name: "deadline",
    note: "x-deadline-ms: hanging lanes → 504 inside the deadline, never a 220s hang",
    check(r) {
      assert.equal(r.status, 504, `expected 504, got ${r.status}`);
      assert.equal(r.numCalls, 1, `deadline should cut the walk short (got ${r.numCalls} calls)`);
      assert.equal(r.attempts, 1, `expected 1 recorded attempt, got ${r.attempts}`);
      assert.ok(
        r.elapsedMs >= 2400 && r.elapsedMs < 8000,
        `expected ~2.5s (the deadline), got ${r.elapsedMs}ms`
      );
      assert.ok((r.message || "").includes("deadline"), `expected deadline message, got: ${r.message}`);
    },
  },
  {
    name: "authFailover",
    note: "gemini throttled + groq 401 (revoked key) → mistral serves; dead keys fail over",
    check(r) {
      assert.equal(r.status, 200, `expected 200, got ${r.status}`);
      assert.equal(r.xLane, "mistral", `expected x-lane=mistral, got ${r.xLane}`);
      assert.equal(r.fallbackAttempts, "2", `expected x-fallback-attempts=2, got ${r.fallbackAttempts}`);
      assert.equal(r.content, "mistral after groq 401");
      assert.equal(r.numCalls, 3, `expected 3 attempts, got ${r.numCalls}`);
    },
  },
  {
    name: "breaker",
    note: "3 consecutive groq 500s → breaker opens (escalating backoff); 4th request skips groq",
    check(r) {
      assert.deepEqual(r.statuses, [200, 200, 200, 200], "all requests should succeed via mistral");
      assert.deepEqual(r.callsPer, [3, 3, 3, 1], `expected [3,3,3,1] calls/request, got ${r.callsPer}`);
      assert.equal(r.totalCalls, 10, `expected 10 total lane calls, got ${r.totalCalls}`);
      assert.equal(r.groqConsecFail, 3, `expected consecFail=3, got ${r.groqConsecFail}`);
      assert.equal(r.groqBreakerOpen, true, "breaker should be open after 3 consecutive failures");
      assert.ok(
        r.groqCooldownS >= 20 && r.groqCooldownS <= 40,
        `expected ~30s escalating backoff (±jitter), got ${r.groqCooldownS}s`
      );
      assert.ok((r.groqSkips || {}).cooldown >= 1, "4th request should record a groq cooldown skip");
    },
  },
  {
    name: "admission",
    note: "GLOBAL_RPM_LIMIT=2 → 3rd rapid request gets 429 with retry-after, zero lane calls",
    check(r) {
      assert.equal(r.s1, 200, `req1 expected 200, got ${r.s1}`);
      assert.equal(r.s2, 200, `req2 expected 200, got ${r.s2}`);
      assert.equal(r.s3, 429, `req3 expected 429, got ${r.s3}`);
      assert.ok(r.retryAfter, "expected retry-after on admission 429");
      assert.equal(r.numCalls, 2, `admitted requests only (got ${r.numCalls} lane calls)`);
    },
  },
  {
    name: "cacheHit",
    note: "x-cache-ttl: identical 2nd request HITs cache; different prompt MISSes",
    check(r) {
      assert.equal(r.c1, "MISS", `req1 should MISS, got ${r.c1}`);
      assert.equal(r.c2, "HIT", `req2 should HIT, got ${r.c2}`);
      assert.equal(r.c3, "MISS", `req3 (different prompt) should MISS, got ${r.c3}`);
      assert.equal(r.content1, r.content2, "cached content must match the original");
      assert.equal(r.numCalls, 2, `expected 2 lane calls (req2 served from cache), got ${r.numCalls}`);
    },
  },
  {
    name: "hedgeWin",
    note: "x-hedge-after-ms: hanging gemini → groq hedge wins in ~0.5s, gemini not marked failed",
    check(r) {
      assert.equal(r.status, 200, `expected 200, got ${r.status}`);
      assert.equal(r.xLane, "groq", `expected x-lane=groq, got ${r.xLane}`);
      assert.equal(r.hedgeWinner, "groq", `expected x-hedge-winner=groq, got ${r.hedgeWinner}`);
      assert.equal(r.content, "groq hedge wins");
      assert.equal(r.numCalls, 2, `expected 2 attempts (primary + hedge), got ${r.numCalls}`);
      assert.ok(
        r.elapsedMs < 8000,
        `hedge should beat the 20s lane timeout (got ${r.elapsedMs}ms)`
      );
      assert.equal(r.geminiFail, 0, "hedge loser must NOT count as a lane failure");
      assert.ok((r.geminiHedged || 0) >= 1, "hedge loss should be recorded as hedged telemetry");
    },
  },
  {
    name: "bodyCap",
    note: "2MB chunked body → 413 before buffering, zero lane calls",
    check(r) {
      assert.equal(r.status, 413, `expected 413, got ${r.status}`);
      assert.equal(r.numCalls, 0, `no lane may be attempted (got ${r.numCalls})`);
    },
  },
  {
    name: "sseSentinel",
    note: "mid-stream upstream death → client gets the ': router upstream aborted' sentinel",
    check(r) {
      assert.equal(r.status, 200, `expected 200, got ${r.status}`);
      assert.ok(
        (r.contentType || "").includes("text/event-stream"),
        `expected SSE content-type, got ${r.contentType}`
      );
      assert.ok(r.text.includes('data: {"choices"'), "client should get the chunk that arrived");
      assert.ok(
        r.text.includes(": router upstream aborted"),
        "client must see the abort sentinel, not silent truncation"
      );
      assert.equal(r.numCalls, 1);
    },
  },
  {
    name: "jitterBounds",
    note: "retry-after 100 → cooldown lands in 75–125s (±25% jitter), never exactly 100",
    check(r) {
      assert.equal(r.groqInCooldown, true, "groq should be cooling down");
      assert.ok(
        r.cooldownS >= 70 && r.cooldownS <= 130,
        `expected jittered 75–125s (slop to 70–130), got ${r.cooldownS}s`
      );
    },
  },
  {
    name: "fallbackAttemptsHeader",
    note: "x-fallback-attempts=1 after one failover before success",
    check(r) {
      assert.equal(r.status, 200, `expected 200, got ${r.status}`);
      assert.equal(r.xLane, "groq", `expected x-lane=groq, got ${r.xLane}`);
      assert.equal(r.fallbackAttempts, "1", `expected x-fallback-attempts=1, got ${r.fallbackAttempts}`);
      assert.equal(r.numCalls, 2);
    },
  },
  {
    name: "incidentForensics",
    note: "breaker trips logged with sig http-500 on GET /admin/incidents (authed); unauth → 401",
    check(r) {
      assert.equal(r.incidentStatus, 200, `expected 200, got ${r.incidentStatus}`);
      assert.equal(r.unauthStatus, 401, `expected unauth 401, got ${r.unauthStatus}`);
      assert.ok(Array.isArray(r.incidents), "incidents should be an array");
      assert.equal(r.incidents.length, 2, `expected 2 incidents (gemini+groq), got ${r.incidents.length}`);
      const [first, second] = r.incidents;
      assert.equal(first.lane, "groq", `newest incident should be groq, got ${first.lane}`);
      assert.equal(first.sig, "http-500", `expected sig http-500, got ${first.sig}`);
      assert.equal(first.backoffSec, 30, `expected base backoff 30s, got ${first.backoffSec}`);
      assert.equal(first.consecFail, 3, `expected consecFail=3, got ${first.consecFail}`);
      assert.equal(second.lane, "gemini", `older incident should be gemini, got ${second.lane}`);
      assert.equal(second.sig, "http-500");
    },
  },
  {
    name: "repeatOffender",
    note: "classifySig cases + flapping lane escalates 30→60s on 4th same-sig trip; ring caps at 100",
    check(r) {
      for (const [msg, want] of Object.entries(r.wantSigs)) {
        assert.equal(r.sigResults[msg], want, `classifySig(${JSON.stringify(msg)}) → ${r.sigResults[msg]}, want ${want}`);
      }
      assert.deepEqual(r.backs, [30, 30, 30, 60], `expected backoff ladder [30,30,30,60], got ${JSON.stringify(r.backs)}`);
      assert.equal(r.repeatNow, true, "flap/http-503 should be a repeat offender after 3 trips");
      assert.equal(r.wrongSig, false, "different signature must not match");
      assert.equal(r.wrongLane, false, "different lane must not match");
      assert.equal(r.ringLen, 100, `ring buffer should cap at 100, got ${r.ringLen}`);
      assert.equal(r.lastLane, "spam", "newest incident should survive the cap trim");
    },
  },
  {
    name: "pacing",
    note: "kilo bucket: 200 takes OK, 201st blocked, 0 left, refills after 1h; pollinations uncapped; ceilings 200/120",
    check(r) {
      assert.equal(r.allFirst200, true, "first 200 kilo takes must succeed");
      assert.equal(r.blocked201st, true, "201st kilo take must be blocked");
      assert.equal(r.leftAfterDepleted, 0, `bucket should be 0 after depletion, got ${r.leftAfterDepleted}`);
      assert.equal(r.refilledAfterHour, true, "bucket must refill after 1h");
      assert.equal(r.uncappedTake, true, "pollinations must never block");
      assert.equal(r.uncappedLeft, null, "uncapped lane bucketLeft must be null");
      assert.equal(r.ceilKilo, 200, "kilo ceiling 200/hr");
      assert.equal(r.ceilOvh, 120, "ovh ceiling 120/hr");
    },
  },
  {
    name: "efficiency",
    note: "no observations → priority order; observed → ovh (3000) > unexplored-mean > kilo (20)",
    check(r) {
      assert.deepEqual(r.noObs, ["pollinations", "kilo", "ovh", "llm7"], `no-obs order ${JSON.stringify(r.noObs)}`);
      assert.deepEqual(r.ranked, ["ovh", "pollinations", "llm7", "kilo"], `ranked ${JSON.stringify(r.ranked)}`);
      assert.equal(r.ovhScore, 3000, `ovh score ${r.ovhScore}`);
      assert.equal(r.kiloScore, 20, `kilo score ${r.kiloScore}`);
      assert.equal(r.unexplored, null, "unexplored lane score must be null");
    },
  },
  {
    name: "weeklyAccounting",
    note: "groq served: weekly.req>=1, weekly.tokens=15 (mock usage), pacing uncapped, effScore>0",
    check(r) {
      assert.equal(r.status, 200, `status ${r.status}`);
      assert.equal(r.xLane, "groq", `x-lane ${r.xLane}`);
      assert.ok(r.wReq >= 1, `weekly.req ${r.wReq}`);
      assert.equal(r.wTokens, 15, `weekly.tokens ${r.wTokens}`);
      assert.equal(r.pacing.ceilPerHr, null, "groq pacing uncapped");
      assert.equal(r.pacing.bucketLeft, null, "groq bucketLeft null");
      assert.ok(typeof r.eff === "number" && r.eff > 0, `effScore ${r.eff}`);
    },
  },
  {
    name: "emptyCompletion",
    note: "G2 finding: 200 with empty completion fails over (groq empty -> zai answers)",
    check(r) {
      assert.equal(r.status, 200, `status ${r.status}`);
      assert.equal(r.xLane, "zai", `empty groq must fail over to zai, got ${r.xLane}`);
      assert.equal(r.content, "zai real answer", `content ${JSON.stringify(r.content)}`);
      assert.equal(r.numCalls, 4, `expected 4 upstream attempts (gemini 429, groq degraded, mistral 429, zai ok), got ${r.numCalls}`);
    },
  },
  {
    name: "degradedGuard",
    note: "G2 finding unit: empty/whitespace/no-choices degraded; reasoning/tool-calls usable",
    check(r) {
      assert.equal(r.emptyIsDegraded, true, "empty content must be degraded");
      assert.equal(r.whitespaceIsDegraded, true, "whitespace-only must be degraded");
      assert.equal(r.normalIsUsable, true, "normal answer must be usable");
      assert.equal(r.reasoningIsUsable, true, "reasoning_content must be usable (deepseek reasoners)");
      assert.equal(r.toolCallsIsUsable, true, "tool_calls must be usable");
      assert.equal(r.emptyChoicesIsDegraded, true, "empty choices array must be degraded");
      assert.equal(r.noChoicesIsDegraded, true, "missing choices must be degraded");
    },
  },
  {
    name: "durableMergeBaseline",
    note: "shared KV doc hydrates /health; writeback persists deltas; pacing seeded not reset",
    check(r) {
      assert.equal(r.chatStatus, 200, `chat should succeed, got ${r.chatStatus}`);
      assert.equal(r.chatOk, true, "chat should return content");
      assert.equal(r.durable, true, "health must report durable:true once shared doc hydrates");
      assert.equal(r.kiloWeeklyReq, 8, `expected 7 seeded + 1 live = 8, got ${r.kiloWeeklyReq}`);
      assert.equal(r.kiloWeeklyTokens, 7015, `expected 7000 + 15 = 7015, got ${r.kiloWeeklyTokens}`);
      assert.equal(r.kiloSuccess, 8, `expected 7 + 1 = 8 successes, got ${r.kiloSuccess}`);
      assert.equal(r.kiloFail, 1, `expected 1 seeded fail, got ${r.kiloFail}`);
      assert.equal(r.pollinationsFail, 1, `expected 1 live pollinations fail, got ${r.pollinationsFail}`);
      assert.equal(r.bucketNotFull, true, "pacing bucket must seed from doc (150), not reset to 200");
      assert.equal(r.effScoreType, "number", "effScore must compute from hydrated counters");
      assert.equal(r.docKiloWReq, 8, `writeback must land 8 in shared doc, got ${r.docKiloWReq}`);
      assert.ok(r.docPaceKilo < 150, `pace bucket must decrease, got ${r.docPaceKilo}`);
    },
  },
  {
    name: "durableFlushWrites",
    note: "deltas + breaker-trip incidents persist to shared doc; breaker state recorded",
    check(r) {
      assert.equal(r.docExists, true, "shared doc must exist after traffic");
      assert.equal(r.docVersion, 3, "shared doc must carry v:3");
      assert.equal(r.kiloWReq, 3, `expected 3 kilo requests, got ${r.kiloWReq}`);
      assert.equal(r.kiloWTokens, 45, `expected 3x15 = 45 tokens, got ${r.kiloWTokens}`);
      assert.ok(r.paceKilo < 200 && r.paceKilo >= 197, `pace bucket should be ~197, got ${r.paceKilo}`);
      assert.equal(r.incidentSig, "http-500", `expected http-500 signature, got ${r.incidentSig}`);
      assert.equal(r.incidentLane, "pollinations", `expected pollinations lane, got ${r.incidentLane}`);
      assert.equal(r.breakerPollinations, true, "pollinations breaker state must persist");
    },
  },
  {
    name: "durableNoKV",
    note: "no KV binding → durable:false, requests unaffected (graceful degradation)",
    check(r) {
      assert.equal(r.chatStatus, 200, `chat should succeed, got ${r.chatStatus}`);
      assert.equal(r.chatOk, true, "chat should return content");
      assert.equal(r.durable, false, "health must report durable:false without KV");
      assert.equal(r.kiloWeeklyReq, 1, `expected 1 live request, got ${r.kiloWeeklyReq}`);
    },
  },
];

let pass = 0;
let fail = 0;
for (const t of tests) {
  try {
    const out = execFileSync(process.execPath, [SELF, `--scenario=${t.name}`], {
      timeout: 120_000,
      encoding: "utf8",
    });
    const m = out.match(/RESULT_BEGIN\n([\s\S]*?)\nRESULT_END/);
    assert.ok(m, "scenario did not emit RESULT markers");
    t.check(JSON.parse(m[1]));
    pass++;
    console.log(`PASS  ${t.name} — ${t.note}`);
  } catch (e) {
    fail++;
    const firstLine = String(e.message).split("\n")[0];
    console.log(`FAIL  ${t.name} — ${firstLine}`);
    if (e.stdout) console.log("--- child stdout tail ---\n" + String(e.stdout).slice(-1500));
    if (e.stderr) console.log("--- child stderr tail ---\n" + String(e.stderr).slice(-1500));
  }
}
console.log(`\n${pass}/${pass + fail} scenarios passed`);
process.exit(fail ? 1 : 0);
