/**
 * TaxHub front end.
 *
 * Three answer modes, and the UI is explicit about which one produced what you
 * are reading — an assistant in this vertical that blurs the line between
 * "grounded" and "generated" is worse than no assistant at all:
 *
 *   live      — an Anthropic key is configured; Claude synthesises over the
 *               retrieved passages under a strict grounding prompt
 *   seeded    — no key, but the question matches one of the pre-written
 *               grounded answers in answers.json
 *   retrieval — no key and no match: real search results, no synthesis, no
 *               invented prose
 *
 * Retrieval is live in all three. Citations resolve against the loaded corpus
 * in all three, so a chip that cannot be resolved renders as broken rather than
 * silently looking authoritative.
 */

import { Index, highlight, escapeHtml, tokenize } from './retrieval.js';
import { analyseIntake, SCENARIOS } from './intake.js';

const MODEL = 'claude-sonnet-5';
const KEY_STORE = 'taxhub.anthropic.key';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

let index = null;
let corpus = null;
let seeded = [];
let byCite = new Map();
let lastSources = [];

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function boot() {
  const [c, a] = await Promise.all([
    fetch('data/corpus.json').then((r) => r.json()),
    fetch('data/answers.json').then((r) => r.json()),
  ]);
  corpus = c;
  seeded = a.answers;

  index = new Index(c.chunks);
  for (const ch of c.chunks) if (!byCite.has(ch.cite)) byCite.set(ch.cite, ch);

  $('#stat-chunks').textContent = c.meta.totalChunks.toLocaleString('en-US');
  $('#stat-laws').textContent = c.meta.laws.length;
  $('#stat-build').textContent = c.meta.statuteBuildDate;

  // Seeded questions double as the example chips.
  const ex = $('#examples');
  for (const s of seeded) {
    const b = el('button', null, escapeHtml(s.q));
    b.onclick = () => { $('#q').value = s.q; ask(s.q); };
    ex.append(b);
  }

  const sc = $('#scenarios');
  SCENARIOS.forEach((s) => {
    const b = el('button', null, `${escapeHtml(s.label)} <span class="hint">— ${escapeHtml(s.hint)}</span>`);
    b.onclick = () => { $('#intake-text').value = s.text; runIntake(); };
    sc.append(b);
  });

  $('#ask-btn').disabled = false;
  refreshKeyState();
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  for (const x of $('#tabs').children) x.classList.toggle('on', x === b);
  for (const name of ['knowledge', 'intake', 'thesis']) {
    $(`#tab-${name}`).hidden = name !== b.dataset.tab;
  }
});

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

/** Minimal inline markup: **bold** and [[citation]]. Escapes first. */
function renderInline(text) {
  let h = escapeHtml(text);
  h = h.replace(/\[\[(.+?)\]\]/g, (_, cite) => {
    const key = cite.trim();
    const hit = byCite.get(key);
    if (!hit) {
      return `<span class="cite dead" title="This citation does not resolve to a chunk in the loaded corpus.">${escapeHtml(key)} ?</span>`;
    }
    return `<button class="cite" data-cite="${escapeHtml(key)}">${escapeHtml(key)}</button>`;
  });
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/`(.+?)`/g, '<code>$1</code>');
  return h;
}

function renderSources(hits, query) {
  const box = $('#sources');
  box.textContent = '';
  for (const h of hits) {
    const d = el('details', 'src');
    d.dataset.cite = h.cite;
    const pct = Math.round(h.relevance * 100);
    d.append(el('summary', null, `
      <span class="cite-key">${escapeHtml(h.cite)}</span>
      <span class="title">${escapeHtml(h.title || h.lawLong)}</span>
      <span class="rel">${pct}%</span>`));
    d.append(el('div', 'relbar', `<i style="width:${pct}%"></i>`));
    d.append(el('div', 'body', highlight(h.text, query)));
    d.append(el('div', 'srcfoot',
      `<a href="${h.url}" target="_blank" rel="noopener">Open ${escapeHtml(h.section)} ${escapeHtml(h.law)} on gesetze-im-internet.de →</a>`));
    box.append(d);
  }
  $('#retr-meta').textContent =
    `— ${hits.length} of ${corpus.meta.totalChunks.toLocaleString('en-US')} chunks, ranked by hybrid BM25`;
}

