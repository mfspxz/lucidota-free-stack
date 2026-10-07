# GitHub Action checklist (audit-kit class: github-action.md)

- [ ] Third-party actions pinned to full SHAs (not floating tags)
- [ ] `permissions:` least-privilege on every job (default: contents: read)
- [ ] `timeout-minutes` on every job
- [ ] Secrets referenced via `${{ secrets.X }}`; never echoed or printed
- [ ] `concurrency:` group set where re-runs could double-spend/double-send
- [ ] Manual `workflow_dispatch` tested before schedule is enabled
- [ ] Failure path: job failure produces a visible signal (artifact, issue, alert)
