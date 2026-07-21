/**
 * TaxHub front end.
 *
 * Three answer modes, and the UI is explicit about which one produced what you
 * are reading — an assistant in this vertical that blurs the line between
 * "grounded" and "generated" is worse than no assistant at all:
 *
 *   live      — a model is connected; it synthesises over the retrieved
 *               passages under a strict grounding prompt
 *   seeded    — no model, but the question matches a pre-written grounded answer
 *   retrieval — no model and no match: real search results, no synthesis, no
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
const RECENT_STORE = 'taxhub.recent';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
// Yields to the event loop so the boot progress actually paints between steps.
// Deliberately setTimeout rather than requestAnimationFrame: rAF is tied to
// compositing and does not fire in headless/background contexts, which would
// leave boot wedged on the first step forever.
const yieldPaint = () => new Promise((r) => setTimeout(r, 16));

/**
 * Data loading works two ways from one codebase:
 *   served  — fetch the JSON alongside the page
 *   bundled — read it from an inlined JSON block embedded in the document, so
 *             the single-file build runs from file:// with no server
 *
 * (Deliberately no literal script-tag text anywhere in this file: the HTML
 * parser ends a script at the first closing tag it sees, even inside a comment.)
 */
async function loadData(name) {
  const inline = document.getElementById(`data-${name}`);
  if (inline) return JSON.parse(inline.textContent);
  return fetch(`data/${name}.json`).then((r) => r.json());
}

/**
 * localStorage throws in some file:// and private-browsing contexts. Losing the
 * saved key or question history is survivable; a boot crash is not.
 */
const store = {
  get(k) { try { return store.get(k); } catch { return null; } },
  set(k, v) { try { store.set(k, v); } catch { /* non-fatal */ } },
  del(k) { try { store.del(k); } catch { /* non-fatal */ } },
};

async function copy(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg);
  } catch {
    toast('Copy blocked by the browser — select the text manually');
  }
}

let index = null;
let corpus = null;
let seeded = [];
const byCite = new Map();

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function boot() {
  const step = (msg, pct) => {
    $('#boot-step').textContent = msg;
    $('#boot-bar').style.width = `${pct}%`;
  };

  step('Loading statute corpus…', 12);
  await yieldPaint();
  const [c, a] = await Promise.all([loadData('corpus'), loadData('answers')]);
  corpus = c;
  seeded = a.answers;

  step(`Indexing ${c.meta.totalChunks.toLocaleString('en-US')} passages…`, 55);
  await yieldPaint();
  index = new Index(c.chunks);
  for (const ch of c.chunks) if (!byCite.has(ch.cite)) byCite.set(ch.cite, ch);

  step('Ready', 100);

  // Sidebar facts
  $('#stat-chunks').textContent = c.meta.totalChunks.toLocaleString('en-US');
  $('#stat-laws').textContent = c.meta.laws.length;
  $('#stat-build').textContent = new Date(c.meta.statuteBuildDate)
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  for (const law of c.meta.laws) {
    const li = el('li', null, escapeHtml(law.abbr));
    li.title = `${law.long} — ${law.sections} §§, ${law.chunks} passages`;
    $('#lawlist').append(li);
  }
  $('#set-sources').textContent =
    `${c.meta.totalChunks.toLocaleString('en-US')} passages from ${c.meta.laws.length} statutes: ` +
    `${c.meta.laws.map((l) => l.abbr).join(', ')}. Statute text current as of ${c.meta.statuteBuildDate}.`;

  // Seeded questions double as the suggested questions.
  for (const s of seeded) {
    const b = el('button', null, escapeHtml(s.q));
    b.onclick = () => { $('#q').value = s.q; ask(s.q); };
    $('#examples').append(b);
  }

  SCENARIOS.forEach((s, i) => {
    const li = el('li');
    const b = el('button', null,
      `<span class="sl">${escapeHtml(s.label)}</span><span class="sh">${escapeHtml(s.hint)}</span>`);
    b.onclick = () => {
      for (const other of $('#scenarios').querySelectorAll('button')) other.classList.remove('on');
      b.classList.add('on');
      $('#intake-text').value = s.text;
      runIntake();
    };
    li.append(b);
    $('#scenarios').append(li);
  });
  $('#intake-count').textContent = SCENARIOS.length;
  $('#intake-count').hidden = false;

  renderRecent();
  refreshKeyState();

  $('#ask-btn').disabled = false;
  await yieldPaint();
  $('#boot').classList.add('gone');
  setTimeout(() => ($('#boot').hidden = true), 400);

  // Deep links: ?q=… reruns a question, ?tab=intake opens the other surface.
  // An answer is a URL you can send to a colleague, which is how this actually
  // gets used in a practice.
  const params = new URLSearchParams(location.search);
  if (params.get('tab') === 'intake') selectTab('intake');
  const sample = parseInt(params.get('sample'), 10);
  if (sample >= 1 && sample <= SCENARIOS.length) {
    selectTab('intake');
    $('#scenarios').querySelectorAll('button')[sample - 1].click();
  }
  const q = params.get('q');
  if (q) {
    $('#q').value = q;
    ask(q);
  }
}

