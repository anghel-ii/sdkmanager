// ═══════════════════════════════════════════════════════════════════════════
//  Repornirea după un update din /admin FĂRĂ drepturi de administrator
//  (manager/server/actualizare.js îl porneşte ca proces separat, apoi se opreşte).
//  Aşteaptă să se oprească serverul vechi, îl porneşte pe cel nou (acelaşi Node,
//  aceleaşi variabile MANAGER_*), verifică /login; dacă nu răspunde în 60 s, pune
//  înapoi codul de dinainte (SDK_INAINTE) şi îl porneşte pe acela.
//  Variabile: SDK_COD, SDK_INAINTE, SDK_URL, SDK_JURNAL, SDK_LOG.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const { SDK_COD: cod, SDK_INAINTE: inainte, SDK_URL: url, SDK_JURNAL: jurnal, SDK_LOG: log } = process.env;
const scrie = t => fs.appendFileSync(jurnal, `${new Date().toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' })}  ${t}\n`);
const pauza = ms => new Promise(r => setTimeout(r, ms));
if (url.startsWith('https')) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';   // certificatul e pe numele serverului, nu pe 127.0.0.1
const raspunde = async () => {
  try { return (await fetch(url, { signal: AbortSignal.timeout(3000) })).ok; } catch { return false; }
};

function porneste() {
  const out = fs.openSync(log, 'a');
  const p = spawn(process.execPath, [path.join(cod, 'manager', 'server', 'index.js')],
    { cwd: path.join(cod, 'manager'), detached: true, stdio: ['ignore', out, out], windowsHide: true });
  p.unref();
  return p;
}
async function merge(secunde) {
  for (let i = 0; i < secunde; i++) { await pauza(1000); if (await raspunde()) return true; }
  return false;
}

(async () => {
  for (let i = 0; i < 30 && await raspunde(); i++) await pauza(1000);   // serverul vechi se opreşte
  await pauza(1000);
  const nou = porneste();
  if (await merge(60)) return scrie('=== Update reuşit — serverul nou merge. ===');

  scrie('Serverul nou NU răspunde — pun înapoi versiunea de dinainte.');
  try { process.kill(nou.pid); } catch { /* s-a oprit deja */ }
  await pauza(2000);
  fs.rmSync(path.join(cod, 'VERSIUNE.json'), { force: true });
  fs.cpSync(inainte, cod, { recursive: true, force: true });
  porneste();
  scrie(await merge(60) ? 'Serverul merge din nou pe versiunea de dinainte.'
    : `ATENŢIE: nici versiunea de dinainte nu porneşte. Jurnal: ${log}`);
})().catch(e => scrie(`Repornirea a eşuat: ${e.message}`));
