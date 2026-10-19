// Import INIŢIAL al bazei de clienţi din Excel pe Cloudflare:
//   node importa.mjs "../date-clienti/Livrare_MASINA_completat (2).xlsx"
// O singură dată: refuză dacă baza are deja clienţi — după import, originalul e
// aici (agenţii modifică), nu în Excel. Managerul îi preia singur.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { clientiDinXlsx, COLOANE } from './xlsx.mjs';
import { d1, q } from './d1.mjs';

const fisier = process.argv[2];
if (!fisier) { console.error('Folosire: node importa.mjs <fisier.xlsx>'); process.exit(1); }

const clienti = clientiDinXlsx(fisier);
const exista = d1('SELECT COUNT(*) AS n FROM client')[0].n;
if (exista) { console.error(`Baza are deja ${exista} clienţi — importul se face o singură dată.`); process.exit(1); }

const col = Object.values(COLOANE);
const sql = clienti.map((c, i) =>
  `INSERT INTO client (${col.join(', ')}, versiune) VALUES (${col.map(k => q(c[k])).join(', ')}, ${i + 1});`).join('\n');
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'clienti-')), 'import.sql');
fs.writeFileSync(tmp, sql);
try { d1(null, { fisier: tmp }); } finally { fs.rmSync(path.dirname(tmp), { recursive: true }); }

console.log(`${clienti.length} clienţi importaţi. Pe agenţi:`);
const pe = {};
for (const c of clienti) pe[c.agent ?? '(fără agent)'] = (pe[c.agent ?? '(fără agent)'] ?? 0) + 1;
for (const [a, n] of Object.entries(pe).sort((x, y) => y[1] - x[1])) console.log(`  ${String(n).padStart(5)}  ${a}`);