// ---------------------------------------------------------------------------
// Chrome: tabs, toast, modal, shortcuts
// ---------------------------------------------------------------------------

function selectTab(name) {
  for (const x of $('#tabs').children) x.classList.toggle('on', x.dataset.tab === name);
  for (const t of ['knowledge', 'intake']) $(`#tab-${t}`).hidden = t !== name;
  window.scrollTo({ top: 0 });
}

$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) selectTab(b.dataset.tab);
});

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => (t.hidden = true), 220);
  }, 1900);
}

const openSettings = (open) => {
  $('#settings').hidden = !open;
  if (open) $('#apikey').focus();
};
$('#open-settings').onclick = () => openSettings(true);
$('#close-settings').onclick = () => openSettings(false);
$('#settings').addEventListener('click', (e) => { if (e.target.id === 'settings') openSettings(false); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') openSettings(false);
  if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
    e.preventDefault();
    $('#q').focus();
  }
});

// ---------------------------------------------------------------------------
// Recent questions
// ---------------------------------------------------------------------------

const getRecent = () => { try { return JSON.parse(store.get(RECENT_STORE)) || []; } catch { return []; } };

function pushRecent(q) {
  const list = [q, ...getRecent().filter((x) => x !== q)].slice(0, 6);
  store.set(RECENT_STORE, JSON.stringify(list));
  renderRecent();
}

function renderRecent() {
  const list = getRecent();
  $('#recent-block').hidden = !list.length;
  const ul = $('#recent');
  ul.textContent = '';
  for (const q of list) {
    const li = el('li');
    const b = el('button', null, escapeHtml(q));
    b.title = q;
    b.onclick = () => { $('#q').value = q; ask(q); };
    li.append(b);
    ul.append(li);
  }
}

$('#clear-recent').onclick = () => { store.del(RECENT_STORE); renderRecent(); };

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

