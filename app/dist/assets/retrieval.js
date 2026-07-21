/**
 * Hybrid retrieval over the German tax corpus — runs entirely in the browser.
 *
 * No vector database, no embedding API, no backend. A BM25 index over 4.4k
 * §-level chunks builds in well under a second, which is the whole reason this
 * demo can be a static folder you drop on any host.
 *
 * The interesting part is not BM25 — it is the three German-specific layers on
 * top of it, because plain lexical search fails badly on this language:
 *
 *   1. Morphological normalisation (umlauts, ß, conservative suffix stripping)
 *   2. Compound-aware matching — "Kleinunternehmerregelung" must find
 *      "Kleinunternehmer", which no exact-match index will ever do
 *   3. A curated domain lexicon mapping how practitioners *speak* to how the
 *      statute is *written* ("Betriebsprüfung" → "Außenprüfung",
 *      "Pendlerpauschale" → "Entfernungspauschale")
 *
 * Layer 3 is the one that generalises into a moat: it is accumulated vertical
 * knowledge, it is wrong in ways only a tax person can spot, and it gets better
 * every time a real practice uses the product. A horizontal RAG tool has no
 * mechanism to ever acquire it.
 */

const STOPWORDS = new Set(`
aber alle allem allen aller alles als also am an ander andere anderem anderen anderer anderes
auch auf aus bei beim bin bis bist da damit dann der den des dem die das dass daß derselbe
dazu dein deine dem den denn denen der deren dessen dich dir du dies diese diesem diesen dieser
dieses doch dort durch ein eine einem einen einer eines einig einige er es euer eure für gegen
gewesen hab habe haben hat hatte hatten hier hin hinter ich ihr ihre ihrem ihren ihrer ihres im
in indem ins ist ja jede jedem jeden jeder jedes jene jetzt kann kann können könnte man manche
mein meine mit muss musste nach nicht nichts noch nun nur ob oder ohne sehr sein seine seinem
seinen seiner seines selbst sich sie sind so solche soll sollte sondern sonst über um und uns
unse unser unter viel vom von vor war waren was weg weil weiter welche wenn werde werden wie
wieder wir wird wirst wo wollen wollte würde würden zu zum zur zwar zwischen
what which the and for are how much when where who with this that from
a an is it its of to in on at be been am do does did can could should would will
i we you my our your me us have has had not no if or but as by about long any
`.trim().split(/\s+/));

