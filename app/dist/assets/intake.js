/**
 * Intake triage for a tax practice.
 *
 * Takes an unstructured inbound message — a phone-call transcript, an email, a
 * contact-form blob — and produces the structured record a practice actually
 * needs: what kind of mandate this is, how urgent, which documents to request,
 * which statutory deadline is already running, what it can be billed at, and a
 * ready-to-send reply.
 *
 * Deliberately rule-based rather than model-based. Two reasons:
 *
 *   1. It runs with no API key, so the demo is honest about what is real.
 *   2. More importantly, this is what the production system should do *anyway*.
 *      Deadline arithmetic and document checklists must be deterministic and
 *      auditable — you cannot have a language model quietly deciding whether a
 *      one-month objection period has started. The model's job is reading
 *      messy German prose into these slots and drafting the reply; the
 *      liability-bearing logic stays in code.
 */

import { foldUmlauts } from './retrieval.js';

// ---------------------------------------------------------------------------
// Mandate taxonomy
// ---------------------------------------------------------------------------

/**
 * `terms` are matched against the folded, lower-cased message.
 * `docs` are what the practice must request before work can start.
 * `anchors` are queries run against the live corpus so that every checklist
 * carries real statutory citations rather than invented ones.
 */
export const MANDATE_TYPES = [
  {
    id: 'einspruch',
    label: 'Assessment / objection',
    de: 'Steuerbescheid – Einspruch',
    urgency: 3,
    terms: { bescheid: 4, einspruch: 5, nachzahl: 3, widerspruch: 3, 'nachzuzahlen': 3, schätzbescheid: 4, 'zu wenig': 1 },
    docs: [
      'Steuerbescheid in full, including the envelope or the notified date',
      'The underlying return as filed, plus the transmission protocol',
      'Any correspondence with the Finanzamt on this assessment',
    ],
    anchors: ['§ 355 AO Einspruch Frist Monat', '§ 347 AO Einspruch Statthaftigkeit'],
    deadline: { kind: 'einspruch', months: 1, from: 'Bekanntgabe des Bescheids', cite: '§ 355 Abs. 1 AO' },
    fee: 'Zeitgebühr, § 13 StBVV (16,50–41 € per commenced quarter hour)',
    fit: 'Deadline-bearing. Must be acknowledged same day even if the mandate is later declined.',
  },
  {
    id: 'selbstanzeige',
    label: 'Voluntary disclosure',
    de: 'Selbstanzeige',
    urgency: 3,
    terms: { selbstanzeige: 6, 'nicht angegeben': 3, schwarzgeld: 4, 'nicht erklärt': 3, hinterzieh: 5, straffrei: 4, ausland: 1 },
    docs: [
      'Complete account statements for all affected years',
      'Documentation of the undeclared income, by year and by source',
      'Any prior correspondence with the tax authority or Steuerfahndung',
    ],
    anchors: ['§ 371 AO Selbstanzeige Straffreiheit', '§ 169 AO Festsetzungsfrist'],
    fee: 'Zeitgebühr, § 13 StBVV — scope unknown until the years are quantified',
    fit: 'Partner-only. Never triage to staff, never answer substantively before conflict check.',
    flag: 'Criminal-liability exposure. Straffreiheit can be lost by disclosure that is incomplete or too late — do not advise by email.',
  },
  {
    id: 'betriebspruefung',
    label: 'Tax audit',
    de: 'Betriebsprüfung / Außenprüfung',
    urgency: 3,
    terms: { betriebsprüfung: 5, aussenpruefung: 5, prüfungsanordnung: 5, prüfer: 3, 'prüfung angekündigt': 4, lohnsteuerprüfung: 4 },
    docs: [
      'Prüfungsanordnung including the notified date and the periods under audit',
      'Full bookkeeping for the audited years (GoBD-compliant export)',
      'Fixed-asset register and depreciation schedules',
      'Contracts with related parties for the audited years',
    ],
    anchors: ['§ 196 AO Prüfungsanordnung', '§ 147 AO Aufbewahrung Datenzugriff'],
    fee: 'Zeitgebühr, § 13 StBVV; audit support is billed separately from the annual work',
    fit: 'High-value, high-stress. Strongest single trigger for switching advisor — respond fast.',
  },
  {
    id: 'erechnung',
    label: 'E-invoicing migration',
    de: 'E-Rechnung Umstellung',
    urgency: 2,
    terms: { 'e-rechnung': 5, erechnung: 5, xrechnung: 5, zugferd: 5, 'elektronische rechnung': 4, rechnungsformat: 3, peppol: 4 },
    docs: [
      'Prior-year total turnover (drives the transition relief up to 800.000 €)',
      'Current invoicing system and export formats',
      'Sample outgoing invoice and a sample incoming invoice',
      'List of the client’s main B2B counterparties',
    ],
    anchors: [
      '§ 14 UStG elektronische Rechnung strukturiertes Format',
      'Übergangsregelung Rechnung Papier 2026 2027 800 000 Euro Gesamtumsatz',
    ],
    fee: 'Zeitgebühr, § 13 StBVV; typically packaged as a fixed-fee migration project',
    fit: 'Best land-and-expand trigger in 2026 — a compliance deadline the client cannot ignore.',
  },
  {
    id: 'beraterwechsel',
    label: 'Switching advisor',
    de: 'Steuerberaterwechsel',
    urgency: 2,
    terms: { 'neuen steuerberater': 5, wechseln: 4, 'nicht zufrieden': 3, 'reagiert nicht': 3, 'bisheriger steuerberater': 5, unzufrieden: 3, 'meldet sich nicht': 3 },
    docs: [
      'Last two years of assessments and filed returns',
      'DATEV data transfer or bookkeeping export from the previous advisor',
      'Current Steuernummer and USt-IdNr.',
      'Written termination of the previous engagement',
    ],
    anchors: ['§ 149 AO Abgabe der Steuererklärungen Frist', '§ 66 StBerG Handakten'],
    fee: 'Per the applicable StBVV item once scope is known; handover effort as Zeitgebühr § 13 StBVV',
    fit: 'Highest-intent inbound there is. Conversion depends almost entirely on response latency.',
  },
  {
    id: 'existenzgruendung',
    label: 'New business / founder',
    de: 'Existenzgründung',
    urgency: 2,
    terms: { gegründet: 4, gründung: 4, gründen: 4, existenzgründ: 5, 'selbständig gemacht': 4, freiberufler: 3, gewerbe: 2, startup: 3, 'neu gestartet': 3 },
    docs: [
      'Fragebogen zur steuerlichen Erfassung (or the data to complete it)',
      'Gewerbeanmeldung or evidence of freelance status',
      'Expected turnover and profit for the first two years',
      'Business bank account details and opening balance',
    ],
    anchors: ['§ 19 UStG Kleinunternehmer Gesamtumsatz', '§ 141 AO Buchführungspflicht Umsatz Gewinn'],
    fee: 'Beratungsgebühr per StBVV; ongoing bookkeeping under § 33 StBVV',
    fit: 'Low revenue today, long tenure. Worth taking only with a productised onboarding.',
  },
  {
    id: 'gmbh',
    label: 'Corporate / annual accounts',
    de: 'GmbH – Jahresabschluss',
    urgency: 1,
    terms: { gmbh: 4, ug: 3, jahresabschluss: 5, bilanz: 4, körperschaft: 4, 'offenlegung': 3, geschäftsführer: 2 },
    docs: [
      'Complete bookkeeping for the financial year plus opening balances',
      'Bank confirmations and loan agreements as at the reporting date',
      'Inventory count and receivables listing',
      'Shareholder resolutions and managing-director contracts',
    ],
    anchors: ['§ 264 HGB Jahresabschluss Kapitalgesellschaft', '§ 149 AO Abgabe der Steuererklärungen'],
    fee: 'Jahresabschluss per § 35 StBVV on the Gegenstandswert',
    fit: 'Core recurring revenue. Scope creep in year one is the main margin risk.',
  },
  {
    id: 'eur',
    label: 'Freelancer / sole trader return',
    de: 'EÜR / Einkommensteuererklärung (betrieblich)',
    urgency: 1,
    terms: { 'einnahmenüberschuss': 5, eür: 5, euer: 3, freiberuflich: 3, 'kleine gmbh': 1, einzelunternehmen: 4, 'steuererklärung für mein': 3, gewinnermittlung: 4 },
    docs: [
      'Bank statements for the full year, all business accounts',
      'Receipts and invoices, incoming and outgoing',
      'Fixed-asset additions and disposals',
      'Vehicle log or the basis for private-use taxation',
    ],
    anchors: ['§ 4 EStG Gewinnermittlung Überschuss Betriebsausgaben', '§ 25 StBVV Einnahmenüberschussrechnung Gebühr'],
    fee: '5/10–30/10 of a full fee, Tabelle B, minimum Gegenstandswert 17.500 € (§ 25 Abs. 1 StBVV)',
    fit: 'The volume mandate. Only profitable if intake and document chasing are automated.',
  },
  {
    id: 'lohn',
    label: 'Payroll',
    de: 'Lohnbuchhaltung',
    urgency: 2,
    terms: { lohn: 4, gehalt: 3, mitarbeiter: 3, minijob: 4, 'erste mitarbeiterin': 4, 'erster mitarbeiter': 4, sozialversicherung: 3, personal: 2 },
    docs: [
      'Betriebsnummer from the Agentur für Arbeit',
      'Employment contracts and agreed gross salaries',
      'Employee master data incl. tax ID and health-insurance fund',
      'Existing payroll records for the current year, if any',
    ],
    anchors: ['§ 41a EStG Lohnsteuer-Anmeldung', '§ 38 EStG Erhebung der Lohnsteuer'],
    fee: 'Per employee per month, § 34 StBVV',
    fit: 'Sticky and monthly, but staff-intensive. Deadline-dense: monthly, not annual.',
  },
  {
    id: 'privat',
    label: 'Private income tax return',
    de: 'Private Einkommensteuererklärung',
    urgency: 1,
    terms: { 'private steuererklärung': 5, arbeitnehmer: 3, lohnsteuerbescheinigung: 4, werbungskosten: 4, 'nur angestellt': 4, vermietung: 3, pendlerpauschale: 3 },
    docs: [
      'Lohnsteuerbescheinigung for the year',
      'Evidence of Werbungskosten and Sonderausgaben',
      'Certificates for insurance and pension contributions',
      'Rental income statements, where applicable',
    ],
    anchors: ['§ 9 EStG Werbungskosten Entfernungspauschale', '§ 149 AO Abgabe der Steuererklärungen Frist'],
    fee: '1/10–6/10 of a full fee, Tabelle A (§ 24 StBVV)',
    fit: 'Usually below the profitability line on its own. Take as a partner/staff referral or decline politely.',
  },
];

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

