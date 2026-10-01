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
  creeazaUtilizator({ nume: 'Ion Conducere', user: 'ion', parola: 'parola-ion-123', rol: 'conducere' });
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

  console.log('\nSesiuni în DB');
  {
    const crypto = require('node:crypto');
    const sha = t => crypto.createHash('sha256').update(t).digest('hex');
    const token = cookie.split('=').slice(1).join('=');
    const randuri = db2().prepare('SELECT token FROM sesiune').all().map(r => r.token);
    verifica('tokenul din cookie NU apare în clar în DB', !randuri.includes(token));
    verifica('în DB stă SHA-256 al tokenului', randuri.includes(sha(token)));
    

    // o sesiune veche, salvată în clar înainte de v6, trebuie să rămână validă
    const vechi = 'token-vechi-in-clar-' + Date.now();
    const adminId = db2().prepare("SELECT id FROM utilizator WHERE user = 'admin'").get().id;
    db2().prepare("INSERT INTO sesiune (token, utilizator_id, expira_la) VALUES (?, ?, datetime('now', '+1 day'))").run(vechi, adminId);
    require('../server/db.js').hashSesiuniInClar(db2());
    verifica('migraţia: tokenul vechi nu mai e în clar', !db2().prepare('SELECT 1 FROM sesiune WHERE token = ?').get(vechi));
    verifica('migraţia nu strică sesiunile deja convertite', (await cer('GET', '/api/eu')).stare === 200);
    const pastrat = cookie; cookie = `sesiune=${vechi}`;
    verifica('migraţia: omul logat înainte rămâne logat', (await cer('GET', '/api/eu')).stare === 200);
    await cer('POST', '/api/logout');
    verifica('logout şterge sesiunea (după hash)', (await cer('GET', '/api/eu')).stare === 401);
    cookie = pastrat;
  }

  console.log('\nDrepturi');
  verifica('admin vede lista de conturi', (await cer('GET', '/api/utilizatori')).stare === 200);
  verifica('admin vede starea actualizării', (await cer('GET', '/api/actualizare')).stare === 200);

  const creat = await cer('POST', '/api/utilizatori',
    { nume: 'Maria Birou', user: 'maria', parola: 'parola-maria-1', rol: 'birou' });
  verifica('admin creează un cont',       creat.stare === 201, `stare ${creat.stare}`);
  verifica('user duplicat → 409',
    (await cer('POST', '/api/utilizatori', { nume: 'X', user: 'maria', parola: 'parola-maria-2' })).stare === 409);
  verifica('parolă prea scurtă → 400',
    (await cer('POST', '/api/utilizatori', { nume: 'X', user: 'scurt', parola: 'abc' })).stare === 400);
  verifica('rol necunoscut → 400',
    (await cer('POST', '/api/utilizatori', { nume: 'X', user: 'rol', parola: 'parola-lunga-1', rol: 'sef' })).stare === 400);
  verifica('rolul vechi „operator" nu mai există → 400',
    (await cer('POST', '/api/utilizatori', { nume: 'X', user: 'rolv', parola: 'parola-lunga-1', rol: 'operator' })).stare === 400);
  verifica('rol implicit la cont nou = birou',
    (await cer('POST', '/api/utilizatori', { nume: 'Fara Rol', user: 'fararol', parola: 'parola-lunga-1' })).date.utilizator?.rol === 'birou');
  verifica('adminul nu se poate dezactiva singur',
    (await cer('PATCH', `/api/utilizatori/${intrare.date.utilizator.id}`, { activ: 0 })).stare === 400);
  for (const activ of [false, '']) {
    verifica(`… nici cu activ: ${JSON.stringify(activ)}`,
      (await cer('PATCH', `/api/utilizatori/${intrare.date.utilizator.id}`, { activ })).stare === 400);
  }
  verifica('adminul e tot activ după încercări',
    db2().prepare('SELECT activ FROM utilizator WHERE id = ?').get(intrare.date.utilizator.id).activ === 1);

  // parolă prea scurtă → 400 şi NIMIC salvat (nici numele, nici rolul)
  const maria = db2().prepare("SELECT id, nume, rol FROM utilizator WHERE user = 'maria'").get();
  verifica('modificare cu parolă prea scurtă → 400',
    (await cer('PATCH', `/api/utilizatori/${maria.id}`, { nume: 'Alt Nume', rol: 'conducere', parola: 'abc' })).stare === 400);
  const mariaDupa = db2().prepare('SELECT nume, rol FROM utilizator WHERE id = ?').get(maria.id);
  verifica('… şi nu s-a salvat nimic din ea', mariaDupa.nume === maria.nume && mariaDupa.rol === maria.rol,
    JSON.stringify(mariaDupa));

  cookie = null;
  await cer('POST', '/api/login', { user: 'ion', parola: 'parola-ion-123' });
  const interzis = await cer('GET', '/api/utilizatori');
  verifica('conducerea NU vede conturile (403)', interzis.stare === 403, `stare ${interzis.stare}`);

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
    client: { nume: 'Client Test', telefon: '0700000000', adresa: '  Str. Fabricii 12, Cluj  ' },
    detalii: { livrare: 'Curier ramburs', agent: 'Birou', facturare: 'Factura fiscala' },
    observatii: 'test',
    pozitii: [pozitie('confortVerona', 'Confort Verona', 5, 3000)],
  });
  verifica('ofertă creată → 201', oferta.stare === 201, JSON.stringify(oferta.date));
  verifica('numerotare OF-<an>-0001', /^OF-\d{4}-0001$/.test(oferta.date.comanda?.numar || ''),
           oferta.date.comanda?.numar);
  verifica('un singur cod de bare pe comandă (5 uşi)', oferta.date.comanda?.coduri?.length === 1,
           JSON.stringify(oferta.date.comanda?.coduri));
  verifica('respinsă: peste 20 de produse într-o ofertă', (await cer('POST', '/api/comenzi', {
    client: { nume: 'X' }, pozitii: Array(21).fill(pozitie('suspendataA', 'A', 1, 1200)) })).stare === 400);

  const id = oferta.date.comanda.id;
  const det = await cer('GET', `/api/comenzi/${id}`);
  const usi = det.date.coduri;
  verifica('detaliul are codul comenzii', usi.length === 1 && usi[0] === oferta.date.comanda.coduri[0].cod_bare, usi.join(' '));
  verifica('cod de bare = an + număr (ex. 260001)', /^\d{2}0001$/.test(usi[0]), usi[0]);
  verifica('config_json se întoarce parsat', det.date.pozitii[0].config.system === 'confortVerona');
  verifica('adresa şi detaliile comenzii se salvează (telefon separat de adresă)',
    det.date.comanda.client_telefon === '0700000000' && det.date.comanda.client_adresa === 'Str. Fabricii 12, Cluj' &&
    det.date.comanda.livrare === 'Curier ramburs' && det.date.comanda.agent === 'Birou' && det.date.comanda.tip_facturare === 'Factura fiscala',
    JSON.stringify(det.date.comanda));
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
  // modalitatea de plată e obligatorie; avansul e opţional (0 = fără avans)
  for (const [corp, ce] of [
    [undefined, 'fără modalitate de plată'], [{ plata: 'card' }, 'modalitate necunoscută'], [{ plata: 'op' }, 'modalitate veche (OP)'],
    [{ plata: 'bon', avans: -5 }, 'avans negativ'], [{ plata: 'bon', avans: 'mult' }, 'avans nenumeric'],
  ]) verifica(`acceptare respinsă: ${ce} → 400`, (await cer('POST', `/api/comenzi/${id}/accepta`, corp)).stare === 400);
  verifica('… şi oferta a rămas ofertă', db2().prepare('SELECT tip FROM comanda WHERE id = ?').get(id).tip === 'oferta');

  const acc = await cer('POST', `/api/comenzi/${id}/accepta`, { plata: 'fiscala', avans: '1500.5' });
  verifica('acceptare → 200', acc.stare === 200);
  verifica('se salvează plata şi avansul', acc.date.comanda?.plata === 'fiscala' && acc.date.comanda?.avans === 1500.5,
    JSON.stringify({ plata: acc.date.comanda?.plata, avans: acc.date.comanda?.avans }));
  verifica('acelaşi număr, alt prefix',
    acc.date.comanda?.numar_comanda === oferta.date.comanda.numar.replace('OF-', 'CMD-'),
    acc.date.comanda?.numar_comanda);
  verifica('acceptată de două ori → 409', (await cer('POST', `/api/comenzi/${id}/accepta`, { plata: 'bon' })).stare === 409);
  verifica('a trecut în tabul Comenzi',
    (await cer('GET', '/api/comenzi?tip=comanda')).date.comenzi.length === 1);
  verifica('nu mai e în Oferte', (await cer('GET', '/api/comenzi')).date.comenzi.length === 1);
  {
    const rand = (await cer('GET', '/api/comenzi?tip=comanda')).date.comenzi.find(c => c.id === id);
    verifica('lista Comenzi are plata şi avansul', rand?.plata === 'fiscala' && rand?.avans === 1500.5,
      JSON.stringify({ plata: rand?.plata, avans: rand?.avans }));
  }

  const s2 = (await cer('GET', '/api/sumar')).date;
  verifica('sumarul urmăreşte acceptarea', s2.oferte === 1 && s2.comenzi === 1, JSON.stringify(s2));
  verifica('comanda acceptată nu se mai modifică', (await cer('PUT', `/api/comenzi/${id}`, {
    client: { nume: 'Y' }, pozitii: [pozitie('confortGamma', 'G', 1, 1200)] })).stare === 409);
  // `cer` parsează singur răspunsurile application/json — game.json vine cu
  // content-type corect, deci `.date` e deja obiect.
  const gj = (await cer('GET', '/configurator/game.json')).date;
  verifica('game.json se serveşte din dist', gj.game?.length === 5 && gj.game.some(g => g.id === 'util'), typeof gj);
  // oferta cu amănuntul n-are modele — are pagina ei (amanunt.html)
  verifica('gamele au sistem implicit',
    gj.game?.every(g => g.id === 'amanunt' || (g.implicit && g.modele?.length)), JSON.stringify(gj.game?.map(g => g.id)));
  verifica('pagina ofertei cu amănuntul se serveşte', (await cer('GET', '/configurator/amanunt.html')).stare === 200);

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
  verifica('redeschisă → fără „finalizat de"', (await cer('GET', `/api/comenzi/${id}`)).date.comanda.finalizat_de_nume == null);
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
  {
    const c = (await cer('GET', `/api/comenzi/${id}`)).date.comanda;
    verifica('detaliu: acceptată de …', c.confirmat_de_nume === 'Admin Test' && !!c.confirmat_la, c.confirmat_de_nume);
    verifica('detaliu: facturată de …', c.facturat_de_nume === 'Admin Test', c.facturat_de_nume);
    verifica('detaliu: finalizată de …', c.finalizat_de_nume === 'Admin Test', c.finalizat_de_nume);
  }
  const anul = await cer('POST', `/api/comenzi/${id}/factura`, { numar: '', anuleaza: true });
  verifica('anulare facturare → şterge şi „facturat de"', (await cer('GET', `/api/comenzi/${id}`)).date.comanda.facturat_de_nume == null);
  verifica('anulare facturare → nefacturată', anul.stare === 200 && anul.date.comanda.factura_nr === null);

  console.log('\n  facturare pe roluri');
  {
    const ca = async (user, parola, fn) => { const k = cookie; cookie = null;
      await cer('POST', '/api/login', { user, parola }); try { return await fn(); } finally { cookie = k; } };
    const fact = corp => cer('POST', `/api/comenzi/${id}/factura`, corp);
    const nr = () => db2().prepare('SELECT factura_nr FROM comanda WHERE id = ?').get(id).factura_nr;

    await ca('maria', 'parola-maria-1', async () => {
      verifica('birou: trece nr. pe o comandă nefacturată → 200', (await fact({ numar: 'B-1' })).stare === 200 && nr() === 'B-1');
      verifica('birou: NU poate modifica nr. existent → 403', (await fact({ numar: 'B-2' })).stare === 403 && nr() === 'B-1');
      verifica('birou: NU poate anula facturarea → 403', (await fact({ numar: '', anuleaza: true })).stare === 403 && nr() === 'B-1');
      verifica('birou: NU vede conturile → 403', (await cer('GET', '/api/utilizatori')).stare === 403);
      verifica('birou: NU poate porni actualizarea → 403', (await cer('POST', '/api/actualizare')).stare === 403);
      const eu = (await cer('GET', '/api/eu')).date.utilizator;
      verifica('/api/eu spune rolul (pt. interfaţă)', eu?.rol === 'birou');
    });
    await ca('ion', 'parola-noua-1', async () => {
      verifica('conducere: modifică nr. existent → 200', (await fact({ numar: 'C-2' })).stare === 200 && nr() === 'C-2');
      verifica('conducere: anulează facturarea → 200', (await fact({ numar: '', anuleaza: true })).stare === 200 && nr() === null);
      verifica('conducere: NU vede conturile → 403', (await cer('GET', '/api/utilizatori')).stare === 403);
      verifica('conducere: NU creează conturi → 403',
        (await cer('POST', '/api/utilizatori', { nume: 'X', user: 'x2', parola: 'parola-lunga-1' })).stare === 403);
    });
    verifica('admin: modifică şi anulează', (await fact({ numar: 'A-1' })).stare === 200 && (await fact({ numar: 'A-2' })).stare === 200
      && (await fact({ numar: '', anuleaza: true })).stare === 200 && nr() === null);

    // migraţia v7 → v8: rolul vechi „operator" devine „birou"
    const idVechi = Number(db2().prepare("INSERT INTO utilizator (nume, user, parola_hash, parola_salt, rol) VALUES ('Vechi', 'vechi', 'x', 'x', 'operator')").run().lastInsertRowid);
    require('../server/db.js').roluriNoi(db2());
    verifica('migraţie: operator → birou', db2().prepare('SELECT rol FROM utilizator WHERE id = ?').get(idVechi).rol === 'birou');
    verifica('schema la versiunea 13', db2().prepare('PRAGMA user_version').get().user_version === 13);
  }

  console.log('\nFixare şi sortare — per utilizator');
  verifica('fixare → 200', (await cer('POST', `/api/comenzi/${id}/fixare`, { fixat: true })).stare === 200);
  const fixAdmin = (await cer('GET', '/api/comenzi?tip=finalizata')).date.comenzi.find(c => c.id === id);
  verifica('adminul o vede fixată', fixAdmin?.fixat === true);
  verifica('sortare implicită = data', (await cer('GET', '/api/preferinte')).date.sortare === 'data');
  verifica('sortare salvată', (await cer('PUT', '/api/preferinte', { sortare: 'facturare' })).date.sortare === 'facturare');
  verifica('sortare invalidă → 400', (await cer('PUT', '/api/preferinte', { sortare: 'altceva' })).stare === 400);
  verifica('lăţimea barei configuratorului: implicit nesetată', (await cer('GET', '/api/preferinte')).date.latimeBara == null);
  verifica('lăţimea barei se salvează pe cont (număr)', (await cer('PUT', '/api/preferinte', { latimeBara: 612 })).date.latimeBara === 612);
  verifica('… şi se citeşte înapoi', (await cer('GET', '/api/preferinte')).date.latimeBara === 612);
  verifica('lăţime invalidă → 400', (await cer('PUT', '/api/preferinte', { latimeBara: 50 })).stare === 400
    && (await cer('PUT', '/api/preferinte', { latimeBara: 'lata' })).stare === 400);
  verifica('… şi n-a stricat valoarea salvată', (await cer('GET', '/api/preferinte')).date.latimeBara === 612);
  const cookieAdmin = cookie; cookie = null;
  await cer('POST', '/api/login', { user: 'maria', parola: 'parola-maria-1' });
  const fixMaria = (await cer('GET', '/api/comenzi?tip=finalizata')).date.comenzi.find(c => c.id === id);
  verifica('alt utilizator NU o vede fixată', fixMaria && fixMaria.fixat === false);
  verifica('alt utilizator are sortarea lui', (await cer('GET', '/api/preferinte')).date.sortare === 'data');
  verifica('alt utilizator NU are lăţimea barei adminului', (await cer('GET', '/api/preferinte')).date.latimeBara == null);
  cookie = cookieAdmin;
  verifica('lăţime null = înapoi la implicit', (await cer('PUT', '/api/preferinte', { latimeBara: null })).date.latimeBara == null);
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
  const accS = await cer('POST', `/api/comenzi/${ofS.id}/accepta`, { plata: 'bon' });
  verifica('acceptare fără avans → avans 0', accS.date.comanda?.avans === 0, accS.date.comanda?.avans);
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
  await cer('POST', `/api/comenzi/${ofS.id}/finalizeaza`);
  verifica('comandă finalizată → dispare din „comandate"', (await cer('GET', '/api/sticla?comandate=1')).date.linii.length === 0);
  await cer('POST', `/api/comenzi/${ofS.id}/redeschide`);
  verifica('redeschisă → apare din nou la „comandate"', (await cer('GET', '/api/sticla?comandate=1')).date.linii.length === 1);
  verifica('anulare → înapoi la „de comandat"', (await cer('POST', '/api/sticla/anuleaza', { ids: [idGG] })).stare === 200 &&
    (await cer('GET', '/api/sticla')).date.linii.length === 3);
  verifica('fără linii alese → 400', (await cer('POST', '/api/sticla/comanda', { ids: [] })).stare === 400);
  verifica('pagina /sticla se serveşte', String((await cer('GET', '/sticla')).date).includes('Comandă sticlă'));

  console.log('\nConturi create de admin, activate de utilizator la primul login');
  {
    const ca = async fn => { const k = cookie; cookie = null; try { return await fn(); } finally { cookie = k; } };
    // ca admin
    const nou = await cer('POST', '/api/utilizatori', { user: ' Ana.Pop ', rol: 'birou' });
    verifica('admin creează cont DOAR cu utilizator + rol → 201', nou.stare === 201 && nou.date.utilizator?.user === 'ana.pop', JSON.stringify(nou.date));
    verifica('… numele afişat = utilizatorul', nou.date.utilizator?.nume === 'ana.pop');
    verifica('… contul apare neactivat în listă',
      (await cer('GET', '/api/utilizatori')).date.utilizatori.find(u => u.user === 'ana.pop')?.activat === false);
    verifica('utilizator cu caractere nepermise → 400', (await cer('POST', '/api/utilizatori', { user: 'ana pop!', rol: 'birou' })).stare === 400);
    verifica('utilizator existent → 409', (await cer('POST', '/api/utilizatori', { user: 'ana.pop', rol: 'birou' })).stare === 409);

    await ca(async () => {
      const r1 = await cer('POST', '/api/login', { user: 'ana.pop', parola: 'parola-ana-1' });
      verifica('primul login pe cont neactivat → cere confirmarea parolei', r1.stare === 409 && r1.date.activare === true, JSON.stringify(r1));
      verifica('… fără sesiune încă', cookie === null);
      verifica('parole diferite → 400, contul rămâne neactivat',
        (await cer('POST', '/api/login', { user: 'ana.pop', parola: 'parola-ana-1', parolaConfirmare: 'alta-parola-1' })).stare === 400);
      verifica('parolă prea scurtă → 400',
        (await cer('POST', '/api/login', { user: 'ana.pop', parola: 'scurt', parolaConfirmare: 'scurt' })).stare === 400);
      const r2 = await cer('POST', '/api/login', { user: 'ana.pop', parola: 'parola-ana-1', parolaConfirmare: 'parola-ana-1' });
      verifica('parole identice → cont activat + logat', r2.stare === 200 && !!cookie && r2.date.utilizator?.rol === 'birou');
      verifica('… sesiunea merge', (await cer('GET', '/api/eu')).date.utilizator?.user === 'ana.pop');
    });
    await ca(async () => {
      verifica('după activare: login normal', (await cer('POST', '/api/login', { user: 'ana.pop', parola: 'parola-ana-1' })).stare === 200);
      verifica('după activare: altcineva NU mai poate „reactiva" cu altă parolă → 401',
        (await cer('POST', '/api/login', { user: 'ana.pop', parola: 'alta-parola-2', parolaConfirmare: 'alta-parola-2' })).stare === 401);
    });
    const ana = (await cer('GET', '/api/utilizatori')).date.utilizatori.find(u => u.user === 'ana.pop');
    verifica('lista o arată activată', ana.activat === true);
    verifica('lista nu scoate hash-ul / salt-ul', !JSON.stringify(ana).includes('parola'));

    // resetare parolă (parolă uitată)
    verifica('admin resetează parola → 200', (await cer('PATCH', `/api/utilizatori/${ana.id}`, { reseteazaParola: true })).stare === 200);
    verifica('… contul e iar neactivat', (await cer('GET', '/api/utilizatori')).date.utilizatori.find(u => u.id === ana.id).activat === false);
    verifica('… şi sesiunile ei au căzut', !db2().prepare('SELECT 1 FROM sesiune WHERE utilizator_id = ?').get(ana.id));
    await ca(async () => {
      verifica('… parola veche nu mai merge (cere activare)', (await cer('POST', '/api/login', { user: 'ana.pop', parola: 'parola-ana-1' })).stare === 409);
      verifica('… îşi pune parolă nouă', (await cer('POST', '/api/login', { user: 'ana.pop', parola: 'parola-ana-2', parolaConfirmare: 'parola-ana-2' })).stare === 200);
    });
    const eu = (await cer('GET', '/api/eu')).date.utilizator;
    verifica('adminul NU îşi poate reseta singur parola → 400', (await cer('PATCH', `/api/utilizatori/${eu.id}`, { reseteazaParola: true })).stare === 400);
    // cont dezactivat, neactivat: nu se poate activa
    const blocat = (await cer('POST', '/api/utilizatori', { user: 'blocat', rol: 'birou' })).date.utilizator;
    await cer('PATCH', `/api/utilizatori/${blocat.id}`, { activ: false });
    await ca(async () => {
      verifica('cont dezactivat → nu se poate activa (401)',
        (await cer('POST', '/api/login', { user: 'blocat', parola: 'parola-lunga-9', parolaConfirmare: 'parola-lunga-9' })).stare === 401);
    });
    verifica('pagina /admin se serveşte', String((await cer('GET', '/admin')).date).includes('Utilizatori'));
  }

  console.log('\nRedirect după login');
  {
    // destinatie() din pagina de login: doar căi de pe ACELAŞI site
    const html = fs.readFileSync(path.join(__dirname, '../web/login/index.html'), 'utf8');
    const sursa = html.match(/function destinatie\(\) \{[\s\S]*?\n\}/)?.[0];
    const dest = redirect => new Function('location', `${sursa}; return destinatie();`)(
      { origin: 'https://manager.local', search: '?redirect=' + encodeURIComponent(redirect) });
    for (const [r, asteptat] of [
      ['/comenzi', '/comenzi'], ['/configurator/?oferta=12', '/configurator/?oferta=12'],
      ['//evil.com', '/'], ['/\\evil.com', '/'], ['/\\/evil.com', '/'], ['https://evil.com', '/'],
      ['javascript:alert(1)', '/'], ['/%5Cevil.com', '/%5Cevil.com'],
    ]) verifica(`redirect ${JSON.stringify(r)} → ${asteptat}`, dest(r) === asteptat, dest(r));
  }

  console.log('\nAfişare');
  {
    // web/data.js: UTC din SQLite → ora locală (România), format zz/ll/aaaa hh:mm
    const sursa = fs.readFileSync(path.join(__dirname, '../web/data.js'), 'utf8');
    const tzVechi = process.env.TZ;
    process.env.TZ = 'Europe/Bucharest';
    const dataOra = new Function(`${sursa}; return dataOra;`)();
    verifica('dată din DB (UTC) → zz/ll/aaaa hh:mm, ora României — vară',
      dataOra('2026-09-16 05:52:14') === '16/09/2026 08:52', dataOra('2026-09-16 05:52:14'));
    verifica('… şi iarna (+2, trece în ziua următoare)', dataOra('2026-01-10 22:30:00') === '11/01/2026 00:30', dataOra('2026-01-10 22:30:00'));
    verifica('dată lipsă → —', dataOra(null) === '—');
    verifica('un Date (ora de acum) în acelaşi format', /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(dataOra(new Date())));
    if (tzVechi === undefined) delete process.env.TZ; else process.env.TZ = tzVechi;
    for (const pagina of ['manager', 'sticla']) {
      const html = fs.readFileSync(path.join(__dirname, `../web/${pagina}/index.html`), 'utf8');
      verifica(`pagina ${pagina} foloseşte data.js, fără toLocaleString propriu`,
        html.includes('<script src="/data.js">') && !/toLocaleDateString\(|toLocaleTimeString\(|day: '2-digit'/.test(html));
    }
  }

  console.log('\nAşteaptă plata + nr. de ofertă scris de mână');
  {
    const o = await cer('POST', '/api/comenzi', { client: { nume: 'Client Plata' }, ofertaNr: ' NM-77 ',
      detalii: { plata: 'proforma_amanunt' }, pozitii: [pozitie('confortGamma', 'Confort Gamma', 2, 2000)] });
    const pid = o.date.comanda.id;
    verifica('nr. de ofertă se salvează (tăiat)', db2().prepare('SELECT oferta_nr FROM comanda WHERE id = ?').get(pid).oferta_nr === 'NM-77');
    verifica('metoda de plată din configurator se salvează pe ofertă',
      db2().prepare('SELECT plata FROM comanda WHERE id = ?').get(pid).plata === 'proforma_amanunt');
    const oc = await cer('POST', '/api/comenzi', { client: { nume: 'Plata ciudata' }, detalii: { plata: 'card' },
      pozitii: [pozitie('confortGamma', 'Confort Gamma', 1, 1200)] });
    verifica('metodă de plată necunoscută → ignorată (NULL)',
      db2().prepare('SELECT plata FROM comanda WHERE id = ?').get(oc.date.comanda.id).plata === null);
    const sumarInainte = (await cer('GET', '/api/sumar')).date;
    verifica('ofertă → aşteaptă plata → 200', (await cer('POST', `/api/comenzi/${pid}/asteapta-plata`)).stare === 200);
    verifica('a doua oară → 409', (await cer('POST', `/api/comenzi/${pid}/asteapta-plata`)).stare === 409);
    const tab = (await cer('GET', '/api/comenzi?tip=plata')).date.comenzi;
    verifica('apare în tabul Aşteaptă plata, cu nr. de ofertă', tab.length === 1 && tab[0].oferta_nr === 'NM-77', JSON.stringify(tab));
    const sumarDupa = (await cer('GET', '/api/sumar')).date;
    verifica('sumar: plata +1, oferte −1', sumarDupa.plata === 1 && sumarDupa.oferte === sumarInainte.oferte - 1, JSON.stringify(sumarDupa));
    verifica('nu se modifică din configurator', (await cer('PUT', `/api/comenzi/${pid}`, {
      client: { nume: 'Y' }, pozitii: [pozitie('confortGamma', 'G', 1, 1200)] })).stare === 409);
    verifica('nu se facturează cât aşteaptă plata', (await cer('POST', `/api/comenzi/${pid}/factura`, { numar: 'F1' })).stare === 409);
    const pl = await cer('POST', `/api/comenzi/${pid}/accepta`, { plata: 'proforma', avans: 0 });
    verifica('plată primită → comandă în lucru', pl.stare === 200 && pl.date.comanda.tip === 'comanda' && /^CMD-/.test(pl.date.comanda.numar_comanda));
    verifica('… şi a ieşit din Aşteaptă plata', !(await cer('GET', '/api/comenzi?tip=plata')).date.comenzi.length);
    const cate = async tip => (await cer('GET', '/api/comenzi?tip=' + tip)).date.comenzi.length;
    const peTaburi = await cate('oferta') + await cate('plata') + await cate('comanda') + await cate('finalizata');
    verifica('căutarea globală: tip=toate = cele patru taburi la un loc', peTaburi > 1 && await cate('toate') === peTaburi, `${peTaburi}`);
    // oferta cu amănuntul (configurator_usi/amanunt.html): produse la bucată, fără gol şi uşi
    const amanunt = linii => ({ sistem: 'amanunt', eticheta: 'Ofertă cu amănuntul', finisaj: '', latime: 0, inaltime: 0, nrUsi: 1,
      config: { system: 'amanunt', amanunt: linii }, linii: { facturare: linii, necesar: [], client: [], sticla: [] } });
    const am = await cer('POST', '/api/comenzi', { client: { nume: 'Client Amanunt' }, ofertaNr: 'NM-AM',
      pozitii: [amanunt([{ cod: 'SM127', denumire: 'Cuplaj sertar', um: 'set', cantitate: 4 }])] });
    verifica('ofertă cu amănuntul: fără cote → 201', am.stare === 201, JSON.stringify(am.date));
    verifica('… dar nu fără produse', (await cer('POST', '/api/comenzi', { client: { nume: 'X' }, pozitii: [amanunt([])] })).stare === 400);
    verifica('… iar o uşă tot cere cotele', (await cer('POST', '/api/comenzi', { client: { nume: 'X' },
      pozitii: [{ ...pozitie('confortVerona', 'V', 2, 0) }] })).stare === 400);

    // mai multe produse pe o ofertă: fiecare cu fişa lui, facturarea comasată în manager
    const multi = await cer('POST', '/api/comenzi', { client: { nume: 'Client Multi' }, ofertaNr: 'NM-M',
      pozitii: [pozitie('rama820', 'Ramă 820', 6, 600), pozitie('confortGamma', 'Confort Gamma', 2, 1800),
                amanunt([{ cod: 'SM127', denumire: 'Cuplaj sertar', um: 'set', cantitate: 4 }])] });
    verifica('ofertă cu 3 produse → 201, un singur cod de bare', multi.stare === 201 && multi.date.comanda.coduri?.length === 1, JSON.stringify(multi.date));
    const mid = multi.date.comanda.id;
    const dm = (await cer('GET', `/api/comenzi/${mid}`)).date;
    verifica('… cele 3 poziţii, în ordine', dm.pozitii.map(p => `${p.idx}:${p.sistem}`).join() === '1:rama820,2:confortGamma,3:amanunt', dm.pozitii.map(p => p.sistem).join());
    const rm = (await cer('GET', '/api/comenzi?tip=oferta')).date.comenzi.find(c => c.id === mid);
    verifica('… în listă toate sistemele', rm?.sistem === 'Ramă 820 + Confort Gamma + Ofertă cu amănuntul' && rm.nr_pozitii === 3, rm?.sistem);
    verifica('… produsul greşit e numit', (await cer('POST', '/api/comenzi', { client: { nume: 'X' },
      pozitii: [pozitie('rama820', 'R', 1, 600), amanunt([])] })).date.eroare?.startsWith('Produsul 2:'));
    const codM = dm.coduri[0];
    const mod = await cer('PUT', `/api/comenzi/${mid}`, { client: { nume: 'Client Multi' },
      pozitii: [amanunt([{ cod: 'SM178', denumire: 'Cuplaj', um: 'set', cantitate: 2 }]), pozitie('rama820', 'Ramă 820', 3, 600)] });
    const dm2 = (await cer('GET', `/api/comenzi/${mid}`)).date;
    verifica('modificare: 2 produse, renumerotate 1..2, acelaşi cod de bare', mod.stare === 200
      && dm2.pozitii.map(p => `${p.idx}:${p.sistem}`).join() === '1:amanunt,2:rama820' && dm2.coduri.join() === codM, JSON.stringify(dm2.pozitii.map(p => [p.idx, p.sistem])));
  }

  console.log('\nClienţi — copia bazei de pe Cloudflare');
  {
    verifica('fără configurare → preluarea e oprită (409)', (await cer('POST', '/api/clienti/preia')).stare === 409);
    // un „Cloudflare" fals, cu aceeaşi interfaţă ca clienti-agenti/functions/api/clienti/index.js:
    // GET ?dupa=<versiune> → ce s-a schimbat după ea, în ordinea versiunii, câte `pagina`
    let versiune = 0, pagina = 2, primitAgent = null;
    const externi = new Map();
    const propuse = new Map([[7, { id: 7, tip: 'nou', agent: 'Ion', trimis_la: '2026-10-01 10:00:00', propus: { nume: 'Propus SRL' }, actual: null }],
                             [8, { id: 8, tip: 'nou', agent: 'Ion', trimis_la: '2026-10-01 10:01:00', propus: { nume: 'Respins SRL' }, actual: null }]]);
    const schimba = c => externi.set(c.id, { ...externi.get(c.id), ...c, versiune: ++versiune });
    schimba({ id: 1, agent: 'Ion', nume: 'Ana SRL', cui: 'RO1', telefon_administrator: '0722' });
    schimba({ id: 2, agent: 'Ion', nume: 'Dan', email: 'd@x.ro', judet: 'IASI', delegat: 'Vio' });
    schimba({ id: 3, agent: 'Maria', nume: 'Vlad', telefon_delegat: '0733' });
    const fals = http.createServer((q, r) => {
      if (q.headers.authorization !== 'Bearer cheie-test') { r.writeHead(401); return r.end('{}'); }
      if (q.url === '/api/agenti/intra') return r.end(JSON.stringify({ url: 'https://agenti.test/api/intra?t=bilet' }));
      // propunerile agenţilor (clienti-agenti/functions/api/propuneri): aprobarea scrie clientul
      if (q.url === '/api/propuneri') return r.end(JSON.stringify({ propuneri: [...propuse.values()] }));
      const pr = q.url.match(/^\/api\/propuneri\/(\d+)\/(aproba|respinge)$/);
      if (pr && q.method === 'POST') {
        const p = propuse.get(+pr[1]);
        if (!p) { r.writeHead(404); return r.end(JSON.stringify({ eroare: 'Propunerea nu mai există.' })); }
        propuse.delete(p.id);
        if (pr[2] === 'aproba') schimba({ id: 50 + p.id, agent: p.agent, ...p.propus });
        return r.end(JSON.stringify({ ok: true }));
      }
      if (q.url === '/api/agenti') {
        if (q.method === 'GET') return r.end(JSON.stringify({ agenti: [{ user: 'ion', nume: 'Ion', activ: 1, clienti: 2, sesiuni: 1 }], faraCont: [] }));
        let corp = ''; q.on('data', b => corp += b);
        return q.on('end', () => { primitAgent = { metoda: q.method, ...JSON.parse(corp) };
          r.end(JSON.stringify(q.method === 'POST' ? { user: 'maria', nume: primitAgent.nume, parola: 'p4r0la', clienti: 2, nou: true } : {})); });
      }
      const dupa = +new URL(q.url, 'http://x').searchParams.get('dupa');
      r.end(JSON.stringify({ clienti: [...externi.values()].filter(c => c.versiune > dupa)
        .sort((a, b) => a.versiune - b.versiune).slice(0, pagina) }));
    });
    await new Promise(r => fals.listen(0, r));
    const { config } = require('../server/config.js');
    config.clientiUrl = `http://localhost:${fals.address().port}`;
    config.clientiCheie = 'gresita';
    verifica('cheie greşită → 502, nimic salvat', (await cer('POST', '/api/clienti/preia')).stare === 502
      && !db2().prepare('SELECT COUNT(*) AS n FROM client').get().n);
    config.clientiCheie = '';
    verifica('/admin: cheie greşită → 400, nesalvată', (await cer('PUT', '/api/clienti/cheie', { cheie: 'gresita' })).stare === 400
      && !db2().prepare('SELECT 1 FROM setare').get());
    const pusa = await cer('PUT', '/api/clienti/cheie', { cheie: ' cheie-test ' });
    verifica('/admin: cheia bună se salvează în bază şi porneşte legătura', pusa.stare === 200 && pusa.date.activ === true
      && db2().prepare("SELECT valoare FROM setare WHERE cheie = 'clienti_cheie'").get()?.valoare === 'cheie-test');
    verifica('… şi nu se trimite înapoi spre browser', !JSON.stringify((await cer('GET', '/api/agenti')).date).includes('cheie-test'));
    await new Promise(r => setTimeout(r, 200));   // prima preluare, pornită de salvarea cheii
    db2().exec('DELETE FROM client');
    verifica('preia toţi 3, pe mai multe pagini', (await cer('POST', '/api/clienti/preia')).date.noi === 3
      && db2().prepare('SELECT COUNT(*) AS n FROM client').get().n === 3);
    verifica('a doua oară: nimic nou', (await cer('POST', '/api/clienti/preia')).date.noi === 0);
    schimba({ id: 2, localitate: 'Paşcani', modificat_la: '2026-09-29 12:00:00' });
    schimba({ id: 4, agent: 'Maria', nume: 'Nou', email: 'n@x.ro', creat_la: '2026-09-29 12:05:00', modificat_la: '2026-09-29 12:05:00' });
    verifica('agentul a modificat unul şi a adăugat unul → 2', (await cer('POST', '/api/clienti/preia')).date.noi === 2);
    const dan = db2().prepare('SELECT * FROM client WHERE extern_id = 2').get();
    verifica('modificarea suprascrie copia (fără dublură)', dan.localitate === 'Paşcani' && dan.delegat === 'Vio'
      && db2().prepare('SELECT COUNT(*) AS n FROM client').get().n === 4, JSON.stringify(dan));
    const l = (await cer('GET', '/api/clienti')).date;
    verifica('lista: cei modificaţi de agenţi primii', l.clienti[0].nume === 'Nou' && l.clienti[1].nume === 'Dan', l.clienti.map(c => c.nume).join());
    const cauta = async q => (await cer('GET', '/api/clienti/cauta?q=' + encodeURIComponent(q))).date.clienti.map(c => c.nume).join();
    verifica('sugestii configurator: cei care încep cu textul, primii', await cauta('an') === 'Ana SRL,Dan', await cauta('an'));
    verifica('… sub 2 litere sau cu % tastat → nimic', await cauta('a') === '' && await cauta('%%') === '');
    verifica('pagina /clienti se serveşte', (await cer('GET', '/clienti')).stare === 200);
    const ag = await cer('GET', '/api/agenti');
    verifica('admin vede conturile agenţilor (de pe Cloudflare)', ag.stare === 200 && ag.date.agenti[0]?.user === 'ion', JSON.stringify(ag.date));
    const creat = await cer('POST', '/api/agenti', { nume: 'Maria' });
    verifica('admin: cont de agent → parola trece prin server', creat.stare === 200 && creat.date.parola === 'p4r0la'
      && primitAgent?.metoda === 'POST' && primitAgent.nume === 'Maria', JSON.stringify(creat));
    verifica('admin: dezactivare ajunge la Cloudflare', (await cer('PATCH', '/api/agenti', { nume: 'Ion', activ: false })).stare === 200
      && primitAgent.metoda === 'PATCH' && primitAgent.activ === false);
    const intra = await cer('POST', '/api/agenti/intra', { nume: 'Ion' });
    verifica('admin: „Intră ca agent" → linkul de intrare', intra.stare === 200 && intra.date.url.includes('/api/intra?t='), JSON.stringify(intra.date));

    // ce trimit agenţii aşteaptă aprobarea de aici
    const pr = (await cer('GET', '/api/clienti/propuneri')).date;
    verifica('propunerile agenţilor (de pe Cloudflare)', pr.activ && pr.propuneri.length === 2, JSON.stringify(pr));
    verifica('… şi numărul lor, pt. insigna de pe „Clienţi"', (await cer('GET', '/api/sumar')).date.deAprobat === 2);
    verifica('acţiune necunoscută → 404', (await cer('POST', '/api/clienti/propuneri/7/sterge')).stare === 404);
    cookie = null;
    await cer('POST', '/api/login', { user: 'maria', parola: 'parola-maria-1' });
    verifica('biroul vede propunerile, dar nu aprobă (403)', (await cer('GET', '/api/clienti/propuneri')).date.propuneri?.length === 2
      && (await cer('POST', '/api/clienti/propuneri/7/aproba')).stare === 403);
    cookie = null;
    await cer('POST', '/api/login', { user: 'ion', parola: 'parola-noua-1' });
    const ap = await cer('POST', '/api/clienti/propuneri/7/aproba');
    verifica('conducerea aprobă → clientul e imediat în copia de aici', ap.stare === 200
      && db2().prepare("SELECT 1 FROM client WHERE nume = 'Propus SRL'").get(), JSON.stringify(ap));
    verifica('respinge → nu ajunge în copie', (await cer('POST', '/api/clienti/propuneri/8/respinge')).stare === 200
      && !db2().prepare("SELECT 1 FROM client WHERE nume = 'Respins SRL'").get() && !(await cer('GET', '/api/clienti/propuneri')).date.propuneri.length);
    verifica('a doua oară → 404 de acolo', (await cer('POST', '/api/clienti/propuneri/7/aproba')).stare === 404);
    verifica('insigna scade la 0 după aprobare / respingere', (await cer('GET', '/api/sumar')).date.deAprobat === 0);
    cookie = null;
    await cer('POST', '/api/login', { user: 'admin', parola: 'parola-admin-1' });
    fals.close();
    verifica('Cloudflare căzut → 502 cu mesaj', (await cer('GET', '/api/agenti')).stare === 502);
    config.clientiUrl = config.clientiCheie = '';
  }

  console.log('\nBackup');
  const dest = require('../server/db.js').backup();
  verifica('backup scris pe disc', fs.existsSync(dest) && fs.statSync(dest).size > 0);

  server.close();
  // Windows nu şterge un fişier deschis: întâi închidem baza. Ştergerea folderului
  // temporar nu e un test, deci un eşec aici nu trebuie să pice rularea.
  require('../server/db.js').inchide();
  try { fs.rmSync(TEMP, { recursive: true, force: true }); } catch (e) { console.warn(`(nu am putut şterge ${TEMP}: ${e.code})`); }

  console.log(`\n${treceri} trecute, ${caderi} căzute\n`);
  process.exit(caderi ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
