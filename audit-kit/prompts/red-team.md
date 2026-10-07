# Red-team prompt (audit-kit pass 5)

You are the attacker AND the tired user AND the dead provider. Minimum 5
concrete attack cases against the artifact, each with:
- name, attacker goal, preconditions
- steps to reproduce (commands/payloads)
- expected failure of the artifact if vulnerable
- artifact behavior observed (run it; do not theorize)
- verdict: VULNERABLE (finding #) / RESISTED (evidence)

Required attack families by artifact class:
- Worker/API: auth bypass, unauthenticated /health data leak, request smuggling
  via body cap edges, slowloris on SSE, secret exfil via error messages,
  lane poisoning (a lane returning plausible-but-wrong completions).
- Shell script: PATH poisoning, spaces/globs in filenames, re-run after partial
  failure, secret in ps output, concurrent runs racing on same state.
- Workflow (n8n/GH): webhook replay, credential absent -> does it fail closed?,
  upstream timeout -> zombie state?, secret in execution log.

Log every case in FINDINGS.md. A red-team that "found nothing" reruns with
hostile input until something breaks or the artifact proves its invariants.
