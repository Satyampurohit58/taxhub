# TaxHub — CITO case round 1

**An AI-native operating hub for German tax practices.** Beachhead: Steuerberater.

Submitted by **Satyam Purohit** for the Founders' Associate / EIR role at CITO.

---

## Deliverables

| | |
|---|---|
| **[TaxHub-Investor-Deck.pptx](TaxHub-Investor-Deck.pptx)** | The investor deck — 17 slides, the memo in presentation form |
| **[01-INVESTMENT-MEMO.pdf](01-INVESTMENT-MEMO.pdf)** · [.md](01-INVESTMENT-MEMO.md) | The investor cut — market, ICP, willingness to pay, DATEV gap, wedge, moat, unit economics, go/no-go |
| **[02-ONE-PAGER.pdf](02-ONE-PAGER.pdf)** · [.md](02-ONE-PAGER.md) | What I would build first as the real product, and the first three moves in 30 days |
| **[app/](app/)** | The live MVP — grounded knowledge + intake core, built with Claude Code |

The Markdown files are the source of truth; the PDFs and the deck are generated from them.

**The one-line thesis:** German tax practices are not under-digitised — DATEV saturated them years ago. They are **capacity-constrained**. So sell them the assistant they cannot hire, enter through the phone because it needs no integration, and let the knowledge layer become the thing they cannot leave.

---

## The MVP

A **fully static, backend-free** web app. No server, no database, no vector store, no API key required to run it.

### What is genuinely real

