// Produsele cu care porneşte o bază nouă (migraţia 39 din server/db.js). Adaugă în
// server/produse-start.json, ca NELISTATE, codurile din export care lipsesc de acolo;
// ce e deja în fişier rămâne neschimbat. Rulează ÎNAINTE de lansare, cu un export
// proaspăt — pe o bază deja migrată nu mai are efect.
//   node scripts/produse-start.js "../materiale/baza de date completa.xlsx"
const fs = require('node:fs');
const path = require('node:path');
const { dinExport } = require('../server/produse.js');

const FISIER = path.join(__dirname, '..', 'server', 'produse-start.json');
const pornire = JSON.parse(fs.readFileSync(FISIER, 'utf8'));
const are = new Set(pornire.map(p => p.cod));
const noi = dinExport(fs.readFileSync(process.argv[2])).produse.filter(p => !are.has(p.cod));
const toate = [...pornire, ...noi.map(p => ({ ...p, listat: 0 }))];
fs.writeFileSync(FISIER, `[\n${toate.map(p => JSON.stringify(p)).join(',\n')}\n]\n`);
console.log(`${noi.length} adăugate; ${toate.filter(p => p.listat).length} listate + ${toate.filter(p => !p.listat).length} nelistate`);
