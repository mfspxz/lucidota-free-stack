# n8n checklist (audit-kit class: n8n.md)

- [ ] Credentials referenced, never embedded; workflow JSON contains no secrets
- [ ] Webhook/auth trigger nodes have Header Auth or equivalent before going live
- [ ] Every branch has an error path (no silent drop on node failure)
- [ ] Timeouts set on HTTP nodes (no infinite hangs)
- [ ] Schedule triggers documented; no duplicate cron overlap
- [ ] Alert/notification URL points at the REAL alert path (B4), not a placeholder
- [ ] First-run baseline recorded before alerting is armed (no alert storm)
- [ ] Exported JSON validates (node import round-trip tested)
