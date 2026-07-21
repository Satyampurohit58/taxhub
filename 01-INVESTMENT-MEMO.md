# Investment Memo — TaxHub

**Vertical AI operating hub for German tax practices (Steuerberaterkanzleien)**

Prepared for CITO · Case round 1 · Author: Satyam Purohit

**Recommendation: GO**, on three conditions set out at the end. Build TaxHub, lead with intake, price against headcount rather than seats.

---

## 1. Why TaxHub, and why the obvious version of the thesis is wrong

The brief's instinct is TaxHub. I agree with the destination but not with the usual reasoning, and the difference decides what we build.

The standard pitch is *"90,000 Steuerberater, fragmented, under-digitised, still on paper — bring AI."* Half of that is wrong, and it is the half that kills companies.

German tax practices are **not** under-digitised. They are among the most software-saturated small businesses in the country. DATEV eG — a cooperative doing roughly €1.4bn in revenue, **owned by the Steuerberater themselves** — sits inside the overwhelming majority of practices and runs bookkeeping, payroll, filing and the tax-office interface. A founder who walks in saying "you need to digitise" is telling a DATEV member that their own cooperative has failed them. It lands badly and it is not true.

What is actually true is narrower and much more useful:

> Practices are **capacity-constrained, not software-constrained.** They are turning away profitable mandates because they cannot hire, and the partner generation is retiring faster than it is being replaced.

Three structural facts drive this:

1. **Labour scarcity.** Steuerfachangestellte are among the hardest roles in the German Mittelstand to fill. Practices compete for the same shrinking pool, and salary inflation has outrun what the StBVV fee schedule comfortably supports.
2. **Succession.** The profession skews old. A large share of practices have no identified successor, which drives consolidation and makes efficiency-per-head an existential number rather than a nice-to-have.
3. **A hard compliance calendar.** E-invoicing (§ 14 UStG, phased through 2028), retention reform, and continuous statutory change generate mandatory, deadline-bound work that clients must buy. Demand is not the problem. Throughput is.

That reframing does the strategic work. If the problem is software, we compete with DATEV's roadmap on DATEV's turf and lose. If the problem is **capacity**, our competitor is a €45–60k/year assistant that the practice cannot find — and we are priced against a salary, not against a €50 seat licence. This single move is what makes the unit economics work in a vertical where seat-based tools cap out around €80/user/month.

### Why not CraftHub or LogHub

| | TaxHub | CraftHub | LogHub |
|---|---|---|---|
| Businesses (DE) | ~90k professionals, roughly 50–55k practices | >1m Handwerk businesses | Small; movers are a niche |
| Willingness to pay | **High** — bills €150–250/h, software budget already exists | Low — price-sensitive, cash-focused | Medium |
| Existing budget line | **Yes** (DATEV) — procurement path exists | Often none | Fragmented |
| Competitive density | Moderate, incumbent is slow by construction | **Crowded** — Plancraft, ToolTime, Meisterwerk, all funded | Thin but small |
| Regulatory moat | **High** — Berufsrecht, confidentiality, DSGVO | Low | Low |
| Value of a knowledge layer | **Very high** — law changes constantly | Low — trade knowledge is stable | Low |
| Realistic ACV | €12–30k | €1–3k | €5–15k |

CraftHub wins on logo count and loses on everything that compounds. A million businesses at €150/month, sold one at a time to price-sensitive owners against four funded competitors, is a worse business than 30,000 practices at €1,500/month with a regulatory moat. **LogHub** has the prettiest single workflow (call → survey → quote) but the market cannot carry a venture outcome on its own.

TaxHub also has a property the others lack: the customer's own clients are every SME in Germany. A practice that adopts TaxHub becomes a distribution channel into its 200–800 mandates. That is the long game.

---

## 2. Market size and structure

**Structure matters more than the headline number.** The market is a barbell:

- A **long tail** of ~40–45k small, owner-run practices (1–3 professionals, 3–15 staff). Almost all on DATEV. Buy quickly, decide alone, cannot run a procurement process. **This is the ICP.**
- A **consolidating middle**: PE-backed and partnership roll-ups aggregating practices. Slower to sell, but a single win lands 10–40 sites. **This is year-two enterprise motion.**
- A **top end** (Big Four, large partnerships) that builds in-house. **Not our market.**

Sizing, bottom-up and deliberately conservative:

| | |
|---|---|
| Practices in Germany | ~50–55k |
| Addressable (3–20 staff, owner-run) | **~30k** |
| Target ACV | **€18k** (≈€1,500/month) |
| **SAM (Germany)** | **~€540m/year** |
| 5-year target: 5% of addressable | 1,500 practices → **~€27m ARR** |
| DACH extension | Austria (~4.7k), Swiss Treuhand — adds ~25–30% |

