# Cloudflare Tunnel architecture — SurrealDB on Cloudflare, done right

## The honest framing (read this first)

**Cloudflare Workers cannot run a SurrealDB server.** Workers are stateless,
short-lived isolates: no persistent TCP listeners, no local disk, and the free
tier has hard CPU-time walls per request. SurrealDB is a real database
process — it needs an always-on socket, memory, and a disk file. Any guide
claiming "SurrealDB on Workers" is either (a) talking about the SurrealDB
*client* (WASM in the browser/worker talking to a remote DB — fine, and we use
that pattern), or (b) selling you something.

The $0-correct design, and what this stack implements:

```
                    ┌──────────────────────────── Cloudflare edge ────────────────────────────┐
                    │  AI router (Worker)   heartbeat ingest (Worker + D1 + KV)  Pages          │
                    │  stateless, global, no disk — the right home for edge compute            │
                    └──────────────────────────────────┬──────────────────────────────────────┘
                                                       │ HTTPS
                    ┌──────────────────────────────────┴──────────────────────────────────────┐
                    │  Cloudflare Tunnel (free) — OUTBOUND-ONLY from your server               │
                    │  no open ports · no static IP · edge TLS + DDoS shielding                │
                    └──────────────────────────────────┬──────────────────────────────────────┘
                                                       │ encrypted tunnel
┌────────────────────────── your server ──────────────┴───────────────────────────────────────┐
│  cloudflared ──► SurrealDB :8000 (graph DB, file:/data)                                     │
│              ──► n8n :5678 (automation, behind Access)                                      │
│              ──► Uptime Kuma :3001 (monitoring / status page)                               │
│  everything still 127.0.0.1-bound locally — the tunnel is the ONLY internet path            │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

Two lanes, each doing what it's good at:

| Lane | Lives on | Good for | Bad for |
|---|---|---|---|
| **Workers-native** | Cloudflare edge | AI router, heartbeat ingest, static Pages, cron triggers | anything with a disk, a socket, or state |
| **Behind the tunnel** | your server | SurrealDB, n8n, Uptime Kuma — stateful, long-lived | global low-latency (it's one box, that's fine) |

## What goes behind the tunnel (and why)

- **SurrealDB (:8000)** — the graph/document DB for CuteCity GIS + Lucidota
  memory. HTTP + WebSocket both proxied by cloudflared. Clients (Workers,
  n8n, your laptop) talk to `https://db.<yourdomain>` with the root creds —
  same as localhost, now reachable anywhere.
- **n8n (:5678)** — admin UI + webhooks. Webhooks get a stable public URL
  (useful: third-party services can call back without Tailscale). Admin UI
  goes behind **Cloudflare Access** (below) — never bare on the internet.
- **Uptime Kuma (:3001)** — status page can be public; admin login stays
  behind Access.

Deliberately NOT behind the tunnel: postgres/redis/mongo (internal only,
no reason to ever expose), Infisical/Vaultwarden (vault UIs stay local-only
or tailnet-only — a secrets manager on the public internet is a liability
you don't need), Authentik (tailnet-only; it's the SSO front door, keep it
off the public edge until you need it), LibreTranslate/SearXNG (local tools).

## Cloudflare Access / Zero Trust on the free tier

The free Zero Trust tier includes **50 Access seats** — more than enough:

1. **Access application for `n8n.<domain>`** — policy: allow only your email
   (one-time PIN or Google/GitHub IdP). This replaces exposing n8n's login
   to the internet; the first-visit admin wizard stays unclaimable.
2. **Access application for `status.<domain>`/admin paths** — or leave the
   status page public and Access-protect `/dashboard`.
3. **Service tokens** for machine-to-machine: if a Worker or GitHub Action
   ever needs to call n8n webhooks through the tunnel, mint a service token
   (Client ID + secret as headers) instead of weakening the Access policy.
   (Today nothing needs this — n8n calls the Worker, not the reverse.)
4. **WAF**: free tier includes managed rules on the tunnel hostnames —
   turn on Bot Fight Mode for the n8n hostname.

What the free tier does NOT give you: Tunnel is unlimited and free (bandwidth
included); Access beyond 50 seats and advanced DLP are paid — irrelevant here.

## What Zackary does (dashboard steps, ~15 min, $0, no card)

1. **Domain on Cloudflare** (if not already): add site, point nameservers.
   Free plan is fine.
2. **Zero Trust dashboard → Networks → Tunnels → Create tunnel**,
   name it `freestack`. Copy the **token**.
3. **`.env`**: set `CLOUDFLARE_TUNNEL_TOKEN=<the token>` (it's a secret —
   treat like a password; never paste in chat).
4. **Edit `cloudflared/config.yml`**: replace the three `*.example.com`
   hostnames with your real ones.
5. **Back in the dashboard, same tunnel → Public Hostnames**: add the three
   hostnames (Service: HTTP, URL: `surrealdb:8000` / `n8n:5678` /
   `uptime-kuma:3001` — or just let the config file drive it; dashboard
   entries create the DNS CNAMEs automatically).
6. **Start it**: `docker compose --profile tunnel up -d cloudflared`
   (slim mode: add both `-f` flags as in DEPLOY.md §3).
7. **Verify**: `docker compose logs cloudflared` shows "Registered tunnel
   connection"; `curl https://db.<domain>/health` answers.
8. **Access**: Zero Trust → Access → Applications → add `n8n.<domain>`,
   policy Allow + your email. Test in an incognito window.

## Security notes

- The tunnel is **outbound-only**: your firewall can stay default-deny
  inbound. There is no listening socket for an attacker to find.
- All compose ports remain **127.0.0.1-bound** — the tunnel container talks
  to services over the internal `freestack` network, not via the host.
- SurrealDB root creds (`SURREAL_PASS`) now protect an internet-reachable
  endpoint: they must be strong (generated, 32 hex chars) and unique.
  Consider creating a least-privilege DB user for app clients later and
  keeping `root` for admin only.
- `cloudflared` runs with no published ports and a read-only config mount.
  Pin its image digest after the first green deploy (same rule as §1c).
- Token rotation: if `CLOUDFLARE_TUNNEL_TOKEN` ever leaks, delete the tunnel
  in the dashboard (kills all connections instantly), create a new one,
  update `.env`, restart the service.

## Compartmentation (standing rule)

The tunnel carries **fragments, never the whole picture**: SurrealDB holds
graph/memory data, n8n holds workflow logic, the AI router holds no state at
all. Cloudflare sees encrypted tunnel traffic and edge requests — it never
holds your DB file, your n8n credentials, or your vault. That stays on your
box.
