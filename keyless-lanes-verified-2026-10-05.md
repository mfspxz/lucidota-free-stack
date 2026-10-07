# Keyless AI Lanes — Live Verification
Date: 2026-10-05 ~18:45 PDT. Method: one tiny real request per lane via curl, no signup, no keys. Hacker verification, not docs.

## Scorecard

| Lane | Verdict | Endpoint tested | Result |
|---|---|---|---|
| OVHcloud AI Endpoints | **PROVEN** | `POST https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions` | HTTP 200, `gpt-oss-20b`, 13.6s |
| LLM7.io | **PROVEN** | `POST https://api.llm7.io/v1/chat/completions` (`Bearer unused`, model `default`) | HTTP 200, served by `codestral-latest`, 36.9s |
| Kilo gateway | **PROVEN** | `POST https://api.kilo.ai/api/gateway/chat/completions` (model `kilo-auto/free`) | HTTP 200 in 1.8s, routed to `poolside/laguna-s-2.1:free`, cost 0 |
| Pollinations.AI | **PROVEN** | `GET https://text.pollinations.ai/Say%20OK?model=openai` and `GET https://gen.pollinations.ai/text/Say%20OK` | HTTP 200 both, 0.87s / 2.5s |
| UnoRouter | **DISPROVEN** (zero-signup) | `GET/POST https://api.unorouter.com/v1/...` | 401 on models AND chat: "Missing or invalid API key" — key needs Discord/GitHub sign-in |
| OrcaRouter | **DISPROVEN** (zero-signup) | `POST https://api.orcarouter.ai/v1/chat/completions` | 401 "Invalid API key" — needs `sk-orca-...` signup. Anonymous `/api/free-package/public` probe is status-only |

## Per-lane notes for the failover router

### OVHcloud — PROVEN, slow, strict quota
- Anonymous catalog: `GET /v1/models` → 200, 24 models (chat: `gpt-oss-20b/120b`, `Qwen3.6-27B`, `Qwen3.8-27B`, `Qwen3.5-9B/397B`, `Qwen3-Coder-30B`, `Meta-Llama-3_3-70B`, `Mistral-Nemo`, `Mistral-7B`, `Mistral-Small-3.2-24B`, `Qwen2.5-VL-72B` + embeddings/TTS/Whisper).
- Rate-limit headers ARE exposed: `x-ratelimit-limit-minute: 2`, `ratelimit-remaining`, `ratelimit-reset`. Parse them — they tell the truth.
- Quirk: `gpt-oss` models emit reasoning tokens before content; tiny `max_tokens` truncates with `finish_reason: length` and the visible text lands in the `reasoning` field. Use larger `max_tokens` or a non-reasoning model (`Qwen3.5-9B`, `Mistral-7B`).
- Expect 429s under shared-pool contention (2/min/model is GLOBAL across all anonymous callers, not per-IP in practice). Retry with backoff, rotate models.
- Privacy: vendor states anonymous inputs are NOT used for training. EU-hosted. → privacy lane.

### LLM7.io — PROVEN, slowest
- `Authorization: Bearer unused` works; stable selectors `default` / `fast`. `default` routed to `codestral-latest` at test time — the catalog is dynamic, never hardcode the resolved model.
- 36.9s for a 2-word reply. Use as a deep fallback, not in the hot path. 1-request concurrency per IP reported.
- Optional free token at dash.llm7.io raises limits (that's signup-adjacent; anonymous tier is what was verified).

### Kilo — PROVEN, prefer the auto-router
- `GET /api/gateway/models` → 200 anonymous, 399 models, many `:free`.
- Pinning `liquid/lfm-2.5-2.6b:free` hung 60s (timeout); pinning `poolside/laguna-s-2.1:free` got an immediate upstream 429 (`limit_source: upstream_provider_account`). But `kilo-auto/free` → HTTP 200 in 1.8s.
- Router rule: ALWAYS use `kilo-auto/free`, never pin a `:free` model directly. Expect transient upstream 429s — that's the documented failure mode, retry with backoff.
- Advertised: 200 req/hr/IP keyless.

### Pollinations.AI — PROVEN, fastest, most fragile contract
- Both legacy (`text.pollinations.ai/{prompt}`) and current (`gen.pollinations.ai/text/{prompt}`) answer keyless TODAY. 0.87s on the legacy endpoint — fastest lane tested.
- An Aug 2026 report saw 401s demanding keys; docs now push `enter.pollinations.ai` keys. The keyless path works now but has the weakest contract — treat as opportunistic, monitor, never depend on it alone.
- Also keyless: `image.pollinations.ai/prompt/...` (image lane, not tested here).

### UnoRouter — DISPROVEN (needs key)
- 401 everywhere without key, including `/v1/models` (docs claiming public catalog are stale). Free tier is real but requires Discord/GitHub sign-in. Revisit only if a key is provisioned.

### OrcaRouter — DISPROVEN (needs key)
- 401 without `sk-orca-...`. Free `-free` models exist behind signup. The anonymous `/api/free-package/public` endpoint (200) only reports free-package status — useful as a health signal, not inference.

## Failover order recommendation (keyless stack)
1. Pollinations (fastest, weakest contract) → 2. Kilo `kilo-auto/free` (fast, auto-failover built in) → 3. OVHcloud (private, strict 2/min — parse rate-limit headers) → 4. LLM7 `default` (slow, last resort).
Keep all four warm with periodic health pings; any 429 → rotate to next lane immediately, never retry same lane twice in a row.
