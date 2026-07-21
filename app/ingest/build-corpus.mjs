/**
 * TaxHub corpus builder.
 *
 * Reads the official XML releases from gesetze-im-internet.de (Bundesamt für
 * Justiz) and turns them into §-level, citable chunks.
 *
 * The point of this file: every chunk that the assistant can ever cite is
 * traceable to a real paragraph in a real statute, with a URL a Steuerberater
 * can open and verify. Nothing is authored here — only extracted.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = join(HERE, 'raw');
const OUT = join(HERE, '..', 'dist', 'data');

/**
 * Each entry maps a downloaded law to how we cite and link it.
 * `keep` optionally restricts ingestion to the § range that is actually
 * relevant to a tax practice (the HGB is mostly company law we do not want).
 */
const LAWS = [
  {
    dir: 'estg', slug: 'estg', abbr: 'EStG',
    long: 'Einkommensteuergesetz',
    blurb: 'Income tax — the core statute for almost every mandate.',
  },
  {
    dir: 'ustg_1980', slug: 'ustg_1980', abbr: 'UStG',
    long: 'Umsatzsteuergesetz',
    blurb: 'VAT — incl. §14 e-invoicing and §19 small-business rules.',
  },
  {
    dir: 'ao_1977', slug: 'ao_1977', abbr: 'AO',
    long: 'Abgabenordnung',
    blurb: 'Procedural law — deadlines, retention, audits, penalties.',
  },
  {
    dir: 'stbgebv', slug: 'stbvv', abbr: 'StBVV',
    long: 'Steuerberatervergütungsverordnung',
    blurb: 'The fee schedule — what the practice is allowed to bill.',
  },
  {
    dir: 'gewstg', slug: 'gewstg', abbr: 'GewStG',
    long: 'Gewerbesteuergesetz',
    blurb: 'Trade tax.',
  },
  {
    dir: 'kstg_1977', slug: 'kstg_1977', abbr: 'KStG',
    long: 'Körperschaftsteuergesetz',
    blurb: 'Corporate income tax — GmbH mandates.',
  },
  {
    dir: 'estdv_1955', slug: 'estdv_1955', abbr: 'EStDV',
    long: 'Einkommensteuer-Durchführungsverordnung',
    blurb: 'Implementing regulation to the EStG.',
  },
  {
    dir: 'ustdv_1980', slug: 'ustdv_1980', abbr: 'UStDV',
    long: 'Umsatzsteuer-Durchführungsverordnung',
    blurb: 'Implementing regulation to the UStG.',
  },
  {
    dir: 'hgb', slug: 'hgb', abbr: 'HGB',
    long: 'Handelsgesetzbuch',
    blurb: 'Commercial bookkeeping duties (§§238–289).',
    keep: (n) => n >= 238 && n <= 289,
  },
];

// ---------------------------------------------------------------------------
// XML → text
// ---------------------------------------------------------------------------

const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  '&nbsp;': ' ', '&szlig;': 'ß', '&auml;': 'ä', '&ouml;': 'ö', '&uuml;': 'ü',
  '&Auml;': 'Ä', '&Ouml;': 'Ö', '&Uuml;': 'Ü', '&sect;': '§', '&euro;': '€',
  '&ndash;': '–', '&mdash;': '—', '&bdquo;': '„', '&ldquo;': '“',
};

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&[a-zA-Z]+;/g, (m) => ENTITIES[m] ?? m);
}

/**
 * Flattens the mixed-content body of a <norm> into readable plain text.
 * Table cells are joined with " | " because in the StBVV the fee tables are
 * the substance, not decoration.
 */
