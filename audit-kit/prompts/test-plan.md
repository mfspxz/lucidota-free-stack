# Test-plan prompt (audit-kit pass 7)

For each finding, write the regression test BEFORE the fix:
1. Write the test. Run it. Watch it FAIL (red). Record the failure output.
2. Fix the code. Run it. Watch it PASS (green).
3. Run the full suite. Confirm no regressions.

Rules:
- No fix without a red-first test. "It obviously works" is not a test.
- Tests must fail for the right reason (assert the failure mode, not a proxy).
- Update the suite count in the audit line: e.g. "25/25 -> 31/31".

Log test ids and red/green evidence in FINDINGS.md.
