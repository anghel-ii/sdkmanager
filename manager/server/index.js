const http  = require('node:http');
const https = require('node:https');
const fs    = require('node:fs');

const { config } = require('./config.js');
const { deschide, inchide, backup, inTest, copiaLui, sincronizeaza } = require('./db.js');
const repetare = require('./repetare.js');
const { eroare, redirect, serveste, router } = require('./http.js');
const auth = require('./auth.js');

const utilizatori = require('./api/utilizatori.js');
const comenzi     = require('./api/comenzi.js');
// scanarea din atelier — doar cu MANAGER_SCANARE=1 (vezi config.js)
const scanare     = config.scanare ? require('./scanare.js') : null;
const evenimente  = require('./evenimente.js');
const sticla      = require('./sticla.js');
const livrari     = require('./livrari.js');
const taskuri     = require('./taskuri.js');
const cereri      = require('./cereri.js');
const tichete     = require('./tichete.js');
const tablou      = require('./tablou.js');
const actualizare = require('./actualizare.js');
const clienti     = require('./clienti.js');
const ora         = require('./ora.js');
const releu       = require('./releu.js');

// ═══════════════════════════════════════════════════════════════════════════
//  Serverul managerului de comenzi
//
//  Un singur proces serveşte tot, pe acelaşi origin:
//    /api/*        API-ul JSON
//    /             managerul (oferte, comenzi)
//    /scan         pagina de scanare, pentru telefon
//    /configurator configuratorul 3D (dist-ul lui, construit separat)
//
//  Acelaşi origin înseamnă că acelaşi cookie de sesiune funcţionează şi în
//  configurator — de-aia nu-l servim de pe alt port sau alt server.
// ═══════════════════════════════════════════════════════════════════════════

// ── Rute ─────────────────────────────────────────────────────────────────────
// Fiecare rută declară cine o poate chema:
//   { public: true }   — fără sesiune (login)
//   { }                — orice utilizator logat
//   { rol: 'admin' }   — doar administratorii

const MODULE = [utilizatori, comenzi, scanare, evenimente, sticla, livrari, taskuri, cereri, tichete, tablou, actualizare, clienti].filter(Boolean);

const rute = MODULE.flatMap(m => m.rute).map(([metoda, cale, spec]) => [metoda, cale, spec]);
const potriveste = router(rute);
const PE_BUNE = ['/api/login', '/api/logout', '/api/eu', '/api/tichete'];   // şi în modul test

// ── Cererea ──────────────────────────────────────────────────────────────────

