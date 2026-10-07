# The Build Journal Convention (G1 — canonical)

One canonical log per work session, plus a per-artifact audit trail.
This file is the contract. The journal is how a fresh agent with zero
context picks up any artifact and knows its full history in <5 minutes.

## 1. The canonical session log

- **Path:** `~/workspace/free-stack/hour-log-YYYY-MM-DD.md` (one file per day, PDT date).
- **One wave = one timestamped entry.** A wave is never "done" without a log line.
- **Entry format** (grep-friendly, machine-scannable):

```
## HH:MM — Wave <n> (<node-id>, <actor>)
- <timestamped fact lines: what landed, where, test counts>
- Trinary verdicts: PROVEN — <claim + evidence>. DISPROVEN — <claim + evidence>.
  UNKNOWN — <open question>.
- Issues found and fixed in place: <what broke, what changed>
```

- **Required in every wave entry:** DAG node id (e.g. `G2`), actor, file paths touched,
  test results with counts, trinary verdicts on every claim a human would act on
  (prices, limits, availability, auth behavior). Opinions and guesses are UNKNOWN
  until tested.
- **Drift rule:** if you touch a file, say the path exactly. No "the config" —
  `~/workspace/free-stack/server/docker-compose.yml`.

## 2. The per-artifact audit trail

No artifact is ever `done` without an audit line. Two places, same content:

1. **DAG JSON** `audit_trail[]` on the node that built it. ADD-only: append entries,
   never rewrite history. Entry schema (exact):
   `{"ts": "<UTC ISO>", "plan_version": "<pinned>", "wave": <n>, "actor": "<subagent>",
   "what_changed": "...", "audit_findings": "...", "pivot": "...", "status": "todo|in_play|done"}`.
2. **The artifact's own doc** (when the artifact is a doc) or a note in
   `hidden_files/` gets an `## Audit trail` section mirroring what changed and
   what the audit found — so the artifact explains itself without the DAG.

Rule: the DAG entry is the system of record; the artifact-local note is the
human-readable mirror. `sync-build-order.mjs --check` keeps the markdown view
in sync with the DAG.

## 3. The briefing tool (the 5-minute test)

`~/workspace/tentacle-corp/tools/journal-brief.mjs <node-id>` produces a briefing:
what the node built, every audit finding and pivot in chronological order, and
the current verdict. Dogfood rule: if the brief can't answer "what broke last
time" for a node, the journal is broken — fix the journal, not the tool.

The done_definition test for THIS convention: hand a fresh agent
`validation-2026-10-05.md` + today's hour-log + the brief for one node, and ask
"what broke last time". If it can't answer in <5 minutes of reading, G1 is not
done.

## 4. Ledger mirror

Every wave ends with a ledger append via `python3 ~/ledger/ledger.py '<json>'`
(actor `subagent:cron`, device `vm`, chat `cute-tentacle-cloud-city`, type `action`).
The journal is the human narrative; the ledger is the immutable receipt. Both.

## 5. Validation

`validate-all.mjs` runs a `journal` check every time it runs:
- today's hour-log exists and every `## HH:MM — Wave` entry carries a DAG node id;
- the DAG JSON parses and every `audit_trail[]` entry has `ts`, `plan_version`,
  `actor`, and `status`.
A wave that skips the journal fails validation. The journal is not paperwork —
it's the institutional memory. Treat it like production code.
