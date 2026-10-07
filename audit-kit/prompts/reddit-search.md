# Reddit-search prompt (audit-kit pass 3)

You are auditing an artifact for the Cute Tentacle Cloud City project.
Search Reddit (search tool, site:reddit.com queries, or subreddit threads) for
real-user breakage of the artifact's dependencies/providers.

Minimum 3 queries. For each, record in FINDINGS.md:
- query, top threads, the complaint in one line
- artifact exposure: does OUR stack inherit this pain? (VULNERABLE /
  MITIGATED / NOT-APPLICABLE with evidence)

Complaints are free red-team. Treat "my provider silently changed ToS" as a
first-class finding class.