/** Minimal inline markup: **bold**, `code` and [[citation]]. Escapes first. */
function renderInline(text) {
  let h = escapeHtml(text);
  h = h.replace(/\[\[(.+?)\]\]/g, (_, cite) => {
    const key = cite.trim();
    if (!byCite.has(key)) {
      return `<span class="cite dead" title="This citation does not resolve to a passage in the knowledge base.">${escapeHtml(key)} ?</span>`;
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
  $('#retr-meta').textContent = `· ${hits.length} passages`;
  $('#toggle-all').textContent = 'Expand all';
}

$('#toggle-all').onclick = () => {
  const all = [...$('#sources').querySelectorAll('details')];
  const open = all.some((d) => !d.open);
  all.forEach((d) => (d.open = open));
  $('#toggle-all').textContent = open ? 'Collapse all' : 'Expand all';
};

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

$('#copy-answer').onclick = () => copy($('#answer').innerText, 'Answer copied');

function setMode(kind, text) {
  const labels = { live: 'Grounded', seeded: 'Grounded · saved', retrieval: 'Sources only', err: 'Unavailable' };
  $('#mode-bar').innerHTML = `<span class="badge ${kind}">${labels[kind]}</span><span>${text}</span>`;
}

// ---------------------------------------------------------------------------
// Seeded matching
// ---------------------------------------------------------------------------

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
    throw new Error(`${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 160)}` : ''}`);
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

  $('#suggest-block').hidden = true;
  $('#answer-region').hidden = false;
  $('#ask-btn').disabled = true;
  pushRecent(query);
  history.replaceState(null, '', `?q=${encodeURIComponent(query)}`);

  const t0 = performance.now();
  const hits = index.search(query, 8);
  const ms = Math.round(performance.now() - t0);
  renderSources(hits, query);

  if (!hits.length) {
    setMode('retrieval', `Nothing matched (${ms} ms)`);
    $('#answer').innerHTML = '<p class="muted">No passage in the knowledge base matches that. It currently covers EStG, UStG, AO, StBVV, GewStG, KStG, EStDV, UStDV and the bookkeeping sections of the HGB.</p>';
    $('#ask-btn').disabled = false;
    return;
  }

  const key = store.get(KEY_STORE);

  if (key) {
    setMode('live', `${hits.length} passages in ${ms} ms · writing answer…`);
    $('#answer').innerHTML = '<span class="skel" style="width:92%"></span><span class="skel" style="width:99%"></span><span class="skel" style="width:74%"></span><span class="skel" style="width:88%"></span>';
    try {
      renderMarkdownish(await synthesise(query, hits, key));
      setMode('live', `Written from ${hits.length} retrieved passages · every claim cited below`);
      $('#ask-btn').disabled = false;
      return;
    } catch (err) {
      toast('Model unavailable — showing sources');
      setMode('err', `Synthesis failed (${err.message}). Sources below are unaffected.`);
    }
  }

  const match = matchSeeded(query);
  if (match) {
    renderSeeded(match.entry);
    setMode('seeded', `Saved answer for “${match.entry.q}” · citations verified against the knowledge base`);
  } else {
    const a = $('#answer');
    a.textContent = '';
    a.append(el('p', 'thinking',
      'No model is connected, so nothing has been written for this question — deliberately. These are the passages the search returned, ranked, with your terms highlighted.'));
    a.append(el('p', null,
      `Closest match: ${renderInline(`[[${hits[0].cite}]]`)} — ${escapeHtml(hits[0].title || hits[0].lawLong)}.`));
    a.append(el('p', 'muted small',
      'Connect a model in Settings to have the answer written from these same passages.'));
    setMode('retrieval', `${hits.length} passages in ${ms} ms · no answer written`);
  }
  $('#ask-btn').disabled = false;
}

$('#ask-form').addEventListener('submit', (e) => { e.preventDefault(); ask($('#q').value); });

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
  const grid = el('div', 'igrid');
  const add = (node, full = true) => { if (full) node.classList.add('full'); grid.append(node); };

  // Headline
  const head = el('div', 'panel');
  head.append(el('div', 'headline', `
    <span class="type">${p ? escapeHtml(p.type.label) : 'Needs manual classification'}</span>
    ${p ? `<span class="de">${escapeHtml(p.type.de)}</span>` : ''}
    <span class="pri p${4 - r.priority}" style="margin-left:auto">${escapeHtml(r.priorityLabel)}</span>`));
  if (p) {
    head.append(el('p', 'muted small', `
      Confidence ${Math.round(r.classification.confidence * 100)}% · matched
      <span class="matchterms">${p.matched.map(escapeHtml).join(', ')}</span>` +
      (r.classification.secondary.length
        ? ` · also considered ${r.classification.secondary.map((s) => escapeHtml(s.type.label)).join(', ')}`
        : '')));
    head.append(el('p', null, `<strong>Triage.</strong> ${escapeHtml(p.type.fit)}`));
  }
  add(head);

  if (r.flag) add(el('div', 'flagbox', `<strong>Escalate.</strong> ${escapeHtml(r.flag)}`));

  // Deadline
  if (r.deadline) {
    const d = r.deadline;
    const box = el('div', `deadline ${d.state}`);
    if (d.state === 'undated') {
      box.innerHTML = `<div class="big">Deadline undetermined</div>
        <div class="sub">A statutory period runs from ${escapeHtml(d.basis)} (${escapeHtml(d.cite)}), but no date was found in the message. Request the notified date before anything else.</div>`;
    } else {
      const rel = d.daysLeft < 0
        ? `expired ${Math.abs(d.daysLeft)} days ago`
        : `${d.daysLeft} days remaining`;
      box.innerHTML = `<div class="big">Einspruchsfrist ends ${escapeHtml(d.due)} — ${rel}</div>
        <div class="sub">One month from ${escapeHtml(d.basis)}, detected as “${escapeHtml(d.baseRaw)}” in the message (${escapeHtml(d.cite)}).</div>`;
    }
    add(box);
  }

  // Record + checks (left) | documents + anchors (right)
  const rec = el('div', 'panel');
  rec.append(el('h3', null, 'Mandate record'));
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
  add(rec, false);

  if (r.docs.length) {
    const d = el('div', 'panel');
    d.append(el('h3', null, 'Documents to request'));
    d.append(el('ul', 'docs', r.docs.map((x) => `<li>${escapeHtml(x)}</li>`).join('')));
    add(d, false);
  }

  if (r.observations.length) {
    const o = el('div', 'panel');
    o.append(el('h3', null, 'Automatic checks'));
    o.append(el('ul', 'obs', r.observations.map((x) => `<li>${escapeHtml(x)}</li>`).join('')));
    add(o, false);
  }

  if (r.anchors.length) {
    const a = el('div', 'panel');
    a.append(el('h3', null, 'Statutory basis'));
    for (const h of r.anchors) {
      const det = el('details', 'src');
      det.append(el('summary', null,
        `<span class="cite-key">${escapeHtml(h.cite)}</span><span class="title">${escapeHtml(h.title || h.lawLong)}</span>`));
      det.append(el('div', 'body', escapeHtml(h.text)));
      det.append(el('div', 'srcfoot', `<a href="${h.url}" target="_blank" rel="noopener">Open on gesetze-im-internet.de →</a>`));
      a.append(det);
    }
    add(a, false);
  }

  // Drafted reply
  const dr = el('div', 'panel');
  dr.append(el('h3', null, 'Drafted reply — review before sending'));
  const wrapEl = el('div', 'draft');
  wrapEl.append(el('pre', null, escapeHtml(r.email)));
  const copyBtn = el('button', 'mini copy', 'Copy');
  copyBtn.onclick = () => copy(r.email, 'Draft copied');
  wrapEl.append(copyBtn);
  dr.append(wrapEl);
  add(dr);

  out.append(grid);
}

$('#intake-form').addEventListener('submit', (e) => { e.preventDefault(); runIntake(); });
$('#intake-clear').onclick = () => {
  $('#intake-text').value = '';
  $('#intake-out').textContent = '';
  for (const b of $('#scenarios').querySelectorAll('button')) b.classList.remove('on');
};

// ---------------------------------------------------------------------------
// Model connection
// ---------------------------------------------------------------------------

function refreshKeyState() {
  const has = !!store.get(KEY_STORE);
  const s = $('#keystate');
  s.textContent = has ? `Connected — answers written by ${MODEL}.` : 'Not connected — saved answers and sources only.';
  s.style.color = has ? 'var(--ok)' : 'var(--ink-3)';
}

$('#savekey').onclick = () => {
  const v = $('#apikey').value.trim();
  if (!v) return;
  store.set(KEY_STORE, v);
  $('#apikey').value = '';
  refreshKeyState();
  toast('Model connected');
  openSettings(false);
};
$('#clearkey').onclick = () => { store.del(KEY_STORE); refreshKeyState(); toast('Model disconnected'); };

boot().catch((err) => {
  $('#boot-step').textContent = `Failed to load: ${err.message}`;
  $('#boot-step').style.color = 'var(--crit)';
});
