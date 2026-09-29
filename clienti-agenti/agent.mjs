// Contul unui agent de vânzări, din linia de comandă (acelaşi lucru ca din /admin în manager):
//   node agent.mjs "Serban Dragos"                 cont nou SAU parolă nouă (îl deloghează)
//   node agent.mjs --dezactiveaza "Serban Dragos"  nu mai poate intra
// Merge prin API-ul de pe Cloudflare (functions/api/agenti.js), cu cheia din .dev.vars.
import fs from 'node:fs';

const cheie = fs.readFileSync(new URL('.dev.vars', import.meta.url), 'utf8').match(/CHEIE_MANAGER=(\S+)/)?.[1];
const [a, b] = process.argv.slice(2);
const dezactiveaza = a === '--dezactiveaza', nume = (dezactiveaza ? b : a)?.trim();
if (!nume) { console.error('Folosire: node agent.mjs "Nume Agent"   |   node agent.mjs --dezactiveaza "Nume Agent"'); process.exit(1); }

const r = await fetch('https://clienti-agenti.pages.dev/api/agenti', {
  method: dezactiveaza ? 'PATCH' : 'POST',
  headers: { Authorization: `Bearer ${cheie}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(dezactiveaza ? { nume, activ: false } : { nume }),
});
const j = await r.json();
if (!r.ok) { console.error(j.eroare); process.exit(1); }
if (dezactiveaza) { console.log(`${nume}: dezactivat şi delogat.`); process.exit(0); }
console.log(`\nhttps://clienti-agenti.pages.dev\n  user:   ${j.user}\n  parolă: ${j.parola}\n`);
console.log(j.clienti ? `${nume} are ${j.clienti} clienţi.` : `⚠ Niciun client pe numele „${nume}" — verifică să fie scris exact ca în coloana AGENT.`);
