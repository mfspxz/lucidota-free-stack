# Bucket 8 — Monitoring / Uptime / Logging / Analytics / Auth / Identity
Deep sweep completed **2026-10-05** by subagent (FreeStack op). Research only — no signups.

**Raw candidates surveyed: ~70** (see category lists below).

## Ranked shortlist (top 15)

### 1. Uptime Kuma — PRIMARY self-hosted uptime watchdog
- URL: https://github.com/louislam/uptime-kuma
- Free limits: unlimited monitors, unlimited status pages, 20-second intervals, 90+ notification channels (Telegram, Discord, Slack, SMTP...), SQLite storage, ~85K GitHub stars.
- Signup friction: none — `docker run -d -p 3001:3001 -v uptime-kuma:/app/data louislam/uptime-kuma:1` on his own server. ~512MB RAM comfortable.
- ToS gotchas: none — MIT license.
- Jurisdiction: self-hosted (his data, Canada).
- Verdict: **PROVEN** — live README + install docs current as of 2026.
- Redundancy role: primary uptime watchdog.
- **FRIEND** — the #1 self-host monitoring fit: zero cost, zero lock-in.

### 2. Upptime — zero-infra backup watchdog + status page
- URL: https://upptime.js.org
- Free limits: unlimited monitors via GitHub Actions (5-min interval), incidents auto-opened as GitHub Issues, status page on GitHub Pages, response-time graphs committed to git.
- Friction: template repo fork + one config file; needs a GH_PAT for Pages.
- Gotchas: **private-repo Actions minutes cap (2,000/mo free)** — keep the Upptime repo PUBLIC for effectively unlimited runs (public repos get unlimited Actions minutes); private repo at 5-min checks (~8,640 min/mo) would burn the cap.
- Jurisdiction: GitHub (US, Microsoft).
- Verdict: **PROVEN** — official docs current.
- Role: backup/external watchdog independent of his own server.
- **FRIEND** — best "free server that isn't yours" trick in the bucket.

### 3. PostHog — analytics + feature flags + session replay, all-in-one
- URL: https://posthog.com
- Free limits (per month, reset monthly, no card): 1M analytics events, 5K session replays, 1M feature-flag requests, 100K exceptions, 50GB logs, 1,500 surveys. 97% of companies pay nothing (their claim).
- Friction: signup, drop-in snippet; EU (Frankfurt) capture available (`eu.i.posthog.com`), cookieless mode available.
- Gotchas: **identified events carry an extra person-profile charge** above the free allowance (~$0.0002/event); per-product meters are separate — one product blowing past its cap doesn't touch the others; billing caps configurable. Open source (self-host exit exists).
- Jurisdiction: US company, EU hosting option.
- Verdict: **PROVEN** — pricing verified Sept 2026 across posthog.com, Rybbit teardown, Flexprice.
- Role: primary product analytics + feature flags + replay.
- **FRIEND** — no card, billing caps, kills three buckets at once.

### 4. Authentik — PRIMARY self-hosted identity provider
- URL: https://goauthentik.io (docs.goauthentik.io)
- Free limits: unlimited users, all protocols (OIDC, OAuth2, SAML, LDAP, RADIUS, SCIM), MFA (TOTP, WebAuthn, passkeys), visual flow builder, user portal.
- Friction: Docker Compose (server + worker + PostgreSQL — Redis no longer required since 2025.10), ~1GB RAM, ~30–60 min setup. Generate `AUTHENTIK_SECRET_KEY` + PG pass.
- Gotchas: heavier than Authelia (Python/Django ~500MB+ image); MIT license, Enterprise plan adds support only.
- Jurisdiction: self-hosted.
- Verdict: **PROVEN** — current 2026.x releases, multiple 2026 deploy guides.
- Role: primary identity/SSO for his products + his own server apps.
- **FRIEND** — "self-hosted Auth0/Okta", priority lead confirmed.

