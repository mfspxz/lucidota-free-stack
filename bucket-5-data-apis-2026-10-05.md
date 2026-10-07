# Bucket 5 — Data APIs (deep sweep) · 2026-10-05

Operation FreeStack research. **~110 raw candidates** screened across web search, maps/geocoding, weather, translation, TTS/STT, IP geolocation, currency, news, market data, company/WHOIS/DNS, time/holidays, and misc utility APIs. Shortlist: top 15, each with a per-service record. Trinary = PROVEN / DISPROVEN / UNKNOWN on every claim.

## Ranked shortlist (top 15)

### 1. Tavily — web search (primary)
- URL: https://tavily.com / https://docs.tavily.com
- Free limits: **1,000 credits/month, no card.** Basic search = 1 credit (~1,000 searches/mo). Extract = 1 credit/5 URLs. Acquired by Nebius Feb 2026; team intact.
- Signup friction: email signup, instant API key. No card, no phone.
- ToS gotchas: credit-based; advanced search = 2 credits; free tier "Researcher" plan.
- Jurisdiction: US (Nebius-owned).
- Trinary: **PROVEN** — multiple 2026 sources + official pricing page agree.
- Redundancy role: primary web search for the agent (LangChain/LlamaIndex/MCP integrations).
- Verdict: **FRIEND** — no-card, genuinely recurring free tier, agent-native output.

