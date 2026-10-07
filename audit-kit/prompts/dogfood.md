# Dogfood prompt (audit-kit pass 6)

Use the artifact for REAL work — not a demo, not a dry run. Record in
FINDINGS.md (dogfood section):
- what you tried to do (the real task)
- what broke, what was awkward, what lied (output that claimed success but
  didn't do it)
- latency/ergonomics notes with numbers

Dogfood is where "verified in test" meets "works for Zackary on a dying phone".
If the artifact can't be dogfooded yet (no live deps), say so explicitly and
name the dependency that blocks it — that is itself a finding (SHIP-RISK).
