// ═══════════════════════════════════════════════════════════════════════════
//  Curăţenia reducerilor (userul, 2026-10-29: „grupele vechi nu mai sunt relevante, poţi
//  şterge datele de acolo"). Câmpul `discounturi` al fiecărui client se rescrie aşa cum îl
//  scrie portalul acum (public/reduceri.js): gamele vechi cu grupă nouă primesc numele nou
//  (LUX → Lux, CONFORT → Confort, GOLA → Gola), cele fără grupă nouă (Usi, MANER, Sertare,
//  Hairpin, Jolly, Rehau, Acc SDK, Lamele) dispar; notiţele text rămân.
//  La fel şi în cererile agenţilor încă neaprobate (altfel aprobarea le-ar scrie la loc).
//
//    node curata-reduceri.mjs                  → ce s-ar schimba (nu scrie nimic)
//    node curata-reduceri.mjs --aplica         → backup în ../date-clienti/, apoi scrie în baza de pe Cloudflare
//    D1_LOCAL=<folder> node curata-reduceri.mjs → pe baza locală de probă (wrangler pages dev --persist-to)
//
//  Fiecare rând se scrie doar dacă textul lui e încă cel citit (cine l-a schimbat între timp
//  rămâne neatins — se mai rulează o dată) şi primeşte versiune nouă, ca managerul să-l preia.
//  modificat_la rămâne: nu e o modificare de la agent.
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { d1, q } from './d1.mjs';

await import('./public/reduceri.js');
const { desfaReduceri, compuneReduceri } = globalThis.Reduceri;
const curat = t => { const { pe, alte } = desfaReduceri(t); return compuneReduceri(pe, alte); };
const aici = fileURLToPath(new URL('.', import.meta.url));
const aplica = process.argv.includes('--aplica');

const clienti = d1("SELECT id, nume, discounturi FROM client WHERE discounturi IS NOT NULL AND discounturi <> ''")
  .map(c => ({ ...c, nou: curat(c.discounturi) })).filter(c => c.nou !== c.discounturi);
const propuneri = d1("SELECT id, agent, json_extract(date_json, '$.discounturi') AS discounturi FROM propunere WHERE stergere = 0")
  .filter(p => p.discounturi).map(p => ({ ...p, nou: curat(p.discounturi) })).filter(p => p.nou !== p.discounturi);

console.log(`${clienti.length} clienţi şi ${propuneri.length} cereri în aşteptare cu reduceri de rescris${process.env.D1_LOCAL ? ' (baza LOCALĂ)' : ''}.\n`);
for (const c of clienti.slice(0, 5)) console.log(`  #${c.id} ${c.nume}\n     ${c.discounturi}\n   → ${c.nou || '(nimic)'}`);
if (clienti.length > 5) console.log(`  … şi încă ${clienti.length - 5}`);
for (const p of propuneri) console.log(`  cererea #${p.id} (${p.agent}): ${p.discounturi} → ${p.nou || '(nimic)'}`);

if (!aplica) {
  if (clienti.length + propuneri.length) console.log('\n(rulează cu --aplica ca să le scrii)');
} else if (clienti.length + propuneri.length) {
  const backup = `${aici}../date-clienti/backup-reduceri-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
  fs.writeFileSync(backup, JSON.stringify({ clienti, propuneri }, null, 1));
  console.log(`\nBackup (ce era): ${backup}`);
  const sql = [
    ...clienti.map(c => `UPDATE client SET discounturi = ${q(c.nou || null)}, versiune = (SELECT MAX(versiune) FROM client) + 1
      WHERE id = ${c.id} AND discounturi = ${q(c.discounturi)};`),
    ...propuneri.map(p => `UPDATE propunere SET date_json = json_set(date_json, '$.discounturi', ${q(p.nou || null)})
      WHERE id = ${p.id} AND json_extract(date_json, '$.discounturi') = ${q(p.discounturi)};`),
  ].join('\n');
  const f = `${aici}.curata-reduceri.sql`;
  fs.writeFileSync(f, sql);
  try { d1(null, { fisier: f }); } finally { fs.rmSync(f, { force: true }); }
  const ramase = d1("SELECT id, discounturi FROM client WHERE discounturi IS NOT NULL AND discounturi <> ''")
    .filter(c => curat(c.discounturi) !== c.discounturi).length;
  console.log(ramase ? `Gata, dar ${ramase} clienţi s-au schimbat între timp — mai rulează o dată.` : 'Gata — toate reducerile sunt pe grupele noi.');
}
