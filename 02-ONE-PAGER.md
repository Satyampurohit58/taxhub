# TaxHub — What I Would Build First, and the First 30 Days

---

## The real first product

**"Never miss a mandate."** A hosted AI front desk for owner-run tax practices, with a grounded knowledge layer behind it.

Not a platform. One loop, done properly:

> **Inbound call or email → captured and qualified → structured mandate record → deadline detected and secured → documents requested → drafted reply in the partner's inbox for approval.**

The practice forwards its number after hours and at peak, or the whole line. Every enquiry comes back as a structured record instead of a note on a pad. Nothing is auto-sent — everything lands as a draft a human approves. That single constraint is what makes it sellable to a profession carrying personal liability.

**What ships in v1**

| Included | Deliberately excluded from v1 |
|---|---|
| German voice intake, 24/7, on the practice's own number | DATEV integration (v2 — needed for expansion, fatal as a starting requirement) |
| Email + contact-form capture into the same queue | Client-facing self-service portal |
| Mandate classification and priority triage | Anything that sends without human approval |
| **Deterministic** deadline detection (§ 355 AO, § 149 AO) | Multi-language |
| Document checklist per mandate type | Automated fee quoting |
| Drafted German reply, human-approved | Bookkeeping, payroll, filing — that is DATEV's, permanently |
| Grounded statute Q&A with verifiable citations | |

**Why this shape.** It is the only version that needs no integration, is live in days, produces a number the owner already tracks (enquiries answered, mandates won), and quietly makes us the system of record for demand. The knowledge layer ships alongside because it costs almost nothing to serve and it is what turns a phone tool into a hub — but it is not what we lead the sale with.

**Priced against a salary, not a seat:** €490 / €1,490 / €2,900 per month by practice size. The comparison in the room is a €50k assistant nobody can hire, never a €50 licence.

---

## First 30 days — three moves

### Move 1 · Days 1–10 — Ten real intake recordings, before writing product code

Sign five practices as design partners on a paid pilot (€500/month, explicitly discounted, contractually a pilot). Sit in the office. Record and transcribe **every inbound call for a full week** — with consent, DSGVO-compliant.

Then hand-label them: what kind of request, how urgent, what deadline was hiding in it, what documents were needed, what the practice actually did next.

**Why first.** Everything downstream — the mandate taxonomy, the triage rules, the German the voice agent must survive — is a guess until this exists. The case build in this repo is already a working demonstration of the pattern, and it is precisely where its assumptions need to meet reality: my mandate taxonomy has ten categories because I reasoned my way to them, not because I counted. Real calls will reorder that list, and will contain dialect, interruptions and half-sentences no synthetic scenario reproduces.

**Deliverable:** a labelled corpus of ~200 real inbound requests, and the first honest version of the taxonomy.
**Success:** ≥ 80% of real calls fall cleanly into the revised taxonomy.

### Move 2 · Days 5–25 — Ship the loop into one live practice

In parallel: take one design partner fully live on their real number — first out-of-hours only, then peak hours, then the full line as trust builds.

Build order, hardest risk first:

1. German voice intake that survives a real call (the highest-risk component — if it is not good, the whole sequencing thesis changes and we lead with knowledge instead)
2. Structured mandate record + deterministic deadline engine
3. Drafted reply, human-approved, in the partner's existing inbox
4. Knowledge layer over statutes + that firm's own templates

**Instrument from day one, because this is the sales pitch:** enquiries captured out-of-hours, median response latency before vs. after, mandates won that would previously have been missed.
**Success:** one practice running live for two consecutive weeks, ≥ 90% of inbound captured, zero missed deadlines, and one specific mandate the owner agrees would have been lost.

### Move 3 · Days 15–30 — Open the channel before the product is finished

CAC is the number that decides this company, and channel takes months to warm — so it starts now, not after launch.

- Approach two **Steuerberaterkammern** and one Verband about a webinar or member newsletter slot; the pilot's live numbers are the credential.
- Approach three **DATEV-Systempartner** — they already sell into exactly this ICP, they are not threatened by a front-office product, and they can co-sell.
- Get the **Berufsrecht question answered in writing** by a specialist lawyer: confidentiality (§ 203 StGB, § 57 StBerG), AVV, EU-only processing, retention. In this profession a clean legal opinion is a sales asset, not a compliance cost — and the objection *will* come up in the first meeting.

**Success:** one signed channel conversation with a scheduled date, and a written legal position we can hand to a sceptical partner.

---

## What I would be watching at day 30

| Question | Signal that we are right | Signal to change course |
|---|---|---|
| Will they let AI answer the phone? | Design partner moves from after-hours to full line unprompted | Still after-hours only at day 30 |
| Is capacity really the pain? | Owner talks about mandates they can now accept | Owner talks about saving €50/month |
| Does the price hold? | ≥ €1,000/month accepted without seat-count negotiation | Anchoring to DATEV module pricing |
| Is intake the right wedge? | Enquiries captured is the metric they quote to peers | They ignore intake and only use the knowledge Q&A |

That last row is the one I would take most seriously. If design partners consistently ignore the front desk and live in the knowledge layer, the memo's sequencing is wrong — and the right response is to invert it and lead with knowledge, not to argue with the users.

---

## The 90-day gate

Three things decide whether TaxHub becomes a company (full reasoning in [`01-INVESTMENT-MEMO.md`](01-INVESTMENT-MEMO.md) §9):

1. One channel partner willing to co-market
2. **Ten paying practices at ≥ €1,000/month** — signed, not LOIs
3. A voice demo a Steuerberater accepts on their own line

Hit all three and this is fundable. Miss the pricing one specifically and it is a features business, not a platform — and the honest move is to say so early.
