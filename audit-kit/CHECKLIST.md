# Audit Kit — v1 (G2 done-definition artifact)
v2026-10-06 · ~/workspace/free-stack/audit-kit/

The reusable "you think you're done" audit. Every artifact the city ships gets
run through this kit before it counts as done. **Success criterion: running the
kit on real work produces >=1 real finding that changes code.** A kit that finds
nothing is broken, not honest.

## The 8 passes (in order)

1. **HN search** (`prompts/hn-search.md`) — how did the smartest builders in the
   room break/build this exact thing? Minimum 3 queries, notes in FINDINGS.md.
2. **arXiv search** (`prompts/arxiv-search.md`) — is there a paper that disproves
   our approach? Cite or rule out with reason.
3. **Reddit search** (`prompts/reddit-search.md`) — what breaks in production for
   real users? Complaints are free red-team.
4. **Best-practice diff** (`prompts/best-practice-diff.md`) — diff the artifact
   against the current industry best-practice checklist for its class (the kit
   ships checklists for: Cloudflare Worker, n8n workflow, GH Action, Rust
   binary, shell script, API surface).
5. **Red-team pass** (`prompts/red-team.md`) — adversarial: act like the attacker,
   the tired user, the dead provider. Minimum 5 concrete attack cases.
6. **Dogfood** (`prompts/dogfood.md`) — use the thing for real work. Record what
   broke, what was awkward, what lied.
7. **Test plan** (`prompts/test-plan.md`) — write the test the finding needs,
   watch it FAIL first (red), fix, watch it pass (green).
8. **Pivot decision** (`prompts/pivot-decision.md`) — template: KEEP / FIX /
   REWRITE / KILL, with evidence pointer and Zackary's call recorded where needed.

## Outputs per audit

- `FINDINGS.md` — numbered findings, each with: severity (CRIT/HIGH/MED/LOW),
  evidence, status (FIXED/WONTFIX/ZACKARY-CALL), test pointer.
- `run-kit.sh` — mechanical pre-checks (secret scan, bash -n, JSON validity,
  route liveness). Exit nonzero on failure.
- Audit line appended to the artifact's per-artifact audit trail (G1 convention).

## Non-goals

- The kit does not bless. It accuses. Finding zero flaws means the audit was
  lazy, not that the artifact is perfect.
- Sycophancy is a kit defect: "looks good" without evidence = FAIL the audit.
