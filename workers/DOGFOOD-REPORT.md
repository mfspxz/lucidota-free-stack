# DOGFOOD-REPORT.md — D3: ai-router worker
**Date:** 2026-10-07 ~07:00 PDT (dogfood lead D3) · **Source:** `~/workspace/free-stack/workers/ai-router.js` · **Live:** https://ai-router.cutecity.workers.dev

## Exercise (real)
- `GET /`, `GET /health` unauthenticated (curl, real UA).
- Authenticated `GET /health` via `~/workspace/skills/ai-router/bin/router-call.py` (vault surrogate `custom.ai-router`).
- Authenticated `POST /v1/chat/completions` real inference (`{"model":"auto",…,"max_tokens":8}`).
- Authenticated `GET /v1/models`.
- Full local harness: `node test-router.mjs` (self-contained, mocked fetch + in-memory KV).

## Results
| Check | Result |
|---|---|
| `GET /` (no key) | **401** `router_error unauthorized` — **EXPECTED healthy** (fail-closed, secret-gated) |
| `GET /health` (no key) | 401 — EXPECTED |
| `GET /health` (vault key) | **HTTP 200** — router live, lane registry hydrated, keyed lanes correctly `configured:false` |
| `POST /v1/chat/completions` (vault key) | **HTTP 200** — routed to pollinations lane, model `gpt-oss-20b`, reply `"OK"` |
| `GET /v1/models` (vault key) | 404 — **EXPECTED**, router has no `/v1/models` route (only `/v1/chat/completions`, `/health`, `/admin/*`) |
| `test-router.mjs` | **41/41 scenarios passed** (failover, breakers, admission, cache, hedge, body cap, SSE sentinel, degraded-output guards, durable merge — all green) |
| Keyed lanes | BLOCKED-USER (Zackary hasn't pasted provider keys: GEMINI/GROQ/MISTRAL/NVIDIA/etc.) — not a bug |

## Failures found / fixed / staged
- None. Router survived the full G2 audit kit previously and passes its own 41-scenario suite today.

## Remains
- Keyed-lane dogfood waits on Zackary's key handoff (main-chat lane, recorded not chased).
- No staged changes; no deploys (per directive).
