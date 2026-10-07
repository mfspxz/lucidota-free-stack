# C1 n8n AI-ops activation runbook
v2026-10-06 · activate ONLY when n8n is live (light-up.sh on Zackary's server).

## Pre-activation audit (done 2026-10-06)
- 4/4 workflow JSONs valid; 0 embedded secrets; schedule triggers present where
  expected; the one webhook trigger (content-pipeline "Content Webhook") carries
  headerAuth with a placeholder credential — CREATE the real "Header Auth"
  credential in n8n before importing (name must match).
- Alert URL: MONITOR_WEBHOOK env on the n8n host, pointing at the lane-alerts
  pipeline. tos-watcher.json's notify node must be repointed from placeholder
  to the real webhook before activation.

## Activation order (one at a time, 48h solo each)
1. **heartbeat-healthcheck** — import INACTIVE → create Header Auth credential →
   activate → watch 48h: executions clean, no unauth hits in n8n access log.
2. **nightly-digest** — same. Judge: digest is USEFUL (Zackary's call, not ours).
3. **tos-watcher** — same. First run must record baselines with zero alert storm
   (scripted baseline already live at tools/tos-baseline.py — compare).
4. **content-pipeline** — same. Drafts only; NOTHING auto-publishes (voice pass).

## Abort conditions
- Any unauthenticated webhook hit → deactivate all, investigate, re-audit.
- Alert storm (>3 alerts/hour from one workflow) → deactivate that workflow.