/** Clicking a citation chip opens and flashes the matching source card. */
document.addEventListener('click', (e) => {
  const c = e.target.closest('.cite[data-cite]');
  if (!c) return;
  const card = document.querySelector(`.src[data-cite="${CSS.escape(c.dataset.cite)}"]`);
  if (!card) return;
  card.open = true;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('flash');
  setTimeout(() => card.classList.remove('flash'), 1400);
});

function setMode(kind, text) {
  const labels = { live: 'Live synthesis', seeded: 'Pre-generated', retrieval: 'Retrieval only', err: 'Error' };
  $('#mode-bar').innerHTML =
    `<span class="badge ${kind}">${labels[kind]}</span><span>${text}</span>`;
}

// ---------------------------------------------------------------------------
// Seeded matching
// ---------------------------------------------------------------------------

/** Token-overlap match of the query against each seeded question and its variants. */
function matchSeeded(query) {
  const q = new Set(tokenize(query));
  if (!q.size) return null;
  let best = null;
  for (const s of seeded) {
    for (const cand of [s.q, ...s.variants]) {
      const c = new Set(tokenize(cand));
      if (!c.size) continue;
      let inter = 0;
      for (const t of q) if (c.has(t)) inter++;
      // Asymmetric: covering the query matters more than covering the variant.
      const score = (inter / q.size) * 0.7 + (inter / c.size) * 0.3;
      if (!best || score > best.score) best = { entry: s, score, inter };
    }
  }
  // Two independent terms must agree. Without this, a short off-topic query
  // ("what is the corporate tax rate?") shares one token with a variant and
  // scores high enough to serve a confidently wrong pre-written answer.
  return best && best.score >= 0.42 && best.inter >= 2 ? best : null;
}

function renderSeeded(entry) {
  const a = $('#answer');
  a.textContent = '';
  for (const b of entry.blocks) {
    if (b.h) a.append(el('h4', null, escapeHtml(b.h)));
    a.append(el('p', null, renderInline(b.t)));
  }
  if (entry.caveat) a.append(el('div', 'caveat', renderInline(entry.caveat)));
}

// ---------------------------------------------------------------------------
// Live synthesis
// ---------------------------------------------------------------------------

const SYSTEM = `You are the knowledge assistant inside TaxHub, used by staff in a German tax practice (Steuerberaterkanzlei).

You answer ONLY from the numbered source passages supplied with the question. These are verbatim extracts from current German statutes.

Rules:
- Never state a rule, figure, threshold or deadline that is not present in the passages. If the passages do not answer the question, say so plainly and state what would need to be looked up instead. A missing answer is acceptable; an invented one is not.
- Cite with double brackets containing the exact citation key shown for the passage, e.g. [[§ 19 Abs. 1 UStG]]. Put the citation immediately after the sentence it supports. Never invent a citation key.
- Answer in English, but keep German legal terms in German (Gesamtumsatz, Buchungsbelege, Bekanntgabe) — the reader is a German tax professional.
- Be direct and practical. Lead with the answer. Use **bold** for figures and deadlines.
- Where useful, add a short heading with a single # prefix line for a second aspect.
- Close with a practical implication for the practice where there is a real one. Do not pad.
- You are not giving tax advice to an end client; you are helping a professional locate and apply the rule.`;

async function synthesise(query, hits, key) {
  const passages = hits.map((h, i) =>
    `[${i + 1}] citation key: ${h.cite}\nstatute: ${h.lawLong} (${h.law}) — ${h.section} ${h.title}\n---\n${h.text}`
  ).join('\n\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1400,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Source passages:\n\n${passages}\n\n---\n\nQuestion: ${query}` }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}`);
  }
  const json = await res.json();
  return json.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
}

