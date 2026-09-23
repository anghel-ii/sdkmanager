const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');
const http = require('node:http');

// ── Test de fumegare pentru fundaţie ─────────────────────────────────────────
// Porneşte serverul pe o bază de date temporară şi verifică lanţul complet:
// login, sesiune, drepturi, administrare conturi, fişiere statice.
//   node scripts/test.js

const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'manager-test-'));
process.env.MANAGER_DB     = path.join(TEMP, 'test.sqlite');
process.env.MANAGER_BACKUP = path.join(TEMP, 'backup');
process.env.MANAGER_PORT   = '0';                       // port liber, ales de sistem
process.env.MANAGER_TLS_CERT = path.join(TEMP, 'inexistent.pem');   // forţează HTTP
process.env.MANAGER_TLS_KEY  = path.join(TEMP, 'inexistent.pem');
// Scanarea e oprită implicit în producţie (config.js), dar codul ei rămâne —
// o testăm PORNITĂ aici, ca să nu putrezească până o reactivăm. Modul oprit
// îl verifică scripts/test-fara-scanare.js.
process.env.MANAGER_SCANARE  = '1';

const { porneste } = require('../server/index.js');
const { creeazaUtilizator } = require('../server/auth.js');
const db2 = () => require('../server/db.js').db();

let treceri = 0, caderi = 0;

function verifica(nume, conditie, detaliu = '') {
  if (conditie) { treceri++; console.log(`  ✓ ${nume}`); }
  else          { caderi++;  console.log(`  ✗ ${nume}${detaliu ? ` — ${detaliu}` : ''}`); }
}