€27m ARR from a 5% share of one country, on a product that expands by module and by seat, is a venture-scale outcome without requiring heroic penetration. The sanity check on ACV is Section 4.

> **Numbers to verify before any real commitment.** The figures above are directionally right but drawn from memory and should be sourced properly: BStBK *Berufsstatistik* for practitioner and practice counts, DATEV's annual report for revenue and member count, and the Steuerberaterkammer age distribution for the succession claim. I would not put this memo in front of an IC without that pass, and I flag it rather than dress it up.

---

## 3. ICP and willingness to pay

**Ideal customer:** an owner-run practice, 1–3 professionals, 6–15 staff, €600k–1.5m revenue, 150–500 mandates, running DATEV, with one or two people answering the phone and a partner who personally handles anything unusual.

**The buyer is the owner.** One person, no committee, no CIO, decides in one or two conversations, and is heavily influenced by peers and by their Kammer. That is a fast sales cycle by German SME standards — *if* you reach them, which is the actual constraint (Section 7).

**Where the money already goes:** DATEV licences, an assistant's salary, temp cover, and — critically — the revenue lost to mandates declined for lack of capacity. The last item never appears in a budget, which is precisely why it is the number to sell against.

**Willingness to pay, anchored three ways:**

| Anchor | Amount |
|---|---|
| Assistant / Sekretariat FTE, fully loaded | €45–60k/year |
| Billable hour recovered (StBVV Zeitgebühr, § 13) | €66–164/hour |
| Missed inbound → one mandate won | Often €2–5k/year, recurring |

Against those, **€1,000–2,500/month is defensible** if — and only if — we can show a countable result. A practice that recovers three hours a week of partner time at StBVV Zeitgebühr covers a €1,500/month subscription roughly twice over. That is the arithmetic the sales conversation should be about, and it is arithmetic the buyer does every day.

**Where WTP breaks:** if we are sold as "an AI tool" priced per seat, we are compared to DATEV modules and anchored at €50. Positioning is not decoration here; it is the difference between a €600/year and an €18,000/year contract for the same software.

---

## 4. The incumbent, and where it leaves a gap

**DATEV is not beatable head-on, and does not need to be.** It owns the bookkeeping and filing system of record, the tax-office interface, and — through the cooperative structure — genuine institutional loyalty. Any strategy requiring practices to leave DATEV fails.

But the cooperative structure is exactly where the gap is, and it is structural rather than a matter of execution:

1. **It is owned by its users.** Cooperatives optimise for consensus and continuity. That is a feature for reliability and a serious constraint on shipping speed in a fast-moving capability area.
2. **It is bookkeeping-centric.** DATEV's centre of gravity is what happens *after* work enters the practice. The **front office — the phone, the inbox, the unstructured client request — is largely unowned.** That is the wedge.
3. **It sells to the practice, not to the mandate.** The client-facing surface is thin.
4. **Product breadth caps depth.** A platform serving every practice cannot ship an opinionated workflow for one segment as fast as a focused team.

**The jupus proof point.** jupus built the AI front desk — Telefon-KI, KI-Sekretariat, Dokumenten-KI — for law firms, an adjacent profession with the same shape: regulated, fragmented, owner-run, phone-driven, incumbent-software-saturated. It demonstrates that (a) these professionals *will* let AI answer their phone, and (b) the front office is a viable entry point next to an entrenched incumbent. **TaxHub is that pattern aimed at a market with better economics and a much higher-value knowledge layer** — tax law changes continuously, so a grounded knowledge product has recurring value that a legal template library does not.

**The honest counter-argument:** DATEV will ship AI assistants. It already is. My answer is not that they will fail — it is that they will ship *horizontal, bookkeeping-adjacent* AI, and that the front office plus a firm-private knowledge brain is a different product sold on a different budget line. We should assume DATEV integration becomes table stakes, and design to be a **good citizen on top of DATEV rather than a replacement for it.** Anything else invites the one fight we cannot win.

---

## 5. The wedge: intake first, knowledge second

Of the three blocks, **Communication / Intake is the wedge.** Not because it is the most valuable — it is not — but because it is the only one that can be sold in week one.

**Why intake leads:**

- **No integration required.** It sits on the phone line and the inbox, in front of the systems. No DATEV connector, no data migration, no IT project, no procurement. A practice can be live in days. Every other entry point starts with a months-long integration conversation.
- **The ROI is countable.** Missed calls, response latency, mandates won. A practice that returns an inbound enquiry in ten minutes instead of two days converts materially better, and switching enquiries are the highest-intent leads in the market.
- **The pain is felt by the buyer personally.** The owner is the one interrupted.
- **It becomes the system of record for demand.** Every request, qualified and structured, flows through us. That is the strategic prize hiding inside a modest first product.