function renderMarkdownish(text) {
  const a = $('#answer');
  a.textContent = '';
  for (const para of text.split(/\n{2,}/)) {
    const t = para.trim();
    if (!t) continue;
    if (/^#{1,4}\s/.test(t)) a.append(el('h4', null, renderInline(t.replace(/^#{1,4}\s/, ''))));
    else a.append(el('p', null, renderInline(t)));
  }
}

// ---------------------------------------------------------------------------
// Ask
// ---------------------------------------------------------------------------

async function ask(query) {
  query = query.trim();
  if (!query || !index) return;

  $('#knowledge-empty').hidden = true;
  $('#answer-region').hidden = false;
  $('#ask-btn').disabled = true;

  const t0 = performance.now();
  const hits = index.search(query, 8);
  const ms = Math.round(performance.now() - t0);
  lastSources = hits;
  renderSources(hits, query);

  if (!hits.length) {
    setMode('retrieval', `No passage matched in ${ms} ms.`);
    $('#answer').innerHTML = '<p class="muted">Nothing in the corpus matched that. The corpus covers EStG, UStG, AO, StBVV, GewStG, KStG, EStDV, UStDV and the bookkeeping sections of the HGB — questions outside those statutes will not resolve.</p>';
    $('#ask-btn').disabled = false;
    return;
  }

  const key = localStorage.getItem(KEY_STORE);

  if (key) {
    setMode('live', `Retrieved ${hits.length} passages in ${ms} ms. Synthesising with ${MODEL}…`);
    $('#answer').innerHTML = '<p class="loading"><span class="spin"></span>Grounding the answer in the retrieved paragraphs…</p>';
    try {
      const text = await synthesise(query, hits, key);
      renderMarkdownish(text);
      setMode('live', `Retrieved ${hits.length} passages in ${ms} ms, synthesised by ${MODEL} under a strict grounding prompt. Citations resolve to the passages below.`);
      $('#ask-btn').disabled = false;
      return;
    } catch (err) {
      setMode('err', `Live synthesis failed (${err.message}). Falling back to retrieval — the sources below are unaffected.`);
      // fall through to the no-key paths
    }
  }

  const match = matchSeeded(query);
  if (match) {
    renderSeeded(match.entry);
    setMode('seeded',
      `Retrieved ${hits.length} passages in ${ms} ms. No API key configured, so this is the pre-written grounded answer for “${match.entry.q}” (match ${Math.round(match.score * 100)}%). Its citations resolve against the live corpus.`);
  } else {
    const a = $('#answer');
    a.textContent = '';
    a.append(el('p', 'thinking',
      'No API key is configured and this question does not match one of the pre-written answers, so nothing has been synthesised — deliberately. Below are the actual passages retrieval returned, ranked, with your search terms highlighted.'));
    a.append(el('p', null,
      `Best match: ${renderInline(`[[${hits[0].cite}]]`)} — ${escapeHtml(hits[0].title || hits[0].lawLong)}.`));
    a.append(el('p', 'muted small',
      'Add an Anthropic API key at the bottom of the page to see the full grounded synthesis over these same passages.'));
    setMode('retrieval', `Retrieved ${hits.length} passages in ${ms} ms. No synthesis performed.`);
  }
  $('#ask-btn').disabled = false;
}

$('#ask-form').addEventListener('submit', (e) => {
  e.preventDefault();
  ask($('#q').value);
});

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

function runIntake() {
  const text = $('#intake-text').value.trim();
  const out = $('#intake-out');
  out.textContent = '';
  if (!text) return;

  const r = analyseIntake(text, index);
  const p = r.classification.primary;

  // Headline
  const head = el('div', 'panel');
  head.append(el('div', 'headline', `
    <span class="type">${p ? escapeHtml(p.type.label) : 'Unclassified'}</span>
    ${p ? `<span class="de">${escapeHtml(p.type.de)}</span>` : ''}
    <span class="pri p${4 - r.priority}">${escapeHtml(r.priorityLabel)}</span>`));
  if (p) {
    head.append(el('p', 'muted small',
      `Confidence ${Math.round(r.classification.confidence * 100)}% · matched <span class="matchterms">${p.matched.map(escapeHtml).join(', ')}</span>` +
      (r.classification.secondary.length
        ? ` · also considered ${r.classification.secondary.map((s) => escapeHtml(s.type.label)).join(', ')}`
        : '')));
    head.append(el('p', null, `<strong>Triage note.</strong> ${escapeHtml(p.type.fit)}`));
  }
  out.append(head);

  if (r.flag) out.append(el('div', 'flagbox', `<strong>Escalate.</strong> ${escapeHtml(r.flag)}`));

  // Deadline
  if (r.deadline) {
    const d = r.deadline;
    const box = el('div', `deadline ${d.state}`);
    if (d.state === 'undated') {
      box.innerHTML = `<div class="big">Deadline undetermined</div>
        <div>A statutory period runs from ${escapeHtml(d.basis)} (${escapeHtml(d.cite)}), but no date was found in the message. Request the notified date before anything else.</div>`;
    } else {
      const rel = d.daysLeft < 0
        ? `<strong>expired ${Math.abs(d.daysLeft)} days ago</strong>`
        : `<strong>${d.daysLeft} days remaining</strong>`;
      box.innerHTML = `<div class="big">Einspruchsfrist ends ${escapeHtml(d.due)} — ${rel}</div>
        <div>One month from ${escapeHtml(d.basis)}, detected as “${escapeHtml(d.baseRaw)}” in the message (${escapeHtml(d.cite)}).</div>`;
    }
    out.append(box);
  }

  // Structured record
  const rec = el('div', 'panel');
  rec.append(el('h3', null, 'Structured record'));
  const dl = el('dl', 'kv');
  const row = (k, v) => {
    dl.append(el('dt', null, escapeHtml(k)));
    dl.append(el('dd', v ? null : 'none', v ? escapeHtml(v) : 'not stated'));
  };
  row('Contact', r.contact.name);
  row('Company', r.contact.company);
  row('Legal form', r.legalForm);
  row('Email', r.contact.email);
  row('Phone', r.contact.phone);
  row('Turnover', r.turnover ? r.turnover.raw : null);
  row('Dates found', r.dates.length ? r.dates.map((d) => d.raw).join(', ') : null);
  row('Fee basis', r.fee);
  rec.append(dl);
  out.append(rec);

  if (r.observations.length) {
    const o = el('div', 'panel');
    o.append(el('h3', null, 'Automatic checks'));
    o.append(el('ul', 'obs', r.observations.map((x) => `<li>${escapeHtml(x)}</li>`).join('')));
    out.append(o);
  }

  if (r.docs.length) {
    const d = el('div', 'panel');
    d.append(el('h3', null, 'Documents to request'));
    d.append(el('ul', 'docs', r.docs.map((x) => `<li>${escapeHtml(x)}</li>`).join('')));
    out.append(d);
  }

  if (r.anchors.length) {
    const a = el('div', 'panel');
    a.append(el('h3', null, 'Statutory anchors — retrieved live from the same corpus'));
    for (const h of r.anchors) {
      const det = el('details', 'src');
      det.append(el('summary', null,
        `<span class="cite-key">${escapeHtml(h.cite)}</span><span class="title">${escapeHtml(h.title || h.lawLong)}</span>`));
      det.append(el('div', 'body', escapeHtml(h.text)));
      det.append(el('div', 'srcfoot', `<a href="${h.url}" target="_blank" rel="noopener">Open on gesetze-im-internet.de →</a>`));
      a.append(det);
    }
    out.append(a);
  }

  // Drafted reply
  const dr = el('div', 'panel');
  dr.append(el('h3', null, 'Drafted reply — German, ready to review and send'));
  const wrapEl = el('div', 'draft');
  wrapEl.append(el('pre', null, escapeHtml(r.email)));
  const copy = el('button', 'copy', 'Copy');
  copy.onclick = async () => {
    await navigator.clipboard.writeText(r.email);
    copy.textContent = 'Copied';
    setTimeout(() => (copy.textContent = 'Copy'), 1500);
  };
  wrapEl.append(copy);
  dr.append(wrapEl);
  out.append(dr);
}

$('#intake-form').addEventListener('submit', (e) => { e.preventDefault(); runIntake(); });

// ---------------------------------------------------------------------------
// API key
// ---------------------------------------------------------------------------

function refreshKeyState() {
  const has = !!localStorage.getItem(KEY_STORE);
  $('#keystate').textContent = has
    ? 'Key stored — live synthesis is on.'
    : 'No key stored — running in pre-generated / retrieval-only mode.';
  $('#keystate').style.color = has ? 'var(--ok)' : 'var(--ink-3)';
}

$('#savekey').onclick = () => {
  const v = $('#apikey').value.trim();
  if (!v) return;
  localStorage.setItem(KEY_STORE, v);
  $('#apikey').value = '';
  refreshKeyState();
};
$('#clearkey').onclick = () => { localStorage.removeItem(KEY_STORE); refreshKeyState(); };

boot().catch((err) => {
  document.body.prepend(el('div', 'wrap',
    `<p style="color:var(--crit);padding:20px">Failed to load the corpus: ${escapeHtml(err.message)}. This page must be served over HTTP — opening index.html directly from disk will not work.</p>`));
});