- **4,446 paragraph-level chunks** from **9 German tax statutes** — EStG, UStG, AO, StBVV, GewStG, KStG, EStDV, UStDV and the bookkeeping sections of the HGB — ingested unmodified from the official XML releases at [gesetze-im-internet.de](https://www.gesetze-im-internet.de/) (BMJ / Bundesamt für Justiz). Statute text current as of **2 July 2026**, including the 2025/2026 amendments.
- **Live hybrid retrieval in the browser.** BM25 over German-normalised tokens, plus compound-aware matching and a curated practitioner→statute lexicon. Index builds in ~150 ms; queries run in ~3 ms.
- **Verifiable citations.** Every citation resolves to a real chunk, expands to the statute text in place, and links to the official source. A citation that cannot be resolved renders as *broken*, never as authoritative.
- **Deterministic intake logic.** Classification, deadline arithmetic, document checklists and the drafted German reply are real code operating on the pasted message.

### The three answer modes, and why the UI says which is which

| Mode | When | What happens |
|---|---|---|
| **Live synthesis** | An Anthropic API key is entered in the footer | Claude synthesises over the retrieved passages under a strict grounding prompt |
| **Pre-generated** | No key, question matches a seeded one | A pre-written grounded answer — its citations still resolve against the live corpus |
| **Retrieval only** | No key, no match | Real ranked passages, **no synthesis at all** |

Retrieval is live in all three. The app never invents prose to fill a gap — in retrieval-only mode it says so and shows you the paragraphs instead. For a tax assistant, a visible "I don't know" is worth more than a fluent wrong answer, so the mode is always on screen.

**To see full live synthesis**, open **Settings** (gear icon, top right) and connect an Anthropic API key. It is stored in your browser's `localStorage` and sent only to `api.anthropic.com`. No key is bundled with this repo.

Answers are deep-linkable — `?q=…` reruns a question and `?tab=intake` opens the intake surface, so a colleague can be sent the exact answer you are looking at.

### Two questions worth asking it

Both are things a Steuerberater would use to test us, and both are things general-purpose assistants usually get wrong from stale training data:

1. **"Bis zu welcher Umsatzgrenze bin ich Kleinunternehmer?"** → **25.000 € / 100.000 €** (§ 19 Abs. 1 UStG). Most assistants answer 22.000 / 50.000 — the superseded pre-2025 rule.
2. **"Wie lange muss ich Buchungsbelege aufbewahren?"** → **8 years** (§ 147 Abs. 3 AO), not the widely-repeated 10.

Then open the citation chip and read the statute text yourself. That is the whole product argument.

### Intake

Paste a call note or email — or use a built-in scenario. The **"Objection, clock running"** scenario is the one to try: the assistant finds a date buried in prose, computes the one-month Einspruchsfrist under § 355 Abs. 1 AO, flags the mandate P1, extracts the contact record, notes that the stated turnover rules out the Kleinunternehmer exemption, lists the documents to request, and drafts the German reply.

The **"Voluntary disclosure"** scenario shows the opposite behaviour: it escalates to partner-only and deliberately refuses to advise.

---

## Running it

```bash
cd app
node serve.mjs        # → http://localhost:8080
```

No dependencies, no build step, no install. Node 18+.

It must be served over HTTP — opening `dist/index.html` from disk will not work, because ES modules and `fetch()` need an origin.

### Deploying

`app/dist/` is a self-contained static folder. Copy it to any static host — S3, Cloudflare Pages, nginx, GitHub Pages, a shared drive. There is nothing to configure and no runtime dependency.

### Rebuilding the corpus from source

```bash
cd app
node ingest/build-corpus.mjs     # raw XML → dist/data/corpus.json
node ingest/eval-retrieval.mjs   # retrieval accuracy on 16 practitioner questions
node ingest/verify.mjs           # pre-ship checks — exits non-zero on failure
```

`ingest/raw/` holds the original XML archives as downloaded, so the ingest is fully reproducible.

---

## Checks

`ingest/verify.mjs` runs four gates and fails the build on any of them:

1. **Citation resolution** — 17/17 citations in the seeded answers resolve to real corpus chunks
2. **Seeded matching** — all 35 question probes route to the correct answer
3. **False-positive guard** — off-topic questions must fall through to retrieval rather than serving a confidently wrong pre-written answer
4. **Intake** — all 5 scenarios classify correctly, with correct deadline arithmetic

`ingest/eval-retrieval.mjs` scores retrieval on 16 questions phrased the way a practitioner would actually phrase them — deliberately *not* using statute vocabulary:

```
top-1 11/16   top-3 15/16   top-8 16/16   ~3 ms/query
```

Top-8 recall is the number that matters, since synthesis sees all eight. Several of the top-1 "misses" are legitimate co-answers — asked about retention, § 257 HGB is a correct companion to § 147 AO, not an error.

---

## Architecture, and why it is this shape

```
app/
├── serve.mjs                  static server for local review
├── ingest/
│   ├── raw/                   official XML, as downloaded
│   ├── build-corpus.mjs       XML → §-level chunks with citations + source URLs
│   ├── eval-retrieval.mjs     retrieval accuracy harness
│   ├── verify.mjs             pre-ship gates
│   └── dump-passages.mjs      inspection tool used while authoring answers
└── dist/                      ← the deployable artefact
    ├── index.html
    ├── assets/
    │   ├── retrieval.js       BM25 + German normalisation + lexicon
    │   ├── intake.js          classification, deadlines, checklists, drafting
    │   ├── app.js             UI, three answer modes, Anthropic call
    │   └── styles.css
    └── data/
        ├── corpus.json        4,446 chunks (3.7 MB)
        └── answers.json       seeded grounded answers
```

**Why chunk at the paragraph.** German statutes are numbered `(1) … (2) …`, which is also exactly how a Steuerberater cites them — "§ 15 Abs. 1 UStG". The natural chunk boundary and the natural citation unit are the same thing. That is what makes the citations real rather than approximate, and it is a property of this vertical worth exploiting.

**Why no embeddings.** A semantic index would need either an embedding API (a second vendor and a key) or a model shipped to the browser (tens of MB). Neither fits a static demo. Tuned lexical retrieval over 4.4k chunks with domain-specific query expansion gets to 16/16 top-8 recall in 3 ms — and the curated lexicon is a genuine asset, not a workaround. Production would add embeddings as a second retriever; it would not throw this away.

**Why rules, not a model, for intake.** Deadline arithmetic and document checklists must be deterministic and auditable. A language model must not be the thing deciding whether a one-month objection period has started. The model's job is reading messy German prose into structured slots and drafting the reply; the liability-bearing logic stays in code. That is a product conviction, not a demo shortcut.

---

## Honest limitations

Two hours, and it shows in specific places:

- **The corpus is statutes only.** A real deployment needs BMF-Schreiben, court decisions and — most importantly — the firm's own documents. That last one is the actual moat; this demo does not have it.
- **The intake taxonomy is reasoned, not observed.** Ten mandate types derived from how I understand a practice works. Move 1 of the 30-day plan exists precisely to replace it with real labelled calls.
- **Retrieval has no semantic layer.** Fine at this corpus size, insufficient at production scale.
- **Voice is not built.** The memo argues voice intake is the wedge; this build covers the text side of that loop. Voice is the highest-risk component and the first thing I would prototype next.
- **Market figures in the memo are from memory** and flagged as needing a sourcing pass (BStBK Berufsstatistik, DATEV annual report) before anyone acts on them. I would rather flag that than dress it up.
- **Not tax advice.** A demonstration artefact, and no substitute for a Steuerberater.

## Attribution

Statute text © Bundesministerium der Justiz / Bundesamt für Justiz, retrieved from gesetze-im-internet.de and reproduced unmodified for demonstration. Built with Claude Code.
