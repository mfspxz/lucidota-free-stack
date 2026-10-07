# Shell-script checklist (audit-kit class: shell-script.md)

- [ ] `set -euo pipefail` at top (or documented reason for absence)
- [ ] All expansions quoted; no unquoted `$@`/`$var` in rm/cp/mv paths
- [ ] No `curl | bash`; downloads checksummed where integrity matters
- [ ] Idempotent: safe to re-run after partial failure (state check before mutate)
- [ ] `--dry-run` / `--verify` mode that changes nothing
- [ ] Secrets masked in output; never echoed, never in `ps`-visible args
- [ ] Concurrent runs: lockfile or documented single-run assumption
- [ ] Exit codes nonzero on failure with a one-line reason on stderr
- [ ] `bash -n` clean; shellcheck clean (or documented suppressions)
