# Draft reply to Simon

> Draft — review and edit before sending. Insert the live link and repo URL where marked.

---

Hi Simon,

thanks a lot — I enjoyed this one. Here is what I came up with.

**TL;DR:** I went with TaxHub, but not for the reason in the brief. The usual framing is "90,000 Steuerberater, fragmented, under-digitised." I think the second half of that is wrong, and it is the half that decides the product. German tax practices are among the most software-saturated small businesses in the country — DATEV is a €1.4bn cooperative *owned by the Steuerberater themselves*, and walking in offering to digitise them means losing to their own incumbent's roadmap.

What is actually scarce is **people**. Practices are turning away profitable mandates because they cannot hire, and the partner generation is retiring faster than it is being replaced. So TaxHub should be sold as **capacity, not software** — priced against a €50k assistant nobody can find, not against a €50 seat licence. That one move is what makes a €1,500/month ACV defensible in a vertical where seat-based tools cap out around €80.

From there the sequencing follows: **lead with intake** (it needs no DATEV integration, so it skips the procurement fight entirely and can be live in days), **expand into knowledge** (the firm-private corpus and its correction history is what still matters once generation is free), **deepen into workflow** last.

**What I built** — a working slice of the knowledge and intake core, deliberately with no backend at all:

- **Live:** https://satyampurohit58.github.io/taxhub/
- **Repo:** https://github.com/Satyampurohit58/taxhub

(If you would rather not open a link, the same app is attached as a single self-contained HTML file — `TaxHub-MVP.html` runs offline from disk, no install, no server.)

It is grounded in **4,446 paragraph-level chunks from 9 real German tax statutes** (EStG, UStG, AO, StBVV, GewStG, KStG, EStDV, UStDV, HGB), ingested unmodified from gesetze-im-internet.de and current to 2 July 2026. Retrieval runs live in the browser — no vector DB, no backend.

Two questions worth asking it, because they are what a Steuerberater would test first:

- *"Bis zu welcher Umsatzgrenze bin ich Kleinunternehmer?"* → **25.000 / 100.000 €**. Most general assistants still answer 22.000 / 50.000, the pre-2025 rule.
- *"Wie lange muss ich Buchungsbelege aufbewahren?"* → **8 years**, not the usual 10.

Then click a citation — it expands the actual statute text and links to the official source. Every citation resolves against the corpus, and the build fails if one does not. On the Intake tab, the **"Objection, clock running"** scenario is the one to look at: it pulls a date out of prose, computes the one-month Einspruchsfrist under § 355 Abs. 1 AO, triages P1 and drafts the German reply.

Two deliberate decisions I would want to talk through:

1. **The app tells you which mode produced each answer** — live synthesis, pre-generated, or retrieval-only. With no API key it does real retrieval and shows you the paragraphs rather than inventing prose. For this vertical a visible "I don't know" beats a fluent wrong answer, so I put the mode permanently on screen. Connect an Anthropic key in Settings and you get full live synthesis over the same passages.
2. **Deadlines and checklists are deterministic code, not model output.** A language model should not be the thing deciding whether a one-month objection period has started. It reads messy German into structured slots and drafts the reply; the liability-bearing logic stays in code.

The memo, the 30-day plan and an honest limitations section are in the repo. The short version of the limitations: the corpus is statutes only (the firm's *own* documents are the real moat and are not in here), the intake taxonomy is reasoned rather than observed from real calls — which is exactly what day 1–10 of the 30-day plan is for — and the market figures need a proper sourcing pass against BStBK and DATEV's annual report before anyone acts on them. I flagged those rather than dressing them up.

Happy to walk through any of it — particularly the "capacity not software" pricing thesis, since the whole memo rests on it and it is the part I would most want to pressure-test with you.

Best,
Satyam
