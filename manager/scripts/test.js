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
// adminul face aici comenzi pe bune; „adminul mereu în test” are secţiunea lui (test.js, Modul test)
process.env.MANAGER_ADMIN_TEST = '0';

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
    ['bara comună',            '/bara.js'],
    ['gamele din configurator','/configurator/game.json'],
  ]) verifica(`pagina principală are ${ce}`, acasa.includes(bucata), bucata);

  // bara de sus, comună tuturor paginilor (web/bara.js)
  const bara = String((await cer('GET', '/bara.js')).date);
  for (const [ce, bucata] of [
    ['butonul OFERTĂ NOUĂ', 'id="ofertaNoua"'],
    ['linkul spre sticlă',  'href="/sticla"'],
    ['linkul Acasă',        'href="/"'],
    ['Organizează livrări', 'href="/livrari"'],
    ['reîncercarea cererilor cât se actualizează serverul', 'Serverul se actualizează'],
    ['Taskuri + reminderele', "fetch('/api/taskuri/scadente')"],
  ]) verifica(`bara comună are ${ce}`, bara.includes(bucata), bucata);

  const mg = String((await cer('GET', '/comenzi')).date);
  for (const [ce, bucata] of [
    ['taburile',            "['finalizata', 'Comenzi finalizate']"],
    ['apelul de listare',   '/api/comenzi?tip='],
    ['rutarea pe hash',     '#comanda/'],
    ['tabul din hash',      "location.hash === '#comenzi'"],
    ['bara comună',         '/bara.js'],
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

  verifica('acceptare fără telefon / adresă → 400', (await cer('POST', `/api/comenzi/${id}/accepta`, { plata: 'fiscala' })).stare === 400);
  const acc = await cer('POST', `/api/comenzi/${id}/accepta`, { plata: 'fiscala', avans: '1500.5', telefon: '0722 000 111', adresa: 'Str. Test 1' });
  verifica('telefonul şi adresa din fereastra de acceptare se salvează', acc.date.comanda?.client_telefon === '0722 000 111' && acc.date.comanda?.client_adresa === 'Str. Test 1');
  verifica('acceptare → 200', acc.stare === 200);
  verifica('se salvează plata şi avansul', acc.date.comanda?.plata === 'fiscala' && acc.date.comanda?.avans === 1500.5,
    JSON.stringify({ plata: acc.date.comanda?.plata, avans: acc.date.comanda?.avans }));
  verifica('acceptată: acelaşi număr, fără CMD- (userul, 2026-10-05)',
    acc.date.comanda?.numar === oferta.date.comanda.numar && acc.date.comanda?.numar_comanda == null,
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
  verifica('game.json se serveşte din dist', gj.game?.length === 6 && gj.game.some(g => g.id === 'util') && gj.game.some(g => g.id === 'lux'), typeof gj);
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

  console.log('\nJurnalul de activitate');
  {
    const act = (await cer('GET', `/api/comenzi/${id}/activitate`)).date.randuri ?? [];
    verifica('comanda: facturarea e în jurnal, cu numărul şi cine', act.some(r => r.operatie === 'Facturată' && r.detalii === 'SDK 1234' && r.utilizator_nume === 'Admin Test'));
    verifica('comanda: anularea facturii e în jurnal', act.some(r => r.operatie === 'Factura anulată'));
    verifica('comanda: finalizarea şi redeschiderea sunt în jurnal', act.some(r => r.operatie === 'Marcată finalizată') && act.some(r => /^Redeschisă/.test(r.operatie)));
    verifica('comanda: acceptarea are plata în detalii', act.some(r => r.operatie === 'Acceptată — comandă în lucru' && !!r.detalii), JSON.stringify(act.map(r => r.operatie)));
    verifica('rândul ţine minte nr. ofertei şi clientul', act.every(r => r.comanda_nr && r.client_nume));
    verifica('vizualizările NU apar în „doar schimbări"', (await cer('POST', '/api/activitate', { operatie: 'A deschis comanda', comanda_id: id })).stare === 200
      && !(await cer('GET', `/api/comenzi/${id}/activitate`)).date.randuri.some(r => r.fel === 'vizualizare'));
    verifica('… dar apar în „tot"', (await cer('GET', `/api/comenzi/${id}/activitate?tot=1`)).date.randuri.some(r => r.operatie === 'A deschis comanda'));
    const toate = (await cer('GET', '/api/activitate?tot=1')).date;
    verifica('pagina mare: intrarea în cont e în jurnal', toate.randuri.some(r => r.operatie === 'A intrat în cont'));
    verifica('pagina mare: numărătoare pe zile pt. grafic', Array.isArray(toate.peZi) && toate.peZi.length > 0 && toate.total > 0);
    verifica('pagina mare: căutare după nr. ofertei / client', (await cer('GET', `/api/activitate?tot=1&cauta=${encodeURIComponent(act[0].comanda_nr)}`)).date.randuri.every(r => r.comanda_nr === act[0].comanda_nr || (r.detalii ?? '').includes(act[0].comanda_nr)));
    verifica('pagina mare: filtru pe operaţie', (await cer('GET', '/api/activitate?operatie=Facturată')).date.randuri.every(r => r.operatie === 'Facturată'));
  }

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
    verifica('schema la versiunea 28', db2().prepare('PRAGMA user_version').get().user_version === 28);
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
  verifica('tema: implicit nesetată', (await cer('GET', '/api/preferinte')).date.tema == null);
  verifica('tema se salvează pe cont', (await cer('PUT', '/api/preferinte', { tema: 'luminos' })).date.tema === 'luminos');
  verifica('temă invalidă → 400', (await cer('PUT', '/api/preferinte', { tema: 'roz' })).stare === 400);
  const cookieAdmin = cookie; cookie = null;
  await cer('POST', '/api/login', { user: 'maria', parola: 'parola-maria-1' });
  const fixMaria = (await cer('GET', '/api/comenzi?tip=finalizata')).date.comenzi.find(c => c.id === id);
  verifica('alt utilizator NU o vede fixată', fixMaria && fixMaria.fixat === false);
  verifica('alt utilizator are sortarea lui', (await cer('GET', '/api/preferinte')).date.sortare === 'data');
  verifica('alt utilizator NU are lăţimea barei adminului', (await cer('GET', '/api/preferinte')).date.latimeBara == null);
  verifica('alt utilizator NU are tema adminului', (await cer('GET', '/api/preferinte')).date.tema == null);
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

  console.log('\nCereri repetate (server/repetare.js) — reţeaua cade după ce serverul a salvat');
  {
    const n = () => db2().prepare('SELECT COUNT(*) AS n FROM comanda').get().n;
    const corp = { client: { nume: 'Client Repetat' }, ofertaNr: 'REP-1', pozitii: [pozitie('confortGamma', 'Confort Gamma', 2, 1600)] };
    const trimite = (cheie, c = cookie) => fetch(baza + '/api/comenzi', { method: 'POST', body: JSON.stringify(corp),
      headers: { 'Content-Type': 'application/json', Cookie: c, ...(cheie && { 'X-Cheie-Cerere': cheie }) } });
    let inainte = n();
    const r1 = await trimite('cheie-proba-0001'), j1 = await r1.json();
    const r2 = await trimite('cheie-proba-0001'), j2 = await r2.json();
    verifica('aceeaşi cheie de două ori → o singură ofertă, acelaşi răspuns', r1.status === 201 && r2.status === 201
      && j1.comanda.id === j2.comanda.id && r2.headers.get('x-cerere-repetata') === '1' && n() === inainte + 1, `${n() - inainte} oferte`);
    inainte = n();
    const [a, b] = await Promise.all([trimite('cheie-proba-0002'), trimite('cheie-proba-0002')]);
    const [ja, jb] = [await a.json(), await b.json()];
    verifica('aceeaşi cheie, simultan → tot una', ja.comanda.id === jb.comanda.id && n() === inainte + 1, `${n() - inainte} oferte`);
    inainte = n();
    await trimite('cheie-proba-0003'); await trimite('cheie-proba-0004');
    verifica('chei diferite → oferte diferite', n() === inainte + 2);
    inainte = n();
    await trimite(null); await trimite(null);
    verifica('fără cheie → ca înainte (fiecare cerere se execută)', n() === inainte + 2);
    inainte = n();
    const k = cookie; cookie = null;
    await cer('POST', '/api/login', { user: 'ion', parola: 'parola-noua-1' });
    const altul = cookie; cookie = k;
    const ri = await trimite('cheie-proba-0001', altul);
    verifica('aceeaşi cheie, alt utilizator → a lui (cheile sunt pe utilizator)', ri.status === 201 && (await ri.json()).comanda.id !== j1.comanda.id && n() === inainte + 1);
    const g = await fetch(baza + '/api/comenzi', { headers: { Cookie: cookie, 'X-Cheie-Cerere': 'cheie-proba-0001' } });
    verifica('GET cu cheie → răspuns normal, nerepetat', g.status === 200 && !g.headers.get('x-cerere-repetata') && Array.isArray((await g.json()).comenzi));
    const scurt = await trimite('x');
    verifica('cheie ciudată (prea scurtă) → ignorată, cererea merge normal', scurt.status === 201);
  }

  console.log('\nComandă sticlă');
  const cuSticla = (nume) => ({ client: { nume }, pozitii: [{ ...pozitie('rama842', 'Ramă 842', 3, 450),
    linii: { facturare: [{ cod: 'X', denumire: 'X', cantitate: 1 }], sticla: [
      { cod: 'GG004', denumire: 'Geam float transparent 4mm GG cod GG004', um: 'buc', cantitate: 2, debitare: '1144 × 384 mm' },
      { cod: 'CT063', denumire: 'Geam satinat maro 4mm securizat CT cod CT063', um: 'buc', cantitate: 1, debitare: '500 × 400 mm' },
      { cod: 'OVI001', denumire: 'Geam float 8mm securizat termic OVI001', um: 'buc', cantitate: 1, debitare: '2094 × 444 mm' },
    ] } }] });
  const ofS = (await cer('POST', '/api/comenzi', cuSticla('Client Sticla'))).date.comanda;
  verifica('oferta neacceptată NU apare la sticlă', (await cer('GET', '/api/sticla')).date.linii.length === 0);
  const accS = await cer('POST', `/api/comenzi/${ofS.id}/accepta`, { plata: 'bon', telefon: '0700', adresa: 'X' });
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

  console.log('\nMailurile furnizorilor (cardul din Comandă sticlă)');
  {
    const fz = async () => (await cer('GET', '/api/sticla/furnizori')).date.furnizori;
    const gg = async () => (await fz()).find(f => f.cod === 'GG');
    verifica('lista: furnizorii din migraţie, GoldenGlass cu adresa veche', (await fz()).length >= 6 && (await gg())?.email === 'comenzi@goldenglass.ro');
    const s1 = await cer('PUT', '/api/sticla/furnizori/GG', { email: '  Comenzi@GoldenGlass.RO ; vanzari@goldenglass.ro, comenzi@goldenglass.ro ' });
    verifica('schimbare: mai multe adrese, curăţate (litere mici, fără dubluri) + cine şi când',
      s1.stare === 200 && s1.date.furnizor.email === 'comenzi@goldenglass.ro, vanzari@goldenglass.ro'
      && s1.date.furnizor.modificat_de_nume === 'Admin Test' && !!s1.date.furnizor.modificat_la, JSON.stringify(s1.date));
    verifica('adresa nouă ajunge la liniile de sticlă (butonul „Trimite pe mail")',
      (await cer('GET', '/api/sticla?comandate=1')).date.linii.concat((await cer('GET', '/api/sticla')).date.linii)
        .filter(l => l.furnizor.cod === 'GG').every(l => l.furnizor.email === 'comenzi@goldenglass.ro, vanzari@goldenglass.ro'));
    verifica('adresă greşită → 400, nesalvată', (await cer('PUT', '/api/sticla/furnizori/GG', { email: 'goldenglass.ro' })).stare === 400
      && (await gg()).email === 'comenzi@goldenglass.ro, vanzari@goldenglass.ro');
    verifica('una bună + una greşită → 400 (nu se salvează pe jumătate)', (await cer('PUT', '/api/sticla/furnizori/GG', { email: 'a@b.ro, x@' })).stare === 400);
    verifica('gol → fără adresă (se scrie în mail)', (await cer('PUT', '/api/sticla/furnizori/OVI', { email: '' })).stare === 200 && (await fz()).find(f => f.cod === 'OVI').email === '');
    verifica('furnizor nou (prefix apărut în coduri) → se adaugă', (await cer('PUT', '/api/sticla/furnizori/xy', { email: 'x@y.ro' })).stare === 200
      && (await fz()).find(f => f.cod === 'XY')?.email === 'x@y.ro');
    verifica('cod ciudat → 400', (await cer('PUT', '/api/sticla/furnizori/G1', { email: 'x@y.ro' })).stare === 400);
    await cer('PUT', '/api/sticla/furnizori/GG', { email: 'comenzi@goldenglass.ro' });
  }

  console.log('\nConturi: parola iniţială dată de admin; conturile vechi fără parolă se activează la primul login');
  {
    const ca = async fn => { const k = cookie; cookie = null; try { return await fn(); } finally { cookie = k; } };
    verifica('cont nou FĂRĂ parolă iniţială → 400', (await cer('POST', '/api/utilizatori', { user: 'fara.parola', rol: 'birou' })).stare === 400);
    const nou = await cer('POST', '/api/utilizatori', { user: ' Ana.Pop ', rol: 'birou', parola: 'parola-ana-0' });
    verifica('admin creează cont cu parolă iniţială → 201', nou.stare === 201 && nou.date.utilizator?.user === 'ana.pop', JSON.stringify(nou.date));
    verifica('… numele afişat = utilizatorul', nou.date.utilizator?.nume === 'ana.pop');
    verifica('… contul e activ din prima', (await cer('GET', '/api/utilizatori')).date.utilizatori.find(u => u.user === 'ana.pop')?.activat === true);
    verifica('utilizator cu caractere nepermise → 400', (await cer('POST', '/api/utilizatori', { user: 'ana pop!', rol: 'birou', parola: 'parola-lunga-1' })).stare === 400);
    verifica('utilizator existent → 409', (await cer('POST', '/api/utilizatori', { user: 'ana.pop', rol: 'birou', parola: 'parola-lunga-1' })).stare === 409);
    await ca(async () => {
      verifica('altcineva NU poate „activa" contul cu altă parolă → 401',
        (await cer('POST', '/api/login', { user: 'ana.pop', parola: 'alta-parola-2', parolaConfirmare: 'alta-parola-2' })).stare === 401);
      verifica('colegul intră cu parola iniţială', (await cer('POST', '/api/login', { user: 'ana.pop', parola: 'parola-ana-0' })).stare === 200);
    });

    // conturile vechi, create fără parolă: se activează în continuare la primul login
    creeazaUtilizator({ nume: 'Vechi', user: 'cont.vechi', rol: 'birou' });
    await ca(async () => {
      const r1 = await cer('POST', '/api/login', { user: 'cont.vechi', parola: 'parola-veche-1' });
      verifica('cont vechi neactivat → cere confirmarea parolei', r1.stare === 409 && r1.date.activare === true, JSON.stringify(r1));
      verifica('… fără sesiune încă', cookie === null);
      verifica('parole diferite → 400', (await cer('POST', '/api/login', { user: 'cont.vechi', parola: 'parola-veche-1', parolaConfirmare: 'alta-parola-1' })).stare === 400);
      verifica('parolă prea scurtă → 400', (await cer('POST', '/api/login', { user: 'cont.vechi', parola: 'scurt', parolaConfirmare: 'scurt' })).stare === 400);
      const r2 = await cer('POST', '/api/login', { user: 'cont.vechi', parola: 'parola-veche-1', parolaConfirmare: 'parola-veche-1' });
      verifica('parole identice → cont activat + logat', r2.stare === 200 && !!cookie && r2.date.utilizator?.rol === 'birou');
    });
    const ana = (await cer('GET', '/api/utilizatori')).date.utilizatori.find(u => u.user === 'ana.pop');
    verifica('lista nu scoate hash-ul / salt-ul', !JSON.stringify(ana).includes('parola'));

    // resetare parolă (parolă uitată): o parolă TEMPORARĂ, nu cont fără parolă
    verifica('resetare fără parola temporară → 400', (await cer('PATCH', `/api/utilizatori/${ana.id}`, { reseteazaParola: true })).stare === 400);
    verifica('admin pune parola temporară → 200', (await cer('PATCH', `/api/utilizatori/${ana.id}`, { reseteazaParola: true, parola: 'temporara-ana-1' })).stare === 200);
    verifica('… contul rămâne activ (nu poate fi „luat")', (await cer('GET', '/api/utilizatori')).date.utilizatori.find(u => u.id === ana.id).activat === true);
    verifica('… şi sesiunile ei au căzut', !db2().prepare('SELECT 1 FROM sesiune WHERE utilizator_id = ?').get(ana.id));
    await ca(async () => {
      verifica('… parola veche nu mai merge', (await cer('POST', '/api/login', { user: 'ana.pop', parola: 'parola-ana-0' })).stare === 401);
      verifica('… intră cu cea temporară', (await cer('POST', '/api/login', { user: 'ana.pop', parola: 'temporara-ana-1' })).stare === 200);
    });
    const eu = (await cer('GET', '/api/eu')).date.utilizator;
    verifica('adminul NU îşi poate reseta singur parola → 400', (await cer('PATCH', `/api/utilizatori/${eu.id}`, { reseteazaParola: true, parola: 'parola-lunga-7' })).stare === 400);
    // cont dezactivat: nu intră
    const blocat = (await cer('POST', '/api/utilizatori', { user: 'blocat', rol: 'birou', parola: 'parola-lunga-9' })).date.utilizator;
    await cer('PATCH', `/api/utilizatori/${blocat.id}`, { activ: false });
    await ca(async () => {
      verifica('cont dezactivat → 401', (await cer('POST', '/api/login', { user: 'blocat', parola: 'parola-lunga-9' })).stare === 401);
    });
    // parole ghicite pe rând: după 10 greşeli în 15 minute pe acelaşi cont — blocat, chiar şi cu parola bună
    await cer('POST', '/api/utilizatori', { user: 'lacat', rol: 'birou', parola: 'parola-lacat-1' });
    await ca(async () => {
      for (let k = 0; k < 10; k++) await cer('POST', '/api/login', { user: 'lacat', parola: `gresita-${k}` });
      const r = await cer('POST', '/api/login', { user: 'lacat', parola: 'parola-lacat-1' });
      verifica('10 parole greşite → blocat 15 minute (429), chiar şi cu parola bună', r.stare === 429 && /mai încearcă peste 15 minute/.test(r.date.eroare), JSON.stringify(r));
      verifica('… alt cont de pe acelaşi calculator merge în continuare', (await cer('POST', '/api/login', { user: 'ana.pop', parola: 'temporara-ana-1' })).stare === 200);
    });
    verifica('pagina /admin se serveşte', String((await cer('GET', '/admin')).date).includes('<title>Administrare'));
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
    const pl = await cer('POST', `/api/comenzi/${pid}/accepta`, { plata: 'proforma', avans: 0, telefon: '0700', adresa: 'X' });
    verifica('plată primită → comandă în lucru', pl.stare === 200 && pl.date.comanda.tip === 'comanda' && pl.date.comanda.numar_comanda == null);
    verifica('… şi a ieşit din Aşteaptă plata', !(await cer('GET', '/api/comenzi?tip=plata')).date.comenzi.length);
    // „Înapoi în ofertă" — 10 minute după trecere, doar cât nu s-a lucrat pe ea
    const ina = await cer('POST', `/api/comenzi/${pid}/inapoi-oferta`);
    verifica('înapoi în ofertă → 200, e iar ofertă', ina.stare === 200 && ina.date.comanda.tip === 'oferta'
      && ina.date.comanda.numar_comanda === null && ina.date.comanda.confirmat_la === null, JSON.stringify(ina.date));
    verifica('înapoi a doua oară → 409', (await cer('POST', `/api/comenzi/${pid}/inapoi-oferta`)).stare === 409);
    verifica('aşteaptă plata → înapoi în ofertă → 200', (await cer('POST', `/api/comenzi/${pid}/asteapta-plata`)).stare === 200
      && (await cer('POST', `/api/comenzi/${pid}/inapoi-oferta`)).stare === 200);
    const re = await cer('POST', `/api/comenzi/${pid}/accepta`, { plata: 'proforma', avans: 0, telefon: '0700', adresa: 'X' });
    verifica('reacceptată: acelaşi nr. de ofertă', re.stare === 200 && re.date.comanda.oferta_nr === 'NM-77');
    db2().prepare("UPDATE comanda SET tip_schimbat_la = datetime('now', '-11 minutes') WHERE id = ?").run(pid);
    verifica('după 10 minute → 409', (await cer('POST', `/api/comenzi/${pid}/inapoi-oferta`)).stare === 409);
    db2().prepare("UPDATE comanda SET tip_schimbat_la = datetime('now') WHERE id = ?").run(pid);
    await cer('POST', `/api/comenzi/${pid}/factura`, { numar: 'F-INAPOI' });
    verifica('facturată → nu se mai întoarce (409)', (await cer('POST', `/api/comenzi/${pid}/inapoi-oferta`)).stare === 409);
    await cer('POST', `/api/comenzi/${pid}/factura`, { numar: '', anuleaza: true });
    // modul de livrare la o comandă în lucru (userul, 2026-10-08): transportul şi configuraţia se potrivesc
    const transport = () => db2().prepare(`SELECT count(*) n FROM pozitie_linie l JOIN pozitie p ON p.id = l.pozitie_id
      WHERE p.comanda_id = ? AND l.lista = 'facturare' AND l.cod = 'CHLTTRMANIP'`).get(pid).n;
    const livr = v => cer('POST', `/api/comenzi/${pid}/livrare`, { livrare: v });
    verifica('livrare: valoare necunoscută → 400', (await livr('Posta')).stare === 400);
    verifica('livrare → Curier ramburs: 200 + o linie de transport', (await livr('Curier ramburs')).stare === 200 && transport() === 1);
    verifica('… → Cu masina noastra: tot o singură linie, comanda şi configuraţia schimbate',
      (await livr('Cu masina noastra')).stare === 200 && transport() === 1
      && db2().prepare('SELECT livrare FROM comanda WHERE id = ?').get(pid).livrare === 'Cu masina noastra'
      && JSON.parse(db2().prepare('SELECT config_json FROM pozitie WHERE comanda_id = ?').get(pid).config_json).comanda.livrare === 'Cu masina noastra');
    verifica('… → Ridicare personala: transportul iese din facturare', (await livr('Ridicare personala')).stare === 200 && transport() === 0);
    verifica('livrarea unei oferte → 409 (se schimbă din „Modifică oferta")',
      (await cer('POST', `/api/comenzi/${oc.date.comanda.id}/livrare`, { livrare: 'Curier ramburs' })).stare === 409);
    // adresa + livrarea după ce s-a printat fişa (userul, 2026-10-19): de completat de mână, până la o reprintare
    {
      const det = async () => (await cer('GET', `/api/comenzi/${pid}`)).date.comanda;
      verifica('fişă neprintată: schimbarea adresei nu cere nimic', (await cer('POST', `/api/comenzi/${pid}/livrare`, { adresa: 'Str. Unu 1, Cluj-Napoca, Cluj' })).stare === 200
        && (await det()).client_adresa === 'Str. Unu 1, Cluj-Napoca, Cluj' && (await det()).fisa_de_completat === false);
      verifica('adresă goală → 400', (await cer('POST', `/api/comenzi/${pid}/livrare`, { adresa: '  ' })).stare === 400);
      // ordinea din realitate: adresa schimbată acum 2 ore, fişa printată acum o oră
      db2().prepare(`UPDATE comanda SET livrare_modificata_la = datetime('now', '-2 hours') WHERE id = ?`).run(pid);
      db2().prepare(`INSERT INTO fisa_printare (comanda_id, poz, la, de) VALUES (?, 0, datetime('now', '-1 hour'), NULL)`).run(pid);
      const inainte = (await det()).livrare_modificata_la;
      verifica('nimic schimbat → 200, fără oră de modificare nouă', (await cer('POST', `/api/comenzi/${pid}/livrare`, { adresa: 'Str. Unu 1, Cluj-Napoca, Cluj' })).stare === 200
        && (await det()).livrare_modificata_la === inainte && (await det()).fisa_de_completat === false);
      verifica('adresa schimbată după printare → fişa de completat de mână', (await cer('POST', `/api/comenzi/${pid}/livrare`, { adresa: 'Str. Doi 2, Iași' })).stare === 200
        && (await det()).client_adresa === 'Str. Doi 2, Iași' && (await det()).fisa_de_completat === true);
      await cer('POST', `/api/comenzi/${pid}/fisa`, { poz: 0 });
      verifica('fişa reprintată după modificare → nu mai e nimic de completat', (await det()).fisa_de_completat === false);
      db2().prepare(`UPDATE fisa_printare SET la = datetime('now', '-1 hour') WHERE comanda_id = ?`).run(pid);
      verifica('doar livrarea schimbată după printare → tot de completat', (await cer('POST', `/api/comenzi/${pid}/livrare`, { livrare: 'Curier ramburs' })).stare === 200
        && (await det()).fisa_de_completat === true && (await det()).client_adresa === 'Str. Doi 2, Iași');
    }
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
    const rapoarte = [], deCerut = [];
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
      // pagina /admin de pe Cloudflare (functions/api/server): managerul raportează, primeşte cererea
      if (q.url === '/api/server' && q.method === 'POST') {
        let corp = ''; q.on('data', b => corp += b);
        return q.on('end', () => { rapoarte.push(JSON.parse(corp)); r.end(JSON.stringify({ cerere: deCerut.shift() ?? null })); });
      }
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
    verifica('biroul n-are pagina Clienţi: nici lista, nici propunerile, nici aprobarea (403)',
      (await cer('GET', '/api/clienti')).stare === 403 && (await cer('GET', '/api/clienti/propuneri')).stare === 403
      && (await cer('POST', '/api/clienti/preia')).stare === 403 && (await cer('POST', '/api/clienti/propuneri/7/aproba')).stare === 403);
    verifica('… dar are sugestiile din configurator', (await cer('GET', '/api/clienti/cauta?q=an')).stare === 200);
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
    {
      // update de oriunde: starea pleacă spre Cloudflare, cererea de acolo se execută şi rezultatul pleacă imediat
      const { raporteaza } = require('../server/actualizare.js');
      deCerut.push('actualizeaza');
      await raporteaza();
      verifica('raportul spre /admin de pe Cloudflare: versiunea + jurnalul', rapoarte.some(x => 'versiune' in x && 'jurnal' in x && 'mod' in x),
        JSON.stringify(rapoarte[0]));
      verifica('cererea de pe pagină se execută, rezultatul pleacă imediat (aici: nu e Windows)',
        rapoarte.some(x => /Windows/.test(x.eroare ?? '')), JSON.stringify(rapoarte.map(x => x.eroare)));
    }
    fals.close();
    verifica('Cloudflare căzut → 502 cu mesaj', (await cer('GET', '/api/agenti')).stare === 502);
    config.clientiUrl = config.clientiCheie = '';
  }

  console.log('\nOrganizează livrări (server/livrari.js)');
  {
    const { judetDin } = require('../server/livrari.js');
    for (const [adresa, j] of [
      ['Str. Mihai Eminescu nr. 5, Pascani, Iasi', 'Iași'], ['Str. Iaşi 12, Bacău', 'Bacău'],
      ['Sat Valea Mare, com. X, jud. Bistrita-Nasaud', 'Bistrița-Năsăud'], ['Bd. Unirii 3, Sector 3', 'București'],
      ['Strada Florilor 1', null], ['Satu Mare, str. Libertatii', 'Satu Mare'], ['Str. Voltaire 2, Cluj-Napoca, Cluj', 'Cluj'],
    ]) verifica(`judeţul din „${adresa}" → ${j}`, judetDin(adresa) === j, judetDin(adresa));

    // adresa pe bucăţi (web/adresa.js + lista SIRUTA, 2026-10-19)
    const { adresaDin } = require('../server/livrari.js');
    const Adresa = require('../web/adresa.js');
    for (const [adresa, j, l, str] of [
      ['Strada Fabricii nr. 10, Zalau, SALAJ', 'Sălaj', 'Zalău', 'Strada Fabricii nr. 10'],
      ['Str. Lunga 3, Cluj-Napoca', 'Cluj', 'Cluj-Napoca', 'Str. Lunga 3'],              // judeţul din localitate
      ['Sos. Voinești 124, Iași', 'Iași', 'Iași', 'Sos. Voinești 124'],                  // oraşul = judeţul, scris o dată
      ['Bd. Unirii 5, sector 2', 'București', 'București', 'Bd. Unirii 5, sector 2'],
      ['Str. Mihai Viteazu 3, mun. Alba Iulia, jud. Alba', 'Alba', 'Alba Iulia', 'Str. Mihai Viteazu 3'],
      ['Nr. 12, Jucu, Cluj', 'Cluj', 'Jucu', 'Nr. 12'],                                    // comuna, nu doar satele ei
      ['Str. Iaşi 4, Bacău', 'Bacău', 'Bacău', 'Str. Iaşi 4'],
      ['Strada Florilor 1', null, null, 'Strada Florilor 1'],
    ]) {
      const a = adresaDin(adresa);
      verifica(`adresa „${adresa}" → ${j} / ${l} / ${str}`, a.judet === j && a.localitate === l && a.strada === str, JSON.stringify(a));
    }
    const pusa = Adresa.compune({ judet: 'Cluj', localitate: 'Cluj-Napoca', strada: 'Str. Lunga 3' });
    verifica('adresa compusă din câmpuri se desface la loc la fel', pusa === 'Str. Lunga 3, Cluj-Napoca, Cluj'
      && JSON.stringify(adresaDin(pusa)) === JSON.stringify({ judet: 'Cluj', localitate: 'Cluj-Napoca', strada: 'Str. Lunga 3', recunoscuta: true }), pusa);
    const loc = require('../web/localitati.json').judete;
    verifica('lista de localităţi: 42 de judeţe (cu Bucureşti), peste 13.000 de localităţi',
      Object.keys(loc).length === 42 && Object.values(loc).flat().length > 13000 && loc['Cluj'].includes('Cluj-Napoca'));

    const noua = async (nume, livrare, adresa) => (await cer('POST', '/api/comenzi', {
      client: { nume, telefon: '0722', adresa }, detalii: { livrare }, ofertaNr: 'LV-' + nume,
      pozitii: [pozitie('confortGamma', 'Confort Gamma', 2, 2000)] })).date.comanda.id;
    const iasi  = await noua('Livr Iasi', 'Cu masina noastra', 'Str. Lunga 1, Pascani, Iasi');
    const vaslui = await noua('Livr Vaslui', 'Cu masina noastra', 'Str. Scurta 2, Barlad, Vaslui');
    const curier = await noua('Livr Curier', 'Curier ramburs', 'Str. X, Iasi');
    const faraJ = await noua('Livr FaraJudet', 'Cu masina noastra', 'Strada Florilor 1');
    const oferta = await noua('Livr Oferta', 'Cu masina noastra', 'Str. Y, Iasi');   // rămâne ofertă
    for (const id of [iasi, vaslui, curier, faraJ]) await cer('POST', `/api/comenzi/${id}/accepta`, { plata: 'proforma', avans: 0 });
    const cand = async () => (await cer('GET', '/api/livrari/candidati')).date.comenzi;
    let c = await cand();
    const id = x => c.find(k => k.id === x);
    verifica('livrări: doar comenzile acceptate, cu maşina noastră', id(iasi) && id(vaslui) && id(faraJ) && !id(curier) && !id(oferta),
      JSON.stringify(c.map(k => k.client_nume)));
    verifica('livrări: judeţul recunoscut din adresă', id(iasi).judet === 'Iași' && id(vaslui).judet === 'Vaslui' && id(faraJ).judet === null);
    verifica('livrări: produsele comenzii', id(iasi).produse[0] === 'Confort Gamma · 2 uşi', JSON.stringify(id(iasi).produse));
    verifica('livrări: judeţ ales de mână', (await cer('PUT', `/api/livrari/comanda/${faraJ}`, { judet: 'Neamț' })).stare === 200);
    verifica('livrări: judeţ necunoscut → 400', (await cer('PUT', `/api/livrari/comanda/${faraJ}`, { judet: 'Atlantida' })).stare === 400);
    verifica('livrări: suma de încasat (virgulă) se salvează', (await cer('PUT', `/api/livrari/comanda/${iasi}`, { de_incasat: '1250,5' })).stare === 200);
    {
      const id0 = db2().prepare("SELECT id FROM comanda WHERE lower(livrare) = 'cu masina noastra' AND tip = 'comanda' LIMIT 1").get().id;
      const pune = v => cer('PUT', `/api/livrari/comanda/${id0}`, { observatii_livrare: v });
      verifica('livrări: observaţiile de livrare se salvează şi apar la candidaţi (nu cele din ofertă)', (await pune('  Sună înainte  ')).stare === 200
        && (await cer('GET', '/api/livrari/candidati')).date.comenzi.find(c => c.id === id0)?.observatii_livrare === 'Sună înainte');
      verifica('livrări: observaţii goale → şterse', (await pune('')).stare === 200
        && db2().prepare('SELECT observatii_livrare FROM comanda WHERE id = ?').get(id0).observatii_livrare === null);
    }
    verifica('livrări: sumă negativă → 400', (await cer('PUT', `/api/livrari/comanda/${iasi}`, { de_incasat: '-3' })).stare === 400);
    verifica('livrări: coordonate în afara României → 400', (await cer('PUT', `/api/livrari/comanda/${iasi}`, { lat: 51.5, lon: -0.1 })).stare === 400);
    verifica('livrări: coordonatele din România se salvează', (await cer('PUT', `/api/livrari/comanda/${iasi}`, { lat: 47.24, lon: 26.72, geo_adresa: 'x' })).stare === 200);
    c = await cand();
    verifica('livrări: suma + judeţul + punctul se văd în listă', id(iasi).de_incasat === 1250.5 && id(faraJ).judet === 'Neamț' && id(iasi).lat === 47.24);

    verifica('livrări: fără dată → 400', (await cer('POST', '/api/livrari', { comenzi: [iasi] })).stare === 400);
    verifica('livrări: comandă cu curier → 400', (await cer('POST', '/api/livrari', { data: '2026-10-09', comenzi: [curier] })).stare === 400);
    const l = await cer('POST', '/api/livrari', { data: '2026-10-09', comenzi: [vaslui, iasi] });
    verifica('livrări: livrare programată → 201', l.stare === 201, JSON.stringify(l.date));
    c = await cand();
    verifica('livrări: comenzile programate ies din listă', !id(iasi) && !id(vaslui) && id(faraJ));
    verifica('livrări: aceeaşi comandă de două ori → 409', (await cer('POST', '/api/livrari', { data: '2026-10-10', comenzi: [iasi] })).stare === 409);
    const ls = (await cer('GET', '/api/livrari')).date.livrari;
    const prog = ls.find(x => x.id === l.date.id);
    verifica('livrări: ordinea traseului se păstrează', prog?.data === '2026-10-09' && prog.comenzi.map(x => x.id).join() === [vaslui, iasi].join(),
      JSON.stringify(prog));
    verifica('livrări: anulare → 200', (await cer('DELETE', `/api/livrari/${l.date.id}`)).stare === 200);
    c = await cand();
    verifica('livrări: după anulare comenzile se întorc în listă', !!id(iasi) && !!id(vaslui));
    const pagLiv = String((await cer('GET', '/livrari')).date);
    verifica('pagina /livrari se serveşte', pagLiv.includes('Organizează livrări'));
    // butonul are handler şi căutarea pe hartă există (le-am şters o dată din greşeală)
    verifica('pagina /livrari: „Confirmă livrarea" + căutarea pe hartă', pagLiv.includes("$('confirma').addEventListener") && pagLiv.includes('async function cautaPeHarta'));
  }

  console.log('\nAdaugă la comandă (comenzi în lucru)');
  {
    const cuTransport = p => ({ ...p, linii: { ...p.linii, facturare: [...(p.linii?.facturare ?? []),
      { cod: 'CHLTTRMANIP', denumire: 'Transport', um: 'buc', cantitate: 1 }] } });
    const o = (await cer('POST', '/api/comenzi', { client: { nume: 'Client Adaugă', telefon: '0700', adresa: 'X' }, detalii: { livrare: 'Curier ramburs' },
      ofertaNr: 'AD-1', pozitii: [cuTransport(pozitie('confortGamma', 'Confort Gamma', 2, 2000))] })).date.comanda.id;
    verifica('adaugă: la o ofertă → 409', (await cer('POST', `/api/comenzi/${o}/adauga`, { pozitii: [pozitie('confortGamma', 'Confort Gamma', 1, 1200)] })).stare === 409);
    await cer('POST', `/api/comenzi/${o}/accepta`, { plata: 'proforma', avans: 0 });
    verifica('adaugă: fără produse → 400', (await cer('POST', `/api/comenzi/${o}/adauga`, { pozitii: [] })).stare === 400);
    verifica('adaugă: produs invalid → 400', (await cer('POST', `/api/comenzi/${o}/adauga`, { pozitii: [{ sistem: '' }] })).stare === 400);
    const a = await cer('POST', `/api/comenzi/${o}/adauga`, { pozitii: [cuTransport(pozitie('confortGamma', 'Confort Gamma', 1, 1200))] });
    const d = (await cer('GET', `/api/comenzi/${o}`)).date;
    const transport = d.pozitii.flatMap(p => p.linii.facturare).filter(l => l.cod === 'CHLTTRMANIP').length;
    verifica('adaugă: comanda în lucru primeşte produsul (după cele vechi)', a.stare === 200 && d.pozitii.length === 2 && d.pozitii[1].nr_usi === 1, JSON.stringify(a.date));
    verifica('adaugă: transportul nu se dublează', transport === 1, `linii transport: ${transport}`);
    await cer('POST', `/api/comenzi/${o}/finalizeaza`);
    verifica('adaugă: la o comandă finalizată → 409', (await cer('POST', `/api/comenzi/${o}/adauga`, { pozitii: [pozitie('confortGamma', 'Confort Gamma', 1, 1200)] })).stare === 409);
  }

  console.log('\nCereri de anulare (server/cereri.js) — le decide conducerea');
  {
    const noua = async nume => (await cer('POST', '/api/comenzi', { client: { nume, telefon: '0700', adresa: 'X' }, ofertaNr: 'AN-' + nume,
      pozitii: [pozitie('confortGamma', 'Confort Gamma', 1, 1200)] })).date.comanda.id;
    const a = await noua('Anulez'), b = await noua('Respins');
    const caMaria = async fn => { const k = cookie; cookie = null; await cer('POST', '/api/login', { user: 'maria', parola: 'parola-maria-1' });
      try { return await fn(); } finally { cookie = k; } };
    await caMaria(async () => {
      verifica('anulare fără motiv → 400', (await cer('POST', `/api/comenzi/${a}/anulare`, { motiv: ' ' })).stare === 400);
      verifica('biroul cere anularea cu motiv → 201', (await cer('POST', `/api/comenzi/${a}/anulare`, { motiv: 'Clientul a renunţat' })).stare === 201);
      verifica('a doua cerere pe aceeaşi comandă → 409', (await cer('POST', `/api/comenzi/${a}/anulare`, { motiv: 'iar' })).stare === 409);
      await cer('POST', `/api/comenzi/${b}/anulare`, { motiv: 'Greşeală' });
      const id = (await cer('GET', '/api/cereri')).date.cereri.find(r => r.comanda_id === a)?.id;
      verifica('biroul NU poate aproba → 403', (await cer('POST', `/api/cereri/${id}/aproba`)).stare === 403);
      const l = (await cer('GET', '/api/cereri')).date;
      verifica('biroul îşi vede cererile, fără drept de decizie', l.poateDecide === false && l.cereri.length === 2);
    });
    const lista = (await cer('GET', '/api/cereri')).date;
    verifica('conducerea / adminul vede cererile deschise + poate decide', lista.poateDecide && lista.cereri.filter(r => r.stare === 'deschisa').length >= 2);
    verifica('insigna din meniu: cereri deschise', (await cer('GET', '/api/sumar')).date.cereri >= 2);
    verifica('pagina comenzii arată cererea', (await cer('GET', `/api/comenzi/${a}`)).date.cerere?.motiv === 'Clientul a renunţat');
    const ra = lista.cereri.find(r => r.comanda_id === a), rb = lista.cereri.find(r => r.comanda_id === b);
    verifica('aprobare → 200', (await cer('POST', `/api/cereri/${ra.id}/aproba`, { raspuns: 'OK' })).stare === 200);
    verifica('… comanda e anulată şi iese din oferte', !(await cer('GET', '/api/comenzi?tip=oferta')).date.comenzi.some(c => c.id === a)
      && db2().prepare('SELECT anulat FROM comanda WHERE id = ?').get(a).anulat === 1);
    verifica('… o anulată nu mai poate fi acceptată', (await cer('POST', `/api/comenzi/${a}/accepta`, { plata: 'proforma' })).stare === 400);
    verifica('a doua decizie → 409', (await cer('POST', `/api/cereri/${ra.id}/respinge`)).stare === 409);
    verifica('respingere → comanda rămâne', (await cer('POST', `/api/cereri/${rb.id}/respinge`, { raspuns: 'Mai vorbim' })).stare === 200
      && (await cer('GET', '/api/comenzi?tip=oferta')).date.comenzi.some(c => c.id === b));
    verifica('fişa printată: se ţine ora + cine', (await cer('POST', `/api/comenzi/${b}/fisa`)).stare === 200
      && !!(await cer('GET', `/api/comenzi/${b}`)).date.comanda.fisa_printata_la
      && (await cer('GET', `/api/comenzi/${b}`)).date.comanda.fisa_printata_de_nume != null);
    verifica('fişa printată pe o comandă inexistentă → 404', (await cer('POST', '/api/comenzi/999999/fisa')).stare === 404);
    // retipărirea (2026-10-19): prima printare rămâne, fiecare retipărire se ţine, pe produs (poz)
    await cer('POST', `/api/comenzi/${b}/fisa`, { poz: 0 });
    await cer('POST', `/api/comenzi/${b}/fisa`, { poz: 1 });
    const fiseB = (await cer('GET', `/api/comenzi/${b}/fise`)).date.fise;
    verifica('fişa retipărită: toate printările, în ordine, cu produsul şi cine', fiseB.length === 3
      && fiseB.map(f => f.poz).join() === '0,0,1' && fiseB.every(f => f.de_nume && f.la), JSON.stringify(fiseB));
    verifica('pagina comenzii primeşte printările', (await cer('GET', `/api/comenzi/${b}`)).date.fise?.length === 3);
    verifica('printările unei comenzi inexistente → 404', (await cer('GET', '/api/comenzi/999999/fise')).stare === 404);
    verifica('pagina /cereri se serveşte', String((await cer('GET', '/cereri')).date).includes('<title>Cereri</title>'));
    verifica('/admin află ultimul backup', 'backup' in (await cer('GET', '/api/actualizare')).date);
  }

  console.log('\nAnulare cerută → comanda „pe hold" până decide conducerea');
  {
    const adresa = 'Str. Lunga 1, Pascani, Iasi';
    const r = await cer('POST', '/api/comenzi', { client: { nume: 'Client Hold', telefon: '0700', adresa },
      detalii: { livrare: 'Cu masina noastra' }, ofertaNr: 'HOLD-1',
      pozitii: [{ ...pozitie('confortGamma', 'Confort Gamma', 1, 1200), linii: { facturare: [{ cod: 'X', denumire: 'X', cantitate: 1 }],
        sticla: [{ cod: 'GG004', denumire: 'Geam float 4mm GG004', um: 'buc', cantitate: 1, debitare: '1000 × 500 mm' }] } }] });
    const id = r.date.comanda.id;
    await cer('POST', `/api/comenzi/${id}/accepta`, { plata: 'proforma', telefon: '0700', adresa });
    const laSticla = async () => (await cer('GET', '/api/sticla')).date.linii.some(l => l.comanda_id === id);
    const laLivrari = async () => (await cer('GET', '/api/livrari/candidati')).date.comenzi.some(c => c.id === id);
    verifica('înainte de cerere: apare la sticlă şi la livrări', await laSticla() && await laLivrari());
    await cer('POST', `/api/comenzi/${id}/anulare`, { motiv: 'Clientul se mai gândeşte' });
    verifica('pe hold: nu mai apare la sticlă', !(await laSticla()));
    verifica('pe hold: nu mai apare la livrări', !(await laLivrari()));
    verifica('pe hold: rămâne în listă, marcată', (await cer('GET', '/api/comenzi?tip=comanda')).date.comenzi.find(c => c.id === id)?.pe_hold === 1);
    for (const [cale, corp] of [['finalizeaza'], ['factura', { numar: 'F-HOLD' }], ['livrare', { livrare: 'Ridicare personala' }], ['fisa'],
                                ['adauga', { pozitii: [pozitie('confortGamma', 'Confort Gamma', 1, 1200)] }]])
      verifica(`pe hold: „${cale}" → 409`, (await cer('POST', `/api/comenzi/${id}/${cale}`, corp)).stare === 409);
    const linieSticla = db2().prepare("SELECT l.id FROM pozitie_linie l JOIN pozitie p ON p.id = l.pozitie_id WHERE p.comanda_id = ? AND l.lista = 'sticla'").get(id).id;
    verifica('pe hold: sticla ei nu se poate marca trimisă', (await cer('POST', '/api/sticla/comanda', { ids: [linieSticla] })).date.actualizate === 0);
    verifica('pe hold: pinul personal merge', (await cer('POST', `/api/comenzi/${id}/fixare`, { fixat: true })).stare === 200);
    const rid = (await cer('GET', '/api/cereri')).date.cereri.find(x => x.comanda_id === id).id;
    await cer('POST', `/api/cereri/${rid}/respinge`, { raspuns: 'Continuăm' });
    verifica('respinsă: revine la sticlă şi la livrări', await laSticla() && await laLivrari());
    verifica('respinsă: se lucrează din nou pe ea', (await cer('POST', `/api/comenzi/${id}/finalizeaza`)).stare === 200);
  }

  console.log('\nTichete pentru administrator (server/tichete.js) + tabloul din /admin');
  {
    const caMaria = async fn => { const k = cookie; cookie = null; await cer('POST', '/api/login', { user: 'maria', parola: 'parola-maria-1' });
      try { return await fn(); } finally { cookie = k; } };
    let id;
    await caMaria(async () => {
      verifica('tichet fără tip → 400', (await cer('POST', '/api/tichete', { tip: 'x', text: 'ceva nu merge' })).stare === 400);
      verifica('tichet fără text → 400', (await cer('POST', '/api/tichete', { tip: 'problema', text: ' ' })).stare === 400);
      const r = await cer('POST', '/api/tichete', { tip: 'problema', text: 'Fişa nu se printează la Rame', pagina: '/configurator/?gama=rame' });
      verifica('biroul trimite un tichet → 201', r.stare === 201);
      id = r.date.id;
      verifica('biroul nu poate schimba starea → 403', (await cer('PATCH', `/api/tichete/${id}`, { stare: 'rezolvat' })).stare === 403);
    });
    const l = (await cer('GET', '/api/tichete')).date;
    verifica('adminul vede tichetul + insigna „noi"', l.admin && l.tichete.some(t => t.id === id && t.creat_de_nume)
      && (await cer('GET', '/api/sumar')).date.tichete >= 1);
    verifica('stare necunoscută → 400', (await cer('PATCH', `/api/tichete/${id}`, { stare: 'gata' })).stare === 400);
    {
      // „+ Tichet" de pe o comandă: tichetul ţine minte comanda, lista îi arată numărul şi clientul
      const c = db2().prepare('SELECT id, COALESCE(oferta_nr, numar) AS nr, client_nume FROM comanda LIMIT 1').get();
      const pe = await cer('POST', '/api/tichete', { tip: 'problema', text: 'Fişa iese greşit aici', comanda_id: c.id });
      const t = (await cer('GET', '/api/tichete')).date.tichete.find(x => x.id === pe.date.id);
      verifica('tichet legat de comandă: numărul + clientul în listă', pe.stare === 201 && t?.comanda_id === c.id
        && t.comanda_nr === c.nr && t.comanda_client === c.client_nume, JSON.stringify(t));
      verifica('fără minim de caractere; gol doar pe o comandă', (await cer('POST', '/api/tichete', { tip: 'idee', text: 'x' })).stare === 201
        && (await cer('POST', '/api/tichete', { tip: 'problema', text: '', comanda_id: c.id })).stare === 201
        && (await cer('POST', '/api/tichete', { tip: 'problema', text: '' })).stare === 400);
      verifica('… comandă inexistentă → 400', (await cer('POST', '/api/tichete', { tip: 'problema', text: 'Nu există', comanda_id: 999999 })).stare === 400);
    }
    verifica('adminul răspunde + rezolvă', (await cer('PATCH', `/api/tichete/${id}`, { stare: 'rezolvat', raspuns: 'Reparat în versiunea nouă' })).stare === 200);
    await caMaria(async () => {
      verifica('autorul vede răspunsul (insignă 1) …', (await cer('GET', '/api/sumar')).date.tichete === 1
        && (await cer('GET', '/api/tichete')).date.tichete.find(t => t.id === id)?.raspuns === 'Reparat în versiunea nouă');
      await cer('POST', '/api/tichete/vazute');
      verifica('… şi după ce deschide pagina, insigna dispare', (await cer('GET', '/api/sumar')).date.tichete === 0);
      verifica('biroul nu vede tabloul adminului → 403', (await cer('GET', '/api/admin/tablou')).stare === 403);
    });
    // notificările autorului (server/notificari.js, 2026-10-19): rămân până le închide el cu X
    await cer('PATCH', `/api/tichete/${id}`, { stare: 'in_lucru' });   // doar starea
    await cer('PATCH', `/api/tichete/${id}`, { stare: 'in_lucru' });   // nimic schimbat → nicio notificare
    await caMaria(async () => {
      await cer('POST', '/api/tichete/vazute');   // deschiderea paginii Tichete NU le închide
      const n = (await cer('GET', '/api/notificari')).date.notificari;
      verifica('autorul are 2 notificări (răspunsul, apoi starea), în ordine, cu textul tichetului', n.length === 2
        && n[0].titlu === 'Răspuns la tichetul tău' && n[0].text.includes('Fişa nu se printează la Rame') && n[0].text.includes('Reparat în versiunea nouă')
        && n[0].text.includes('Stare: rezolvat') && n[1].titlu === 'Tichetul tău: în lucru' && n[1].link === '/tichete', JSON.stringify(n));
      verifica('X → se închide doar aia', (await cer('POST', `/api/notificari/${n[0].id}/inchide`)).stare === 200
        && (await cer('GET', '/api/notificari')).date.notificari.map(x => x.id).join() === String(n[1].id));
      verifica('închisă de două ori → 404', (await cer('POST', `/api/notificari/${n[0].id}/inchide`)).stare === 404);
    });
    const deAlMariei = db2().prepare("SELECT id FROM notificare WHERE inchisa_la IS NULL ORDER BY id DESC LIMIT 1").get().id;
    verifica('nu poţi închide notificarea altcuiva → 404', (await cer('POST', `/api/notificari/${deAlMariei}/inchide`)).stare === 404);
    verifica('cine schimbă nu primeşte notificare (adminul n-are niciuna)', (await cer('GET', '/api/notificari')).date.notificari.length === 0);
    const alMeu = (await cer('POST', '/api/tichete', { tip: 'idee', text: 'al adminului' })).date.id;
    await cer('PATCH', `/api/tichete/${alMeu}`, { stare: 'rezolvat', raspuns: 'gata' });
    verifica('tichetul meu, schimbat de mine → fără notificare', (await cer('GET', '/api/notificari')).date.notificari.length === 0);
    const t = (await cer('GET', '/api/admin/tablou')).date;
    verifica('tabloul: activitate pe 7 zile, pe om, server, jurnal', t.zile === 7 && t.activitate.oferte > 0 && Array.isArray(t.peOm)
      && t.peOm.some(o => o.oferte > 0) && !!t.server.pornit && typeof t.jurnal === 'string', JSON.stringify(t.activitate));
    verifica('conturile au ultima activitate', (await cer('GET', '/api/utilizatori')).date.utilizatori.some(u => u.vazut_la));
    verifica('pagina /tichete se serveşte', String((await cer('GET', '/tichete')).date).includes('<title>Tichete</title>'));
  }

  console.log('\nTaskuri + remindere (server/taskuri.js)');
  {
    const { dinOraRomaniei } = require('../server/taskuri.js');
    verifica('reminder: ora României vara (UTC+3) → UTC', dinOraRomaniei('2026-07-01T09:00') === '2026-07-01 06:00:00', dinOraRomaniei('2026-07-01T09:00'));
    verifica('reminder: ora României iarna (UTC+2) → UTC', dinOraRomaniei('2026-12-01T09:00') === '2026-12-01 07:00:00', dinOraRomaniei('2026-12-01T09:00'));
    verifica('reminder: dată greşită → null', dinOraRomaniei('2026-13-01T09:00') === null && dinOraRomaniei('mâine') === null);

    const maria = db2().prepare("SELECT id FROM utilizator WHERE user = 'maria'").get().id;
    const admin = db2().prepare("SELECT id FROM utilizator WHERE user = 'admin'").get().id;
    const cmd = db2().prepare('SELECT id FROM comanda LIMIT 1').get().id;
    verifica('task fără text → 400', (await cer('POST', '/api/taskuri', { text: ' ', pentru: maria })).stare === 400);
    verifica('task pentru un cont inexistent → 400', (await cer('POST', '/api/taskuri', { text: 'x', pentru: 99999 })).stare === 400);
    verifica('task cu dată greşită → 400', (await cer('POST', '/api/taskuri', { text: 'x', pentru: maria, scadenta: 'mâine' })).stare === 400);
    const t1 = await cer('POST', '/api/taskuri', { text: 'Sună clientul pt. avans', pentru: maria, scadenta: '2020-01-01T09:00', comanda_id: cmd });
    const t2 = await cer('POST', '/api/taskuri', { text: 'Al meu, mai târziu', pentru: admin, scadenta: '2099-01-01T09:00' });
    verifica('task nou → 201', t1.stare === 201 && t2.stare === 201, JSON.stringify(t1.date));
    const l = (await cer('GET', '/api/taskuri')).date;
    verifica('lista: ale mele + date de mine, cu comanda şi conturile', l.taskuri.length === 2 && l.utilizatori.length >= 2
      && l.taskuri.find(t => t.id === t1.date.id)?.comanda_id === cmd && l.taskuri.find(t => t.id === t1.date.id)?.pentru_nume === 'Maria Birou',
      JSON.stringify(l.taskuri));
    verifica('scadente: nu şi cele date altora / cu scadenţa în viitor', (await cer('GET', '/api/taskuri/scadente')).date.taskuri.length === 0);

    const k = cookie; cookie = null;
    await cer('POST', '/api/login', { user: 'maria', parola: 'parola-maria-1' });
    const sc = (await cer('GET', '/api/taskuri/scadente')).date.taskuri;
    verifica('scadente: Maria vede taskul primit, ajuns la scadenţă', sc.length === 1 && sc[0].creat_de_nume === 'Admin Test', JSON.stringify(sc));
    verifica('Maria nu vede taskul personal al adminului', (await cer('GET', '/api/taskuri')).date.taskuri.length === 1);
    verifica('Maria nu-l poate şterge pe al adminului', (await cer('DELETE', `/api/taskuri/${t1.date.id}`)).stare === 403);
    verifica('Maria nu-l atinge pe cel personal al adminului', (await cer('PATCH', `/api/taskuri/${t2.date.id}`, { facut: true })).stare === 404);
    verifica('amânare → 200', (await cer('PATCH', `/api/taskuri/${t1.date.id}`, { scadenta: '2099-02-01T10:30' })).stare === 200);
    verifica('amânat → nu mai e scadent', (await cer('GET', '/api/taskuri/scadente')).date.taskuri.length === 0);
    // conversaţia + aşteptarea (2026-10-15)
    const sus = async corp => (await cer('PATCH', `/api/taskuri/${t1.date.id}`, corp)).stare;
    verifica('în aşteptare cu motiv → 200', await sus({ asteptare: true, motiv: 'Aştept avansul' }) === 200);
    verifica('în aşteptare de două ori → un singur eveniment', await sus({ asteptare: true }) === 200);
    await sus({ scadenta: '2020-01-01T09:00' });
    verifica('în aşteptare → fără reminder, chiar trecut de scadenţă', (await cer('GET', '/api/taskuri/scadente')).date.taskuri.length === 0);
    verifica('răspuns gol → 400', (await cer('POST', `/api/taskuri/${t1.date.id}/raspuns`, { text: '  ' })).stare === 400);
    verifica('răspuns → 201', (await cer('POST', `/api/taskuri/${t1.date.id}/raspuns`, { text: 'Am sunat, revine mâine' })).stare === 201);
    verifica('Maria nu răspunde la taskul personal al adminului', (await cer('POST', `/api/taskuri/${t2.date.id}/raspuns`, { text: 'x' })).stare === 404);
    await sus({ asteptare: false });
    verifica('reluat → reminderul revine', (await cer('GET', '/api/taskuri/scadente')).date.taskuri.length === 1);
    verifica('ce scrii tu nu e necitit la tine', (await cer('GET', '/api/taskuri/scadente')).date.necitite === 0);
    await sus({ scadenta: '2099-02-01T10:30' });
    verifica('bifat făcut → 200', (await cer('PATCH', `/api/taskuri/${t1.date.id}`, { facut: true })).stare === 200);
    cookie = k;
    const dupa = (await cer('GET', '/api/taskuri')).date.taskuri.find(t => t.id === t1.date.id);
    verifica('adminul vede că e făcut', !!dupa?.facut_la && dupa.scadenta === '2099-02-01 08:30:00', JSON.stringify(dupa));
    verifica('conversaţia: aşteptare cu motiv, răspuns, reluat, făcut — în ordine',
      JSON.stringify(dupa.mesaje.map(m => [m.eveniment, m.text])) === JSON.stringify([['asteptare', 'Aştept avansul'],
        [null, 'Am sunat, revine mâine'], ['reluat', ''], ['facut', '']]) && dupa.mesaje.every(m => m.autor_nume === 'Maria Birou'),
      JSON.stringify(dupa.mesaje));
    verifica('adminul are 4 necitite (listă + insignă)', dupa.necitite === 4 && (await cer('GET', '/api/taskuri/scadente')).date.necitite === 4);
    verifica('deschis = citit', (await cer('POST', `/api/taskuri/${t1.date.id}/citit`)).stare === 200
      && (await cer('GET', '/api/taskuri/scadente')).date.necitite === 0);
    verifica('cel care l-a dat îl şterge', (await cer('DELETE', `/api/taskuri/${t1.date.id}`)).stare === 200);
    const pag = String((await cer('GET', '/taskuri')).date);
    verifica('pagina /taskuri se serveşte', pag.includes('<title>Taskuri</title>') && pag.includes("api('/api/taskuri'"));
  }

  console.log('\nOra exactă (server/ora.js) — ceasul serverului în urmă cu 5 minute');
  {
    const ora = require('../server/ora.js');
    ora._seteaza(5 * 60e3);   // ca şi cum sincronizarea a găsit ceasul în urmă cu 5 minute
    const o = await cer('POST', '/api/comenzi', { client: { nume: 'Client Ora' }, ofertaNr: 'ORA-1',
      pozitii: [pozitie('confortGamma', 'Confort Gamma', 1, 1200)] });
    const creat = Date.parse(db2().prepare('SELECT creat_la FROM comanda WHERE id = ?').get(o.date.comanda.id).creat_la.replace(' ', 'T') + 'Z');
    verifica('oferta nouă: ora exactă, nu a ceasului serverului', Math.abs(creat - (Date.now() + 5 * 60e3)) < 5000,
      new Date(creat).toISOString());
    const acc = await cer('POST', `/api/comenzi/${o.date.comanda.id}/accepta`, { plata: 'proforma', avans: 0, telefon: '0700', adresa: 'X' });
    const conf = Date.parse(acc.date.comanda.confirmat_la.replace(' ', 'T') + 'Z');
    verifica('acceptarea: ora exactă', Math.abs(conf - (Date.now() + 5 * 60e3)) < 5000);
    verifica('/api/ora dă ora exactă', Math.abs((await cer('GET', '/api/ora')).date.acum - (Date.now() + 5 * 60e3)) < 2000);
    verifica('„Înapoi în ofertă" numără după ora exactă', (await cer('POST', `/api/comenzi/${o.date.comanda.id}/inapoi-oferta`)).stare === 200);
    ora._seteaza(0);
  }

  console.log('\nModul test — copie comună: ce e pe bune apare în test, ce e în test nu apare pe bune');
  {
    const { inTest } = require('../server/db.js');
    const inCopie = sql => inTest(() => db2().prepare(sql).all());
    const pePeBune = sql => db2().prepare(sql).all();
    const an = new Date().getFullYear();
    creeazaUtilizator({ nume: 'Tina Test', user: 'tina', parola: 'parola-tina-1', rol: 'birou' });
    const tina = db2().prepare("SELECT id FROM utilizator WHERE user = 'tina'").get().id;
    await cer('POST', '/api/login', { user: 'admin', parola: 'parola-admin-1' });
    const adminId = db2().prepare("SELECT id FROM utilizator WHERE user = 'admin'").get().id;
    verifica('adminul nu poate fi pus în modul test', (await cer('PATCH', `/api/utilizatori/${adminId}`, { modTest: true })).stare === 400);
    verifica('admin pune un cont în modul test', (await cer('PATCH', `/api/utilizatori/${tina}`, { modTest: true })).stare === 200);
    verifica('copia de test e făcută', fs.existsSync(process.env.MANAGER_DB.replace(/\.sqlite$/, '-test.sqlite')));
    const reala = await cer('POST', '/api/comenzi', { client: { nume: 'Client Real MT' }, ofertaNr: 'MT-R1', pozitii: [pozitie('confortGamma', 'Confort Gamma', 2, 1600)] });

    await cer('POST', '/api/login', { user: 'tina', parola: 'parola-tina-1' });
    verifica('/api/eu spune că e în modul test', (await cer('GET', '/api/eu')).date.utilizator.mod_test === 1);
    verifica('în test se vede oferta făcută pe bune', (await cer('GET', '/api/comenzi')).date.comenzi.some(c => c.client_nume === 'Client Real MT'));
    const t = await cer('POST', '/api/comenzi', { client: { nume: 'Client Doar Test' }, ofertaNr: 'MT-T1', pozitii: [pozitie('confortGamma', 'Confort Gamma', 2, 1600)] });
    verifica('oferta din test: id peste 1e9, număr de la 9001', t.stare === 201 && t.date.comanda.id >= 1e9 && t.date.comanda.numar === `OF-${an}-9001`,
      JSON.stringify(t.date));
    verifica('oferta din test NU e în baza reală', !pePeBune("SELECT 1 FROM comanda WHERE client_nume = 'Client Doar Test'").length);
    verifica('poziţiile ei stau în copie, legate de ea', inCopie(`SELECT comanda_id FROM pozitie WHERE comanda_id = ${t.date.comanda.id}`).length === 1);
    verifica('în test: oferta reală trece la „Aşteaptă plata"', (await cer('POST', `/api/comenzi/${reala.date.comanda.id}/asteapta-plata`)).stare === 200);
    verifica('… dar pe bune rămâne ofertă', pePeBune(`SELECT tip FROM comanda WHERE id = ${reala.date.comanda.id}`)[0].tip === 'oferta');
    // „demo" (2026-10-19, în locul chenarului): doar comenzile făcute / schimbate în test
    const oferteT = (await cer('GET', '/api/comenzi')).date.comenzi;
    verifica('demo: oferta făcută în test e marcată', oferteT.find(c => c.id === t.date.comanda.id)?.demo === true);
    verifica('demo: ofertele neatinse în test nu sunt marcate', oferteT.some(c => c.id < 1e9 && !c.demo), JSON.stringify(oferteT.map(c => [c.id, c.demo])));
    verifica('demo: oferta reală trecută în test la „Aşteaptă plata" e marcată (listă + pagina ei)',
      (await cer('GET', '/api/comenzi?tip=plata')).date.comenzi.find(c => c.id === reala.date.comanda.id)?.demo === true
      && (await cer('GET', `/api/comenzi/${reala.date.comanda.id}`)).date.comanda.demo === true);
    verifica('tichetul din test ajunge pe bune la admin', (await cer('POST', '/api/tichete', { tip: 'idee', text: 'din modul test' })).stare === 201
      && pePeBune("SELECT 1 FROM tichet WHERE text = 'din modul test'").length === 1);
    verifica('tichet pe oferta din test: ajunge pe bune, cu legătura ei', (await cer('POST', '/api/tichete',
      { tip: 'problema', text: 'pe oferta de test', comanda_id: t.date.comanda.id })).stare === 201
      && pePeBune("SELECT comanda_id FROM tichet WHERE text = 'pe oferta de test'")[0]?.comanda_id === t.date.comanda.id);

    await cer('POST', '/api/login', { user: 'admin', parola: 'parola-admin-1' });
    await cer('POST', `/api/comenzi/${reala.date.comanda.id}/accepta`, { plata: 'proforma', avans: 0, telefon: '0700', adresa: 'Str. Reala 1' });
    const r2 = await cer('POST', '/api/comenzi', { client: { nume: 'Client Real MT 2' }, ofertaNr: 'MT-R2', pozitii: [pozitie('confortGamma', 'Confort Gamma', 2, 1600)] });
    verifica('ce se face pe bune ajunge în copie (acceptarea, oferta nouă cu id-ul ei)',
      inCopie(`SELECT tip FROM comanda WHERE id = ${reala.date.comanda.id}`)[0]?.tip === 'comanda'
      && inCopie(`SELECT 1 FROM comanda WHERE id = ${r2.date.comanda.id} AND client_nume = 'Client Real MT 2'`).length === 1);
    verifica('oferta de test rămâne în copie după sincronizare', inCopie("SELECT 1 FROM comanda WHERE client_nume = 'Client Doar Test'").length === 1);
    verifica('demo: pe bune nicio comandă nu e marcată', !(await cer('GET', '/api/comenzi')).date.comenzi.some(c => c.demo)
      && !(await cer('GET', '/api/comenzi?tip=toate')).date.comenzi.some(c => c.demo));
    verifica('„Reface copia de test" o ia de la zero', (await cer('POST', '/api/test/reface')).stare === 200
      && !inCopie("SELECT 1 FROM comanda WHERE client_nume = 'Client Doar Test'").length
      && inCopie(`SELECT 1 FROM comanda WHERE id = ${r2.date.comanda.id}`).length === 1);
    verifica('scos din modul test', (await cer('PATCH', `/api/utilizatori/${tina}`, { modTest: false })).stare === 200
      && pePeBune(`SELECT mod_test FROM utilizator WHERE id = ${tina}`)[0].mod_test === 0);

    // pe server (2026-10-19) copia era ţinută deschisă după un update cu migraţie → EPERM şi serverul nu mai pornea.
    // Aici: în locul copiei e un folder, deci copia nu se poate nici deschide, nici şterge — baza tot trebuie să pornească.
    {
      const dir = fs.mkdtempSync(path.join(TEMP, 'copie-blocata-'));
      fs.mkdirSync(path.join(dir, 'b-test.sqlite'));
      const r = require('node:child_process').spawnSync(process.execPath, ['-e',
        "require('./server/db.js').deschide(); console.log('PORNIT')"],
        { cwd: path.join(__dirname, '..'), env: { ...process.env, MANAGER_DB: path.join(dir, 'b.sqlite') }, encoding: 'utf8' });
      verifica('copia de test blocată nu opreşte pornirea', r.status === 0 && r.stdout.includes('PORNIT')
        && r.stderr.includes('nu s-a putut deschide la pornire'), r.stderr.slice(0, 300));
    }

    // adminul mereu în test (userul, 2026-10-15) — cum rulează pe server
    const { config } = require('../server/config.js');
    config.adminInTest = true;
    verifica('admin: /api/eu spune că e în modul test', (await cer('GET', '/api/eu')).date.utilizator.mod_test === 1);
    const a = await cer('POST', '/api/comenzi', { client: { nume: 'Client Admin Test' }, ofertaNr: 'MT-A1', pozitii: [pozitie('confortGamma', 'Confort Gamma', 2, 1600)] });
    verifica('admin: oferta lui merge doar în copie', a.stare === 201 && a.date.comanda.id >= 1e9
      && !pePeBune("SELECT 1 FROM comanda WHERE client_nume = 'Client Admin Test'").length);
    verifica('admin: nu poate atinge comanda reală', (await cer('POST', `/api/comenzi/${r2.date.comanda.id}/asteapta-plata`)).stare === 200
      && pePeBune(`SELECT tip FROM comanda WHERE id = ${r2.date.comanda.id}`)[0].tip === 'oferta');
    const cont = await cer('POST', '/api/utilizatori', { nume: 'Nou Pe Bune', user: 'noupebune', parola: 'parola-noua-12', rol: 'birou' });
    verifica('admin: administrarea (conturi) rămâne pe bune', cont.stare === 201 && pePeBune("SELECT 1 FROM utilizator WHERE user = 'noupebune'").length === 1,
      JSON.stringify(cont));
    verifica('admin: tabloul arată datele reale', (await cer('GET', '/api/admin/tablou')).stare === 200);
    // demo-ul adminului e separat de al colegilor (userul, 2026-10-19)
    const inCopiaAdmin = sql => inTest(() => db2().prepare(sql).all(), 'admin');
    verifica('admin: oferta lui e în copia LUI, nu în a colegilor',
      inCopiaAdmin("SELECT 1 FROM comanda WHERE client_nume = 'Client Admin Test'").length === 1
      && !inCopie("SELECT 1 FROM comanda WHERE client_nume = 'Client Admin Test'").length);
    verifica('admin: comanda reală trecută de el la plată — aşa doar în copia lui',
      inCopiaAdmin(`SELECT tip FROM comanda WHERE id = ${r2.date.comanda.id}`)[0]?.tip === 'plata'
      && inCopie(`SELECT tip FROM comanda WHERE id = ${r2.date.comanda.id}`)[0]?.tip === 'oferta');
    verifica('admin: oferta lui apare DEMO', (await cer('GET', '/api/comenzi')).date.comenzi.find(c => c.client_nume === 'Client Admin Test')?.demo === true);
    // lanţul: ce se face în demo birou ajunge şi în demo admin (invers, nu)
    const { sincronizeaza } = require('../server/db.js');
    inTest(() => db2().prepare(`UPDATE comanda SET observatii = 'scris în demo birou' WHERE id = ${r2.date.comanda.id}`).run());
    sincronizeaza();
    verifica('lanţ: ce face biroul în demo vede şi adminul',
      inCopiaAdmin(`SELECT observatii FROM comanda WHERE id = ${r2.date.comanda.id}`)[0]?.observatii === 'scris în demo birou'
      && pePeBune(`SELECT observatii FROM comanda WHERE id = ${r2.date.comanda.id}`)[0]?.observatii !== 'scris în demo birou');
    const ofertaAdmin2 = await cer('POST', '/api/comenzi', { client: { nume: 'Client Admin 2' }, ofertaNr: 'MT-A2', pozitii: [pozitie('confortGamma', 'Confort Gamma', 2, 1600)] });
    verifica('demo admin: id-uri peste 2e9, numere de la 9501', ofertaAdmin2.date.comanda.id >= 2e9 && +ofertaAdmin2.date.comanda.numar.slice(-4) > 9500,
      JSON.stringify(ofertaAdmin2.date.comanda));
    verifica('„Resetează demo admin" = demo birou: fără ofertele adminului, cu ce a făcut biroul',
      (await cer('POST', '/api/test/reface', { copie: 'admin' })).stare === 200
      && !inCopiaAdmin("SELECT 1 FROM comanda WHERE client_nume LIKE 'Client Admin%'").length
      && inCopiaAdmin(`SELECT observatii FROM comanda WHERE id = ${r2.date.comanda.id}`)[0]?.observatii === 'scris în demo birou');
    verifica('„Resetează demo birou" = baza reală, şi demo admin odată cu el (e făcut din demo birou)',
      (await cer('POST', '/api/test/reface', { copie: 'colegi' })).stare === 200
      && inCopie(`SELECT observatii FROM comanda WHERE id = ${r2.date.comanda.id}`)[0]?.observatii !== 'scris în demo birou'
      && inCopiaAdmin(`SELECT observatii FROM comanda WHERE id = ${r2.date.comanda.id}`)[0]?.observatii !== 'scris în demo birou');
    // după resetarea biroului, lanţul merge mai departe (sesiunea adminului e pe copia nouă)
    db2().prepare(`UPDATE comanda SET observatii = 'pe bune, după reset' WHERE id = ${r2.date.comanda.id}`).run();
    sincronizeaza();
    verifica('după reset, ce se face pe bune ajunge iar până în demo admin',
      inCopiaAdmin(`SELECT observatii FROM comanda WHERE id = ${r2.date.comanda.id}`)[0]?.observatii === 'pe bune, după reset');
    verifica('reface o copie necunoscută → 400', (await cer('POST', '/api/test/reface', { copie: 'x' })).stare === 400);
    // DEMO şi la livrări / sticlă: o comandă reală programată la livrare sau cu sticla bifată în demo
    const cand = (await cer('GET', '/api/livrari/candidati')).date.comenzi;
    const deLivrat = cand.find(c => !c.demo);
    if (deLivrat) {
      await cer('POST', '/api/livrari', { data: '2026-12-01', comenzi: [deLivrat.id] });
      verifica('demo: comanda programată la livrare în demo → DEMO la livrări şi în listă',
        (await cer('GET', '/api/livrari')).date.livrari.flatMap(l => l.comenzi).find(c => c.id === deLivrat.id)?.demo === true
        && (await cer('GET', '/api/comenzi?tip=toate')).date.comenzi.find(c => c.id === deLivrat.id)?.demo === true);
    } else verifica('demo: există o comandă de programat la livrare (pt. testul de mai sus)', false, JSON.stringify(cand));
    const deSticla = (await cer('GET', '/api/sticla')).date.linii.find(l => !l.demo);
    if (deSticla) {
      await cer('POST', '/api/sticla/comanda', { ids: [deSticla.id] });
      verifica('demo: sticla bifată „comandată" în demo → DEMO la sticlă',
        (await cer('GET', '/api/sticla?comandate=1')).date.linii.find(l => l.id === deSticla.id)?.demo === true);
    }
    verifica('există două fişiere de copie', fs.existsSync(process.env.MANAGER_DB.replace(/\.sqlite$/, '-test-admin.sqlite')));
    config.adminInTest = false;
    verifica('demo: pe bune nimic marcat la livrări / sticlă', !(await cer('GET', '/api/livrari')).date.livrari.flatMap(l => l.comenzi).some(c => c.demo)
      && !(await cer('GET', '/api/sticla?comandate=1')).date.linii.some(l => l.demo) && !(await cer('GET', '/api/sticla')).date.linii.some(l => l.demo));
  }

  console.log('\nReleul spre tabloul de admin de pe Cloudflare (server/releu.js)');
  {
    const { executa } = require('../server/releu.js');
    const zlib = require('node:zlib');
    const corp = r => JSON.parse((r.antete['content-encoding'] ? zlib.gunzipSync : x => x)(Buffer.from(r.corp, 'base64')));
    const eu = await executa(baza, { id: 'a', metoda: 'GET', cale: '/api/eu', antete: {} });
    verifica('cererea de pe Cloudflare rulează ca adminul', eu.id === 'a' && eu.stare === 200 && corp(eu).utilizator.rol === 'admin', JSON.stringify(eu));
    require('../server/db.js').db().exec('DELETE FROM sesiune');   // ex. adminul şi-a schimbat parola
    verifica('… şi după ce sesiunile au fost şterse', corp(await executa(baza, { id: 'b', metoda: 'GET', cale: '/api/eu', antete: {} })).utilizator?.rol === 'admin');
    const t = await executa(baza, { id: 'c', metoda: 'POST', cale: '/api/tichete', antete: { 'content-type': 'application/json' },
      corp: Buffer.from(JSON.stringify({ tip: 'idee', text: 'scris de pe Cloudflare' })).toString('base64') });
    verifica('scrie (POST cu corp)', t.stare === 201 && corp(t).id > 0, JSON.stringify(t));
    const pag = await executa(baza, { id: 'd', metoda: 'GET', cale: '/admin', antete: {} });
    verifica('pagina vine comprimată, fără cookie-ul serverului', pag.stare === 200 && pag.antete['content-encoding'] === 'gzip'
      && !('set-cookie' in pag.antete) && zlib.gunzipSync(Buffer.from(pag.corp, 'base64')).toString().includes('<html'));
    // de la distanţă doar tabloul de admin şi tichetele (userul, 2026-10-15)
    const nr = () => require('../server/db.js').db().prepare('SELECT COUNT(*) AS n FROM comanda').get().n, inainte = nr();
    const blocate = await Promise.all([['GET', '/api/comenzi'], ['POST', '/api/comenzi'], ['GET', '/sticla'], ['GET', '/configurator/'],
      ['GET', '/api/clienti'], ['POST', '/api/comenzi/1/accepta'], ['GET', '/api/eux']]
      .map(([metoda, cale], i) => executa(baza, { id: 'e' + i, metoda, cale, antete: {} })));
    verifica('comenzile, operaţiunile, clienţii, configuratorul → 403, nimic scris', blocate.every(r => r.stare === 403) && nr() === inainte,
      blocate.map(r => r.stare).join());
    const acasa = await executa(baza, { id: 'f', metoda: 'GET', cale: '/?nou', antete: {} });
    verifica('„/" duce la tabloul de admin', acasa.stare === 302 && acasa.antete.location === '/admin');
    const tablou = await executa(baza, { id: 'g', metoda: 'GET', cale: '/api/admin/tablou', antete: {} });
    verifica('tabloul + marcajul pt. meniu', tablou.stare === 200 && tablou.antete['x-distanta'] === '1');
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