/** Practitioner vocabulary → statute vocabulary. Hand-curated; this is the asset. */
const LEXICON = {
  'e-rechnung': ['elektronische rechnung', 'rechnung', 'elektronisch', 'strukturiert', 'format'],
  'erechnung': ['elektronische rechnung', 'rechnung', 'elektronisch'],
  'xrechnung': ['elektronische rechnung', 'rechnung', 'elektronisch', 'format'],
  'zugferd': ['elektronische rechnung', 'rechnung', 'format'],
  'pendlerpauschale': ['entfernungspauschale', 'wege', 'wohnung', 'betriebsstätte'],
  'betriebspruefung': ['außenprüfung', 'prüfungsanordnung', 'prüfung'],
  'betriebsprüfung': ['außenprüfung', 'prüfungsanordnung', 'prüfung'],
  'steuerpruefung': ['außenprüfung', 'prüfung'],
  'homeoffice': ['häusliches arbeitszimmer', 'arbeitszimmer', 'tagespauschale'],
  'arbeitszimmer': ['häusliches arbeitszimmer', 'arbeitszimmer', 'tagespauschale'],
  'firmenwagen': ['kraftfahrzeug', 'private nutzung', 'listenpreis', 'fahrtenbuch'],
  'dienstwagen': ['kraftfahrzeug', 'private nutzung', 'listenpreis', 'fahrtenbuch'],
  'geschaeftswagen': ['kraftfahrzeug', 'private nutzung', 'listenpreis'],
  'kleinunternehmer': ['kleinunternehmer', 'gesamtumsatz', 'steuerfrei'],
  'kleinunternehmerregelung': ['kleinunternehmer', 'gesamtumsatz'],
  'umsatzgrenze': ['gesamtumsatz', 'überschritten', 'kalenderjahr'],
  'aufbewahrungsfrist': ['aufbewahren', 'aufbewahrungsfrist', 'unterlagen', 'jahre'],
  'aufbewahrung': ['aufbewahren', 'unterlagen', 'geordnet'],
  'abgabefrist': ['steuererklärung', 'frist', 'abzugeben', 'kalenderjahr'],
  'fristverlaengerung': ['frist', 'verlängerung', 'verlängern'],
  'verspaetung': ['verspätungszuschlag', 'verspätet'],
  'saeumnis': ['säumniszuschlag', 'säumnis'],
  'honorar': ['vergütung', 'gebühr', 'gegenstandswert', 'zeitgebühr'],
  'gebuehren': ['gebühr', 'vergütung', 'gegenstandswert', 'zeitgebühr'],
  'stundensatz': ['zeitgebühr', 'viertel stunde', 'vergütung'],
  'abrechnung': ['vergütung', 'gebühr', 'berechnung'],
  'bewirtung': ['bewirtung', 'geschäftlicher anlass', 'angemessen'],
  'geschenke': ['geschenke', 'empfänger', 'betriebsausgaben'],
  'abschreibung': ['absetzung für abnutzung', 'anschaffungskosten', 'nutzungsdauer'],
  'afa': ['absetzung für abnutzung', 'anschaffungskosten', 'nutzungsdauer'],
  'geringwertig': ['geringwertige wirtschaftsgüter', 'anschaffungskosten'],
  'gwg': ['geringwertige wirtschaftsgüter', 'anschaffungskosten'],
  'vorsteuer': ['vorsteuerabzug', 'vorsteuer', 'rechnung'],
  'reverse': ['leistungsempfänger', 'steuerschuldner'],
  'einnahmenueberschussrechnung': ['überschuss', 'betriebseinnahmen', 'betriebsausgaben'],
  'euer': ['überschuss', 'betriebseinnahmen', 'betriebsausgaben'],
  'buchfuehrungspflicht': ['buchführung', 'bücher', 'verpflichtet', 'umsatz'],
  'bilanz': ['jahresabschluss', 'bilanz', 'inventar'],
  'selbstanzeige': ['selbstanzeige', 'berichtigung', 'straffreiheit'],
  'schaetzung': ['schätzung', 'besteuerungsgrundlagen'],
  'einspruch': ['einspruch', 'rechtsbehelf', 'frist'],
  'kasse': ['kassenbuch', 'kasseneinnahmen', 'aufzeichnungen'],
  'gobd': ['ordnungsmäßig', 'buchführung', 'aufzeichnungen', 'unveränderbar'],
  'lohnsteuer': ['lohnsteuer', 'arbeitslohn', 'arbeitgeber'],
  'minijob': ['geringfügig', 'arbeitslohn', 'pauschal'],
  'gmbh': ['körperschaft', 'kapitalgesellschaft', 'gesellschaft'],
  'gewerbesteuer': ['gewerbeertrag', 'gewerbebetrieb', 'messbetrag'],
  'freibetrag': ['freibetrag', 'übersteigt'],
  'umsatzsteuervoranmeldung': ['voranmeldung', 'voranmeldungszeitraum'],
  'uva': ['voranmeldung', 'voranmeldungszeitraum'],
  'dauerfristverlaengerung': ['dauerfristverlängerung', 'fristverlängerung', 'voranmeldung'],
  'existenzgruendung': ['betrieb', 'eröffnung', 'gewerblich', 'anzeige'],
  'gruendung': ['eröffnung', 'betrieb', 'anzeige'],
  'steuererklärung': ['steuererklärung', 'abzugeben', 'frist', 'kalenderjahr'],
  'erklärung abgeben': ['steuererklärung', 'abzugeben', 'frist'],
  'bücher': ['buchführungspflicht', 'buchführung', 'bücher', 'aufzeichnungen'],
  'buchführung': ['buchführungspflicht', 'buchführung', 'bücher'],
  'wie lange': ['frist', 'innerhalb', 'monat', 'jahre'],
  'vorsteuerabzug': ['vorsteuerabzug', 'vorsteuer'],
  'einspruchsfrist': ['einspruch', 'frist', 'innerhalb', 'monat'],
};

/** Laws we can hint at from a query mentioning them by name. */
const LAW_HINTS = {
  ustg: 'UStG', umsatzsteuer: 'UStG', mehrwertsteuer: 'UStG', vat: 'UStG',
  estg: 'EStG', einkommensteuer: 'EStG',
  ao: 'AO', abgabenordnung: 'AO',
  stbvv: 'StBVV', vergütungsverordnung: 'StBVV',
  gewstg: 'GewStG', gewerbesteuer: 'GewStG',
  kstg: 'KStG', körperschaftsteuer: 'KStG',
  hgb: 'HGB', handelsgesetzbuch: 'HGB',
};

// ---------------------------------------------------------------------------
// Tokenisation
// ---------------------------------------------------------------------------

export function foldUmlauts(s) {
  return s
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
}

/**
 * Conservative suffix stripping — enough to unify plurals, not enough to
 * collide senses.
 *
 * The -ungen rule matters more than it looks: the statute writes
 * "Steuererklärungen", the practitioner types "Steuererklärung", and without
 * folding those together §149 AO never surfaces for "when is the return due".
 */
function stem(w) {
  if (w.length > 8 && w.endsWith('ungen')) return w.slice(0, -2);
  if (w.length > 6) {
    for (const suf of ['enden', 'ende', 'ern', 'em', 'es']) {
      if (w.endsWith(suf)) return w.slice(0, -suf.length);
    }
  }
  if (w.length > 5) {
    for (const suf of ['en', 'er', 'e', 'n', 's']) {
      if (w.endsWith(suf)) return w.slice(0, -suf.length);
    }
  }
  return w;
}

