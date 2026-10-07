# arXiv-search prompt (audit-kit pass 2)

You are auditing an artifact for the Cute Tentacle Cloud City project.
Search arXiv (export.arxiv.org API) for papers touching the artifact's core
mechanism (e.g. failover routing, LLM gateway reliability, quota management).

For each relevant paper record in FINDINGS.md:
- title, authors, arXiv id, one-line result
- verdict: SUPPORTS our design / DISPROVES or weakens our design / IRRELEVANT,
  with the specific mechanism named.

If the search finds nothing relevant, write exactly why the mechanism is not
covered by literature (e.g. "engineering practice, not researched") — do not
invent relevance.
