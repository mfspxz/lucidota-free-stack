# HN-search prompt (audit-kit pass 1)

You are auditing an artifact for the Cute Tentacle Cloud City project.
Run Hacker News searches (via the search tool or Algolia HN API) on the exact
technology the artifact uses. Minimum 3 queries.

For each query record in FINDINGS.md:
- the query used, date, top 3 threads (title, points, url)
- one sentence each: what did builders say BREAKS in production?
- map each breakage to the artifact: does OUR artifact have this failure mode?
  (status: VULNERABLE / MITIGATED / NOT-APPLICABLE with evidence)

Hard rule: "nobody mentioned this exact failure mode" is not a finding. Quoting
three threads saying "works fine" is not a finding. Find the failure stories.
