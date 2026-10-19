// ═══════════════════════════════════════════════════════════════════════════
//  Lista de localităţi (judeţ → localităţi) din SIRUTA, nomenclatorul INS.
//  O folosesc câmpurile de adresă (configurator, manager, pagina agenţilor):
//  localitatea se alege din listă, ca FAN şi harta livrărilor s-o găsească sigur.
//
//    node scripts/localitati.mjs <siruta.csv>
//
//  CSV-ul: data.gov.ro → „siruta" (ultimul semestru), ex. siruta_s1_2026.csv
//  (UTF-8, „;"). Scrie web/localitati.json (managerul îl serveşte la /localitati.json)
//  şi aceeaşi copie în clienti-agenti/public/ (pagina agenţilor, pe Cloudflare).
//
//  Formatul: { sursa, judete: { "Alba": ["Alba Iulia", "Bărăbanț", …], … } }.
//  Numele ca la INS, cu diacritice ș/ț şi majuscule doar la început de cuvânt.
//  Un sat cu acelaşi nume ca altul din judeţ primeşte comuna/oraşul în paranteză:
//  „Valea Mare (Bogați)" — aşa le scrie şi FAN. Pe lângă sate / localităţi, şi
//  comunele, oraşele, municipiile („Jucu", „Breaza"). Bucureşti = o singură localitate
//  (sectorul se scrie la stradă).
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';

const fisier = process.argv[2];
if (!fisier) { console.error('Folosire: node scripts/localitati.mjs <siruta.csv>'); process.exit(1); }

const linii = fs.readFileSync(fisier, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/).map(l => l.split(';'));
const cap = linii.shift();
const randuri = linii.map(r => Object.fromEntries(cap.map((k, i) => [k, r[i]?.trim()])));
const dupaCod = new Map(randuri.map(r => [r.SIRUTA, r]));

// „SÂNMIHAIU DE CÂMPIE" → „Sânmihaiu de Câmpie"; ş/ţ cu sedilă → ș/ț (ca în restul aplicaţiei)
const MICI = new Set(['de', 'din', 'lui', 'pe', 'la', 'sub', 'cu', 'și', 'peste', 'dintre', 'de-a', 'cel']);
const frumos = t => t.toLowerCase().replace(/ş/g, 'ș').replace(/ţ/g, 'ț').replace(/\.(?=\p{L})/gu, '. ')   // „I.CUZA" → „I. Cuza"
  .split(' ').map((c, i) => i && MICI.has(c) ? c : c.replace(/(^|-)(\p{L})/gu, (_, a, l) => a + l.toUpperCase())).join(' ');
const faraPrefix = t => t.replace(/^(JUDEȚUL|JUDEŢUL|MUNICIPIUL|ORAȘ|ORAŞ|ORAȘUL|ORAŞUL)\s+/, '');

const judete = {};
for (const r of randuri.filter(r => r.TIP === '40')) judete[r.JUD] = r.JUD === '40' ? 'București' : frumos(faraPrefix(r.DENLOC));

const pe = {};   // judeţ → [{ nume, uat }]
for (const r of randuri.filter(r => r.NIV === '3')) {
  const j = judete[r.JUD];
  if (r.JUD === '40') continue;   // sectoarele Bucureştiului
  const uat = dupaCod.get(r.SIRSUP);
  (pe[j] ??= []).push({ nume: frumos(r.DENLOC), uat: frumos(faraPrefix(uat.DENLOC)) });
}
// şi comunele / oraşele / municipiile cu numele lor: oamenii scriu „Jucu", „Breaza", nu „Jucu de Sus"
for (const r of randuri.filter(r => r.NIV === '2' && ['1', '2', '3', '4', '5'].includes(r.TIP))) {
  const nume = frumos(faraPrefix(r.DENLOC));
  pe[judete[r.JUD]].push({ nume, uat: nume });
}
pe['București'] = [{ nume: 'București', uat: 'București' }];

const iesire = { sursa: `SIRUTA — ${path.basename(fisier)}`, judete: {} };
const cmp = new Intl.Collator('ro').compare;
for (const j of Object.keys(pe).sort(cmp)) {
  const cate = new Map();
  for (const l of pe[j]) cate.set(l.nume, (cate.get(l.nume) ?? 0) + 1);
  iesire.judete[j] = [...new Set(pe[j].map(l => cate.get(l.nume) > 1 && l.uat !== l.nume ? `${l.nume} (${l.uat})` : l.nume))].sort(cmp);
}

const json = JSON.stringify(iesire);
const aici = path.dirname(new URL(import.meta.url).pathname);
for (const tinta of ['../web/localitati.json', '../../clienti-agenti/public/localitati.json']) {
  fs.writeFileSync(path.join(aici, tinta), json);
  console.log(`${tinta}: ${Object.keys(iesire.judete).length} judeţe, ${Object.values(iesire.judete).reduce((s, l) => s + l.length, 0)} localităţi, ${(json.length / 1024).toFixed(0)} KB`);
}
