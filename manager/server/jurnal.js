const fs = require('node:fs');
const path = require('node:path');
const { config } = require('./config.js');

// ── Jurnalul serverului (userul, 2026-10-13) ─────────────────────────────────
// Ce scrie serverul (console.log / console.error) merge în fişiere LUNARE,
// <date>/jurnal/server-AAAA-LL.log, cu ora României pe fiecare rând; se păstrează
// ultimele 12. Înainte, ieşirea era redirecţionată în date\server.log, care creştea
// la nesfârşit. Pe ecran (rulat din terminal) se vede în continuare.
// O eroare neprinsă nu mai opreşte serverul fără urmă: se scrie în jurnal, apoi
// procesul iese (starea lui nu mai e sigură); o promisiune respinsă neprinsă doar
// se scrie (cererile îşi prind singure erorile).
// Doar când serverul porneşte singur (node server/index.js), nu şi în teste.
const ORA = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', dateStyle: 'short', timeStyle: 'medium' });

function pornesteJurnal() {
  const dir = path.join(path.dirname(config.db), 'jurnal');
  fs.mkdirSync(dir, { recursive: true });
  const vechi = fs.readdirSync(dir).filter(f => /^server-\d{4}-\d{2}\.log$/.test(f)).sort().slice(0, -12);
  for (const f of vechi) fs.rmSync(path.join(dir, f), { force: true });

  const fisier = () => path.join(dir, `server-${new Date().toISOString().slice(0, 7)}.log`);
  for (const flux of [process.stdout, process.stderr]) {
    const scrie = flux.write.bind(flux);
    flux.write = (bucata, ...rest) => {
      try { fs.appendFileSync(fisier(), String(bucata).replace(/^(?=.)/gm, `${ORA.format(new Date())}  `)); } catch { /* disc plin etc. */ }
      return flux.isTTY ? scrie(bucata, ...rest) : true;
    };
  }
  process.on('uncaughtException', e => {
    console.error('EROARE NEPRINSĂ — serverul se opreşte:', e);
    process.exit(1);
  });
  process.on('unhandledRejection', e => console.error('Promisiune respinsă neprinsă:', e));
}

module.exports = { pornesteJurnal };
