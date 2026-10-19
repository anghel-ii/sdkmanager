// ═══════════════════════════════════════════════════════════════════════════
//  Curăţenia adreselor din baza de clienţi (userul, 2026-10-19 — pt. FAN Courier
//  şi livrările cu maşina noastră).
//
//    node curata-adrese.mjs                 → ce ar repara + tabelul pentru agenţi
//    node curata-adrese.mjs --aplica        → repară în baza de pe Cloudflare (D1)
//    node curata-adrese.mjs --din <x.sqlite> → probă pe copia din manager (fără D1)
//
//  1. Adresele stricate de Excel la import: „nr. 3-5" ajuns „nr. 03-mai",
//     „1 Decembrie 1918" ajuns „01-dec-18" → la loc. Fiecare reparaţie creşte
//     versiunea clientului, ca managerul s-o preia.
//  2. ../date-clienti/adrese-de-completat.csv (Excel, „;") — clienţii a căror adresă nu e bună
//     pentru curier / hartă, pe agenţi, cu ce lipseşte. Judeţul + localitatea se
//     verifică pe lista SIRUTA, la fel ca în manager (manager/web/adresa.js).
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { d1, q } from './d1.mjs';

const require = createRequire(import.meta.url);
const Adresa = require('../manager/web/adresa.js');
const IX = Adresa.index(require('../manager/web/localitati.json'));
const aici = fileURLToPath(new URL('.', import.meta.url));

const arg = process.argv.slice(2);
const aplica = arg.includes('--aplica');
const din = arg.includes('--din') ? arg[arg.indexOf('--din') + 1] : null;
if (aplica && din) { console.error('--aplica merge doar pe baza de pe Cloudflare, nu cu --din.'); process.exit(1); }

const CAMPURI = 'id, agent, nume, cui, judet, localitate, adresa_sediu, adresa_livrare, telefon_administrator, telefon_delegat';
let clienti;
if (din) {
  const { DatabaseSync } = await import('node:sqlite');
  clienti = new DatabaseSync(din, { readOnly: true }).prepare(`SELECT ${CAMPURI.replace(/^id/, 'extern_id AS id')} FROM client`).all();
} else {
  clienti = d1(`SELECT ${CAMPURI} FROM client`);
}
console.log(`${clienti.length} clienţi${din ? ` (din ${din})` : ' (baza de pe Cloudflare)'}\n`);

// ── 1. Datele de Excel înapoi în text ───────────────────────────────────────
const LUNI = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
const LUNI_TOT = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];
const DATA_EXCEL = /(\b(?:nr|numar|număr)\.?\s*)?\b(\d{1,2})-(ian|feb|mar|apr|mai|iun|iul|aug|sep|oct|noi|nov|dec)(?:-(\d{2}))?\b/gi;
// străzile cu dată din istorie: anul din 2 cifre → cel adevărat (implicit 19xx)
const ANI = { 18: 1918, 89: 1989, 77: 1877, 48: 1848, 59: 1859 };
const repara = t => String(t ?? '').replace(DATA_EXCEL, (tot, nr, z, l, an) => {
  const luna = LUNI.indexOf(l.toLowerCase().replace('nov', 'noi'));
  // după „nr." = un interval de numere („3-5"); altfel = numele străzii („1 Decembrie 1918", „22 Decembrie")
  if (nr && !an) return `${nr}${+z}-${luna + 1}`;
  return `${nr ?? ''}${+z} ${LUNI_TOT[luna]}${an ? ` ${ANI[+an] ?? 1900 + +an}` : ''}`;
});

const reparatii = [];
for (const c of clienti) {
  for (const camp of ['adresa_livrare', 'adresa_sediu']) {
    const nou = repara(c[camp]);
    if (c[camp] && nou !== c[camp]) { reparatii.push({ id: c.id, nume: c.nume, camp, vechi: c[camp], nou }); c[camp] = nou; }
  }
}
console.log(`1. Adrese stricate de Excel: ${reparatii.length}`);
for (const r of reparatii) console.log(`   ${r.nume}: „${r.vechi}" → „${r.nou}"`);
if (reparatii.length && aplica) {
  const sql = reparatii.map(r => `UPDATE client SET ${r.camp} = ${q(r.nou)}, modificat_la = datetime('now'),
    versiune = (SELECT MAX(versiune) FROM client) + 1 WHERE id = ${r.id};`).join('\n');
  const f = `${aici}.curata-adrese.sql`;
  fs.writeFileSync(f, sql);
  d1(null, { fisier: f });
  fs.rmSync(f);
  console.log('   ✓ reparate în baza de pe Cloudflare (managerul le preia la următoarea sincronizare)');
} else if (reparatii.length) console.log('   (rulează cu --aplica ca să le repari în baza de pe Cloudflare)');

// ── 2. Ce adrese nu merg pentru curier / hartă ──────────────────────────────
const probleme = [];
for (const c of clienti) {
  const strada = String(c.adresa_livrare || c.adresa_sediu || '').trim();
  const a = Adresa.desface([c.localitate, c.judet].filter(Boolean).join(', '), IX);
  const ce = [];
  if (!String(c.judet ?? '').trim()) ce.push('fără judeţ');
  else if (!a.judet) ce.push(`judeţ greşit („${c.judet}")`);
  if (!String(c.localitate ?? '').trim()) ce.push('fără localitate');
  else if (a.judet && !a.localitate) ce.push(`localitate negăsită în ${a.judet} („${c.localitate}")`);
  if (!strada) ce.push('fără stradă / adresă');
  else if (!/\d/.test(strada)) ce.push('fără număr');
  if (ce.length) probleme.push({ ...c, strada, ce: ce.join('; ') });
}
const cate = t => probleme.filter(p => p.ce.includes(t)).length;
console.log(`\n2. Clienţi cu adresa de completat: ${probleme.length} din ${clienti.length}`);
for (const t of ['fără judeţ', 'judeţ greşit', 'fără localitate', 'localitate negăsită', 'fără stradă', 'fără număr']) console.log(`   ${t}: ${cate(t)}`);

const csv = v => /[;"\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? '');
probleme.sort((a, b) => String(a.agent ?? '').localeCompare(String(b.agent ?? ''), 'ro') || a.nume.localeCompare(b.nume, 'ro'));
const raport = `${aici}../date-clienti/adrese-de-completat.csv`;
fs.mkdirSync(`${aici}../date-clienti`, { recursive: true });
fs.writeFileSync(raport, '﻿' + [['Agent', 'Client', 'CUI', 'Telefon', 'Judeţ', 'Localitate', 'Adresa (stradă, nr.)', 'Ce lipseşte / e greşit'],
  ...probleme.map(p => [p.agent || '—', p.nume, p.cui, p.telefon_delegat || p.telefon_administrator, p.judet, p.localitate, p.strada, p.ce])]
  .map(r => r.map(csv).join(';')).join('\r\n'));
console.log(`\n   Tabelul pentru agenţi: ${fs.realpathSync(raport)}`);
const peAgent = Object.entries(Object.groupBy(probleme, p => p.agent || '—')).sort((a, b) => b[1].length - a[1].length);
console.log(`   pe agenţi: ${peAgent.map(([a, l]) => `${a} ${l.length}`).join(', ')}`);
