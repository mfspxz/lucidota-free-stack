# C2 GitHub Actions go-live runbook
v2026-10-06 · blocked on GitHub auth (connector disconnected; needs Zackary's PAT or reconnect).

## Audit fixes applied 2026-10-06 (vs audit-kit github-action checklist)
- failover-drill.yml: added `permissions: contents: read` + `timeout-minutes: 10`;
  FIXED a real bug — the drill parsed /health lanes as a list, but our router
  returns a dict; verified the fixed parser against live /health (4 healthy
  keyless lanes → PASS).
- nightly-ai-batch.yml / weekly-content.yml: actions pinned to SHAs
  (checkout@11d5960a326750d5838078e36cf38b85af677262,
   setup-python@a26af69be951a213d495a4c3e4e4022e16d87065 — from api.github.com
  2026-10-06), `timeout-minutes: 30`, job-level `concurrency:` group.
- 0 literal secrets in all 3 files (secrets.* references only).

## Go-live steps (when auth lands)
1. Create ops repo (e.g. `tentacle-city-ops`), push this directory:
   `git init && git add . && git commit -m "ops workflows" && gh repo create tentacle-city-ops --private --source=. --push`
   (private — workflows reference the router URL/key.)
2. Set secrets: `AI_ROUTER_URL=https://ai-router.cutecity.workers.dev`,
   `AI_ROUTER_KEY` (Zackary pastes — never in chat).
3. Manual dispatch EACH workflow (Actions tab → Run workflow) before enabling
   schedules. failover-drill must PASS (>=3 healthy lanes; currently 4 keyless).
4. Confirm one full cycle: nightly x7, weekly x1, drill x1, all green.
