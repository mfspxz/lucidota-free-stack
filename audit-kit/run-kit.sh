#!/usr/bin/env bash
# run-kit.sh — mechanical pre-checks for any audit-kit run.
# Usage: run-kit.sh <target-dir> ; exit nonzero on failure.
set -euo pipefail
TARGET="${1:?usage: run-kit.sh <target-dir>}"
FAIL=0
note() { echo "[kit] $*"; }
fail() { echo "[kit] FAIL: $*"; FAIL=1; }

note "target: $TARGET"
# 1. secret scan (source files only)
if grep -rniE 'ROUTER_KEY|HEARTBEAT_SECRET|LEDGER_KEY|GIT_KEY|api[_-]?key\s*[:=]\s*["'"'"'][A-Za-z0-9_-]{16,}' --include='*.js' --include='*.mjs' --include='*.sh' --include='*.py' --include='*.json' --include='*.yml' "$TARGET" 2>/dev/null | grep -viE 'secret put|secrets\.|vault|placeholder|EXAMPLE|YOUR_' ; then
  fail "possible secret literal in source"
else note "secret scan clean"; fi
# 2. shell syntax
while IFS= read -r f; do bash -n "$f" || fail "bash -n: $f"; done < <(find "$TARGET" -maxdepth 3 -name '*.sh' 2>/dev/null)
note "bash -n clean"
# 3. JSON validity
while IFS= read -r f; do python3 -c "import json;json.load(open('$f'))" || fail "bad JSON: $f"; done < <(find "$TARGET" -maxdepth 3 -name '*.json' 2>/dev/null)
note "JSON valid"
# 4. node syntax (js/mjs present)
if command -v node >/dev/null 2>&1; then
  while IFS= read -r f; do node --check "$f" || fail "node --check: $f"; done < <(find "$TARGET" -maxdepth 2 -name '*.js' -o -maxdepth 2 -name '*.mjs' 2>/dev/null)
  note "node --check clean"
fi
exit $FAIL