export function tokenize(text) {
  const raw = foldUmlauts(text.toLowerCase())
    .replace(/[^a-z0-9§äöüß\s-]/g, ' ')
    .split(/[\s-]+/);
  const out = [];
  for (const w of raw) {
    if (!w || w.length < 2) continue;
    if (STOPWORDS.has(w)) continue;
    out.push(stem(w));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

const K1 = 1.4;
const B = 0.72;

export class Index {
  constructor(chunks) {
    this.chunks = chunks;
    this.postings = new Map();   // term -> [docId, tf, docId, tf, ...]
    this.docLen = new Float32Array(chunks.length);
    this.N = chunks.length;

    const t0 = performance.now();
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      // Statute headings are unusually information-dense ("Frist für den
      // Einspruch"), so they get weighted 3x against the body.
      const toks = tokenize(`${c.title} ${c.title} ${c.title} ${c.section} ${c.law} ${c.text}`);
      this.docLen[i] = toks.length;
      const tf = new Map();
      for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
      for (const [t, f] of tf) {
        let p = this.postings.get(t);
        if (!p) { p = []; this.postings.set(t, p); }
        p.push(i, f);
      }
    }
    let sum = 0;
    for (let i = 0; i < this.N; i++) sum += this.docLen[i];
    this.avgdl = sum / this.N;
    this.vocab = [...this.postings.keys()];
    this.buildMs = Math.round(performance.now() - t0);
  }

  idf(term) {
    const p = this.postings.get(term);
    const df = p ? p.length / 2 : 0;
    return Math.log(1 + (this.N - df + 0.5) / (df + 0.5));
  }

  /**
   * Expands a query into weighted terms:
   *   exact query terms (1.0) → lexicon synonyms (0.75) → compound matches (0.5)
   */
  expand(query) {
    const base = tokenize(query);
    const weights = new Map();
    const add = (t, w) => weights.set(t, Math.max(weights.get(t) || 0, w));

    for (const t of base) add(t, 1);

    const folded = foldUmlauts(query.toLowerCase());
    for (const [key, syns] of Object.entries(LEXICON)) {
      if (folded.includes(foldUmlauts(key))) {
        for (const s of syns) for (const t of tokenize(s)) add(t, 0.75);
      }
    }

    // Compound splitting: a long query term that is a substring of an indexed
    // term (or vice versa) is very likely the same concept in German.
    for (const t of base) {
      if (t.length < 6) continue;
      let hits = 0;
      for (const v of this.vocab) {
        if (v === t || v.length < 5) continue;
        if (v.includes(t) || (t.includes(v) && v.length >= 6)) {
          add(v, 0.5);
          if (++hits > 12) break;
        }
      }
    }
    return weights;
  }

  search(query, limit = 8) {
    const weights = this.expand(query);
    if (!weights.size) return [];

    const scores = new Map();
    for (const [term, w] of weights) {
      const p = this.postings.get(term);
      if (!p) continue;
      const idf = this.idf(term);
      for (let j = 0; j < p.length; j += 2) {
        const doc = p[j], f = p[j + 1];
        const dl = this.docLen[doc];
        const s = idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (dl / this.avgdl))));
        scores.set(doc, (scores.get(doc) || 0) + s * w);
      }
    }

    // Explicit paragraph reference: "§ 15 UStG" or "15 UStG" should win outright.
    const secRef = query.match(/§\s*(\d+[a-z]?)/);
    const lawRef = Object.entries(LAW_HINTS).find(([k]) =>
      foldUmlauts(query.toLowerCase()).includes(foldUmlauts(k)));
    for (const [doc, s] of scores) {
      const c = this.chunks[doc];
      let boost = 1;
      if (secRef && c.num === secRef[1]) boost *= 3.5;
      if (lawRef && c.law === lawRef[1]) boost *= 1.6;
      if (boost !== 1) scores.set(doc, s * boost);
    }

    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);

    // Diversity: at most 2 chunks from the same § so one long paragraph cannot
    // crowd out the rest of the answer.
    const perSection = new Map();
    const out = [];
    const top = ranked[0]?.[1] || 1;
    for (const [doc, score] of ranked) {
      const c = this.chunks[doc];
      const key = `${c.law}-${c.num}`;
      const n = perSection.get(key) || 0;
      if (n >= 2) continue;
      perSection.set(key, n + 1);
      out.push({ ...c, score, relevance: score / top });
      if (out.length >= limit) break;
    }
    return out;
  }
}

/** Highlights query terms inside a passage, for the "verify it yourself" view. */
export function highlight(text, query) {
  const terms = [...new Set(tokenize(query))].filter((t) => t.length > 3);
  if (!terms.length) return escapeHtml(text);
  let html = escapeHtml(text);
  for (const t of terms.sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w{0,6})`, 'gi');
    html = html.replace(re, '<mark>$1</mark>');
  }
  return html;
}

export function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