### 2. Exa — semantic search + content extraction
- URL: https://exa.ai
- Free limits: **$20 one-time signup credits + $10/month recurring credits**, no card (≈1,000–1,400 standard searches/mo; /search ~$7/1K; /contents, /answer separate meters).
- Signup friction: email signup, no card. Auth header `x-api-key`.
- ToS gotchas: no balance/usage endpoint on the public API (can't read remaining credits programmatically); 402 = credit exhaustion; free credit rollover unverified.
- Jurisdiction: US.
- Trinary: **PROVEN** — official pricing page + live probes (2026-08) agree on $20 + $10/mo.
- Redundancy role: semantic discovery + clean page-text extraction (RAG).
- Verdict: **FRIEND** — best recurring no-card semantic search deal.

### 3. GDELT DOC 2.0 API — news discovery (primary)
- URL: https://api.gdeltproject.org/api/v2/doc/doc
- Free limits: **unlimited, no key.** 15-minute batch latency, up to 250 ArticleList records/query. Polite ~1 request/5s per client.
- Signup friction: none. Zero config.
- ToS gotchas: GDELT terms allow **unlimited, unrestricted academic/commercial/government use**. It's an index, not a publisher — article content must be fetched from source URLs.
- Jurisdiction: US.
- Trinary: **PROVEN** — terms explicitly permit commercial use; API shape widely documented.
- Redundancy role: primary news discovery/monitoring feed.
- Verdict: **FRIEND** — the strongest free news deal in existence.

### 4. NewsData.io — news fallback
- URL: https://newsdata.io
- Free limits: **200 credits/day free** (a search page costs ~2 credits ≈ 100 pages/day), no card; real-time, ~85K sources, 80+ languages.
- Signup friction: email signup, instant key.
- ToS gotchas: free tier likely dev/testing-oriented; check archive depth on free before depending on history.
- Jurisdiction: India.
- Trinary: **PROVEN** (200 credits/day confirmed July–Sept 2026; numbers change often — recheck before wiring).
- Redundancy role: news fallback when GDELT coverage shape doesn't fit.
- Verdict: **NEUTRAL** — good volume, thinner than GDELT's commercial grant.

### 5. Open-Meteo — weather (primary)
- URL: https://open-meteo.com
- Free limits: **10,000 calls/day, 5,000/hour, 600/min. No key, no signup.** Weighted accounting (requests with >10 variables or >2-week ranges count as multiple calls). 16-day forecasts, ERA5 archive to 1940, marine, air quality, elevation endpoints.
- Signup friction: none.
- ToS gotchas: **free tier is NON-COMMERCIAL ONLY** + CC-BY 4.0 attribution ("Weather data by Open-Meteo.com"). Paid plans unlock commercial use on a dedicated endpoint. No SLA.
- Jurisdiction: Switzerland.
- Trinary: **PROVEN** — official terms page quoted verbatim across 2026 sources.
- Redundancy role: primary weather, zero-friction.
- Verdict: **NEUTRAL** — unbeatable ergonomics, but the non-commercial clause is a hard ceiling for a company stack.

### 6. MET Norway Locationforecast 2.0 — weather fallback
- URL: https://api.met.no (Locationforecast 2.0)
- Free limits: **no key; 20 req/s.** Mandatory identifying User-Agent (name + contact) or 403.
- Signup friction: none.
- ToS gotchas: commercial use allowed under Norwegian licence (NLOD)/CC-BY with attribution. Norway-only alerts, but global forecast coverage.
- Jurisdiction: Norway.
- Trinary: **PROVEN** — long-standing, official policy.
- Redundancy role: commercial-safe weather fallback.
- Verdict: **FRIEND** — the commercial-safe answer to Open-Meteo's non-commercial clause.

### 7. OSM Nominatim — geocoding (primary)
- URL: https://nominatim.openstreetmap.org
- Free limits: **no key; hard 1 req/second** per application. Forward + reverse geocoding.
- Signup friction: none (but set a descriptive User-Agent).
- ToS gotchas: public instance is for light use; **no autocomplete, no bulk/systematic queries**; results must be cached; reselling geocoding results prohibited. Self-host for volume.
- Jurisdiction: UK (OpenStreetMap Foundation).
- Trinary: **PROVEN** — official usage policy.
- Redundancy role: primary geocoding.
- Verdict: **FRIEND** — truly free forever, rules are written down and stable.

### 8. Mapbox — maps + geocoding + routing
- URL: https://www.mapbox.com/pricing
- Free limits: **50,000 map loads/mo, 100,000 geocoding req/mo, 100,000 directions/matrix/isochrone req/mo each.** Token auth.
- Signup friction: email signup. **Card requirement: UNKNOWN — mixed reports** (one 2026 audit says card required at signup; others say no card to start).
- ToS gotchas: Search Box sessions only 500/mo (first quota an indie blows); commercial use allowed on free tier.
- Jurisdiction: US.
- Trinary: **PROVEN on limits; UNKNOWN on card requirement.**
- Redundancy role: map rendering + geocoding/routing headroom when Nominatim/ORS aren't enough.
- Verdict: **NEUTRAL** — generous, but the card question is unresolved.

### 9. OpenRouteService — routing (primary)
- URL: https://openrouteservice.org
- Free limits: **2,000 directions requests/day, 40 req/min** (+ isochrones, distance matrix). Free token, **no card**.
- Signup friction: email signup, token self-serve.
- ToS gotchas: daily quotas tied to token; fair-use; self-hostable via Docker.
- Jurisdiction: Germany (HeiGIT / Heidelberg University).
- Trinary: **PROVEN** — consistent across 2025–2026 sources and official docs.
- Redundancy role: primary routing (driving/cycling/walking, GeoJSON, turn-by-turn).
- Verdict: **FRIEND** — best free hosted routing deal; OSRM public server as zero-key fallback.

### 10. Frankfurter — FX rates (primary)
- URL: https://www.frankfurter.app (API: https://api.frankfurter.app)
- Free limits: **unlimited, no key, no rate limits.** ECB reference rates, daily ~16:00 CET, history since 1999. ~33 currencies.
- Signup friction: none. Also self-hostable (MIT, Docker).
- ToS gotchas: reference rates (weekday close), not live market quotes. Don't present as buy/sell prices.
- Jurisdiction: Germany.
- Trinary: **PROVEN**.
- Redundancy role: primary currency conversion.
- Verdict: **FRIEND** — the perfect free API specimen.

### 11. ExchangeRate-API — FX fallback
- URL: https://www.exchangerate-api.com
- Free limits: **1,500 req/mo free** (keyed, daily updates) + **keyless Open Access endpoint** (`https://open.er-api.com/v6/latest/{CUR}`) for low-volume/dev.
- Signup friction: email signup for key.
- ToS gotchas: free = daily updates (paid = hourly/5-min); 161 currencies.
- Jurisdiction: US.
- Trinary: **PROVEN** — official plans table.
- Redundancy role: FX fallback / non-ECB currencies.
- Verdict: **FRIEND** — keyless open endpoint is the FreeStack-friendly part.

### 12. DeepL API Free — translation (primary)
- URL: https://www.deepl.com/pro-api
- Free limits: **500,000 characters/month free**, key (ends `:fx`, uses `api-free.deepl.com`).
- Signup friction: email signup. No card reported for API Free.
- ToS gotchas: **one report (Oct 2026) says new accounts may get different structures (monthly quota vs one-time credit vs pay-as-you-go) depending on signup date** — verify at signup. Free tier excludes glossary/custom features.
- Jurisdiction: Germany.
- Trinary: **PROVEN with a caveat** — 500K/mo widely confirmed; new-account structure in flux.
- Redundancy role: primary translation.
- Verdict: **FRIEND** — huge volume, best-in-class quality, zero card.

### 13. LibreTranslate (self-hosted) — translation fallback
- URL: https://github.com/LibreTranslate/LibreTranslate
- Free limits: **unlimited on your own server** (AGPL, Docker: `docker run -p 5000:5000 libretranslate/libretranslate`).
- Signup friction: none (compute is the cost).
- ToS gotchas: **public libretranslate.com now requires a paid key** — self-host is the free route. Quality below DeepL/LLMs; AGPL if you modify/distribute.
- Jurisdiction: community open-source.
- Trinary: **PROVEN** — public-instance paywall confirmed 2026; self-host free.
- Redundancy role: offline/private translation fallback on his own server.
- Verdict: **FRIEND** — matches the "he has a server" leg of FreeStack.

### 14. Groq Whisper — STT (primary)
- URL: https://console.groq.com/docs/speech-to-text
- Free limits: **whisper-large-v3/v3-turbo free tier: 2,000 req/day, 7,200 audio-seconds/hour, 28,800 audio-seconds/day (≈8 h/day).** OpenAI-compatible endpoint.
- Signup friction: email signup, instant `gsk_` key, no card.
- ToS gotchas: rate limits are org-level (key rotation doesn't help); the binding constraint is audio-seconds, not requests.
- Jurisdiction: US.
- Trinary: **PROVEN** — consistent 2026 reporting + official docs.
- Redundancy role: primary speech-to-text.
- Verdict: **FRIEND** — daily reset means effectively unlimited STT for a solo founder.

### 15. Google Cloud TTS — TTS (primary)
- URL: https://cloud.google.com/text-to-speech
- Free limits: **1M characters/month free** (Standard + WaveNet/Neural2 voices historically; confirm current voice-type split on pricing page).
- Signup friction: Google Cloud project; **card required** (but usage inside 1M chars costs $0). $300/90-day trial for new accounts.
- ToS gotchas: commercial use allowed on free tier; overage = $4–16/1M chars.
- Jurisdiction: US.
- Trinary: **PROVEN** (1M chars/mo consistent across 2026 sources; exact voice-type coverage needs a pricing-page check).
- Redundancy role: primary text-to-speech.
- Verdict: **NEUTRAL** — generous and commercial-safe, but GCP's card + project setup is the heaviest friction on this list.

## Runner-ups (strong, just outside top 15)
- **Serper** — 2,500 one-time credits, no card. Best free sandbox for Google SERPs, but one-time → NEUTRAL. Legal overhang: Google sued SerpApi (Dec 2025) — sector risk.
- **SerpApi** — 250 searches/mo recurring, no card → thin but durable; NEUTRAL.
- **DuckDuckGo Instant Answer API** — keyless JSON (quick facts, definitions, Wikipedia abstracts). Not a SERP replacement. PROVEN, FRIEND for zero-cost fact lookups.
- **You.com free MCP** — reported 100 searches/day, no signup — single-source, needs verification → UNKNOWN.
- **Jina Reader** — keyless `https://r.jina.ai/` URL-to-text; 10M tokens per new key with free signup → FRIEND for page extraction.
- **SearXNG** — self-hosted metasearch, AGPL, unlimited → FRIEND for the self-host leg.
- **OCR.space** — 25,000 req/mo free, key by email, no card, 1MB/file limit → FRIEND.
- **Nager.Date** — public holidays, 100+ countries, no key, no rate limits → FRIEND.
- **IPinfo Lite** — free token; unlimited country-level geo + ASN; requires CC BY-SA attribution → FRIEND.
- **ipapi.co** — keyless 1,000/day; 30K/mo with free account → NEUTRAL (history of instability).
- **Geoapify** — 3,000 credits/day, no card, "limited commercial use" allowed → FRIEND (geocoding fallback).
- **LocationIQ** — 5,000 req/day, commercial OK with attribution → FRIEND (geocoding fallback).
- **OSRM public server** — free, no key, demo routing → FRIEND (routing fallback).
- **WeatherAPI.com** — 100K calls/mo free, key. Commercial status + attribution rules need a live terms read → NEUTRAL/UNKNOWN.
- **Tomorrow.io** — 500/day free, but **non-commercial only** → NEUTRAL.
- **MET Norway** already in shortlist; **NWS api.weather.gov** (US-only, public domain, alerts) → FRIEND for US.
- **MyMemory** — ~5K chars/day anonymous, ~50K with free email → FRIEND (translation fallback #2).
- **Microsoft Translator (Azure)** — reported 2M chars/mo free tier — single-source 2026 claim → UNKNOWN, worth verifying.
- **Azure Speech F0** — 5h STT + 0.5M chars TTS/mo free, but Azure account + card friction → NEUTRAL.
- **ElevenLabs** — 10K chars/mo free but non-commercial + attribution → FOE for a company stack.
- **Deepgram** — $200 one-time credit, no card → NEUTRAL (one-time).
- **AssemblyAI** — trial credits only → NEUTRAL.
- **Twelve Data** — 800 calls/day free but **"internal non-display use"** license → FOE for user-facing apps.
- **Finnhub** — 60 calls/min free but **non-commercial** → NEUTRAL.
- **FRED (St. Louis Fed)** — free key, 120 req/min, macro series → FRIEND.
- **SEC EDGAR** — 10 req/sec, no key, commercial OK → FRIEND.
- **CoinGecko** — keyless free (~30 calls/min) → FRIEND.
- **Coinbase exchange-rates endpoint** — keyless → FRIEND.
- **Google DNS-over-HTTPS / Cloudflare DNS-over-HTTPS** — free, keyless DNS lookups → FRIEND.
- **RDAP (rdap.org)** — free, keyless WHOIS successor → FRIEND.
- **Wikipedia REST API, OpenAlex, Crossref, Semantic Scholar, arXiv, Open Library** — all free keyless → FRIEND (research data).
- **HERE** — Freemium 250K transactions/mo (card) / Limited 1,000/day (no card); commercial eligibility of free tier unclear → UNKNOWN.
- **TomTom** — 2,500 transactions/day free → NEUTRAL (runner-up geo).
- **Foursquare Places** — 10K Pro calls/mo + $200 credit; one source says free dropped to 500/mo in June 2026 → NEUTRAL, verify.
- **Google Maps Platform** — $200/mo recurring credit + Embed API unlimited free; card required, overage billing risk → NEUTRAL/FOE (keep as embed-only).
- **Microlink** — 50 URL-previews/day free → NEUTRAL/FRIEND.
- **timeapi.world** — 20K req/mo free, worldtimeapi.org drop-in → FRIEND.
- **GeoNames** — 30K credits/day, 2K/hour, free username → FRIEND (gazetteer/timezone/elevation reference).
- **Sunrise-Sunset, USGS earthquakes, REST Countries, ipify, httpbin, randomuser.me, JSONPlaceholder, goqr.me, HN Algolia, npm registry, GitHub REST (public read)** — all keyless free → FRIENDS (utility layer).

## Notable rejects (with why)
1. **Brave Search API** — free tier **killed Feb 2026**; now $5/mo credit (~1,000 queries), **card required** at signup, metered billing with no cap. FOE.
2. **NewsAPI.org Developer** — 100 req/day free but **dev/testing only, 24h delay, no production/commercial use**, CORS-blocked off localhost. FOE for a company stack.
3. **GNews** — same pattern: 100/day, 12h delay, dev/testing. FOE.
4. **ip-api.com** — free endpoint is **HTTP-only, 45 req/min, and explicitly non-commercial**. FOE.
5. **Stadia Maps / MapTiler free** — free tiers are **non-commercial/eval-only** by contract. FOE.
6. **OpenCage free** — 2,500/day but **"testing only," no commercial use**. FOE.
7. **Google Translate API** — paid-only (~$20/1M chars); the free web endpoint is unofficial/ToS-grey. FOE.
8. **OpenWeatherMap One Call 3.0** — 1,000/day free but **overage is the default**: subscribing sets a 2,000/day cap and bills 1,001–2,000 at month-end. Billing trap. FOE.
9. **ElevenLabs free** — 10K chars/mo but **non-commercial + attribution required**. FOE.
10. **Alpha Vantage** — degraded to **25 req/day**. FOE (too thin).
11. **Stooq** — now serves anti-bot verification pages instead of data. REJECTED.
12. **Yelp Fusion** — free tier ended; ~$8/1K calls now. FOE.
13. **Weatherstack** — 250/mo free. Too thin. FOE.
14. **Weatherbit** — 50/day, non-commercial. FOE.
15. **Lingva / unofficial Google Translate endpoints** — no stated quota, throttled/blocked, against Google's ToS. FOE (brittle).
16. **Serper** (one-time only) and **Deepgram** ($200 one-time) — fine sandboxes, not durable free tiers. NEUTRAL, not shortlist.
17. **Currents API / Mediastack / Newscatcher / Perigon** — free tiers exist but thin, delayed, or trial-only; GDELT dominates them. Rejected on fit.
18. **Polygon/Massive free** — 5 calls/min, 15-min delayed EOD only. NEUTRAL; Twelve Data covers the same niche better.
19. **timeapi/worldtimeapi.org** (original) — known downtime; replaced by timeapi.world. FOE on reliability.
20. **Bing Web Search API (Azure)** — pay-as-you-go, card required, no meaningful free tier. FOE.

## Raw candidate tally (~110 screened)
- Web search: Brave, Tavily, Serper, Exa, SerpApi, Linkup, You.com, Perplexity Sonar, Jina Reader, DDG Instant Answer API, SearXNG, Bing Web Search, Google CSE (100/day), Google Search Console API
- Maps/geo: Nominatim, Photon, Overpass, OSRM, OpenRouteService, Mapbox, Google Maps, HERE, TomTom, Geoapify, LocationIQ, OpenCage, Stadia, MapTiler, Thunderforest, Foursquare, GraphHopper, OSM tiles, CARTO, Stamen, Radar, GeoNames, opentopodata, Zippopotam, REST Countries
- Weather: Open-Meteo, MET Norway, NWS, ECCC GeoMet, OpenWeatherMap, WeatherAPI.com, Tomorrow.io, Meteosource, Weatherbit, Visual Crossing, Weatherstack, Bright Sky, Pirate Weather
- Translation: DeepL, LibreTranslate, MyMemory, Lingva, Google Translate, Microsoft Translator, Argos Translate, Yandex
- TTS/STT: Google Cloud TTS, Azure Speech, ElevenLabs, Groq Whisper, Deepgram, AssemblyAI, Soniox, Whisper self-host, Piper, Kokoro, Coqui XTTS, eSpeak-NG
- IP geo: ip-api, IPinfo Lite, ipapi.co, ipwho.is, MaxMind GeoLite2, DB-IP Lite, IP2Location LITE, GeoJS
- Currency: Frankfurter, ExchangeRate-API, open.er-api.com, exchangerate.host, FreeCurrencyAPI, CurrencyAPI, Coinbase rates, CoinGecko, Binance public
- News: GDELT, NewsAPI, GNews, NewsData.io, Currents, Mediastack, Newscatcher, Perigon, NewsMCP, plain RSS
- Market data: FRED, Stooq, Twelve Data, Finnhub, FMP, Alpha Vantage, Tiingo, Nasdaq Data Link, SEC EDGAR, Yahoo Finance (unofficial), Massive/Polygon, EODHD, CBOE VIX CSV
- Company/WHOIS/DNS: OpenCorporates, UK Companies House, OpenFIGI, RDAP, whoisxmlapi, Google DoH, Cloudflare DoH
- Time/holidays: Nager.Date, worldtimeapi.org, timeapi.world, TimezoneDB, Calendarific, GeoNames TZ
- Utility: Wikipedia, OpenAlex, Crossref, Semantic Scholar, CORE, arXiv, Open Library, OCR.space, Microlink, ipify, Sunrise-Sunset, USGS quakes, HN Algolia, npm registry, GitHub REST public, goqr.me, JSONPlaceholder, randomuser.me

## Top 3 unknowns worth resolving
1. **WeatherAPI.com free plan — commercial use allowed?** 100K calls/mo confirmed, but the ToS on commercial production use + attribution rules is ambiguous across sources. A live read of weatherapi.com/terms is the decider; if commercial-OK with attribution, it becomes the weather primary over Open-Meteo.
2. **Mapbox signup — is a credit card actually required for the free tier in 2026?** Mixed reports. If no card, Mapbox is the clearest FRIEND on the list; if card, it's still fine but behind ORS+Nominatim. Five minutes on mapbox.com/signup answers it (without submitting).
3. **You.com free MCP (reported 100 searches/day, keyless) and Linkup ($20/mo recurring refill)** — both appeared in one curated list only. If either is real and API-callable, You.com becomes a keyless search reserve and Linkup joins the Tavily/Exa rotation. Verify on their pricing/docs pages.

## Cross-cutting findings
- **2026 is the year of the free-tier die-off**: Brave killed its free tier (Feb), MinIO archived open-source, Alpha Vantage collapsed to 25/day, Yelp ended Fusion free, Stooq went anti-bot, libretranslate.com paywalled its public instance. Prefer vendors whose free tier is structural (keyless public goods, self-host options, or credit models that refill monthly).
- **Non-commercial traps are everywhere**: Open-Meteo, Tomorrow.io, ip-api, Stadia, MapTiler, OpenCage, ElevenLabs, Finnhub, Twelve Data (non-display) all ban or restrict commercial use. For a *company* stack, the commercial-safe backbone is: Tavily/Exa (search), GDELT (news), MET Norway (weather), Nominatim/ORS/Mapbox (geo), Frankfurter (FX), DeepL (translation), Groq (STT), Google TTS (TTS).
- **No-card champions** (frictionless, durable): Frankfurter, Nager.Date, GDELT, Nominatim, Open-Meteo, MET Norway, RDAP, Google/Cloudflare DoH, Wikipedia/OpenAlex/Crossref/arXiv, ipapi.co keyless tier, DDG Instant Answer API, timeapi.world, OCR.space (key, no card), Geoapify (key, no card), LocationIQ (key, no card), OpenRouteService (key, no card), Exa (key, no card), Tavily (key, no card), Serper (key, no card, one-time), Groq (key, no card).
- **Card-required but legit**: Google Cloud TTS, Azure Speech F0, Mapbox (unverified), Brave ($5 credit — rejected anyway), Google Maps ($200 credit — rejected except embeds).
- **Self-host leg** (he has a server): LibreTranslate, SearXNG, Whisper, Piper/Kokoro TTS, Nominatim, ORS, Frankfurter — all Docker-able, truly $0 at scale.
