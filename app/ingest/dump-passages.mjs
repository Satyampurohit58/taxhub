import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Index } from '../dist/assets/retrieval.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(readFileSync(join(HERE, '..', 'dist', 'data', 'corpus.json'), 'utf8'));
const idx = new Index(corpus.chunks);

const QS = process.argv.slice(2);
for (const q of QS) {
  console.log(`\n=== ${q}`);
  for (const h of idx.search(q, 2)) {
    console.log(`--- ${h.cite} | ${h.title}\n${h.text.slice(0, 900)}`);
  }
}
