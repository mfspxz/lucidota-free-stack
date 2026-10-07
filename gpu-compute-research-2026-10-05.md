# BUCKET 6 — GPU/Compute + Developer Credit Programs
**Researched:** 2026-10-05 (web sources crawled Aug–Oct 2026)
**Raw candidates swept:** ~50 → shortlisted 12

---

## A. NVIDIA — BUDDY-CLAIM VERDICT

Buddy's claim: *"NVIDIA's developer program is way more open — no credit card, unlimited use, train on whatever."*

**Trinary per sub-claim:**

| Sub-claim | Verdict | Evidence |
|---|---|---|
| **No credit card** | ✅ **PROVEN** | NVIDIA Developer Program signup is free, no card. `build.nvidia.com` free tier: "no credit card required," API key signup with email only (cryptobriefing.com, Jul 2026; sidsaladi.substack.com; aitoolsmentor.com). |
| **Unlimited use** | ❌ **DISPROVEN** | NIM free tier: 40 RPM + 10,000 req/day rate model (finite-credit model retired Oct 2026 — see unknowns-resolved-2026-10-05.md #6); no SLA, peak-hour slowdowns. Even in the most generous reading, RPM throttling + no SLA mean it is NOT unlimited. |
| **Train on whatever** | ❌ **DISPROVEN** | NIM free tier is **inference-only**: "You cannot fine-tune models on the free tier. What NVIDIA hosts is what you get" (aitoolsmentor.com). NIM *containers* are free to self-host for dev on up to 16 of your own GPUs, then ~$4,500/GPU/yr AI Enterprise for production (sidsaladi). NGC catalog access = free downloads of models/containers to run on YOUR hardware — no free training GPU hours anywhere in the developer program. |

**Overall verdict: PARTIALLY PROVEN, mostly deflated.** No-card inference API with a generous free tier is real — best-in-class for free LLM API (46–100+ models: Llama, DeepSeek, Qwen, Nemotron). But there is no free training GPU, and "unlimited" is false. The funnel logic is transparent: NVIDIA is buying future customers.

### NVIDIA Inception — does a solo pre-revenue founder qualify?

- ✅ **Free, no equity, no deadline, rolling applications** (PROVEN — NVIDIA docs via opportunitiesfeed.com, LinkedIn Jagan Yetukuri post).
- ✅ No revenue required, no funding required, any stage OK (PROVEN).
- ❌ **Must be officially incorporated** (PROVEN). Also: <10 years old, ≥1 developer, working website.
- ❌ **Zackary does NOT qualify today** (he is not incorporated). If/when he incorporates CuteCity, he becomes eligible — pre-revenue solo founders ARE accepted once incorporated.
- Benefits (PROVEN): free DLI courses, SDK/model access, **cloud credits from NVIDIA + partners**, hardware discounts, VC intros (Inception Capital Connect).
- 🔑 Unlock: **Lambda × Inception: $7,500 in Lambda GPU cloud credits**, exclusive to Inception members (verified 2026-09-14 by tayyabakmal1/free-startup-credits). Requires Inception membership → requires incorporation first.

---

## B. RANKED SHORTLIST (top 12)

Role key: **training** = model fine-tunes/batch jobs; **inference** = API calls; **sandbox** = dev environment.

### 1. Kaggle Notebooks — the training workhorse
- **URL:** https://www.kaggle.com
- **Free limits:** 30 GPU-hours/week (one shared pool), T4 ×2 or P100 per session, ~12h max session, ~20 min idle. TPU pool separate: ~20h/week TPU v3/v5e.
- **Signup friction:** Low — account + phone verification unlocks GPU/internet. No card.
- **Gotchas:** P100 reportedly retired Sep 15 2026 (YouTube source; official docs still list P100 — treat as UNKNOWN); P100 (sm_60) is incompatible with current PyTorch/Python 3.12 stacks, so auto-assigned P100 sessions can be useless — re-push to get T4. Commercial use: ToS ambiguous; intended for learning/personal use.
- **Verdict:** PROVEN (official Kaggle docs + multiple 2026 guides). **Role: weekly batch training + fine-tunes.** Friend — biggest reliable free training pool.

### 2. Google Colab (free tier) — training backup
- **URL:** https://colab.research.google.com
- **Free limits:** No published quota; typically T4 (15GB), up to ~12h sessions, ~90 min idle timeout, availability fluctuates; priority goes to paying/Google AI subscribers (Sep 2026 change).
- **Signup friction:** Google account, no card.
- **Gotchas:** FAQ bans hosting web apps/UIs, SSH/remote desktop, crypto mining, bypassing notebook UI. Ephemeral VMs — save to Drive. No SLA.
- **Verdict:** PROVEN. **Role: overflow training + quick experiments.** Friend.

### 3. NVIDIA NIM free tier (build.nvidia.com) — inference backbone
- **URL:** https://build.nvidia.com
- **Free limits:** 100+ hosted models (Llama, DeepSeek, Qwen, Nemotron...), ~40 req/min, no card. OpenAI-compatible endpoints.
- **Gotchas:** No fine-tuning; no SLA/peak-hour spikes; models can be deprecated with days' notice; ToS says commercial use of *generated code* is fine, but don't build customer-facing products on the endpoint (no production guarantees).
- **Verdict:** PROVEN. **Role: 24/7 free inference API for the AI company stack.** Friend — strongest free inference tier found.

### 4. Beam.cloud — best recurring serverless GPU budget (verify no-card)
- **URL:** https://www.beam.cloud
- **Free limits:** **$30 credit refreshed monthly** on Developer plan (quoted verbatim from beam.cloud/pricing, re-checked 2026-08-09 by gpuhire/CLAUDE.md; corroborated by awesome-agent-sandboxes). ≈ 50h T4 / 43h RTX 4090 / 8.6h H100 equivalent per month.
- **Signup friction:** Reported no card needed — verify on current pricing page.
- **Gotchas:** Rollover unconfirmed (assume use-it-or-lose-it); per-second serverless billing; AGPL-3.0 runtime if self-hosted.
- **Verdict:** $30/mo refreshed PROVEN (2 independent sources); **no-card status UNKNOWN** (one source). **Role: monthly serverless GPU budget for inference endpoints/batch jobs.** Friend if no-card holds.

### 5. Lightning AI Studios — dev environment + monthly GPU credits
- **URL:** https://lightning.ai
- **Free limits:** "Up to 80 free GPU hours to start" with ~30 starter credits; then **15 credits/month ≈ 15–22 T4-hours** (official pricing page + multiple 2026 guides). 1 free CPU Studio 24/7 (restarts every 4h), 50GB storage. No card.
- **Gotchas:** ⚠️ CONFLICT — one 2026 source claims Lightning stopped monthly credits in Aug 2026; official page (Sep 24) still shows monthly credits. Unresolved.
- **Verdict:** Free tier exists PROVEN; **monthly refresh UNKNOWN** — must re-check pricing page. **Role: persistent dev workspace + monthly training burst.** Neutral until resolved.

### 6. Hugging Face ZeroGPU — demo bursts on Blackwell iron
- **URL:** https://huggingface.co/docs/hub/en/spaces-zerogpu
- **Free limits:** 5 GPU-minutes/day free on **RTX Pro 6000 Blackwell (48GB)** shared pool; Gradio-only; host up to 2 ZeroGPU Spaces (account 30+ days). Also $0.10/mo inference credits + 8 free CPU Space units.
- **Gotchas:** Not for training (per-call <120s); quota resets 24h after first use, not at midnight; Gradio SDK only.
- **Verdict:** PROVEN (official HF docs). **Role: free public demo hosting for models.** Friend.

### 7. Google TPU Research Cloud (TRC) — the big-training lottery ticket
- **URL:** https://sites.research.google/trc
- **Free limits:** Free Cloud TPU quota (v4/v5e/v6e, up to pod-scale) granted to a GCP project, temporary/renewable.
- **Signup friction:** Short application + rolling approval; GCP account needed (small VM/driver costs ~$2/mo after trial).
- **Gotchas:** Must share work publicly (paper/open source/blog) + follow Google AI Principles. TPU programming is JAX/XLA-flavored — learning curve.
- **Verdict:** PROVEN (official FAQ). **Role: train-from-scratch / heavy fine-tunes if accepted.** Friend.

### 8. AWS Activate (Founders tier) — self-serve cloud credits
- **URL:** https://aws.amazon.com/startups/lp/aws-activate-credits
- **Free limits:** Up to **$1,000** (older docs) / up to **$5,000** (2026 sources) for self-funded founders, no partner needed. Credits usable on EC2 GPU instances + Bedrock.
- **Signup friction:** AWS account (card usually required at signup); must be pre-Series B, <10 yrs, functioning website, non-Gmail corporate email.
- **Gotchas:** Credits valid ~2 yrs; higher tiers ($100K–$200K) need VC/accelerator Org ID — not available to him now.
- **Verdict:** PROVEN exists; exact self-serve amount varies by source ($1K–$5K). **Role: GPU overflow budget once any revenue exists.** Neutral.

### 9. Microsoft for Startups Founders Hub — self-serve Azure credits
- **URL:** https://www.microsoft.com/startups
- **Free limits:** **$1K–$5K self-serve**, no VC required; up to $150K via investor network over time.
- **Signup friction:** Must be privately held, building software you own, not a consultancy. Application-based.
- **Gotchas:** Solo-founder eligibility plausible but unconfirmed; credits apply to Azure including GPU VMs.
- **Verdict:** PROVEN program; solo eligibility UNKNOWN. **Role: Azure GPU credit budget.** Neutral.

### 10. Lambda research grant — up to $5,000 GPU cloud credits
- **URL:** https://lambda.ai/research
- **Free limits:** Up to $5,000 in Lambda Cloud credits + mentoring from CSO (announced Dec 2024, "hundreds of researchers").
- **Signup friction:** Competitive application with a research narrative.
- **Gotchas:** Research-oriented (his CuteCity GIS/robotics + Northern Strike data-journalism angle could qualify); not guaranteed.
- **Verdict:** PROVEN announced; rolling status 2026 UNKNOWN. **Role: H100/A100 training grant if won.** Friend.

### 11. Modal — $30/mo serverless credits, but CARD REQUIRED
- **URL:** https://modal.com
- **Free limits:** **$30/mo recurring** compute credit on Starter (PROVEN, modal.com/pricing). ≈ 50h T4 / 12h A100-80 / 7.6h H100 per month.
- **Signup friction:** ⚠️ Billing docs: *"you must have a payment method on file in order to use Modal."* Card = hard blocker if he has none.
- **Verdict:** PROVEN $30/mo; card requirement PROVEN. **Role: serverless GPU budget IF he adds a card.** Neutral/Foe without card.

### 12. Daytona ($200 one-time) / Baseten ($30 credits) — one-shot GPU boosts
- **URLs:** https://www.daytona.io · https://www.baseten.co
- **Free limits:** Daytona: flat **$200 free compute credit** on signup (tech-insider.org, Sep 2026). Baseten: $30 compute credits reported, no card (awesome-ai-free-tiers).
- **Gotchas:** One-time grants, not recurring; Baseten claim is single-source; Inferless (10h/$30 no-card) is joining Baseten — status in flux.
- **Verdict:** UNKNOWN (single/secondary sources). **Role: one-shot GPU boosts.** Neutral.

---

## C. NOTABLE REJECTS (with why)

| Service | Why rejected |
|---|---|
| SageMaker Studio Lab | New-customer access **closed 2026-07-30** per AWS docs — likely dead. |
| RunPod | No blanket free tier (PROVEN) — pay-go from $0.27/h. Paid overflow only. |
| Vast.ai | Pay-go spot market, no free tier. Paid overflow only. |
| Paperspace Gradient (Free plan) | Free machines "almost never available" in practice; needs $8/mo Pro for real GPUs. Skip. |
| GitHub Student Pack | He's not a student — categorically ineligible. |
| GeForce Now | Gaming-only, 100h/mo cap in 2026, no dev compute. Irrelevant. |
| CoreWeave / Crusoe / FluidStack / Nscale | No self-serve free tier; CoreWeave Accelerator is application/VC-grade. Equity-for-compute deals (startupfortune.com) are anti-freestack. |
| SaladCloud | Consumer-GPU marketplace; "free trial" only, no recurring free tier. |
| Gensyn / Akash | Decentralized, pay-go; no free tier found. |
| Oracle Cloud free tier | Ampere A1 **CPU** free forever; no free GPU instances. (Filed under compute, not GPU.) |
| Azure $200/30d, GCP $300/90d, AWS $100/6mo | Real but short-window, card required; GCP trial **blocks GPUs entirely**. One-shot, not recurring. |
| Cerebrium / Cerebras / E2B Hobby | Paid now or CPU-only sandbox. |
| Replicate | ~$5 one-time promo trial only; inference-API niche, mostly covered by AI-API bucket. |
| Fireworks / DeepInfra / Hyperbolic / fal.ai | One-time $1–$10 trial credits; inference-API bucket, not GPU compute. |
| GitHub Codespaces | 120 core-h/mo — CPU only, no GPU. (Compute bucket.) |
| Deepnote free | CPU-only free tier. |
| Genesis Cloud "166 free GPU hours" | Stale 2024-era claim; no 2026 confirmation. Assume dead. |

## D. TOP 3 UNKNOWNS WORTH RESOLVING

1. **Beam.cloud no-card + monthly refresh — is it still live on the pricing page today?** ($30/mo refreshed is confirmed by 2 sources; the no-card claim is 1 source, Aug 2026.) This is the single highest-value verification — a card-free recurring $30/mo GPU budget changes the stack.
2. **Lightning AI monthly credits — did they stop in Aug 2026?** Official pricing page (Sep 24) still shows 15 credits/month; one secondary source claims monthly credits ended. A direct pricing-page check settles it.
3. **NVIDIA build.nvidia.com free tier — RESOLVED Oct 5.** Credit caps were removed: the finite-credit model (1,000→5,000) is retired; current model is 40 RPM + 10,000 req/day, no token meter (build.nvidia.com current limits + NVIDIA forum moderator). Settled: rate-limited, not unlimited, and strictly better for sustained use than credits.

## E. NOTES FOR PARENT (cross-bucket)

- **NVIDIA NIM free tier also belongs in the free-AI-APIs bucket** — it's the strongest free LLM API found (100+ models, no card, commercial-use-OK for generated code).
- **Incorporation unlocks:** NVIDIA Inception → Lambda $7,500 credits → potentially AWS Activate Portfolio / Microsoft $150K. Incorporation is the highest-leverage single move for the credits ladder.
- **Geography:** all shortlisted services accept Canadian users; no jurisdiction blocks found.
- **TRC + Kaggle + Colab + Beam + NIM + HF ZeroGPU** = a fully card-free recurring stack: weekly training (Kaggle), overflow training (Colab), monthly serverless GPU budget (Beam), free inference API (NIM), demos (HF), moonshot training (TRC).
