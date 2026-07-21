/**
 * Bundles dist/ into one self-contained HTML file.
 *
 *   node build-single-file.mjs
 *   → ../TaxHub-MVP.html
 *
 * The output opens by double-click, from disk, with no server, no install and
 * no network. That matters because the alternative — "clone this and run a
 * local server" — is friction between a reviewer and the thing you want them
 * to see.
 *
 * Three things have to change to make that work:
 *   1. ES modules can't load over file://, so the three scripts are
 *      concatenated into one classic <script> (imports/exports stripped; they
 *      share a scope once inlined).
 *   2. fetch() can't read local JSON over file://, so the corpus is embedded
 *      as <script type="application/json"> and app.js reads that when present.
 *   3. The stylesheet is inlined.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, 'dist');
const OUT = join(HERE, '..', 'TaxHub-MVP.html');

const read = (...p) => readFileSync(join(DIST, ...p), 'utf8');

// --- scripts ---------------------------------------------------------------
// Order matters: retrieval defines what intake and app consume.
const scripts = ['retrieval.js', 'intake.js', 'app.js']
  .map((f) => read('assets', f))
  .join('\n\n')
  .replace(/^import\s+[^;]*?;\s*$/gm, '')   // drop cross-file imports
  .replace(/^export\s+/gm, '')              // drop export markers
  // The HTML parser ends a <script> at the first "</script" — even inside a
  // comment or a string. app.js documents this very inlining trick and so
  // contains that literal, which silently truncated the bundle and produced a
  // SyntaxError. Harmless everywhere JS can legally contain the sequence.
  .replace(/<\/script/gi, '<\\/script');

// --- data ------------------------------------------------------------------
// Every "<" becomes < so no combination of characters in the statute text
// can ever be seen as markup by the HTML parser. It is a legal JSON escape, so
// the payload still parses identically.
const embed = (id, file) => {
  const json = read('data', file).replace(/</g, '\\u003c');
  return `<script type="application/json" id="data-${id}">${json}</script>`;
};

// --- assemble --------------------------------------------------------------
// Replacements go through a function, never a string. A string replacement
// expands "$&", "$'" and friends — and the bundle legitimately contains "\\$&"
// (retrieval.js escapes regex metacharacters with it), which silently
// re-injected the original <script> tag into the middle of the payload.
let html = read('index.html');

html = html.replace(
  '<link rel="stylesheet" href="assets/styles.css">',
  () => `<style>\n${read('assets', 'styles.css')}\n</style>`
);

html = html.replace(
  '<script type="module" src="assets/app.js"></script>',
  () => [
    embed('corpus', 'corpus.json'),
    embed('answers', 'answers.json'),
    `<script>\n(function(){\n'use strict';\n${scripts}\n})();\n</script>`,
  ].join('\n')
);

// --- self-check ------------------------------------------------------------
// A broken bundle still looks like a 3.8 MB HTML file, so verify structure
// rather than trusting it. The parser ends a script at the FIRST "</script",
// which is what these counts are really testing.
// Walk elements the way a parser does — after an opening tag, skip the body to
// its closing tag. Counting raw "<script" matches would also count tag-like
// text sitting harmlessly inside a script body.
const scriptTags = [];
for (let i = 0; i < html.length;) {
  const m = /<script\b([^>]*)>/g;
  m.lastIndex = i;
  const hit = m.exec(html);
  if (!hit) break;
  const bodyStart = hit.index + hit[0].length;
  const close = html.indexOf('</script', bodyStart);
  scriptTags.push({ 1: hit[1], index: hit.index, bodyStart, close });
  i = close < 0 ? html.length : close + 8;
}
const problems = [];

if (scriptTags.length !== 3) {
  problems.push(`expected 3 script elements, found ${scriptTags.length}: ` +
    scriptTags.map((m) => `[${m[1].trim() || 'inline'}]`).join(' '));
}
if (html.includes('assets/app.js') || html.includes('assets/styles.css')) {
  problems.push('external asset reference survived — replacement did not apply');
}
for (const id of ['data-corpus', 'data-answers']) {
  if (!html.includes(`id="${id}"`)) problems.push(`missing embedded ${id}`);
}
const inline = scriptTags.find((m) => !m[1].trim());
if (!inline) {
  problems.push('no inline script element found');
} else {
  const body = html.slice(inline.bodyStart, inline.close);
  if (body.length < 40000) problems.push(`inline script truncated to ${body.length} chars`);
}

if (problems.length) {
  console.error('BUNDLE IS BROKEN:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

writeFileSync(OUT, html, 'utf8');

const mb = (Buffer.byteLength(html) / 1048576).toFixed(2);
console.log(`${OUT}`);
console.log(`  ${mb} MB — self-contained, opens from disk`);
console.log(`  3 script elements, inline bundle intact`);
