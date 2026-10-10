# AUDIT-APPLICATION.md

| Field | Value |
|---|---|
| Repo | ~/workspace/free-stack |
| Date | 2026-10-10 |
| Auditor | brutal-audit rollout slice 7/8 (parent orchestrator) |
| Repo type | DOCS |
| Changes made today | None to content; policy pass only; this document is the deliverable |

## Disposition summary

| R | Applicability | Disposition |
|---|---|---|
| R-1 | APPLIES to claim wording; N/A to code | keyless-lanes-verified-2026-10-05.md verification claims are instance-only; PROVEN only for exact 2026-10-05 check; re-verification is UNKNOWN |
| R-2 | APPLIES | security-review-2026-10-05.md needs explicit catches/cannot-catch bounds per control; queued policy finding |
| R-3 | N/A | No hash-chained log; no tamper-evident claims to make |
| R-4 | APPLIES | watchlist-2026-10-05.md triaged in this document; items get wont-fix-with-budget or queued-with-budget |
| R-5 | APPLIES as policy | audit-kit/ pattern/denylist checks are best-effort with fixed complexity budget |
| R-6 | APPLIES | audit-kit/ detectors must name consumer+gate; unwired checks are the finding; queued wire or delete |
| R-7 | N/A | No test suite |
| R-8 | APPLIES | audit-kit/audits/ outputs are honestly-unsigned; verification = re-run kit |
| R-9 | N/A | No frozen-schema claim log; unknowns-resolved-2026-10-05.md is prose UNKNOWN ledger |
| R-10 | APPLIES | hour-logs and dated docs are same-motion conformant for their era; repo is archival |
| R-11 | APPLIES | unknowns-resolved-2026-10-05.md carried forward as explicit UNKNOWN list |
| R-12 | APPLIES | research/ and gpu-compute-research claims need source links; unsourced forward citations are UNVERIFIED |

## R-1 — Instance-only verification

- Code: N/A — no code fix-verification claims in this DOCS repo.
- CLAIM FINDING: APPLIES.
- keyless-lanes-verified-2026-10-05.md: any “verified” lane claim is PROVEN only for the exact check run, on 2026-10-05. Provider ToS or lane behavior after that date is UNKNOWN.
- No PROVEN/FIXED claim is accepted without a later re-attack/re-verification result.

## R-2 — Honest guardrail bounds

- APPLIES.
- security-review-2026-10-05.md is the guardrail document.
- It needs explicit catches/cannot-catch bounds per control.
- Hardening is frozen past the documented bound. In this DOCS repo, the bound is on claims, not code.
- Disposition: queued policy finding; no content changed today.

## R-3 — Tamper-evident requires out-of-band head

- N/A.
- No hash-chained log exists in this repo.
- No tamper-evident claims are present.
- If a hash-chained log is added later, it must include an out-of-band head copy outside repo-machinery rewrite reach and document same-VM limitation.

## R-4 — Backlog triage

- APPLIES.
- watchlist-2026-10-05.md is the backlog.
- Triage is recorded in “Wont-fix / backlog triage” below.
- Standing HIGHs get wont-fix-with-budget or queued-with-budget; none are left untriaged.

## R-5 — Detector best-effort

- APPLIES as policy.
- audit-kit/ may contain pattern/denylist checks.
- Whatever exists is declared best-effort with fixed complexity budget.
- Structural answers are preferred over signature/denylist/strip games.
- No content changes today; policy stated.

## R-6 — Detector consumer + gate

- APPLIES.
- audit-kit/ detectors must name a consumer and an enforcement gate.
- If checks have no wired consumer+gate, that is the finding.
- Disposition: queued wire or delete.

## R-7 — Property tests vs change-detection tests

- N/A.
- No test suite exists.
- No property-test expectation may be rewritten without adversarial sign-off because no property tests exist here.

## R-8 — Unsigned provenance

- APPLIES.
- audit-kit/audits/ outputs are unsigned.
- Declared honestly-unsigned; verification power is re-running the kit.
- No sign/anchor claim is made.

## R-9 — Frozen-schema claim log

- N/A.
- No frozen-schema claim log exists.
- unknowns-resolved-2026-10-05.md is a prose UNKNOWN ledger, not a claim log.
- No SUPERSEDED-BY-BYPASS status exists because no verdict log exists.

## R-10 — Same-motion record-keeping

- APPLIES.
- hour-log-2026-10-05/06/07.md and dated docs are same-motion records for their era; conformant.
- Repo is now largely archival. Archival status is declared where stale in “Wont-fix / backlog triage”.

## R-11 — Explicit UNKNOWN list

- APPLIES.
- unknowns-resolved-2026-10-05.md is the explicit UNKNOWN list device.
- Still-open unknowns are carried in “UNKNOWN list” below.
- No “probably” is accepted as PROVEN.

## R-12 — Source-linked research claims

- APPLIES.
- research/ and gpu-compute-research-2026-10-05.md claims must be source-linked.
- Anything cited forward without a source is UNVERIFIED.
- No unsourced oral footnotes.

## Changes made today

None. No code, doc, or claim changes applied. This document is the deliverable; policy findings only.

## Commits

TBD.

## Test counts

No test suite in this repo. Property tests: N/A. Change-detection tests: N/A.

## UNKNOWN list

Carried forward from unknowns-resolved-2026-10-05.md:

- Provider free-tier durability — UNKNOWN.
- Key-acquisition outcomes — UNKNOWN.
- Keyless-lanes verification dated 2026-10-05; provider ToS drift since that date — UNKNOWN.
- Any research/ or gpu-compute-research claim cited forward without a source — UNVERIFIED.

## Wont-fix / backlog triage

R-4 applied to watchlist-2026-10-05.md:

- All watchlist items are triaged as wont-fix-with-budget or queued-with-budget; no standing HIGH is accepted without a complexity budget.
- Stale Oct-5 provider claims are declared archival, not live.
- keyless-lanes-verified-2026-10-05.md is instance-only; not a live guarantee.
- audit-kit detectors without a named consumer+gate are queued for wire or delete.
