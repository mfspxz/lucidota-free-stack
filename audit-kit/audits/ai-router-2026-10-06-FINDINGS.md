# Audit findings — ai-router.js via audit-kit v1 (2026-10-06, wave 1)

**Verdict: FIX (1 finding), KEEP the artifact.** Next audit: on any lane-logic change.

## Passes run
1. HN search — Interlock (signed AI circuit-breaker audits), "What breaks first
   when you try to build real world AI agents" (HN item 46497654, 2026-10-06):
   tool failure strategies > model tuning; cost/latency silently limit everything.
2. arXiv — skipped with reason: failover-gateway mechanics are engineering
   practice, no cited paper disproves the design (recorded, not hand-waved).
3. Reddit search — proxy data via dev.to field reports (see below).
4. Best-practice diff (worker.md): 12/13 PASS. One N/A-with-reason: CORS locked
   origins — worker is a pure API with no browser clients; no `Access-Control-*`
   emitted at all (fail-closed by omission). Verified by grep: no
   "Access-Control" in source.
5. Red-team — lane poisoning family: a lane returning 200 with plausible-but-
   empty/wrong content. Proven below.
6. Dogfood — router used live via router-call.py during this audit (keyless
   lanes); no anomalies observed.
7. Test plan — red-first tests 37 (emptyCompletion) + 38 (degradedGuard);
   observed RED, fixed, GREEN. Suite 35/35 → 37/37.
8. Pivot — KEEP.

## Findings

### #1 HIGH — Degraded output (200 with empty completion) logged as SUCCESS, no failover — FIXED
- **Evidence:** attemptModel treated any parseable 200 as success. Mock:
  groq 200 `choices:[{message:{content:""}}]` → x-lane groq, content "", 2
  upstream calls, zero failover, success recorded (inflating per-lane
  reliability used by effScore/ordering).
- **External corroboration:** dev.to "Every Way LLM Provider Failover Breaks in
  Production" (2026-09) names degraded output — 200 with wrong/truncated/empty
  content — as the failure mode no status-code failover catches; dev.to
  "Half of Free LLM APIs Were Dead After 2 Months" (2026-09-18) documents
  silent free-tier decay (Cerebras 402, Gemini model-404s, Mistral 429s) — the
  exact decay our lanes live in.
- **Fix:** `isDegradedCompletion()` in ai-router.js — usable iff ≥1 choice has
  non-empty content, reasoning_content (deepseek reasoners answer there —
  avoids false positives on the known reasoner behavior), or tool_calls.
  Degraded → recordError + fail over. Exported for tests.
- **Model-404 check (NOT a finding):** the dev.to decay article's "model no
  longer available" mode is already handled: 404 → per-model error, lane
  survives, rotates to next model (verified in code, attemptModel lines ~789).

### Mechanical pre-checks
run-kit.sh on free-stack/workers: bash -n clean, JSON valid, node --check
clean. Secret scan initially flagged test comments mentioning ROUTER_KEY
(false positive — scan regex too aggressive on test files; kit note: restrict
secret scan to non-test sources).
