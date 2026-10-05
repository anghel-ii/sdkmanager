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