async function main() {
  const server = porneste();
  await new Promise(r => server.once('listening', r));
  const baza = `http://127.0.0.1:${server.address().port}`;

  // cerere cu păstrarea cookie-ului, ca un browser
  let cookie = null;
  async function cer(metoda, cale, corp) {
    const r = await fetch(baza + cale, {
      method: metoda,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: corp === undefined ? undefined : JSON.stringify(corp),
      redirect: 'manual',
    });
    const pus = r.headers.getSetCookie?.()[0];
    if (pus) cookie = pus.split(';')[0];
    const tip = r.headers.get('content-type') || '';
    return { stare: r.status, date: tip.includes('json') ? await r.json() : await r.text() };
  }

  console.log('\nFundaţie — manager de comenzi\n');

  console.log('Conturi');
  creeazaUtilizator({ nume: 'Admin Test', user: 'admin',  parola: 'parola-admin-1', rol: 'admin' });
  creeazaUtilizator({ nume: 'Ion Atelier', user: 'ion',   parola: 'parola-ion-123', rol: 'operator' });
  verifica('parola nu se stochează în clar', !JSON.stringify(
    require('../server/db.js').db().prepare('SELECT * FROM utilizator').all()
  ).includes('parola-admin-1'));

  console.log('\nAutentificare');
  verifica('fără sesiune → 401',        (await cer('GET',  '/api/eu')).stare === 401);
  verifica('parolă greşită → 401',      (await cer('POST', '/api/login', { user: 'admin', parola: 'gresit' })).stare === 401);
  verifica('utilizator inexistent → 401', (await cer('POST', '/api/login', { user: 'nimeni', parola: 'x' })).stare === 401);

  const intrare = await cer('POST', '/api/login', { user: 'admin', parola: 'parola-admin-1' });
  verifica('login corect → 200',        intrare.stare === 200, `stare ${intrare.stare}`);
  verifica('login nu întoarce hash-ul', !JSON.stringify(intrare.date).includes('parola_hash'));

  const eu = await cer('GET', '/api/eu');
  verifica('sesiunea ţine peste cereri', eu.stare === 200 && eu.date.utilizator.user === 'admin');

  console.log('\nDrepturi');
  verifica('admin vede lista de conturi', (await cer('GET', '/api/utilizatori')).stare === 200);

  const creat = await cer('POST', '/api/utilizatori',
    { nume: 'Maria Birou', user: 'maria', parola: 'parola-maria-1', rol: 'birou' });
  verifica('admin creează un cont',       creat.stare === 201, `stare ${creat.stare}`);
  verifica('user duplicat → 409',
    (await cer('POST', '/api/utilizatori', { nume: 'X', user: 'maria', parola: 'parola-maria-2' })).stare === 409);
  verifica('parolă prea scurtă → 400',
    (await cer('POST', '/api/utilizatori', { nume: 'X', user: 'scurt', parola: 'abc' })).stare === 400);
  verifica('rol necunoscut → 400',
    (await cer('POST', '/api/utilizatori', { nume: 'X', user: 'rol', parola: 'parola-lunga-1', rol: 'sef' })).stare === 400);
  verifica('adminul nu se poate dezactiva singur',
    (await cer('PATCH', `/api/utilizatori/${intrare.date.utilizator.id}`, { activ: 0 })).stare === 400);

  cookie = null;
  await cer('POST', '/api/login', { user: 'ion', parola: 'parola-ion-123' });
  const interzis = await cer('GET', '/api/utilizatori');
  verifica('operatorul NU vede conturile (403)', interzis.stare === 403, `stare ${interzis.stare}`);

  console.log('\nParolă proprie');
  verifica('parola curentă greşită → 403',
    (await cer('POST', '/api/eu/parola', { parolaCurenta: 'aiurea', parolaNoua: 'parola-noua-1' })).stare === 403);
  verifica('schimbare reuşită → 200',
    (await cer('POST', '/api/eu/parola', { parolaCurenta: 'parola-ion-123', parolaNoua: 'parola-noua-1' })).stare === 200);
  verifica('rămâi logat după schimbare', (await cer('GET', '/api/eu')).stare === 200);

  cookie = null;
  verifica('parola veche nu mai merge',
    (await cer('POST', '/api/login', { user: 'ion', parola: 'parola-ion-123' })).stare === 401);
  verifica('parola nouă merge',
    (await cer('POST', '/api/login', { user: 'ion', parola: 'parola-noua-1' })).stare === 200);

  console.log('\nLogout');
  await cer('POST', '/api/logout');
  cookie = null;
  verifica('după logout → 401', (await cer('GET', '/api/eu')).stare === 401);

  console.log('\nPagini şi fişiere');
  for (const [cale, nume] of [['/login', 'login'], ['/', 'principală'], ['/comenzi', 'comenzi'], ['/test-camera', 'test cameră']]) {
    const r = await cer('GET', cale);
    verifica(`pagina ${nume} se serveşte`, r.stare === 200 && String(r.date).includes('<!DOCTYPE html>'));
  }
  verifica('CSS-ul comun se serveşte', (await cer('GET', '/comun.css')).stare === 200);

  // Pagina managerului trebuie să conţină chiar bucăţile care fac faza 3:
  // taburile, rutarea pe hash şi butoanele de paste NeoManager.
  const acasa = String((await cer('GET', '/')).date);
  for (const [ce, bucata] of [
    ['listele de comenzi',     '/api/comenzi?tip='],
    ['butonul OFERTĂ NOUĂ',    'id="ofertaNoua"'],
    ['gamele din configurator','/configurator/game.json'],
    ['linkul spre sticlă',     'href="/sticla"'],
  ]) verifica(`pagina principală are ${ce}`, acasa.includes(bucata), bucata);

  const mg = String((await cer('GET', '/comenzi')).date);
  for (const [ce, bucata] of [
    ['taburile',            "['finalizata', 'Comenzi finalizate']"],
    ['apelul de listare',   '/api/comenzi?tip='],
    ['rutarea pe hash',     '#comanda/'],
    ['tabul din hash',      "location.hash === '#comenzi'"],
    ['linkul Acasă',        'href="/"'],
    ['butonul de acceptare','/accepta'],
    ['copierea NeoManager', 'copCant'],
  ]) verifica(`pagina managerului are ${ce}`, mg.includes(bucata));
  verifica('rută API inexistentă → 404', (await cer('GET', '/api/aiurea')).stare === 404);
  verifica('metodă greşită → 405',       (await cer('GET', '/api/login')).stare === 405);

  // Configuratorul foloseşte căi relative; fără slash-ul final s-ar rezolva
  // faţă de rădăcină şi pagina s-ar încărca goală, fără CSS şi fără JS.
  const faraSlash = await cer('GET', '/configurator');
  verifica('/configurator → redirect la /configurator/', faraSlash.stare === 302, `stare ${faraSlash.stare}`);
  const distGata = fs.existsSync(require('../server/config.js').config.dist);
  if (distGata) {
    verifica('configuratorul se serveşte',   (await cer('GET', '/configurator/')).stare === 200);
    verifica('bundle-ul lui se serveşte',    (await cer('GET', '/configurator/bundle.js')).stare === 200);
    verifica('CSS-ul lui se serveşte',       (await cer('GET', '/configurator/css/main.css')).stare === 200);
  } else {
    console.log('  – configurator neconstruit, sar peste (node build.js în configurator_usi)');
  }

  // Un bundle cache-uit cu max-age a produs deja un bug real: browserul rula
  // cod vechi după un build, fără ca nimeni să-şi dea seama. Fişierele statice
  // trebuie revalidate de fiecare dată; ETag-ul face revalidarea ieftină.
  console.log('\nCache');
  const brut = await fetch(baza + '/comun.css');
  const etag = brut.headers.get('etag');
  verifica('fişierele statice cer revalidare',
    brut.headers.get('cache-control') === 'no-cache', brut.headers.get('cache-control'));
  verifica('au ETag', !!etag, String(etag));

  const revalidat = await fetch(baza + '/comun.css', { headers: { 'If-None-Match': etag } });
  verifica('acelaşi ETag → 304 gol', revalidat.status === 304, `stare ${revalidat.status}`);

  fs.utimesSync(path.join(__dirname, '..', 'web', 'comun.css'), new Date(), new Date(Date.now() + 1000));
  const dupaModificare = await fetch(baza + '/comun.css', { headers: { 'If-None-Match': etag } });
  verifica('fişier modificat → 200, nu 304', dupaModificare.status === 200, `stare ${dupaModificare.status}`);

  console.log('\nTraversare de directoare');
  for (const atac of ['/../server/auth.js', '/%2e%2e/server/db.js', '/../../etc/passwd']) {
    const r = await cer('GET', atac);
    verifica(`blocat: ${atac}`, r.stare === 404 && !String(r.date).includes('scrypt'));
  }

  console.log('\nOperaţii implicite');
  const operatii = require('../server/db.js').db()
    .prepare('SELECT cod FROM operatie ORDER BY ordine').all().map(o => o.cod);
  verifica('5 operaţii semănate (ca pe fişă)',
    operatii.join(',') === 'DEBITARE,GAURIRE,GARNITURA,ASAMBLARE,COLETARE', operatii.join(', '));

  console.log('\nOferte (faza 2)');
  cookie = null;
  await cer('POST', '/api/login', { user: 'admin', parola: 'parola-admin-1' });

  const pozitie = (sistem, eticheta, nrUsi, latime) => ({
    sistem, eticheta, finisaj: 'ALUMINIU', latime, inaltime: 2100, nrUsi,
    config: { system: sistem, width: latime, height: 2100, doors: nrUsi },
    linii: {
      facturare: [{ cod: 'USA007', denumire: 'Uşă', um: 'buc', cantitate: nrUsi }],
      necesar:   [{ cod: 'AL-M19', denumire: 'Profil vertical', um: 'buc', cantitate: 2 * nrUsi, debitare: '2118 mm' }],
      client:    [{ cod: null, denumire: 'Panou PAL', um: 'buc', cantitate: 1, debitare: '600 × 900 mm' }],
    },
  });

  const oferta = await cer('POST', '/api/comenzi', {
    client: { nume: 'Client Test', telefon: '0700000000' },
    observatii: 'test',
    pozitii: [pozitie('confortVerona', 'Confort Verona', 5, 3000)],
  });
  verifica('ofertă creată → 201', oferta.stare === 201, JSON.stringify(oferta.date));
  verifica('numerotare OF-<an>-0001', /^OF-\d{4}-0001$/.test(oferta.date.comanda?.numar || ''),
           oferta.date.comanda?.numar);
  verifica('un singur cod de bare pe comandă (5 uşi)', oferta.date.comanda?.coduri?.length === 1,
           JSON.stringify(oferta.date.comanda?.coduri));
  verifica('respinsă: două sisteme într-o ofertă', (await cer('POST', '/api/comenzi', {
    client: { nume: 'X' }, pozitii: [pozitie('suspendataA', 'A', 1, 1200), pozitie('suspendataA', 'A', 1, 1200)] })).stare === 400);

  const id = oferta.date.comanda.id;
  const det = await cer('GET', `/api/comenzi/${id}`);
  const usi = det.date.coduri;
  verifica('detaliul are codul comenzii', usi.length === 1 && usi[0] === oferta.date.comanda.coduri[0].cod_bare, usi.join(' '));
  verifica('cod de bare = an + număr (ex. 260001)', /^\d{2}0001$/.test(usi[0]), usi[0]);
  verifica('config_json se întoarce parsat', det.date.pozitii[0].config.system === 'confortVerona');
  verifica('cele 3 liste păstrate',
    ['facturare', 'necesar', 'client'].every(l => det.date.pozitii[0].linii[l].length === 1));
  verifica('lista client n-are cod', det.date.pozitii[0].linii.client[0].cod === null);
  verifica('debitarea s-a păstrat', det.date.pozitii[0].linii.necesar[0].debitare === '2118 mm');

  const a2 = await cer('POST', '/api/comenzi', {
    client: { nume: 'Al doilea' }, pozitii: [pozitie('suspendataA', 'Suspendată A', 1, 1200)],
  });
  verifica('a doua ofertă → 0002', /-0002$/.test(a2.date.comanda?.numar || ''), a2.date.comanda?.numar);

  console.log('\n  validare');
  for (const [nume, corp] of [
    ['fără nume de client', { client: {}, pozitii: [pozitie('suspendataA', 'A', 1, 1200)] }],
    ['fără poziţii',        { client: { nume: 'X' }, pozitii: [] }],
    ['nr. uşi invalid',     { client: { nume: 'X' }, pozitii: [{ ...pozitie('suspendataA', 'A', 1, 1200), nrUsi: 0 }] }],
    ['lăţime invalidă',     { client: { nume: 'X' }, pozitii: [{ ...pozitie('suspendataA', 'A', 1, 1200), latime: -5 }] }],
    ['cantitate invalidă',  { client: { nume: 'X' }, pozitii: [{ ...pozitie('suspendataA', 'A', 1, 1200),
        linii: { facturare: [{ denumire: 'X', cantitate: 'multe' }] } }] }],
  ]) {
    verifica(`respins: ${nume}`, (await cer('POST', '/api/comenzi', corp)).stare === 400);
  }
  const inainte = db2().prepare('SELECT COUNT(*) AS n FROM comanda').get().n;
  await cer('POST', '/api/comenzi', { client: { nume: 'X' }, pozitii: [] });
  verifica('o ofertă respinsă nu lasă nimic în baza de date',
           db2().prepare('SELECT COUNT(*) AS n FROM comanda').get().n === inainte);

  console.log('\n  modificare (Modifică oferta)');
  const mod = await cer('PUT', `/api/comenzi/${id}`, {
    client: { nume: 'Client Modificat', telefon: '0711' }, pozitii: [pozitie('confortGamma', 'Confort Gamma', 3, 2800)] });
  verifica('PUT pe ofertă → 200, acelaşi număr şi cod', mod.stare === 200 &&
    mod.date.comanda.numar === oferta.date.comanda.numar && mod.date.comanda.coduri[0].cod_bare === usi[0],
    JSON.stringify(mod.date));
  const det3 = (await cer('GET', `/api/comenzi/${id}`)).date;
  verifica('configuraţia şi clientul s-au înlocuit', det3.pozitii.length === 1 &&
    det3.pozitii[0].config.system === 'confortGamma' && det3.comanda.client_nume === 'Client Modificat' &&
    det3.coduri[0] === usi[0], `${det3.pozitii.length} poz., ${det3.pozitii[0].config.system}`);

  console.log('\n  sumar (numerele de pe pagina principală)');
  const s1 = (await cer('GET', '/api/sumar')).date;
  verifica('sumar numără ofertele', s1.oferte === 2, JSON.stringify(s1));
  verifica('sumar: nicio comandă încă', !s1.comenzi, JSON.stringify(s1));

  console.log('\n  acceptare');
  verifica('oferta apare în tabul Oferte', (await cer('GET', '/api/comenzi')).date.comenzi.length === 2);
  const acc = await cer('POST', `/api/comenzi/${id}/accepta`);
  verifica('acceptare → 200', acc.stare === 200);
  verifica('acelaşi număr, alt prefix',
    acc.date.comanda?.numar_comanda === oferta.date.comanda.numar.replace('OF-', 'CMD-'),
    acc.date.comanda?.numar_comanda);
  verifica('acceptată de două ori → 409', (await cer('POST', `/api/comenzi/${id}/accepta`)).stare === 409);
  verifica('a trecut în tabul Comenzi',
    (await cer('GET', '/api/comenzi?tip=comanda')).date.comenzi.length === 1);
  verifica('nu mai e în Oferte', (await cer('GET', '/api/comenzi')).date.comenzi.length === 1);

  const s2 = (await cer('GET', '/api/sumar')).date;
  verifica('sumarul urmăreşte acceptarea', s2.oferte === 1 && s2.comenzi === 1, JSON.stringify(s2));
  verifica('comanda acceptată nu se mai modifică', (await cer('PUT', `/api/comenzi/${id}`, {
    client: { nume: 'Y' }, pozitii: [pozitie('confortGamma', 'G', 1, 1200)] })).stare === 409);
  // `cer` parsează singur răspunsurile application/json — game.json vine cu
  // content-type corect, deci `.date` e deja obiect.
  const gj = (await cer('GET', '/configurator/game.json')).date;
  verifica('game.json se serveşte din dist', gj.game?.length === 3 && gj.game.some(g => g.id === 'rame'), typeof gj);
  verifica('gamele au sistem implicit',
    gj.game?.every(g => g.implicit && g.modele?.length), JSON.stringify(gj.game?.map(g => g.id)));

  console.log('\nScanare din atelier');
  const scan = (cod, op, extra = '') => cer('GET',
    `/scan/inregistreaza?cod=${encodeURIComponent(cod)}&op=${op}&m=popup&o=https%3A%2F%2Fscanare-atelier.pages.dev${extra}`);
  const c1 = await scan(usi[0], 'ASAMBLARE');
  verifica('scanare → 200 + pagină care anunţă pagina de scanare', c1.stare === 200 &&
    c1.date.includes('"ok":true') && c1.date.includes('"https://scanare-atelier.pages.dev"'), String(c1.date).slice(0, 80));
  verifica('codul se găseşte şi cu spaţii în jur', (await scan(` ${usi[0]} `, 'DEBITARE')).stare === 200);
  await scan(usi[0], 'ASAMBLARE');
  const nScan = db2().prepare('SELECT COUNT(*) AS n FROM scanare').get().n;
  verifica('aceeaşi scanare în 30 s nu se dublează', nScan === 2, `${nScan} rânduri`);
  verifica('cod inexistent → 400', (await scan('999999-9-99', 'ASAMBLARE')).stare === 400);
  verifica('operaţie inexistentă → 400', (await scan(usi[0], 'GEAM')).stare === 400);
  const strain = await scan(usi[0], 'COLETARE', '').then(() =>
    cer('GET', `/scan/inregistreaza?cod=${usi[0]}&op=COLETARE&m=popup&o=https%3A%2F%2Frau.example`));
  verifica('postMessage NU pleacă spre o origine străină', !strain.date.includes('rau.example'));
  const nav = await cer('GET', `/scan/inregistreaza?cod=${usi[0]}&op=GAURIRE&m=nav&inapoi=${encodeURIComponent('https://scanare-atelier.pages.dev/')}`);
  verifica('mod navigare → redirect înapoi cu rezultatul', nav.stare === 302);
  const det2 = (await cer('GET', `/api/comenzi/${id}`)).date;
  verifica('detaliul comenzii are istoricul scanărilor', det2.scanari.length === 4 &&
    det2.scanari.at(-1).operatie === 'Gaurire', JSON.stringify(det2.scanari.map(x => x.operatie)));
  verifica('scanarea „Coletare" a finalizat comanda', !!det2.comanda.finalizat_la);
  const fin = (await cer('GET', '/api/comenzi?tip=finalizata')).date.comenzi;
  verifica('apare în „Comenzi finalizate", cu status = ultima operaţie',
    fin.length === 1 && fin[0].status?.operatie === 'Gaurire' && fin[0].sistem === 'Confort Gamma', JSON.stringify(fin[0]));
  verifica('nu mai e în „în lucru"', (await cer('GET', '/api/comenzi?tip=comanda')).date.comenzi.length === 0);
  verifica('redeschide → înapoi în lucru', (await cer('POST', `/api/comenzi/${id}/redeschide`)).stare === 200 &&
    (await cer('GET', '/api/comenzi?tip=comanda')).date.comenzi.length === 1);
  verifica('finalizare manuală', (await cer('POST', `/api/comenzi/${id}/finalizeaza`)).stare === 200 &&
    (await cer('GET', '/api/sumar')).date.finalizate === 1);
  const salvat = cookie; cookie = null;
  const fara = await scan(usi[0], 'ASAMBLARE');
  verifica('fără sesiune → login, apoi înapoi la scanare', fara.stare === 302);
  cookie = salvat;

  console.log('\nActualizare live (WebSocket /api/live)');
  // client WebSocket minimal (Node 22 are WebSocket global, dar fără antete
  // Cookie) — handshake de mână pe node:http, citim cadrele text
  const deschideLive = ck => new Promise(rez => {
    const req = http.request(baza + '/api/live', { headers: {
      ...(ck ? { Cookie: ck } : {}), Connection: 'Upgrade', Upgrade: 'websocket',
      'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version': '13' } });
    req.on('upgrade', (res, socket) => {
      const mesaje = [];
      socket.on('data', b => { if ((b[0] & 0x0f) === 1) mesaje.push(b.slice(2).toString()); });
      rez({ stare: 101, accept: res.headers['sec-websocket-accept'], mesaje, inchide: () => socket.destroy() });
    });
    req.on('response', res => rez({ stare: res.statusCode }));
    req.on('error', () => rez({ stare: 0 }));
    req.end();
  });
  const pauza = ms => new Promise(r => setTimeout(r, ms));
  verifica('fără sesiune → refuzat', (await deschideLive(null)).stare !== 101);
  const live = await deschideLive(cookie);
  verifica('handshake corect (RFC 6455)', live.stare === 101 && live.accept === 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=', live.accept);
  await cer('POST', `/api/comenzi/${id}/redeschide`);
  await pauza(200);
  verifica('serverul împinge schimbarea', live.mesaje.some(m => m.includes('"schimbare"')), JSON.stringify(live.mesaje));
  live.inchide();
  await cer('POST', `/api/comenzi/${id}/finalizeaza`);   // înapoi cum era, pt. testele de mai jos

  console.log('\nFacturare');
  verifica('fără număr → nu se poate marca facturată',
    (await cer('POST', `/api/comenzi/${id}/factura`, { numar: '  ' })).stare === 400);
  verifica('ofertă neacceptată → nu se facturează',
    (await cer('POST', `/api/comenzi/${a2.date.comanda.id}/factura`, { numar: 'F1' })).stare === 409);
  const fac = await cer('POST', `/api/comenzi/${id}/factura`, { numar: ' SDK 1234 ' });
  verifica('cu număr → facturată', fac.stare === 200 && fac.date.comanda.factura_nr === 'SDK 1234' && !!fac.date.comanda.facturat_la);
  verifica('lista arată nr. facturii',
    (await cer('GET', '/api/comenzi?tip=finalizata')).date.comenzi[0]?.factura_nr === 'SDK 1234');
  const anul = await cer('POST', `/api/comenzi/${id}/factura`, { numar: '', anuleaza: true });
  verifica('anulare facturare → nefacturată', anul.stare === 200 && anul.date.comanda.factura_nr === null);

  console.log('\nFixare şi sortare — per utilizator');
  verifica('fixare → 200', (await cer('POST', `/api/comenzi/${id}/fixare`, { fixat: true })).stare === 200);
  const fixAdmin = (await cer('GET', '/api/comenzi?tip=finalizata')).date.comenzi.find(c => c.id === id);
  verifica('adminul o vede fixată', fixAdmin?.fixat === true);
  verifica('sortare implicită = data', (await cer('GET', '/api/preferinte')).date.sortare === 'data');
  verifica('sortare salvată', (await cer('PUT', '/api/preferinte', { sortare: 'facturare' })).date.sortare === 'facturare');
  verifica('sortare invalidă → 400', (await cer('PUT', '/api/preferinte', { sortare: 'altceva' })).stare === 400);
  const cookieAdmin = cookie; cookie = null;
  await cer('POST', '/api/login', { user: 'maria', parola: 'parola-maria-1' });
  const fixMaria = (await cer('GET', '/api/comenzi?tip=finalizata')).date.comenzi.find(c => c.id === id);
  verifica('alt utilizator NU o vede fixată', fixMaria && fixMaria.fixat === false);
  verifica('alt utilizator are sortarea lui', (await cer('GET', '/api/preferinte')).date.sortare === 'data');
  cookie = cookieAdmin;
  // pin-ul ajunge DOAR la conexiunile aceluiaşi utilizator
  const cookieMaria = (await (async () => { const k = cookie; cookie = null;
    await cer('POST', '/api/login', { user: 'maria', parola: 'parola-maria-1' }); const m = cookie; cookie = k; return m; })());
  const liveA = await deschideLive(cookieAdmin), liveM = await deschideLive(cookieMaria);
  await cer('POST', `/api/comenzi/${id}/fixare`, { fixat: true });
  await pauza(200);
  verifica('pin-ul ajunge la celelalte taburi ale aceluiaşi cont', liveA.mesaje.some(m => m.includes('"personal"')));
  verifica('… dar nu la alţi utilizatori', !liveM.mesaje.some(m => m.includes('"personal"')));
  liveA.inchide(); liveM.inchide();
  verifica('scoatere fixare', (await cer('POST', `/api/comenzi/${id}/fixare`, { fixat: false })).stare === 200 &&
    (await cer('GET', '/api/comenzi?tip=finalizata')).date.comenzi.find(c => c.id === id).fixat === false);

  console.log('\nComandă sticlă');
  const cuSticla = (nume) => ({ client: { nume }, pozitii: [{ ...pozitie('rama842', 'Ramă 842', 3, 450),
    linii: { facturare: [{ cod: 'X', denumire: 'X', cantitate: 1 }], sticla: [
      { cod: 'GG004', denumire: 'Geam float transparent 4mm GG cod GG004', um: 'buc', cantitate: 2, debitare: '1144 × 384 mm' },
      { cod: 'CT063', denumire: 'Geam satinat maro 4mm securizat CT cod CT063', um: 'buc', cantitate: 1, debitare: '500 × 400 mm' },
      { cod: 'OVI001', denumire: 'Geam float 8mm securizat termic OVI001', um: 'buc', cantitate: 1, debitare: '2094 × 444 mm' },
    ] } }] });
  const ofS = (await cer('POST', '/api/comenzi', cuSticla('Client Sticla'))).date.comanda;
  verifica('oferta neacceptată NU apare la sticlă', (await cer('GET', '/api/sticla')).date.linii.length === 0);
  await cer('POST', `/api/comenzi/${ofS.id}/accepta`);
  const st = (await cer('GET', '/api/sticla')).date.linii;
  verifica('comanda acceptată → 3 linii de sticlă', st.length === 3, st.length);
  const dupaCod = c => st.find(l => l.cod === c);
  verifica('GG → GoldenGlass', dupaCod('GG004')?.furnizor.nume === 'GoldenGlass');
  verifica('OVI → OviBest', dupaCod('OVI001')?.furnizor.nume === 'OviBest');
  verifica('CT063 se comandă la CS (ca în Excel)', dupaCod('CT063')?.furnizor.cod === 'CS');
  verifica('mp calculaţi din cote (2 × 1144 × 384)', dupaCod('GG004')?.mp === 0.88, dupaCod('GG004')?.mp);
  verifica('sumar: bucăţi de comandat', (await cer('GET', '/api/sumar')).date.sticla === 4);
  const idGG = dupaCod('GG004').id;
  verifica('marchează comandate → 200', (await cer('POST', '/api/sticla/comanda', { ids: [idGG] })).stare === 200);
  verifica('iese din „de comandat"', (await cer('GET', '/api/sticla')).date.linii.length === 2);
  const cmd = (await cer('GET', '/api/sticla?comandate=1')).date.linii;
  verifica('apare la „comandate", cu cine', cmd.length === 1 && cmd[0].comandat_de_nume, JSON.stringify(cmd[0]?.comandat_de_nume));
  const stL = (await cer('GET', '/api/comenzi?tip=comanda')).date.comenzi.find(c => c.id === ofS.id)?.sticla;
  verifica('lista comenzilor arată sticla parţial comandată, cu cine', stL?.total === 3 && stL.comandate === 1 && !!stL.cine,
    JSON.stringify(stL));
  verifica('detaliul comenzii arată starea sticlei', (await cer('GET', `/api/comenzi/${ofS.id}`)).date.sticla?.comandate === 1);
  verifica('anulare → înapoi la „de comandat"', (await cer('POST', '/api/sticla/anuleaza', { ids: [idGG] })).stare === 200 &&
    (await cer('GET', '/api/sticla')).date.linii.length === 3);
  verifica('fără linii alese → 400', (await cer('POST', '/api/sticla/comanda', { ids: [] })).stare === 400);
  verifica('pagina /sticla se serveşte', String((await cer('GET', '/sticla')).date).includes('Comandă sticlă'));

  console.log('\nBackup');
  const dest = require('../server/db.js').backup();
  verifica('backup scris pe disc', fs.existsSync(dest) && fs.statSync(dest).size > 0);

  server.close();
  fs.rmSync(TEMP, { recursive: true, force: true });

  console.log(`\n${treceri} trecute, ${caderi} căzute\n`);
  process.exit(caderi ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
