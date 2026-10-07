# Worker checklist (audit-kit class: worker.md)

Cloudflare Worker best-practice diff, current as of 2026-10-06.
- [ ] Auth on EVERY route including /health and debug endpoints (no unauth data leak)
- [ ] Fail-closed: missing secret/env -> deny, never default-open
- [ ] Failover semantics: 401/403/404/429/5xx each have a defined lane behavior
- [ ] Per-lane circuit breaker with escalating backoff + jitter (no thundering herd)
- [ ] Honest 429 with Retry-After / retry_after_s; admission control under load
- [ ] Request body cap; abort handling on SSE/streaming (AbortSignal wired)
- [ ] Logical deadline on upstream calls (fetch timeout), not just wall-clock
- [ ] Secrets never in logs; error responses carry no secret fragments or stack traces
- [ ] CORS locked to known origins (not `*`) where credentials are involved
- [ ] KV/D1 access: read-your-write expectations stated; stale-registry handling
- [ ] Idempotency on mutating endpoints (replay returns recorded result)
- [ ] Log redaction verified by grep: no `ROUTER_KEY|SECRET|TOKEN` literals in source
- [ ] Version pinned in response header or /health (know what is deployed)
