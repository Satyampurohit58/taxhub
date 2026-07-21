/**
 * Pre-ship checks. Runs the same modules the browser runs.
 *
 * The citation check is the important one: a seeded answer that cites a key not
 * present in the corpus would render as authoritative in the UI while being
 * unverifiable. That is exactly the failure mode this whole product is supposed
 * to prevent, so it fails the build.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Index, tokenize } from '../dist/assets/retrieval.js';
import { analyseIntake, SCENARIOS } from '../dist/assets/intake.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const D = join(HERE, '..', 'dist', 'data');
const corpus = JSON.parse(readFileSync(join(D, 'corpus.json'), 'utf8'));
const answers = JSON.parse(readFileSync(join(D, 'answers.json'), 'utf8')).answers;

const index = new Index(corpus.chunks);
const byCite = new Set(corpus.chunks.map((c) => c.cite));
let failed = 0;

// --- 1. every citation in every seeded answer must resolve -------------------
console.log('1. citation resolution');
let cites = 0;
for (const a of answers) {
  const text = a.blocks.map((b) => b.t).join(' ') + ' ' + (a.caveat || '');
  for (const m of text.matchAll(/\[\[(.+?)\]\]/g)) {
    cites++;
    if (!byCite.has(m[1].trim())) {
      console.log(`   FAIL  ${a.id}: "${m[1]}" not in corpus`);
      failed++;
    }
  }
}
console.log(`   ${cites} citations checked, ${failed} unresolved\n`);

// --- 2. each seeded question must self-match above threshold ----------------
console.log('2. seeded matching');
const match = (query) => {
  const q = new Set(tokenize(query));
  let best = null;
  for (const s of answers) {
    for (const cand of [s.q, ...s.variants]) {
      const c = new Set(tokenize(cand));
      if (!c.size) continue;
      let inter = 0;
      for (const t of q) if (c.has(t)) inter++;
      const score = (inter / q.size) * 0.7 + (inter / c.size) * 0.3;
      if (!best || score > best.score) best = { id: s.id, score, inter };
    }
  }
  return best && best.score >= 0.42 && best.inter >= 2 ? best : null;
};
for (const a of answers) {
  for (const probe of [a.q, ...a.variants]) {
    const m = match(probe);
    const ok = m && m.id === a.id;
    if (!ok) {
      console.log(`   FAIL  "${probe.slice(0, 56)}" → ${m?.id} @ ${m?.score.toFixed(2)} (want ${a.id})`);
      failed++;
    }
  }
}
console.log(`   ${answers.length} seeded answers, ${answers.reduce((n, a) => n + a.variants.length + 1, 0)} probes\n`);

// --- 3. an unrelated question must NOT match a seeded answer ----------------
console.log('3. false-positive guard');
for (const q of ['Wie hoch ist die Gewerbesteuer in Berlin?', 'What is the corporate tax rate?', 'Wie melde ich einen Mitarbeiter an?']) {
  const m = match(q);
  console.log(`   ${m ? 'FAIL ' : 'ok   '} "${q}" → ${m ? `${m.id} @ ${m.score.toFixed(2)}` : 'falls through to retrieval'}`);
  if (m) failed++;
}
console.log();

// --- 4. intake across all scenarios -----------------------------------------
console.log('4. intake scenarios');
const today = new Date(2026, 6, 21); // fixed date so output is stable
for (const s of SCENARIOS) {
  const r = analyseIntake(s.text, index, today);
  const p = r.classification.primary;
  console.log(`   ${s.label}`);
  console.log(`     type      ${p ? p.type.id : 'UNCLASSIFIED'} @ ${Math.round(r.classification.confidence * 100)}%   ${r.priorityLabel}`);
  console.log(`     contact   ${r.contact.name ?? '—'} | ${r.contact.company ?? '—'} | ${r.contact.email ?? '—'} | ${r.contact.phone ?? '—'}`);
  console.log(`     form      ${r.legalForm ?? '—'}   turnover ${r.turnover?.raw ?? '—'}`);
  if (r.deadline) {
    console.log(`     deadline  ${r.deadline.state}${r.deadline.due ? ` → ${r.deadline.due} (${r.deadline.daysLeft}d)` : ''}`);
  }
  console.log(`     anchors   ${r.anchors.map((a) => a.cite).join(' , ') || '—'}`);
  if (r.observations.length) console.log(`     checks    ${r.observations[0].slice(0, 100)}…`);
  if (!p) failed++;
  console.log();
}

console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