**Why knowledge is the moat, not the wedge.** "Ask your firm's knowledge" is the more defensible product but a harder first sale: value is diffuse, it competes with "we'll just ask the partner", and it needs the firm's own documents to shine — which requires trust we have not yet earned. It should be sold *second*, into an account that already trusts us, where onboarding its corpus is a natural expansion rather than a leap of faith.

**Workflow is expansion.** Once intake owns the front door and knowledge owns the reference layer, taking a captured request through to a first useful output — and eventually into DATEV — is where the contract grows and where switching becomes painful.

Sequenced: **land on intake (pain, fast ROI, no integration) → expand into knowledge (stickiness, data) → deepen into workflow (integration, switching cost).**

---

## 6. Moat, as generation commoditises

Assume the honest base case: **the model layer is free and excellent within 24 months.** Anything defensible must survive that. Ranked by durability:

1. **The firm-private knowledge asset, with its correction history.** Not the documents — the *accumulated corrections*. Every time a practice marks an answer wrong, we learn something no competitor and no foundation model has. This compounds per-account and makes switching mean re-teaching a system that already knows how the firm works.
2. **System of record for intake.** Once every inbound request lands in TaxHub, we hold the demand-side data. Ripping us out means losing the client-communication history — the same reason nobody changes their CRM.
3. **The vertical lexicon and evaluation set.** Boring and underrated. The demo in this repo already shows why: making German practitioner language reach the right statute takes curated domain mapping (`Betriebsprüfung` → `Außenprüfung`, `Pendlerpauschale` → `Entfernungspauschale`) plus a test set that only a tax person can write. Horizontal RAG has no mechanism to acquire this. It is a small moat individually and a real one cumulatively, because it is exactly the work generalist competitors will skip.
4. **Regulatory and trust surface.** Berufsrecht confidentiality (§ 203 StGB, § 57 StBerG), DSGVO, EU-hosted processing, auditable citation trails, AVV. This is a barrier to *horizontal* entrants — a US generalist tool cannot casually satisfy it — though not to a determined vertical competitor.
5. **Distribution.** Steuerberaterkammern, Verbände, DATEV-Systempartner and Fachliteratur channels are relationship-gated and slow to build. Weak as a moat, strong as a head start.

**What is not a moat:** the RAG pipeline, the prompts, the model choice, the UI. All replicable in a quarter. We should say so internally and stop confusing effort with defensibility.

---

## 7. Business model and unit economics

**Model: per-practice subscription, tiered by mandate count, priced against headcount.**

| Tier | Practice | €/month | Contents |
|---|---|---|---|
| Front Desk | 1–3 staff | 490 | Intake, call/email capture, qualification, booking |
| Practice | 4–15 staff | **1,490** | + knowledge layer, firm corpus, drafting |
| Partner | 15+ / multi-site | 2,900+ | + workflow, DATEV integration, multi-site |

Target blended **ACV €18k**. Setup/onboarding fee €2–4k (qualifies the buyer and funds implementation).

**Gross margin.** Dominated by voice inference, not text.

| Line | Monthly, mid-tier |
|---|---|
| Voice AI (~600 calls × 3 min) | €200–280 |
| Knowledge queries (~500) | €10–20 |
| Telephony numbers, hosting, storage | €40–60 |
| **COGS** | **~€300** |
| Revenue | €1,490 |
| **Gross margin** | **~78–80%** |

Healthy, and it *improves* — inference cost per unit has fallen persistently, so the same contract gets more profitable over time. Note the asymmetry: voice is ~90% of COGS, so the knowledge layer we lead the demo with is nearly free to serve, while the wedge we lead the *sale* with carries the cost. That is the right way round — pay for the thing that closes deals.

**CAC and payback.**

| | |
|---|---|
| Blended CAC (founder-led + channel, year 1) | €6–9k |
| Gross profit per account | ~€14.4k/year |
| **Payback** | **~6–8 months** |
| Expected life (sticky, incumbent-adjacent) | 5+ years |
| NRR target (seats + modules) | 110–120% |
| **LTV/CAC** | **>5x** at steady state |

**The number that decides the company is not CAC — it is sales cycle × reachability.** Conservative buyers, no procurement function, and a profession that trusts peers over vendors. Cold outbound will underperform. The plan must run through **Kammern, Verbände, Fachliteratur, and DATEV-Systempartner**, plus a referral loop, and must include a genuinely fast pilot (live in two weeks, one countable metric).

