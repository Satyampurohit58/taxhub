/**
 * Retrieval smoke test.
 *
 * Each case is a question phrased the way a Steuerberater or their client would
 * actually phrase it, paired with the § that must show up. Deliberately does
 * NOT use statute vocabulary — that is the whole point of the lexicon layer.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Index } from '../dist/assets/retrieval.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(readFileSync(join(HERE, '..', 'dist', 'data', 'corpus.json'), 'utf8'));

const CASES = [
  ['Ab wann gilt die E-Rechnungspflicht und welches Format?', 'UStG', '14'],
  ['Bis zu welcher Umsatzgrenze bin ich Kleinunternehmer?', 'UStG', '19'],
  ['Wie lange muss ich Buchungsbelege aufbewahren?', 'AO', '147'],
  ['Was kostet eine Einnahmenüberschussrechnung nach Gebührenordnung?', 'StBVV', '25'],
  ['Wann muss die Steuererklärung abgegeben werden?', 'AO', '149'],
  ['Wie hoch ist der Verspätungszuschlag?', 'AO', '152'],
  ['Darf das Finanzamt eine Betriebsprüfung ankündigen?', 'AO', '196'],
  ['Wie wird der Firmenwagen privat versteuert?', 'EStG', '6'],
  ['Kann ich das häusliche Arbeitszimmer absetzen?', 'EStG', '4'],
  ['Ab welchem Umsatz muss ich Bücher führen?', 'AO', '141'],
  ['Was ist die Entfernungspauschale pro Kilometer?', 'EStG', '9'],
  ['Wann kann ich Vorsteuer abziehen?', 'UStG', '15'],
  ['Welcher Stundensatz gilt für die Zeitgebühr?', 'StBVV', '13'],
  ['Wie hoch ist der Gewerbesteuerfreibetrag?', 'GewStG', '11'],
  ['Wann ist eine Selbstanzeige noch straffrei?', 'AO', '371'],
  ['Wie lange habe ich Zeit für einen Einspruch?', 'AO', '355'],
];

const t0 = performance.now();
const idx = new Index(corpus.chunks);
console.log(`index: ${idx.N} chunks, ${idx.vocab.length} terms, built in ${idx.buildMs} ms\n`);

let top1 = 0, top3 = 0, top8 = 0;
for (const [q, law, num] of CASES) {
  const hits = idx.search(q, 8);
  const rank = hits.findIndex((h) => h.law === law && h.num === num);
  if (rank === 0) top1++;
  if (rank >= 0 && rank < 3) top3++;
  if (rank >= 0) top8++;
  const mark = rank === 0 ? 'OK ' : rank > 0 ? `#${rank + 1} ` : 'MISS';
  console.log(`${mark} want §${num} ${law.padEnd(6)} | got ${hits.slice(0, 3).map((h) => h.cite).join(' , ')}`);
  if (rank < 0) console.log(`      ^ "${q}"`);
}

const n = CASES.length;
console.log(`\ntop-1 ${top1}/${n}   top-3 ${top3}/${n}   top-8 ${top8}/${n}`);
console.log(`avg query time: ${((performance.now() - t0 - idx.buildMs) / n).toFixed(1)} ms`);