const LEGAL_FORMS = [
  [/\bgmbh\s*&\s*co\.?\s*kg\b/i, 'GmbH & Co. KG'],
  [/\bug\b|\bunternehmergesellschaft\b/i, 'UG (haftungsbeschränkt)'],
  [/\bgmbh\b/i, 'GmbH'],
  [/\bgbr\b/i, 'GbR'],
  [/\bohg\b/i, 'OHG'],
  [/\bkg\b/i, 'KG'],
  [/\be\.?\s?k\.?\b/i, 'e.K.'],
  [/freiberuf|freelanc|selbständig|selbstaendig/i, 'Freiberufler / Einzelunternehmen'],
  [/einzelunternehm/i, 'Einzelunternehmen'],
];

/** Parses German money expressions: "1,2 Mio", "850.000 €", "80k", "ca. 45 000 Euro". */
function parseMoney(text) {
  const out = [];
  const re = /(?:ca\.?\s*|rund\s*|etwa\s*|über\s*|ueber\s*)?([\d]{1,3}(?:[.\s]\d{3})+|\d+(?:,\d+)?)\s*(mio\.?|millionen|k\b|tsd\.?|tausend)?\s*(?:€|eur\b|euro\b)/gi;
  let m;
  while ((m = re.exec(text))) {
    let n = parseFloat(m[1].replace(/[.\s]/g, '').replace(',', '.'));
    // "1,2 Mio" parses as 1.2 above; plain "850.000" already has its dots stripped.
    if (/^\d+,\d+$/.test(m[1])) n = parseFloat(m[1].replace(',', '.'));
    const unit = (m[2] || '').toLowerCase();
    if (unit.startsWith('mio') || unit.startsWith('mill')) n *= 1e6;
    else if (unit.startsWith('k') || unit.startsWith('tsd') || unit.startsWith('tausend')) n *= 1e3;
    if (n > 0) out.push({ value: n, raw: m[0].trim() });
  }
  return out;
}