async function trateaza(req, res) {
  const cale = req.url.split('?')[0];

  // 1. API
  if (cale === '/api' || cale.startsWith('/api/')) {
    const gasit = potriveste(req.method, cale);
    if (!gasit)                return eroare(res, 404, 'Rută inexistentă.');
    if (gasit.metodaGresita)   return eroare(res, 405, `Metoda ${req.method} nu e permisă aici.`);

    const { handler: spec, params } = gasit;
    const utilizator = auth.dinToken(auth.tokenDinCerere(req));

    if (!spec.public && !utilizator)  return eroare(res, 401, 'Trebuie să fii autentificat.');
    // rol: unul ('admin') sau mai multe (['admin', 'conducere'])
    if (spec.rol && ![].concat(spec.rol).includes(utilizator.rol)) {
      return eroare(res, 403, 'Nu ai drepturile necesare pentru operaţia asta.');
    }

    const ctx = { req, res, params, utilizator };
    // Comanda cu cerere de anulare nedecisă e „pe hold" (cereri.js): nicio operaţie pe ea până
    // decide conducerea — în afară de cererea însăşi şi de pinul personal. Toate operaţiile pe
    // o comandă trec pe aici (/api/comenzi/:id/…), deci verificarea stă o singură dată.
    const peComanda = req.method !== 'GET' && /^\/api\/comenzi\/(\d+)(\/[\w-]+)?$/.exec(cale);
    const opreste = () => {
      if (!peComanda || ['/anulare', '/fixare'].includes(peComanda[2]) || !cereri.peHold(+peComanda[1])) return false;
      eroare(res, 409, 'Comanda are o cerere de anulare — e oprită până decide conducerea.');
      return true;
    };
    // Modul test: cererea merge pe copia bazei (server/db.js, „Modul test"). Contul
    // (parola, sesiunea) şi tichetele către admin rămân pe bune.
    // adminul e mereu în test (auth.js), dar administrarea (rutele doar pt. admin), clienţii şi cererile de anulare
    // (lista, aprobarea, respingerea — userul, 2026-10-19: aprobate doar în demo, reapăreau la fiecare update) merg pe bune
    const peBune = PE_BUNE.some(p => cale === p || cale.startsWith(p + '/'))
      || (utilizator?.rol === 'admin' && ([].concat(spec.rol ?? []).join() === 'admin' || cale.startsWith('/api/clienti') || cale.startsWith('/api/cereri')));
    // o cerere retrimisă de pagină (aceeaşi X-Cheie-Cerere) nu se execută de două ori — server/repetare.js
    return repetare.oSinguraData(req, res, utilizator?.id, async () => {
      if (utilizator?.mod_test && !peBune) {
        if (cale.startsWith('/api/clienti/propuneri/')) return eroare(res, 403, 'În modul test nu se aprobă clienţi — aprobarea ar ajunge pe bune.');
        // întâi lanţul la zi (ce a scris biroul în demo ajunge acum, nu la timer, în demo admin)
        sincronizeaza();
        return inTest(() => opreste() || spec.handler(ctx), copiaLui(utilizator));   // adminul pe copia lui
      }
      if (opreste()) return;
      try { return await spec.handler(ctx); } finally { sincronizeaza(); }   // ce s-a scris pe bune intră şi în copia de test
    });
  }

  // Scanarea din atelier — navigare/fereastră de la pagina de pe Cloudflare
  // (nu e sub /api: răspunde cu HTML/redirect, nu JSON) — vezi server/scanare.js
  if (scanare && cale === '/scan/inregistreaza') return scanare.trateazaScanare(req, res);

  // 2. Configuratorul 3D, servit din dist-ul lui.
  // index.html-ul lui foloseşte căi RELATIVE (`bundle.js`, `css/main.css`) ca
  // să rămână deschis şi direct de pe disc, fără server. Fără slash-ul final,
  // browserul le-ar rezolva faţă de `/`, nu faţă de `/configurator/`, şi ar
  // încărca pagina goală — de-aia redirecţionăm.
  if (cale === '/configurator') return redirect(res, '/configurator/');

  if (cale.startsWith('/configurator/')) {
    const sub = cale.slice('/configurator'.length) || '/';
    if (serveste(req, res, config.dist, sub)) return;
    return eroare(res, 404,
      'Configuratorul nu e construit. Rulează: cd configurator_usi && node build.js');
  }

  // 3. Paginile managerului. Rutele „frumoase" mapează pe foldere din web/.
  const PAGINI = {
    '/':            'manager',   // pagina principală = listele (oferte / în lucru / finalizate)
    '/comenzi':     'manager',   // (adresa veche — linkurile existente merg în continuare)
    '/sticla':      'sticla',    // comanda de sticlă la furnizori
    '/livrari':     'livrari',   // organizează livrările cu maşina noastră
    '/taskuri':     'taskuri',
    '/tichete':     'tichete',   // probleme / idei de la colegi pt. administrator (server/tichete.js)
    '/cereri':      'cereri',    // cererile (tichetele) pt. conducere: anulări de comenzi   // taskuri + remindere (notificarea o face bara.js)
    '/clienti':     'clienti',   // clienţii adăugaţi de agenţii de vânzări
    '/login':       'login',
    '/admin':       'admin',     // conturile (API-ul e doar pt. admin; pagina se autoverifică)
    ...(config.scanare ? { '/scan': 'scan', '/test-camera': 'test-camera' } : {}),
  };
  const pagina = PAGINI[cale.replace(/\/$/, '') || '/'];
  if (pagina && serveste(req, res, config.web, `/${pagina}/index.html`)) return;

  // 4. Restul fişierelor din web/ (css, js, imagini) — fără paginile de
  // scanare/cameră cât timp scanarea e oprită
  if (!config.scanare && /^\/(scan|test-camera)(\/|$)/.test(cale)) return eroare(res, 404, 'Pagină inexistentă.');
  if (serveste(req, res, config.web, cale)) return;

  eroare(res, 404, 'Pagină inexistentă.');
}