function xmlToText(xml) {
  let s = xml;
  s = s.replace(/<fussnoten>[\s\S]*?<\/fussnoten>/g, ' ');
  s = s.replace(/<BR\s*\/?>/g, '\n');
  s = s.replace(/<\/(P|entry|row|item|LA|DT|DD)>/g, (m) => (m === '</entry>' ? ' | ' : '\n'));
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  s = s.replace(/[ \t ]+/g, ' ');
  s = s.replace(/ *\n */g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

const MAX_CHARS = 1400;

/**
 * Splits a §'s text into chunks that respect Absatz boundaries.
 *
 * German statutes are numbered "(1) … (2) …", which is also exactly how a
 * Steuerberater cites them ("§ 15 Abs. 1 UStG"). So the natural chunk boundary
 * and the natural citation unit are the same thing — that is what makes the
 * citations in this demo real rather than decorative.
 */
function chunkSection(text) {
  const lines = text.split('\n');
  const blocks = [];
  let cur = { absatz: null, lines: [] };

  for (const line of lines) {
    const m = line.match(/^\((\d+[a-z]?)\)\s/);
    if (m && cur.lines.length) {
      blocks.push(cur);
      cur = { absatz: m[1], lines: [line] };
    } else {
      if (m && !cur.lines.length) cur.absatz = m[1];
      cur.lines.push(line);
    }
  }
  if (cur.lines.length) blocks.push(cur);

  // Merge tiny neighbours, then hard-split anything still oversized.
  const out = [];
  for (const b of blocks) {
    const body = b.lines.join('\n').trim();
    if (!body) continue;
    const last = out[out.length - 1];
    if (last && last.text.length + body.length < 700 && last.absatz === null) {
      last.text += '\n' + body;
      continue;
    }
    if (body.length <= MAX_CHARS) {
      out.push({ absatz: b.absatz, text: body });
      continue;
    }
    // Oversized Absatz: split on sentence boundaries, keep the Absatz label.
    let buf = '';
    for (const sent of body.split(/(?<=\.)\s+(?=[A-ZÄÖÜ§\d])/)) {
      if (buf.length + sent.length > MAX_CHARS && buf) {
        out.push({ absatz: b.absatz, text: buf.trim() });
        buf = '';
      }
      buf += sent + ' ';
    }
    if (buf.trim()) out.push({ absatz: b.absatz, text: buf.trim() });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const chunks = [];
const lawStats = [];
let buildDate = null;

for (const law of LAWS) {
  const dir = join(RAW, law.dir);
  if (!existsSync(dir)) {
    console.warn(`  ! missing ${law.abbr} (${dir})`);
    continue;
  }
  const xmlFile = readdirSync(dir).find((f) => f.endsWith('.xml'));
  const xml = readFileSync(join(dir, xmlFile), 'utf8');

  if (!buildDate) {
    const bd = xml.match(/builddate="(\d{8})/);
    if (bd) buildDate = `${bd[1].slice(0, 4)}-${bd[1].slice(4, 6)}-${bd[1].slice(6, 8)}`;
  }

  let sections = 0;
  let before = chunks.length;

  for (const normMatch of xml.matchAll(/<norm\b[^>]*>([\s\S]*?)<\/norm>/g)) {
    const norm = normMatch[1];
    const enbez = norm.match(/<enbez>([\s\S]*?)<\/enbez>/)?.[1];
    if (!enbez) continue;

    const label = decodeEntities(enbez).trim();
    const isSection = /^§+\s*\d/.test(label);
    const isAnnex = /^Anlage/i.test(label);
    if (!isSection && !isAnnex) continue;

    // § number, incl. letter suffixes like "14a" or "15a".
    const numMatch = label.match(/§+\s*(\d+)([a-z]?)/);
    const num = numMatch ? numMatch[1] + (numMatch[2] || '') : null;
    if (law.keep && numMatch && !law.keep(parseInt(numMatch[1], 10))) continue;

    const title = decodeEntities(
      norm.match(/<titel[^>]*>([\s\S]*?)<\/titel>/)?.[1] ?? ''
    ).replace(/<[^>]+>/g, '').trim();

    const textBlock = norm.match(/<textdaten>([\s\S]*?)<\/textdaten>/)?.[1];
    if (!textBlock) continue;
    const inner = textBlock.match(/<text[^>]*>([\s\S]*?)<\/text>/)?.[1];
    if (!inner) continue;

    const text = xmlToText(inner);
    // Repealed paragraphs read "(weggefallen)" — no value in the index.
    if (!text || text.length < 40 || /^\(?weggefallen\)?$/i.test(text)) continue;

    const anchor = isAnnex
      ? `anlage_${(label.match(/\d+/) || ['1'])[0]}.html`
      : `__${num}.html`;
    const url = `https://www.gesetze-im-internet.de/${law.slug}/${anchor}`;

    sections++;
    for (const part of chunkSection(text)) {
      const cite = isAnnex
        ? `${label} ${law.abbr}`
        : `§ ${num}${part.absatz ? ` Abs. ${part.absatz}` : ''} ${law.abbr}`;
      chunks.push({
        id: `${law.abbr}-${num ?? label.replace(/\W+/g, '')}-${part.absatz ?? '0'}-${chunks.length}`,
        law: law.abbr,
        lawLong: law.long,
        section: label,
        num,
        title,
        absatz: part.absatz,
        cite,
        url,
        text: part.text,
      });
    }
  }

  lawStats.push({
    abbr: law.abbr, long: law.long, blurb: law.blurb,
    sections, chunks: chunks.length - before,
    url: `https://www.gesetze-im-internet.de/${law.slug}/`,
  });
  console.log(`  ${law.abbr.padEnd(6)} ${String(sections).padStart(4)} §§  →  ${chunks.length - before} chunks`);
}

mkdirSync(OUT, { recursive: true });

const corpus = {
  meta: {
    source: 'gesetze-im-internet.de — Bundesministerium der Justiz / Bundesamt für Justiz',
    license: 'Official statute text, publicly available. Retrieved unmodified and chunked.',
    statuteBuildDate: buildDate,
    generatedBy: 'CITO/app/ingest/build-corpus.mjs',
    laws: lawStats,
    totalChunks: chunks.length,
  },
  chunks,
};

const outFile = join(OUT, 'corpus.json');
writeFileSync(outFile, JSON.stringify(corpus));
const mb = (Buffer.byteLength(JSON.stringify(corpus)) / 1048576).toFixed(2);

console.log(`\n  ${chunks.length} chunks from ${lawStats.length} statutes → ${mb} MB`);
console.log(`  statute text current as of ${buildDate}`);
console.log(`  written to ${outFile}`);