### 5. Sentry Developer — managed error tracking
- URL: https://sentry.io
- Free limits: 5,000 errors/mo, 5M spans, 50 session replays, 5GB logs, 1 cron monitor, 1 uptime monitor, 1 user, unlimited projects, 30-day retention.
- Friction: low — signup, DSN into SDK.
- Gotchas: **1-user limit on free** (he's solo, fine); ingestion stops at quota; logs at $0.50/GB overage; US company.
- Jurisdiction: US (region selection on higher plans).
- Verdict: **PROVEN** — first-party pricing page + Aug-2025 plan-change notice.
- Role: primary error tracking (managed); GlitchTip is the self-host fallback.
- **FRIEND** — best free managed error tier; tiny footprint for a solo dev.

### 6. Grafana Cloud Free — managed metrics/logs/traces
- URL: https://grafana.com
- Free limits (per month, no card): 10,000 active metric series, 50GB logs, 50GB traces, 3 users, 14-day retention. Open-source self-host exit (Loki/Mimir/Tempo).
- Friction: signup; Alloy agent for unified OTLP shipping.
- Gotchas: series cardinality can blow the 10K budget fast (label discipline needed); retention only 14 days free; IRM/on-call is paid.
- Jurisdiction: US (region select on signup).
- Verdict: **PROVEN** — pricing page, Sept 2026.
- Role: infra + app telemetry backbone.
- **FRIEND** — most generous real free managed observability tier.

### 7. Logto — managed auth, huge free MAU
- URL: https://logto.io
- Free limits: 50,000 MAU, 50,000 tokens/mo, 3 apps, custom domain included, no card. Pro is $24/mo flat (unlimited MAU — pays for capabilities, not users).
- Friction: signup; SDKs for 30+ frameworks.
- Gotchas: RBAC moved to paid ($32 add-on) Oct 2025; MFA/WebAuthn $48 add-on; 1 M2M app only on free. Core is open source → self-host exit.
- Jurisdiction: US (regions: EU/US/AU/JP).
- Verdict: **PROVEN** — logto.io pricing/compare pages, April 2026 free-stack verification.
- Role: primary managed auth for customer-facing apps.
- **FRIEND** — 5× Clerk's free MAU with a flat-rate escape hatch, no MAU trap.

### 8. Better Stack Free — uptime + logs + status bundle
- URL: https://betterstack.com
- Free limits: 10 uptime monitors (30s–3min checks), 10 heartbeats, 1 status page, ~1–3GB logs/mo (sources differ: ~1GB per freestackhq, 3GB per sagargupta16 — call it **~1GB safe**), 100K exceptions/mo, 5K replays, 3-day log retention.
- Friction: low signup, no card.
- Gotchas: logs/exceptions retention only 3 days free; paid responder licensing $29–34/seat/mo — never touch it, use only the free tier. US/EU (region on signup).
- Verdict: **PROVEN** — multiple 2026 comparisons + official comparison pages.
- Role: secondary uptime (outside his server) + short-lived log tail.
- **FRIEND** — best "one dashboard" managed bundle at $0.

### 9. Axiom Always Free — log analytics volume king
- URL: https://axiom.co
- Free limits: 500GB ingest/mo, ~100 datasets, 30-day retention, no card. (Sources conflict on user/dataset counts — see unknowns.)
- Friction: low signup.
- Gotchas: overage goes to usage billing ($25 platform fee + per-GB); APL query language is proprietary; cloud-only.
- Jurisdiction: US.
- Verdict: **PROVEN-ISH** — 2026-04 verified (500GB) but current numbers contested → see unknown #2.
- Role: heavy-log analytics overflow.
- **FRIEND** (pending number confirmation) — nothing else free offers 500GB ingest.

### 10. healthchecks.io — cron/dead-man-switch monitoring
- URL: https://healthchecks.io
- Free limits: 20 checks, 100 pings/day (per one source), 100 log entries/check; hosted + **BSD-3-Clause self-hostable** (same code).
- Friction: trivial (one URL per job); self-host is a Django app.
- Gotchas: cron-only — no uptime checks, no status pages. One source lists a $5/mo Supporter tier (same limits).
- Jurisdiction: hosted EU (vendor: SIA Monkey See Monkey Do); self-host anywhere.
- Verdict: **PROVEN** — 2026 comparisons.
- Role: primary cron watchdog (n8n workflows, backup scripts, drone pipelines).
- **FRIEND** — zero vendor risk thanks to BSD self-host exit.

### 11. Umami — self-hosted privacy analytics
- URL: https://umami.is
- Free limits: **self-hosted MIT = unlimited events & sites**; Cloud Hobby 100K events/mo free.
- Friction: Docker Compose (Node 18+ + PostgreSQL), admin login on first boot.
- Gotchas: no cookies = GDPR-clean; core is complete (funnels, replay, heatmaps all in MIT build v3); self-host lacks only email reports/streaming API.
- Jurisdiction: self-hosted.
- Verdict: **PROVEN**.
- Role: privacy analytics for marketing sites (Cloudflare Web Analytics is the zero-ops alternative).
- **FRIEND**.

### 12. Cloudflare Web Analytics — zero-ops traffic stats
- Free limits: **unlimited pageviews**, unlimited proxied sites, 10 non-proxied sites; 6-month retention (Cloudflare skills doc); no cookies, no fingerprinting, no PII.
- Friction: zero — token in existing Cloudflare account.
- Gotchas: dashboard-only (no API), 5–10 min delay, no custom events, no real-time; reviewers note weak bot filtering and ~30-day practical retention on some dashboards.
- Verdict: **PROVEN** — Cloudflare's own skill reference, 2026.
- Role: baseline traffic visibility for every site, zero setup.
- **FRIEND** — he already has Cloudflare free.

### 13. Authelia — featherweight SSO/2FA gate for his own server
- URL: https://www.authelia.com
- Free limits: everything — Go single binary (~20MB image, ~30MB RAM idle), forward-auth SSO + TOTP/WebAuthn/passkeys + Duo push, OIDC provider, brute-force protection.
- Friction: YAML config + reverse-proxy forward-auth middleware (Traefik/nginx/Caddy). Not a full IdP: no SAML/SCIM, simpler user management.
- Verdict: **PROVEN** — 26.9K stars, active 2026 releases.
- Role: gate every internal dashboard (Uptime Kuma, n8n, GlitchTip, GlitchTip admin) behind 2FA.
- **FRIEND** — cheapest security win in the bucket.

### 14. Infisical — secrets (self-host primary)
- URL: https://infisical.com
- Free limits: Cloud free = 5 identities, 3 projects, 3 envs, 200 reads/min; **self-hosted = no rate limits**, full open source.
- Friction: Docker Compose; CLI/SDKs/GitHub Actions integration.
- Gotchas: audit logs are a paid feature on Cloud (self-host covers it); pricing unit is identity-based — count service tokens.
- Jurisdiction: self-hosted.
- Verdict: **PROVEN** — Infisical's own 2026 pricing guide + merginit comparison.
- Role: primary secrets manager. Doppler (free for 3 users, closed source) is the managed backup.
- **FRIEND**.

### 15. Unleash — self-hosted feature flags (redundancy to PostHog flags)
- URL: https://www.getunleash.io
- Free limits: self-hosted Community (Apache 2.0) = unlimited flags/projects/environments/users; environments are a first-class concept.
- Friction: Docker + Postgres; simplest self-host of the OSS flag platforms (9/10 rating vs GrowthBook 8/10).
- Gotchas: weak experimentation (2/10) — pair with PostHog/GrowthBook for A/B stats. GrowthBook (MIT) is the richer-stats alternative if he wants one platform.
- Verdict: **PROVEN** — multiple 2026 comparisons.
- Role: flag redundancy if PostHog caps are a concern; primary flags for his Rust/GIS stack where PostHog SDK is heavy.
- **FRIEND**.

---

## Raw candidate census (~70 total)

- **Uptime:** UptimeRobot, Better Stack, Upptime, Uptime Kuma, Checkly, Instatus, openstatus, Qodex, OnlineOrNot, phare.io, Pingzo, pingpong.one, Pingmeter, pingbreak, MonitorMonk, cronalive, AlertKick, bleemeo, Velprove, Hyperping, Freshping, Statping-ng, Gatus, Netdata, MarionetteOps, pagecrawl, Cronitor, Dead Man's Snitch, QuietPulse, Drumbeats, watchcron.
- **Status pages:** Instatus, cState, openstatus, Upptime (GH Pages), Uptime Kuma pages, Better Stack.
- **Logging/error:** Sentry, GlitchTip, Axiom, Grafana Cloud, Better Stack (Logtail), New Relic, Logflare, HyperDX, Seq, Papertrail, Sumo Logic, middleware.io, PostHog Logs, LaunchDarkly Observability (ex-Highlight.io).
- **Analytics:** PostHog, Umami, Matomo, Cloudflare Web Analytics, Plausible, GoatCounter, Rybbit, OpenPanel, Fathom, Mixpanel, Piwik PRO.
- **Auth/identity:** Clerk, Auth0, Supabase Auth (50K MAU, 7-day pause gotcha), WorkOS AuthKit (1M free), Stytch (10K), Logto (50K), Hanko (10K), Ory, Zitadel, Keycloak, Authentik, Authelia, Descope (7.5K), PropelAuth (10K), SuperTokens, Firebase Auth, Auth.js/NextAuth, Better Auth, lldap.
- **Feature flags:** PostHog, GrowthBook, Unleash, Flagsmith.
- **Secrets:** Doppler (3 users free), Infisical, HashiCorp Vault, Akeyless (5 clients/500 secrets free), 1Password (no free), GitGuardian.

## Notable rejects (with why)

- **UptimeRobot — FOE.** Free 50 monitors/5-min/1 status page PROVEN, but ToS restricts free tier to **personal, non-commercial use since Oct 2024** (notifier.so, verified May 2026). Zackary's is a company. Commercial use on free = account risk. → Better Stack free + Upptime cover the need.
- **Clerk — NEUTRAL/FOE.** 10K MAU free PROVEN, but Pro jump is brutal ($25/mo → ~$800/mo at 50K MAU; $0.02/MAU). Classic MAU trap. → Logto or self-host.
- **Auth0 — FOE.** Free tier has churned repeatedly (sources say 7.5K vs 25K); pricing at 10K MAU ≈ hundreds/mo; SAML/enterprise gated; no self-host exit. → Authentik self-host.
- **Plausible — FOE.** No free tier (30-day trial; $9+/mo). Self-host is ClickHouse+Postgres heavy. → Umami/Cloudflare.
- **Piwik PRO — FOE.** Killed its Free Core plan Feb 2026 — bait-and-switch cautionary tale; Business from ~€35/mo. → Umami.
- **Firebase Auth — NEUTRAL.** 50K free MAU but **US data centers only** for auth (privacy posture); no self-host. → Supabase Auth or Logto.
- **1Password — FOE.** No free plan (14-day trial only), $7.99–19.95/mo. → Infisical.
- **AWS Secrets Manager — FOE.** $0.40/secret/mo, not free at any scale. → Infisical.
- **Datadog — FOE.** No free production tier; per-host metering is a trap for a one-server shop. → Grafana Cloud/New Relic.
- **Supabase Auth (managed) — NEUTRAL.** 50K MAU free is real, but **projects pause after 7 days inactivity** — dangerous for a 24/7 company identity layer. Keep it only inside his existing Supabase usage; not the auth primary. → Logto managed or Authentik self-host.

## Top 3 unknowns worth resolving

1. **Auth0's actual current free tier** — sources conflict: familylist (2026) says 7,500 MAU; merginit (June 2026) says 25,000 MAU free with Essentials $35/mo. Auth0 churns this constantly. Resolve: fetch `auth0.com/pricing` text directly.
2. **Axiom's current Always-Free numbers** — 2026-04 verification said 500GB ingest/mo + 100 datasets + 30-day retention + 1,000 users; a July 2026 source said 500GB hard cap + 3 datasets + 3 monitors + 1 user; a Sept 2026 source shows 1TB/100GB-hour/100GB behind a $25 platform fee. Something changed; verify on `axiom.co/pricing`.
3. **Clerk's free tier metric** — most 2026 sources say 10K MAU free; merginit claims 50,000 **MRU** on Hobby. "MRU" (monthly regular users?) may be a 2026 pricing rebrand. Verify on `clerk.com/pricing` — determines whether Clerk belongs on the rejects list permanently.

## Architecture recommendation (for the master plan)

```
[Uptime Kuma (server)] ←→ [Upptime (GitHub, off-server)]     # two independent watchers
   + healthchecks.io pings for every n8n cron / backup job
[Status page]: Instatus Starter free (15 monitors, 2-min, 200 subs) or Upptime Pages
[Errors]: Sentry Developer (managed) + GlitchTip (self-host overflow / zero-data-leak option)
[Logs]: Grafana Cloud Loki 50GB + Axiom 500GB for volume; Better Stack 1–3GB tail
[Analytics]: Cloudflare Web Analytics (zero-ops) + PostHog 1M events + Umami self-host (privacy)
[Auth]: Authentik self-host (company SSO) + Logto managed (customer auth, 50K free)
[Server gate]: Authelia forward-auth 2FA on every internal dashboard
[Flags]: PostHog flags primary; Unleash self-host for the Rust/GIS stack
[Secrets]: Infisical self-host; Doppler free as cloud backup
```
