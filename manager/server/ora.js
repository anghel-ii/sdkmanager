// ── Ora exactă ───────────────────────────────────────────────────────────────
// Userul (2026-10-05): „orele nu prea sunt ok… eşti în urmă cu câteva minute".
// Momentele (ofertat, acceptat, facturat…) se scriau cu ceasul calculatorului pe
// care rulează serverul — dacă el nu se sincronizează (Windows Time oprit, NTP
// blocat de firewall), rămâne în urmă. Aşa că nu ne bazăm pe el: la pornire şi la
// câteva ore citim ora din antetul `Date` al bazei de clienţi de pe Cloudflare — o
// adresă pe care managerul o foloseşte oricum (server/clienti.js), deci fără trafic
// spre site-uri noi. (2026-10-06: Kaspersky a pus node.exe în carantină a doua zi după
// ce verificarea întreba din oră în oră Google / Cloudflare / Microsoft — n-o mai face.)
// Fără internet rămâne ultima diferenţă ştiută (la început 0 = ceasul serverului).

const { config } = require('./config.js');
const SURSE = () => (config.clientiUrl ? [config.clientiUrl] : []);
const LA_6_ORE = 6 * 60 * 60 * 1000;

let diferenta = 0;   // ms: ora exactă − ceasul serverului

async function sincronizeaza() {
  for (const url of SURSE()) {
    try {
      const t0 = Date.now();
      const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      const t1 = Date.now();
      const exacta = Date.parse(r.headers.get('date'));
      if (!Number.isFinite(exacta)) continue;
      // antetul are rezoluţie de o secundă → mijlocul ei, faţă de mijlocul cererii
      const noua = exacta + 500 - (t0 + t1) / 2;
      if (Math.abs(noua - diferenta) > 2000) {
        console.log(`Ora: ceasul serverului e ${noua > 0 ? 'în urmă' : 'înainte'} cu ${Math.round(Math.abs(noua) / 1000)} s — folosesc ora exactă (${new URL(url).host}).`);
      }
      diferenta = Math.abs(noua) < 1500 ? 0 : noua;   // sub o secundă şi jumătate: ceasul e bun
      return true;
    } catch { /* următoarea sursă */ }
  }
  return false;
}

let temporizator = null;
function porneste() {
  sincronizeaza();
  temporizator = setInterval(sincronizeaza, LA_6_ORE);
  temporizator.unref();   // nu ţine procesul în viaţă (teste, oprire)
}

const acumMs = () => Date.now() + diferenta;
// formatul din SQLite (datetime('now')): UTC, „2026-10-05 12:24:57"
const acumSql = () => new Date(acumMs()).toISOString().slice(0, 19).replace('T', ' ');

// Cât de des întreabă serverul Cloudflare (clienţii + cererile agenţilor, raportul pt. /admin):
// la 30 s în programul de lucru, 7–18, altfel la 10 minute (userul, 2026-10-29 — mai puţine cereri).
const pauzaCloudflare = () => { const h = new Date(acumMs()).getHours(); return h >= 7 && h < 18 ? 30e3 : 10 * 60e3; };

module.exports = { porneste, sincronizeaza, acumMs, acumSql, pauzaCloudflare, _seteaza: ms => { diferenta = ms; } };
