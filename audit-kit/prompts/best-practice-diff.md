# Best-practice diff prompt (audit-kit pass 4)

Diff the artifact against the current industry best-practice checklist for its
class. The kit ships class checklists in `checklists/`:
- `worker.md` — Cloudflare Worker: failover semantics, cold start, CPU time
  budgets, secret handling, log redaction, abort handling, body caps, TLS.
- `n8n.md` — n8n workflow: credentials in vault, no plaintext secrets in JSON,
  error branches, timeouts, webhook auth, versioned node pinning.
- `github-action.md` — GH Action: pinned SHAs, least-privilege GITHUB_TOKEN,
  no secrets in logs, concurrency groups, timeout-minutes on every job.
- `rust-binary.md` — Rust: no unwrap in prod paths, error types, graceful
  shutdown, signal handling, config from env not literals.
- `shell-script.md` — shell: set -euo pipefail, no curl|bash, quote expansions,
  idempotency, --dry-run, secret masking in output.
- `api-surface.md` — API: auth on every route, fail-closed defaults, rate
  limits, input validation, uniform error shapes, no stack traces to clients.

For each checklist item record: PASS (evidence) / FAIL (finding #, fix made) /
N/A (reason). A diff with zero FAILs is suspicious — re-run red-team before
claiming it.
