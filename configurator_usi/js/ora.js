// ═══════════════════════════════════════════════════════════════════════════
//  ORA DE PE FIŞĂ — ora României (Europe/Bucharest), după ceasul EXACT al
//  managerului (/api/ora, corectat de pe internet — manager/server/ora.js), nu
//  după ceasul calculatorului, care poate fi în urmă (userul, 2026-10-05).
//  Fără manager (Cloudflare, de pe disc): ceasul calculatorului, tot pe ora României.
// ═══════════════════════════════════════════════════════════════════════════

let decalaj = 0;   // ms: ora exactă − ceasul calculatorului
fetch('/api/ora').then(r => (r.ok ? r.json() : null))
  .then(o => { if (Number.isFinite(o?.acum)) decalaj = o.acum - Date.now(); })
  .catch(() => { /* fără manager */ });

const FORMAT = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit',
  year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const parti = () => Object.fromEntries(FORMAT.formatToParts(new Date(Date.now() + decalaj)).map(x => [x.type, x.value]));

// „05/10/2026 15:24" — acelaşi format ca în manager
export const acumRo = () => { const p = parti(); return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`; };
// „05.10.2026" — doar data (lista de amănunt)
export const dataRo = () => { const p = parti(); return `${p.day}.${p.month}.${p.year}`; };

// Un moment din manager (SQLite, UTC: „2026-11-03 09:15:00") pe ora României, în aceleaşi formate
const partiDin = s => Object.fromEntries(FORMAT.formatToParts(new Date(String(s).replace(' ', 'T') + 'Z')).map(x => [x.type, x.value]));
export const momentRo = s => { const p = partiDin(s); return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`; };
export const ziRo = s => { const p = partiDin(s); return `${p.day}.${p.month}.${p.year}`; };

// Data de pe fişa unei comenzi VĂZUTE mai târziu (userul, 2026-11-05: „apare data şi ora curente în loc de data
// comenzii"): când s-a printat ultima dată fişa produsului k (ce scrie pe hârtia din atelier); neprintată —
// confirmarea comenzii, apoi data ofertei. `o` = comanda din manager (/api/comenzi/:id, cu `fise`).
export const momentFisa = (o, k) => (o.fise ?? []).filter(f => f.poz === k).map(f => f.la).sort().at(-1)
  ?? o.comanda?.confirmat_la ?? o.comanda?.creat_la ?? null;