const MONTHS = {
  januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6,
  juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
};

/** Finds German dates in both "12.03.2026" and "12. März 2026" forms. */
function parseDates(text) {
  const out = [];
  for (const m of text.matchAll(/\b(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\b/g)) {
    out.push({ date: new Date(+m[3], +m[2] - 1, +m[1]), raw: m[0] });
  }
  for (const m of text.matchAll(/\b(\d{1,2})\.?\s*(januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*(\d{4})\b/gi)) {
    out.push({ date: new Date(+m[3], MONTHS[m[2].toLowerCase()] - 1, +m[1]), raw: m[0] });
  }
  return out.filter((d) => !isNaN(d.date));
}

function fmtDate(d) {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function extractContact(text) {
  // Trailing sentence punctuation must not become part of the address.
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0].replace(/[.,;:]+$/, '') ?? null;
  const phone = text.match(/(?:\+49|0)[\d\s/()-]{7,}\d/)?.[0]?.trim() ?? null;
  // "Herr/Frau X", or a "Mein Name ist X" / "hier spricht X" opener.
  const name =
    text.match(/(?:mein name ist|hier (?:ist|spricht)|ich hei[sß]e)\s+([A-ZÄÖÜ][\wäöüß]+(?:\s+[A-ZÄÖÜ][\wäöüß]+){0,2})/i)?.[1] ??
    text.match(/\b(?:Herr|Frau)\s+([A-ZÄÖÜ][\wäöüß]+(?:\s+[A-ZÄÖÜ][\wäöüß]+)?)/)?.[1] ??
    null;
  const company = text.match(/\b([A-ZÄÖÜ][\wäöüß&.\- ]{2,40}?\s(?:GmbH(?:\s*&\s*Co\.?\s*KG)?|UG(?:\s*\(haftungsbeschränkt\))?|GbR|OHG|KG|e\.K\.))/)?.[1]?.trim() ?? null;
  return { name, company, email, phone };
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Term matching is tiered by length, and the tiers are not cosmetic.
 *
 * Naive substring matching is catastrophic in German: the abbreviation "EÜR"
 * folds to "euer", which is a substring of "steuerberater" — so an objection
 * about a Steuerbescheid scored as a routine profit-calculation mandate and the
 * one-month appeal deadline was never surfaced. Hence:
 *
 *   ≤3 chars  whole word only      "KG" must not fire inside "Verpackung"
 *   4–7       must start a word    "Lohn" should still catch "Lohnbuchhaltung"
 *   ≥8        free substring       "bescheid" must catch "Steuerbescheid"
 *
 * The middle tier is the one doing the real work: German compounds are built by
 * prefixing, so anchoring at a word start keeps compound recall while killing
 * the accidental infix hits.
 */
function termMatches(hay, term) {
  const t = foldUmlauts(term);
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (t.length <= 3) return new RegExp(`\\b${esc}\\b`).test(hay);
  if (t.length <= 7) return new RegExp(`\\b${esc}`).test(hay);
  return hay.includes(t);
}

function classify(text) {
  const hay = foldUmlauts(text.toLowerCase());
  const scored = MANDATE_TYPES.map((t) => {
    const matched = [];
    let score = 0;
    for (const [term, w] of Object.entries(t.terms)) {
      if (termMatches(hay, term)) {
        score += w;
        matched.push(term);
      }
    }
    return { type: t, score, matched };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return { primary: null, secondary: [], confidence: 0 };

  const total = scored.reduce((a, b) => a + b.score, 0);
  return {
    primary: scored[0],
    secondary: scored.slice(1, 3),
    confidence: Math.min(0.97, scored[0].score / Math.max(total, scored[0].score + 2)),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function analyseIntake(text, index, today = new Date()) {
  const cls = classify(text);
  const contact = extractContact(text);
  const money = parseMoney(text);
  const dates = parseDates(text);

  const legalForm = LEGAL_FORMS.find(([re]) => re.test(text))?.[1] ?? null;
  const turnover = money.length ? money.reduce((a, b) => (b.value > a.value ? b : a)) : null;

  // Deadline arithmetic — deterministic, and the reason this is code not prose.
  let deadline = null;
  const dl = cls.primary?.type.deadline;
  if (dl && dates.length) {
    const base = dates.reduce((a, b) => (b.date > a.date ? b : a));
    const due = new Date(base.date);
    due.setMonth(due.getMonth() + dl.months);
    const daysLeft = Math.round((due - today) / 86400000);
    deadline = {
      basis: dl.from, baseDate: fmtDate(base.date), baseRaw: base.raw,
      due: fmtDate(due), daysLeft, cite: dl.cite,
      state: daysLeft < 0 ? 'expired' : daysLeft <= 7 ? 'critical' : 'running',
    };
  } else if (dl) {
    deadline = { basis: dl.from, cite: dl.cite, state: 'undated' };
  }

  // Priority: urgency of the mandate type, escalated by a live deadline.
  let priority = cls.primary ? cls.primary.type.urgency : 1;
  if (deadline && (deadline.state === 'critical' || deadline.state === 'expired')) priority = 3;
  const priorityLabel = { 3: 'P1 — same day', 2: 'P2 — within 48h', 1: 'P3 — this week' }[priority];

  // Statutory anchors, retrieved live from the same corpus the Q&A uses.
  const anchors = [];
  if (cls.primary && index) {
    for (const q of cls.primary.type.anchors) {
      const hit = index.search(q, 1)[0];
      if (hit && !anchors.some((a) => a.cite === hit.cite)) anchors.push(hit);
    }
  }

  // Turnover-triggered observations — the small checks a good assistant makes.
  const observations = [];
  if (turnover) {
    const v = turnover.value;
    if (v > 800000) {
      observations.push(`Stated turnover ${turnover.raw} exceeds 800.000 € — bookkeeping obligation under § 141 Abs. 1 AO is likely, and there is no e-invoicing transition relief for 2027.`);
    } else if (v > 100000) {
      observations.push(`Stated turnover ${turnover.raw} is above the 100.000 € ceiling — the Kleinunternehmer exemption under § 19 Abs. 1 UStG does not apply.`);
    } else if (v <= 25000) {
      observations.push(`Stated turnover ${turnover.raw} is within the 25.000 € look-back limit — check whether § 19 Abs. 1 UStG applies before setting up VAT filings.`);
    }
  }
  if (cls.primary?.type.id === 'erechnung' && !turnover) {
    observations.push('No turnover stated. Prior-year turnover decides whether the 800.000 € transition relief for 2027 applies — request it before scoping the migration.');
  }
  if (!cls.primary) {
    observations.push('No mandate type matched with confidence. Route to a human for classification rather than auto-replying.');
  }

  return {
    classification: cls,
    contact, legalForm, turnover, dates,
    priority, priorityLabel,
    deadline, anchors, observations,
    docs: cls.primary?.type.docs ?? [],
    fee: cls.primary?.type.fee ?? null,
    fit: cls.primary?.type.fit ?? null,
    flag: cls.primary?.type.flag ?? null,
    email: draftEmail({ cls, contact, deadline, docs: cls.primary?.type.docs ?? [] }),
  };
}

/**
 * Drafts the reply in German — this is a client-facing artefact, and a practice
 * would never send it in English. Deliberately does not give substantive advice:
 * it acknowledges, secures the deadline, and requests documents.
 */
function draftEmail({ cls, contact, deadline, docs }) {
  const salutation = contact.name
    ? `Guten Tag ${contact.name},`
    : 'Guten Tag,';

  const opener = {
    einspruch: 'vielen Dank für Ihre Nachricht und die Übersendung des Steuerbescheids.',
    selbstanzeige: 'vielen Dank für Ihre Nachricht. Wir behandeln Ihr Anliegen selbstverständlich streng vertraulich.',
    betriebspruefung: 'vielen Dank für Ihre Nachricht zur angekündigten Betriebsprüfung.',
    erechnung: 'vielen Dank für Ihre Anfrage zur Umstellung auf die E-Rechnung.',
    beraterwechsel: 'vielen Dank für Ihr Interesse an einer Zusammenarbeit mit unserer Kanzlei.',
    existenzgruendung: 'herzlichen Glückwunsch zur Gründung und vielen Dank für Ihre Anfrage.',
    gmbh: 'vielen Dank für Ihre Anfrage zum Jahresabschluss.',
    eur: 'vielen Dank für Ihre Anfrage zur Gewinnermittlung.',
    lohn: 'vielen Dank für Ihre Anfrage zur Lohnbuchhaltung.',
    privat: 'vielen Dank für Ihre Anfrage zu Ihrer Einkommensteuererklärung.',
  }[cls.primary?.type.id] ?? 'vielen Dank für Ihre Nachricht.';

  const parts = [salutation, '', opener, ''];

  if (deadline?.due) {
    parts.push(
      `Wir haben Ihren Vorgang vorgemerkt. Nach unserer Berechnung endet die Einspruchsfrist am **${deadline.due}** (ein Monat nach Bekanntgabe, ${deadline.cite}). Wir haben die Frist in unserer Fristenkontrolle erfasst.`,
      ''
    );
  } else if (deadline) {
    parts.push(
      `Bitte teilen Sie uns das Bekanntgabedatum des Bescheids mit — davon hängt der Fristablauf ab (${deadline.cite}).`,
      ''
    );
  }

  if (docs.length) {
    parts.push('Damit wir schnell für Sie tätig werden können, benötigen wir von Ihnen:', '');
    docs.forEach((d, i) => parts.push(`${i + 1}. ${d}`));
    parts.push('');
  }

  parts.push(
    'Sie können uns die Unterlagen einfach als Antwort auf diese E-Mail zusenden.',
    '',
    'Bitte beachten Sie, dass mit dieser Nachricht noch kein Mandatsverhältnis begründet wird und sie keine steuerliche Beratung im Einzelfall darstellt.',
    '',
    'Mit freundlichen Grüßen',
    'Kanzlei Musterberater PartG mbB'
  );

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Demo scenarios — written the way these actually arrive
// ---------------------------------------------------------------------------

export const SCENARIOS = [
  {
    label: 'Objection, clock running',
    hint: 'Deadline arithmetic from a date buried in prose',
    text: `Telefonnotiz, eingegangen 09:14

Anruferin: Frau Kessler, Kessler Sanitär GmbH, 0171 4453321, m.kessler@kessler-sanitaer.de

Sie sagt, sie hat am 03.07.2026 einen Steuerbescheid vom Finanzamt bekommen und soll auf einmal 14.800 Euro nachzahlen. Sie versteht das nicht, ihr bisheriger Steuerberater meldet sich seit Wochen nicht. Sie fragt ob man da noch was machen kann und was das kostet. Umsatz letztes Jahr war ungefähr 640.000 €. Bittet um Rückruf heute.`,
  },
  {
    label: 'E-invoicing migration',
    hint: 'Turnover drives the transition relief',
    text: `Von: t.baumann@baumann-elektro.de
Betreff: Frage E-Rechnung

Sehr geehrte Damen und Herren,

wir sind ein Elektrobetrieb (Baumann Elektrotechnik GmbH & Co. KG) mit rund 1,2 Mio Euro Jahresumsatz und schreiben aktuell noch alle Rechnungen als PDF per Mail. Unsere Auftraggeber sind überwiegend Bauträger und die Stadt.

Jetzt hören wir dauernd von XRechnung und ZUGFeRD und dass wir umstellen müssen. Uns ist ehrlich gesagt nicht klar bis wann und was genau. Können Sie uns dabei begleiten?

Mit freundlichen Grüßen
Thomas Baumann`,
  },
  {
    label: 'Founder, low value',
    hint: 'Should qualify as low priority — and say so',
    text: `Kontaktformular

Hallo, mein Name ist Jonas Reinhardt. Ich habe mich letzten Monat selbständig gemacht als Webdesigner, Einzelunternehmen. Rechne dieses Jahr mit vielleicht 18.000 Euro Umsatz. Brauche jemanden für die Steuererklärung und weiß nicht ob ich Umsatzsteuer draufschreiben muss. Erreichbar unter jonas.reinhardt@gmail.com.`,
  },
  {
    label: 'Voluntary disclosure',
    hint: 'Must escalate, must not auto-advise',
    text: `Telefonnotiz, eingegangen 17:52 — Anrufer wollte Namen zunächst nicht nennen

Herr Neumann. Sagt, er hat über mehrere Jahre Einkünfte aus einer Vermietung in Österreich nicht erklärt. Ungefähr 30.000 Euro pro Jahr, seit ca. 2019. Hat gelesen dass eine Selbstanzeige noch straffrei möglich ist und will wissen ob das für ihn noch geht. Ist sehr nervös, fragt ob das Gespräch vertraulich ist.

Rückruf erbeten: 0160 2233445`,
  },
  {
    label: 'Audit announced',
    hint: 'High-value switching trigger',
    text: `Von: buero@hansen-logistik.de

Guten Tag,

wir haben gestern eine Prüfungsanordnung für eine Betriebsprüfung der Jahre 2022 bis 2024 erhalten, datiert auf den 15.07.2026. Wir sind eine Spedition mit 22 Mitarbeitern, Hansen Logistik GmbH, Umsatz ca. 4,3 Mio Euro.

Unser jetziger Steuerberater sagt, er hat dafür keine Kapazitäten. Können Sie die Prüfungsbegleitung übernehmen? Es eilt.

Freundliche Grüße
Kerstin Hansen`,
  },
];
