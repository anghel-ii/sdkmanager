const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');

// ── Scanarea OPRITĂ (implicitul din producţie) ───────────────────────────────
// Cu MANAGER_SCANARE nesetat: fără rute de scanare, fără pagini /scan*, iar
// API-ul nu trimite coduri de bare, status sau istoric (interfeţele le ascund).
// Codul de bare se generează totuşi în DB, ca la repornire să nu lipsească.
//   node scripts/test-fara-scanare.js

const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'manager-test-'));
Object.assign(process.env, {
  MANAGER_DB: path.join(TEMP, 'test.sqlite'), MANAGER_BACKUP: path.join(TEMP, 'backup'),
  MANAGER_PORT: '0', MANAGER_TLS_CERT: path.join(TEMP, 'x.pem'), MANAGER_TLS_KEY: path.join(TEMP, 'x.pem'),
});
delete process.env.MANAGER_SCANARE;

// adminul face aici comenzi pe bune; „adminul mereu în test” are secţiunea lui (test.js, Modul test)
process.env.MANAGER_ADMIN_TEST = '0';
const { porneste } = require('../server/index.js');
const { creeazaUtilizator } = require('../server/auth.js');

let caderi = 0;
const verifica = (nume, ok, detaliu = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${nume}${ok || !detaliu ? '' : ` — ${detaliu}`}`);
  if (!ok) caderi++;
};

(async () => {
  const server = porneste();
  await new Promise(r => server.once('listening', r));
  const baza = `http://127.0.0.1:${server.address().port}`;
  let cookie = null;
  const cer = async (metoda, cale, corp) => {
    const r = await fetch(baza + cale, { method: metoda, redirect: 'manual',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: corp === undefined ? undefined : JSON.stringify(corp) });
    const pus = r.headers.getSetCookie?.()[0];
    if (pus) cookie = pus.split(';')[0];
    return { stare: r.status, date: (r.headers.get('content-type') || '').includes('json') ? await r.json() : null };
  };

  console.log('\nScanare oprită (implicit)\n');
  creeazaUtilizator({ nume: 'Admin', user: 'admin', parola: 'parola-admin-1', rol: 'admin' });
  await cer('POST', '/api/login', { user: 'admin', parola: 'parola-admin-1' });

  const creat = await cer('POST', '/api/comenzi', { client: { nume: 'Client' }, pozitii: [{
    sistem: 'suspendataA', eticheta: 'Suspendată A', finisaj: 'ALUMINIU', latime: 1200, inaltime: 2100, nrUsi: 1,
    config: { system: 'suspendataA' }, linii: { facturare: [{ cod: 'X', denumire: 'Uşă', cantitate: 1 }] } }] });
  const id = creat.date?.comanda?.id;
  verifica('oferta se creează', creat.stare === 201);
  verifica('răspunsul nu conţine cod de bare', creat.date?.comanda && !('coduri' in creat.date.comanda));

  const lista = await cer('GET', '/api/comenzi?tip=oferta');
  verifica('lista nu conţine status de scanare', lista.date.comenzi.every(c => !('status' in c)));

  const det = await cer('GET', `/api/comenzi/${id}`);
  verifica('detaliul nu conţine coduri / scanări', det.stare === 200 && !('coduri' in det.date) && !('scanari' in det.date));

  const modif = await cer('PUT', `/api/comenzi/${id}`, { client: { nume: 'Client 2' }, pozitii: [{
    sistem: 'suspendataA', eticheta: 'Suspendată A', finisaj: 'ALUMINIU', latime: 1300, inaltime: 2100, nrUsi: 1,
    config: { system: 'suspendataA' }, linii: {} }] });
  verifica('modificarea nu întoarce cod de bare', modif.stare === 200 && !('coduri' in modif.date.comanda));

  verifica('/api/operatii nu există → 404',        (await cer('GET', '/api/operatii')).stare === 404);
  verifica('/scan/inregistreaza nu există → 404',  (await cer('GET', '/scan/inregistreaza?cod=1&op=DEBITARE')).stare === 404);
  verifica('pagina /scan nu se serveşte → 404',     (await cer('GET', '/scan')).stare === 404);
  verifica('pagina /test-camera nu se serveşte → 404', (await cer('GET', '/test-camera')).stare === 404);

  const cod = require('../server/db.js').db().prepare(
    'SELECT a.cod_bare FROM usa a JOIN pozitie p ON p.id = a.pozitie_id WHERE p.comanda_id = ?').get(id)?.cod_bare;
  verifica('codul de bare există totuşi în DB (pt. repornire)', /^\d{6}$/.test(cod ?? ''), cod);

  server.close();
  // Windows nu şterge un fişier deschis: întâi închidem baza. Ştergerea folderului
  // temporar nu e un test, deci un eşec aici nu trebuie să pice rularea.
  require('../server/db.js').inchide();
  try { fs.rmSync(TEMP, { recursive: true, force: true }); } catch (e) { console.warn(`(nu am putut şterge ${TEMP}: ${e.code})`); }
  console.log(caderi ? `\n${caderi} căzute\n` : '\ntoate trecute\n');
  process.exit(caderi ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