// Orice excepţie netratată dintr-un handler devine 500, cu urma în log-ul
// serverului şi NIMIC din ea în răspuns — mesajele de eroare interne pot
// scurge căi de fişiere sau fragmente de SQL.
const cerere = (req, res) =>
  Promise.resolve()
    .then(() => trateaza(req, res))
    .catch(e => {
      const cod = e.cod || 500;
      if (cod >= 500) console.error(`[${req.method} ${req.url}]`, e);
      if (!res.headersSent) eroare(res, cod, cod >= 500 ? 'Eroare internă.' : e.message);
    });

// ── Pornire ──────────────────────────────────────────────────────────────────

function porneste() {
  deschide();

  const server = config.https
    ? https.createServer({ cert: fs.readFileSync(config.tls.cert), key: fs.readFileSync(config.tls.key) }, cerere)
    : http.createServer(cerere);
  // actualizare live — WebSocket pe /api/live (server/evenimente.js)
  server.on('upgrade', evenimente.upgrade);

  server.listen(config.port, () => {
    const schema = config.https ? 'https' : 'http';
    // portul efectiv legat, nu cel cerut — diferă când config.port e 0
    console.log(`Manager comenzi: ${schema}://localhost:${server.address().port}`);
    console.log(`  bază de date : ${config.db}`);
    console.log(`  configurator : ${config.dist}${fs.existsSync(config.dist) ? '' : '  ⚠ neconstruit'}`);

    console.log(`  scanare      : ${config.scanare ? 'pornită' : 'oprită (MANAGER_SCANARE=1 o porneşte)'}`);
    releu.porneste(server.address().port);   // tabloul de admin de pe Cloudflare (doar serverul firmei)

    // camera telefonului (scanarea) cere HTTPS
    if (!config.https && config.scanare) {
      console.log('');
      console.log('  ⚠ HTTP simplu — camera telefonului e blocată pe origini nesecurizate.');
      console.log('    Pe Android: deschide /test-camera de pe telefon, îţi dă excepţia de');
      console.log('    pus în chrome://flags. Pe iPhone nu există ocol — pune certificatul');
      console.log('    în manager/certs/ (fullchain.pem + privkey.pem) sau setează');
      console.log('    MANAGER_TLS_CERT / MANAGER_TLS_KEY.');
    }
  });

  // Întreţinere zilnică: backup + curăţarea sesiunilor expirate. `unref` ca
  // timer-ul să nu ţină procesul în viaţă de unul singur.
  const zilnic = () => {
    try {
      const sterse = auth.curataSesiuni();
      console.log(`Întreţinere: backup → ${backup()}${sterse ? `, ${sterse} sesiuni expirate şterse` : ''}`);
    } catch (e) {
      console.error('Întreţinere eşuată:', e.message);
    }
  };
  zilnic();
  setInterval(zilnic, 24 * 3600 * 1000).unref();
  clienti.porneste();
  actualizare.pornesteRaportarea();   // pagina /admin de pe Cloudflare (update şi din afara firmei)
  ora.porneste();   // ora exactă de pe internet — momentele nu mai depind de ceasul serverului

  // Ctrl+C / systemctl stop. server.close() singur aştepta ca TOATE conexiunile
  // să se închidă — dar fiecare tab al managerului ţine una live (WebSocket), iar
  // browserele ţin şi conexiuni HTTP keep-alive, deci serverul nu mai ieşea.
  // Aşa: închidem conexiunile live + cele inactive, cererile în curs se termină,
  // apoi baza se închide curat. Plasă de siguranţă: ieşire după 2 s oricum; un al
  // doilea Ctrl+C iese imediat.
  let seOpreste = false;
  const opreste = () => {
    if (seOpreste) process.exit(1);
    seOpreste = true;
    console.log('\nSe opreşte serverul…');
    evenimente.inchideToate();
    server.close(() => { inchide(); process.exit(0); });
    server.closeIdleConnections();
    setTimeout(() => { inchide(); process.exit(0); }, 2000).unref();
  };
  process.on('SIGINT',  opreste);
  process.on('SIGTERM', opreste);

  return server;
}

if (require.main === module) { require('./jurnal.js').pornesteJurnal(); porneste(); }

module.exports = { porneste };