**Rough plan sanity check:** ~40 practices in year 1 (founder-led, ~€700k ARR), ~200 by year 2 with channel (~€3.6m), ~600 by year 3 (~€11m). Demanding but not fantastical for a €1,500/month product with a compliance-driven trigger.

---

## 8. Key risks

| Risk | Severity | Mitigation |
|---|---|---|
| **DATEV ships an equivalent front office** | High | Be a good citizen on top, not a replacement. Win the front office before they turn to it. Own the client-facing surface they structurally under-serve. |
| **Sales cycle slower than modelled** | High | Channel-first via Kammer/Verband. Two-week pilot with one metric. Kill criterion in §9. |
| **Liability from a wrong answer** | High | Grounded-or-silent by construction (this is built, see §10). Deterministic code for deadlines. Positioned as staff support, never as advice to the end client. |
| **Voice quality in German, on trade vocabulary and dialect** | Medium | Voice is the wedge — it must be excellent. Pilot on the actual dialects of the target region before scaling. |
| **Commoditisation of the knowledge layer** | Medium | Moat is the *firm-private* corpus and correction history, not the public statutes. |
| **Berufsrecht / confidentiality objection** | Medium | EU hosting, AVV, auditable citations, legal opinion in hand before first sale. Turn it into a sales asset. |
| **Priced as a seat tool** | Medium | Positioning discipline. Sell capacity, quote against a salary. |

---

## 9. Go / no-go

**GO**, conditional on three things being true within 90 days:

1. **Channel access.** At least one Steuerberaterkammer, Verband or DATEV-Systempartner willing to co-market to their membership. Without a channel, the CAC model does not hold and the recommendation flips to no-go.
2. **Ten paying pilots at ≥ €1,000/month.** Not LOIs, not free trials — signed. This tests the "capacity not software" pricing thesis, which the whole memo rests on. If practices will only pay €300, this is a features business, not a platform.
3. **A voice demo a Steuerberater accepts on their own line.** The wedge is the phone. If German voice intake is not convincingly good on real calls, we should lead with knowledge instead and revisit the entire sequencing.

**Kill criteria.** Abandon if, after 6 months: median sales cycle exceeds 5 months with channel support in place; or pilot-to-paid conversion is below 30%; or DATEV ships an equivalent front-office product with real adoption before we reach 100 accounts.

**What I would *not* do:** build a DATEV integration first (slow, and it fights the incumbent on their ground), chase the Big Four end, or launch three verticals at once. The whole thesis is depth in one vertical; hedging across three destroys the only advantage we have.

---

## 10. What the accompanying build proves

The live MVP in this repo (`/app`, see [`README.md`](README.md)) is the grounded knowledge and intake core, built as a static, backend-free app over **4,446 paragraph-level chunks from 9 real German tax statutes** (EStG, UStG, AO, StBVV, GewStG, KStG, EStDV, UStDV, HGB), ingested unmodified from gesetze-im-internet.de and current to **2 July 2026**.

Three things it demonstrates that matter to this memo:

**Grounding can be verifiable rather than decorative.** Every citation resolves to a real chunk and expands to the statute text with a link to the official source. A build check fails if any citation does not resolve — the failure mode this product exists to prevent is not allowed into the artefact itself.

**Currency is a real, demonstrable wedge.** Ask it the Kleinunternehmer threshold: it returns **25.000 € / 100.000 €** from § 19 Abs. 1 UStG. Ask a general-purpose assistant and you will usually get 22.000 / 50.000 — the superseded pre-2025 rule. Same for retention: **8 years** for Buchungsbelege under § 147 Abs. 3 AO, not the widely-repeated 10. *That* is the product argument, in two questions, to a sceptical Steuerberater.

**The liability-bearing logic belongs in code.** The intake assistant computes the one-month objection deadline (§ 355 Abs. 1 AO) deterministically from a date buried in prose, and escalates a Selbstanzeige to partner-only without offering advice. The model reads and drafts; it does not decide whether a statutory clock has started.

The build also surfaced the kind of failure that only shows up when you actually build: the abbreviation "EÜR" folds to `euer`, which is a substring of `steuerberater`, so an urgent objection silently classified as a routine filing job and the deadline was never raised. Caught by the verification suite, not by inspection. Vertical AI is full of these, they are invisible from a pitch deck, and accumulating the fixes is a meaningful part of what Section 6 calls a moat.

---

### One-line version

*Not "digitise the Steuerberater" — they already are. Sell them the assistant they cannot hire, enter through the phone because it needs no integration, and let the knowledge layer become the thing they cannot leave.*
