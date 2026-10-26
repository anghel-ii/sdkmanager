// ═══════════════════════════════════════════════════════════════════════════
//  IZOLAREA DEMO-ULUI (userul, 2026-10-19: „ce e demo e demo şi ce e real e real,
//  nu vreau surprize"). Managerul rulează ca pe server (proces separat, adminul
//  mereu în demo), iar după FIECARE acţiune care scrie se compară baza reală —
//  şi copiile de demo — tabel cu tabel, cu ce era înainte.
//
//    real  →  demo birou (colegii puşi în demo)  →  demo admin
//
//  Conturi: admin (demo admin), ana (birou, în demo), bogdan (birou, real),
//  cora (conducere, reală).
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'manager-demo-'));
const DB = path.join(TEMP, 'manager.sqlite');
const BIROU = path.join(TEMP, 'manager-test.sqlite');
const ADMIN = path.join(TEMP, 'manager-test-admin.sqlite');
const RADACINA = path.join(__dirname, '..');

let treceri = 0, caderi = 0;
function verifica(nume, conditie, detaliu = '') {
  if (conditie) { treceri++; console.log(`  ✓ ${nume}`); }
  else          { caderi++;  console.log(`  ✗ ${nume}${detaliu ? ` — ${detaliu}` : ''}`); }
}

// ── Serverul, ca proces separat (repornit la nevoie) ─────────────────────────
let port, proces;
const liber = () => new Promise(r => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const ENV = () => ({ ...process.env, MANAGER_DB: DB, MANAGER_BACKUP: path.join(TEMP, 'backup'), MANAGER_PORT: String(port),
  MANAGER_TLS_CERT: path.join(TEMP, 'nu.pem'), MANAGER_TLS_KEY: path.join(TEMP, 'nu.pem'), MANAGER_ADMIN_TEST: '1',
  MANAGER_RAPORTARE: '0', MANAGER_RELEU_URL: '', MANAGER_CLIENTI_URL: 'http://127.0.0.1:9' });
async function porneste() {
  proces = spawn(process.execPath, ['server/index.js'], { cwd: RADACINA, env: ENV(), stdio: ['ignore', 'pipe', 'pipe'] });
  proces.jurnal = '';
  proces.stdout.on('data', d => { proces.jurnal += d; });
  proces.stderr.on('data', d => { proces.jurnal += d; });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/login`)).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('serverul nu porneşte:\n' + proces.jurnal);
}
async function opreste() {
  const p = proces;
  await new Promise(r => { p.once('exit', r); p.kill('SIGINT'); });
}

// ── Cereri, câte un „browser" pe cont ───────────────────────────────────────
const cookie = {};
async function cer(cine, metoda, cale, corp) {
  const r = await fetch(`http://127.0.0.1:${port}${cale}`, { method: metoda, redirect: 'manual',
    headers: { 'Content-Type': 'application/json', ...(cookie[cine] ? { Cookie: cookie[cine] } : {}) },
    body: corp === undefined ? undefined : JSON.stringify(corp) });
  const pus = r.headers.getSetCookie?.()[0];
  if (pus) cookie[cine] = pus.split(';')[0];
  const tip = r.headers.get('content-type') || '';
  return { stare: r.status, date: tip.includes('json') ? await r.json() : await r.text() };
}
const PAROLA = 'parola-de-proba-1';
const login = async cine => (await cer(cine, 'POST', '/api/login', { user: cine, parola: PAROLA })).stare;

// ── Instantanee: fiecare tabel → amprentă (fără sesiuni) ─────────────────────
function instantaneu(fisier) {
  const d = new DatabaseSync(fisier, { readOnly: true });
  const t = {};
  for (const { name } of d.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('sesiune', 'activitate', 'tichet_poza')").all()) {   // jurnalul de activitate se scrie mereu pe bune (marcat „test")
    t[name] = crypto.createHash('sha1').update(JSON.stringify(d.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all())).digest('hex');
  }
  d.close();
  return t;
}
const schimbate = (a, b) => Object.keys({ ...a, ...b }).filter(k => a[k] !== b[k]).sort();
const rand = (fisier, sql) => { const d = new DatabaseSync(fisier, { readOnly: true }); const r = d.prepare(sql).all(); d.close(); return r; };

// O acţiune: rulează, apoi verifică ce s-a schimbat în fiecare bază faţă de înainte.
// `real` / `birou` / `admin` = tabelele care AU VOIE să se schimbe acolo (restul — neatinse).
// Copiile la zi înainte de o „poză": o cerere DIN DEMO sincronizează lanţul înainte să răspundă (index.js),
// pe când una reală o face abia după ce a trimis răspunsul — pe un calculator lent (CI-ul GitHub),
// poza de după ea ar prinde copiile înainte de sincronizare.
const laZi = () => cer('ana', 'GET', '/api/sumar');
async function actiune(nume, fn, { real = [], birou, admin, stare = s => s >= 200 && s < 300 } = {}) {
  await laZi();
  const inainte = { real: instantaneu(DB), birou: fs.existsSync(BIROU) && instantaneu(BIROU), admin: fs.existsSync(ADMIN) && instantaneu(ADMIN) };
  const r = await fn();
  await laZi();
  const dupa = { real: instantaneu(DB), birou: fs.existsSync(BIROU) && instantaneu(BIROU), admin: fs.existsSync(ADMIN) && instantaneu(ADMIN) };
  const sr = schimbate(inainte.real, dupa.real).filter(t => !real.includes(t));
  verifica(`${nume}: ${r.stare}, baza reală neatinsă${real.length ? ` (în afară de ${real.join(', ')})` : ''}`,
    stare(r.stare) && !sr.length, `stare ${r.stare} ${JSON.stringify(r.date).slice(0, 200)} · schimbate pe bune: ${sr.join(', ')}`);
  for (const [copie, voie] of [['birou', birou], ['admin', admin]]) {
    if (!voie || !inainte[copie] || !dupa[copie]) continue;
    const s = schimbate(inainte[copie], dupa[copie]).filter(t => !voie.includes(t));
    verifica(`${nume}: demo ${copie} neatins${voie.length ? ` (în afară de ${voie.join(', ')})` : ''}`, !s.length, `schimbate: ${s.join(', ')}`);
  }
  return r;
}
const NIMIC = [];

// ── Date de probă ───────────────────────────────────────────────────────────
const pozitie = (latime = 1600) => ({
  sistem: 'confortGamma', eticheta: 'Confort Gamma', finisaj: 'ALUMINIU', latime, inaltime: 2100, nrUsi: 2,
  config: { system: 'confortGamma', width: latime, height: 2100, doors: 2 },
  linii: {
    facturare: [{ cod: 'USA007', denumire: 'Uşă', um: 'buc', cantitate: 2 }],
    necesar:   [{ cod: 'AL-M19', denumire: 'Profil', um: 'buc', cantitate: 4, debitare: '2118 mm' }],
    client:    [{ cod: null, denumire: 'Panou PAL', um: 'buc', cantitate: 1, debitare: '600 × 900 mm' }],
    sticla:    [{ cod: 'GG004', denumire: 'Geam float 4mm GG004', um: 'buc', cantitate: 2, debitare: '1144 × 384 mm' }],
  },
});
const oferta = (nume, nr) => ({ client: { nume, telefon: '0700', adresa: 'Str. Lunga 3, Cluj-Napoca, Cluj' },
  detalii: { livrare: 'Cu masina noastra', agent: 'Birou' }, ofertaNr: nr, pozitii: [pozitie()] });
const comanda = async (cine, nume, nr) => {
  const o = (await cer(cine, 'POST', '/api/comenzi', oferta(nume, nr))).date.comanda;
  await cer(cine, 'POST', `/api/comenzi/${o.id}/accepta`, { plata: 'bon', avans: 0, telefon: '0700', adresa: 'Str. Lunga 3, Cluj-Napoca, Cluj' });
  return o.id;
};
const lista = async (cine, tip = 'toate') => (await cer(cine, 'GET', `/api/comenzi?tip=${tip}`)).date.comenzi;
const gaseste = async (cine, id) => (await lista(cine)).find(c => c.id === id);

async function main() {
  port = await liber();
  // conturile, înainte de pornire (ca pe server: create din /admin)
  spawnSync(process.execPath, ['-e', `
    const { deschide, db } = require('./server/db.js'); const { creeazaUtilizator } = require('./server/auth.js'); deschide();
    for (const [user, rol] of [['admin','admin'],['ana','birou'],['bogdan','birou'],['cora','conducere']])
      creeazaUtilizator({ nume: user, user, parola: '${PAROLA}', rol });
    db().prepare("UPDATE utilizator SET mod_test = 1 WHERE user = 'ana'").run();
    require('./server/db.js').inchide();`], { cwd: RADACINA, env: ENV(), stdio: 'inherit' });
  await porneste();
  for (const u of ['admin', 'ana', 'bogdan', 'cora']) await login(u);
  console.log('\nDemo — izolare (proces separat, adminul mereu în demo)\n');

  console.log('Pornire');
  const eu = async u => (await cer(u, 'GET', '/api/eu')).date.utilizator;
  await cer('ana', 'GET', '/api/comenzi'); await cer('admin', 'GET', '/api/comenzi');   // prima intrare în demo face copiile
  verifica('ana (birou, în demo) şi adminul — în demo; bogdan şi cora — reali',
    (await eu('ana')).mod_test === 1 && (await eu('admin')).mod_test === 1 && !(await eu('bogdan')).mod_test && !(await eu('cora')).mod_test);

  // ── Date reale de pornire ──
  console.log('\nDate reale (bogdan)');
  const r1 = await actiune('bogdan: ofertă reală', () => cer('bogdan', 'POST', '/api/comenzi', oferta('Real Unu', 'R-1')),
    { real: ['comanda', 'pozitie', 'pozitie_linie', 'usa'], birou: ['comanda', 'pozitie', 'pozitie_linie', 'usa'], admin: ['comanda', 'pozitie', 'pozitie_linie', 'usa'] });
  const idR1 = r1.date.comanda.id;
  const idR2 = await comanda('bogdan', 'Real Doi', 'R-2');   // comandă în lucru, cu sticlă, cu maşina noastră
  const idR3 = await comanda('bogdan', 'Real Trei', 'R-3');
  await laZi();
  verifica('copiile de demo au apărut (birou + admin)', fs.existsSync(BIROU) && fs.existsSync(ADMIN));
  verifica('ce e real ajunge în demo birou şi în demo admin',
    rand(BIROU, `SELECT tip FROM comanda WHERE id = ${idR2}`)[0]?.tip === 'comanda' && rand(ADMIN, `SELECT tip FROM comanda WHERE id = ${idR2}`)[0]?.tip === 'comanda');

  // ── 1. Demo birou: fiecare acţiune ──
  console.log('\nDemo birou (ana) — nimic pe bune');
  const C = ['comanda', 'pozitie', 'pozitie_linie', 'usa', 'fixare', 'cerere', 'fisa_printare', 'livrare', 'livrare_comanda',
    'task', 'task_mesaj', 'task_destinatar', 'task_citit', 'preferinta'];   // ce are voie să se schimbe în copii
  const oA = await actiune('ana: ofertă nouă', () => cer('ana', 'POST', '/api/comenzi', oferta('Demo Ana', 'D-1')), { birou: C, admin: C });
  const idA = oA.date.comanda.id;
  verifica('ana: oferta ei are id ≥ 1e9 şi număr 9001+', idA >= 1e9 && idA < 2e9 && +oA.date.comanda.numar.slice(-4) > 9000, JSON.stringify(oA.date.comanda));
  await actiune('ana: modifică oferta ei', () => cer('ana', 'PUT', `/api/comenzi/${idA}`, oferta('Demo Ana Modificat', 'D-1')), { birou: C, admin: C });
  await actiune('ana: modifică oferta REALĂ', () => cer('ana', 'PUT', `/api/comenzi/${idR1}`, oferta('Real Unu MODIFICAT ÎN DEMO', 'R-1')), { birou: C, admin: C });
  await actiune('ana: ofertă reală → aşteaptă plata', () => cer('ana', 'POST', `/api/comenzi/${idR1}/asteapta-plata`), { birou: C, admin: C });
  await actiune('ana: ofertă reală → acceptată', () => cer('ana', 'POST', `/api/comenzi/${idR1}/accepta`, { plata: 'bon', avans: 10, telefon: '0711', adresa: 'X, Iași' }), { birou: C, admin: C });
  await actiune('ana: factură pe comanda reală', () => cer('ana', 'POST', `/api/comenzi/${idR2}/factura`, { numar: 'F-DEMO' }), { birou: C, admin: C });
  await actiune('ana: finalizează comanda reală', () => cer('ana', 'POST', `/api/comenzi/${idR2}/finalizeaza`), { birou: C, admin: C });
  await actiune('ana: redeschide', () => cer('ana', 'POST', `/api/comenzi/${idR2}/redeschide`), { birou: C, admin: C });
  await actiune('ana: schimbă livrarea', () => cer('ana', 'POST', `/api/comenzi/${idR3}/livrare`, { livrare: 'Curier ramburs' }), { birou: C, admin: C });
  await actiune('ana: înapoi la livrare cu maşina', () => cer('ana', 'POST', `/api/comenzi/${idR3}/livrare`, { livrare: 'Cu masina noastra' }), { birou: C, admin: C });
  await actiune('ana: adaugă produs la comanda reală', () => cer('ana', 'POST', `/api/comenzi/${idR3}/adauga`, { pozitii: [pozitie(1700)] }), { birou: C, admin: C });
  await actiune('ana: fişa printată', () => cer('ana', 'POST', `/api/comenzi/${idR3}/fisa`, { poz: 0 }), { birou: C, admin: C });
  await actiune('ana: fixează (pin)', () => cer('ana', 'POST', `/api/comenzi/${idR3}/fixare`, { fixat: true }), { birou: C, admin: C });
  await actiune('ana: preferinţe', () => cer('ana', 'PUT', '/api/preferinte', { sortare: 'facturare' }), { birou: C, admin: C });
  const linii = (await cer('ana', 'GET', '/api/sticla')).date.linii.filter(l => l.comanda_id === idR3);
  await actiune('ana: sticla comandată', () => cer('ana', 'POST', '/api/sticla/comanda', { ids: linii.map(l => l.id) }), { birou: C, admin: C });
  await actiune('ana: sticla înapoi la „de comandat"', () => cer('ana', 'POST', '/api/sticla/anuleaza', { ids: linii.map(l => l.id) }), { birou: C, admin: C });
  await actiune('ana: sticla comandată din nou', () => cer('ana', 'POST', '/api/sticla/comanda', { ids: linii.map(l => l.id) }), { birou: C, admin: C });
  await actiune('ana: judeţ / de încasat la livrare', () => cer('ana', 'PUT', `/api/livrari/comanda/${idR3}`, { judet: 'Cluj', de_incasat: '150', coloana_borderou: 'factura' }), { birou: C, admin: C });
  const lv = await actiune('ana: programează livrarea', () => cer('ana', 'POST', '/api/livrari', { data: '2026-12-01', comenzi: [idR3] }), { birou: C, admin: C });
  const anaId = (await eu('ana')).id;
  const tk = await actiune('ana: task pentru ea', () => cer('ana', 'POST', '/api/taskuri', { text: 'task din demo', pentru: anaId }), { birou: C, admin: C });
  await actiune('ana: răspuns în task', () => cer('ana', 'POST', `/api/taskuri/${tk.date.id}/raspuns`, { text: 'merge' }), { birou: C, admin: C });
  await actiune('ana: task bifat', () => cer('ana', 'PATCH', `/api/taskuri/${tk.date.id}`, { facut: true }), { birou: C, admin: C });
  await actiune('ana: cere anularea comenzii reale', () => cer('ana', 'POST', `/api/comenzi/${idR1}/anulare`, { motiv: 'probă din demo' }), { birou: C, admin: C });
  await actiune('ana: tichet (merge PE BUNE, intenţionat)', () => cer('ana', 'POST', '/api/tichete', { tip: 'idee', text: 'tichet din demo' }),
    { real: ['tichet'], birou: [...C, 'tichet'], admin: [...C, 'tichet'] });   // tichetul real coboară şi în demo
  await actiune('ana: aprobarea unui client e blocată în demo', () => cer('ana', 'POST', '/api/clienti/propuneri/1/aproba'),
    { birou: NIMIC, admin: NIMIC, stare: s => s === 403 });
  void lv;

  console.log('\nDemo birou — ce vede fiecare');
  const anaVede = await gaseste('ana', idR1), bogdanVede = await gaseste('bogdan', idR1), adminVede = await gaseste('admin', idR1);
  verifica('bogdan (real): oferta R-1 e tot ofertă, numele vechi, fără DEMO',
    rand(DB, `SELECT tip, client_nume FROM comanda WHERE id = ${idR1}`)[0]?.tip === 'oferta' && bogdanVede?.client_nume === 'Real Unu' && !bogdanVede?.demo);
  verifica('ana: R-1 modificată + DEMO', anaVede?.client_nume === 'Real Unu MODIFICAT ÎN DEMO' && anaVede?.demo === true, JSON.stringify(anaVede));
  verifica('adminul vede ce a făcut ana (lanţ) + DEMO', adminVede?.client_nume === 'Real Unu MODIFICAT ÎN DEMO' && adminVede?.demo === true, JSON.stringify(adminVede));
  verifica('bogdan nu vede oferta făcută de ana', !(await gaseste('bogdan', idA)));
  verifica('adminul vede oferta făcută de ana', (await gaseste('admin', idA))?.demo === true);
  verifica('bogdan: niciun DEMO nicăieri (comenzi, sticlă, livrări)', !(await lista('bogdan')).some(c => c.demo)
    && !(await cer('bogdan', 'GET', '/api/sticla')).date.linii.some(l => l.demo)
    && !(await cer('bogdan', 'GET', '/api/sticla?comandate=1')).date.linii.some(l => l.demo)
    && !(await cer('bogdan', 'GET', '/api/livrari')).date.livrari.length
    && !(await cer('bogdan', 'GET', '/api/livrari/candidati')).date.comenzi.some(c => c.demo));
  verifica('bogdan: R-3 încă de livrat (programarea din demo nu e pe bune)',
    (await cer('bogdan', 'GET', '/api/livrari/candidati')).date.comenzi.some(c => c.id === idR3));
  verifica('bogdan: sticla R-3 încă „de comandat"', (await cer('bogdan', 'GET', '/api/sticla')).date.linii.some(l => l.comanda_id === idR3));
  verifica('ana: livrarea din demo e DEMO', (await cer('ana', 'GET', '/api/livrari')).date.livrari.flatMap(l => l.comenzi).find(c => c.id === idR3)?.demo === true);
  verifica('cora (conducere, reală): nicio cerere de anulare', !(await cer('cora', 'GET', '/api/cereri')).date.cereri?.some(c => c.comanda_id === idR1));
  verifica('cora: tichetul din demo a ajuns pe bune (aşa trebuie)', rand(DB, "SELECT 1 FROM tichet WHERE text = 'tichet din demo'").length === 1);
  verifica('bogdan: nu vede taskul anei din demo', !rand(DB, "SELECT 1 FROM task WHERE text = 'task din demo'").length);

  // ── 2. Demo admin ──
  console.log('\nDemo admin — nici pe bune, nici în demo birou');
  const oAd = await actiune('admin: ofertă nouă', () => cer('admin', 'POST', '/api/comenzi', oferta('Demo Admin', 'AD-1')), { birou: NIMIC, admin: C });
  const idAd = oAd.date.comanda.id;
  verifica('admin: id ≥ 2e9, număr 9501+', idAd >= 2e9 && +oAd.date.comanda.numar.slice(-4) > 9500, JSON.stringify(oAd.date.comanda));
  await actiune('admin: acceptă oferta lui', () => cer('admin', 'POST', `/api/comenzi/${idAd}/accepta`, { plata: 'bon', avans: 0, telefon: '1', adresa: 'X, Cluj' }), { birou: NIMIC, admin: C });
  await actiune('admin: finalizează comanda reală R-3', () => cer('admin', 'POST', `/api/comenzi/${idR3}/finalizeaza`), { birou: NIMIC, admin: C });
  await actiune('admin: modifică oferta anei', () => cer('admin', 'PUT', `/api/comenzi/${idA}`, oferta('Ana modificat de admin', 'D-1')), { birou: NIMIC, admin: C });
  await actiune('admin: sticla R-2 comandată', async () => {
    const l = (await cer('admin', 'GET', '/api/sticla')).date.linii.filter(x => x.comanda_id === idR2);
    return cer('admin', 'POST', '/api/sticla/comanda', { ids: l.map(x => x.id) });
  }, { birou: NIMIC, admin: C });
  await actiune('admin: anulează livrarea din demo-ul anei', async () => {
    const l = (await cer('admin', 'GET', '/api/livrari')).date.livrari[0];
    return cer('admin', 'DELETE', `/api/livrari/${l.id}`);
  }, { birou: NIMIC, admin: C });
  // cererile de anulare: adminul le vede şi le decide PE BUNE (2026-10-19 — aprobate doar în demo, reapăreau)
  verifica('admin: nu vede cererea de anulare făcută de ana în demo', !(await cer('admin', 'GET', '/api/cereri')).date.cereri.some(x => x.comanda_id === idR1));
  const idR7 = await comanda('bogdan', 'Real Şapte', 'R-7');
  await actiune('bogdan: cere anularea (pe bune)', () => cer('bogdan', 'POST', `/api/comenzi/${idR7}/anulare`, { motiv: 'clientul a renunţat' }),
    { real: ['cerere'], birou: ['cerere'], admin: ['cerere'] });
  verifica('admin: vede cererea reală, şi în numărul din meniu', (await cer('admin', 'GET', '/api/cereri')).date.cereri.some(x => x.comanda_id === idR7 && x.stare === 'deschisa')
    && (await cer('admin', 'GET', '/api/sumar')).date.cereri === rand(DB, "SELECT COUNT(*) AS n FROM cerere WHERE stare = 'deschisa'")[0].n);
  await actiune('admin: aprobă cererea reală → PE BUNE', async () => {
    const c = (await cer('admin', 'GET', '/api/cereri')).date.cereri.find(x => x.comanda_id === idR7 && x.stare === 'deschisa');
    return cer('admin', 'POST', `/api/cereri/${c.id}/aproba`);
  }, { real: ['cerere', 'comanda'], birou: ['cerere', 'comanda'], admin: ['cerere', 'comanda'] });
  verifica('aprobarea adminului e pe bune: cererea aprobată, comanda anulată (şi în ambele demo-uri)',
    rand(DB, `SELECT stare FROM cerere WHERE comanda_id = ${idR7}`)[0]?.stare === 'aprobata' && rand(DB, `SELECT anulat FROM comanda WHERE id = ${idR7}`)[0]?.anulat === 1
    && rand(BIROU, `SELECT anulat FROM comanda WHERE id = ${idR7}`)[0]?.anulat === 1 && rand(ADMIN, `SELECT anulat FROM comanda WHERE id = ${idR7}`)[0]?.anulat === 1);
  verifica('cora (conducere) vede cererea ca aprobată de admin', (await cer('cora', 'GET', '/api/cereri')).date.cereri.find(x => x.comanda_id === idR7)?.stare === 'aprobata');
  const idR8 = await comanda('bogdan', 'Real Opt', 'R-8');
  await cer('bogdan', 'POST', `/api/comenzi/${idR8}/anulare`, { motiv: 'probă respingere' });
  await actiune('admin: respinge o cerere reală → PE BUNE', async () => {
    const c = (await cer('admin', 'GET', '/api/cereri')).date.cereri.find(x => x.comanda_id === idR8 && x.stare === 'deschisa');
    return cer('admin', 'POST', `/api/cereri/${c.id}/respinge`, { motiv: 'nu' });
  }, { real: ['cerere'], birou: ['cerere'], admin: ['cerere'] });
  verifica('respingerea e pe bune, comanda rămâne activă', rand(DB, `SELECT stare FROM cerere WHERE comanda_id = ${idR8}`)[0]?.stare === 'respinsa'
    && !rand(DB, `SELECT anulat FROM comanda WHERE id = ${idR8}`)[0]?.anulat);
  verifica('decizia adminului e în baza reală — nu mai reapare la refacerea copiilor (update, resetare)',
    rand(DB, `SELECT stare FROM cerere WHERE comanda_id = ${idR7}`)[0]?.stare === 'aprobata'
    && !(await cer('admin', 'GET', '/api/cereri')).date.cereri.some(x => x.stare === 'deschisa' && [idR7, idR8].includes(x.comanda_id)));
  await actiune('admin: task', () => cer('admin', 'POST', '/api/taskuri', { text: 'task admin', pentru: anaId }), { birou: NIMIC, admin: C });
  await actiune('ana: schimbă mailul unui furnizor — doar în demo', () => cer('ana', 'PUT', '/api/sticla/furnizori/GG', { email: 'demo@ana.ro' }),
    { birou: ['furnizor'], admin: ['furnizor'] });
  verifica('mailul schimbat de ana nu e pe bune', rand(DB, "SELECT email FROM furnizor WHERE cod = 'GG'")[0].email === 'comenzi@goldenglass.ro'
    && (await cer('bogdan', 'GET', '/api/sticla/furnizori')).date.furnizori.find(f => f.cod === 'GG').email === 'comenzi@goldenglass.ro');
  await actiune('admin: schimbă mailul unui furnizor → PE BUNE', () => cer('admin', 'PUT', '/api/sticla/furnizori/GG', { email: 'nou@goldenglass.ro' }),
    { real: ['furnizor'], birou: ['furnizor'], admin: ['furnizor'] });
  verifica('mailul schimbat de admin: pe bune, la bogdan şi la ana (lanţ)', rand(DB, "SELECT email FROM furnizor WHERE cod = 'GG'")[0].email === 'nou@goldenglass.ro'
    && (await cer('bogdan', 'GET', '/api/sticla/furnizori')).date.furnizori.find(f => f.cod === 'GG').email === 'nou@goldenglass.ro'
    && (await cer('ana', 'GET', '/api/sticla/furnizori')).date.furnizori.find(f => f.cod === 'GG').email === 'nou@goldenglass.ro');
  await actiune('admin: răspunde la tichetul anei → PE BUNE, cu notificare', async () => {
    const t = (await cer('admin', 'GET', '/api/tichete')).date.tichete.find(x => x.text === 'tichet din demo');
    return cer('admin', 'PATCH', `/api/tichete/${t.id}`, { stare: 'rezolvat', raspuns: 'am văzut' });
  }, { real: ['tichet', 'tichet_mesaj', 'notificare'], birou: ['tichet', 'tichet_mesaj', 'notificare'], admin: ['tichet', 'tichet_mesaj', 'notificare'] });
  const nAna = (await cer('ana', 'GET', '/api/notificari')).date.notificari;
  verifica('ana (în demo) primeşte notificarea, şi o închide pe bune', nAna.length === 1 && nAna[0].titlu === 'Răspuns la tichetul tău'
    && (await cer('ana', 'POST', `/api/notificari/${nAna[0].id}/inchide`)).stare === 200
    && !!rand(DB, `SELECT inchisa_la FROM notificare WHERE id = ${nAna[0].id}`)[0]?.inchisa_la, JSON.stringify(nAna));
  await actiune('admin: cont nou (administrarea merge PE BUNE)', () => cer('admin', 'POST', '/api/utilizatori', { user: 'nou', nume: 'Nou', rol: 'birou', parola: PAROLA }),
    { real: ['utilizator'], birou: ['utilizator'], admin: ['utilizator'] });
  verifica('ana nu vede oferta adminului, nici schimbările lui', !(await gaseste('ana', idAd))
    && (await gaseste('ana', idA))?.client_nume === 'Demo Ana Modificat' && !(await gaseste('ana', idR3))?.finalizat_la);
  verifica('bogdan nu vede nimic din demo admin', !(await gaseste('bogdan', idAd)) && !(await gaseste('bogdan', idR3))?.finalizat_la
    && !rand(DB, `SELECT 1 FROM cerere WHERE comanda_id = ${idR1}`).length && !rand(DB, `SELECT anulat FROM comanda WHERE id = ${idR1}`)[0].anulat);
  verifica('ana: livrarea ei din demo rămâne (adminul a anulat-o doar la el)', (await cer('ana', 'GET', '/api/livrari')).date.livrari.length === 1);
  verifica('admin: vede DEMO pe oferta lui', (await gaseste('admin', idAd))?.demo === true);

  // ── 3. Ce se face pe bune ajunge în ambele demo-uri ──
  console.log('\nPe bune → ambele demo-uri');
  const idR4 = await comanda('bogdan', 'Real Patru', 'R-4');
  await cer('bogdan', 'POST', `/api/comenzi/${idR4}/factura`, { numar: 'F-REAL' });
  verifica('comanda reală nouă + factura ei — la ana şi la admin, fără DEMO',
    (await gaseste('ana', idR4))?.factura_nr === 'F-REAL' && !(await gaseste('ana', idR4))?.demo
    && (await gaseste('admin', idR4))?.factura_nr === 'F-REAL' && !(await gaseste('admin', idR4))?.demo);
  await cer('bogdan', 'POST', `/api/comenzi/${idR2}/finalizeaza`);
  await laZi();
  verifica('pe bune, R-2 finalizată → aşa şi în ambele demo-uri', !!(await gaseste('ana', idR2))?.finalizat_la && !!(await gaseste('admin', idR2))?.finalizat_la);
  verifica('id-urile nu se bat: ofertele anei şi adminului încă acolo', !!(await gaseste('ana', idA)) && !!(await gaseste('admin', idAd)) && !!(await gaseste('admin', idA)));

  // ── 4. Live: cine află de o schimbare ──
  console.log('\nActualizarea live');
  const asculta = cine => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/live`, { headers: { Cookie: cookie[cine] } });
    const m = { mesaje: [], ws };
    ws.onmessage = e => m.mesaje.push(String(e.data));
    m.gata = new Promise(r => { ws.onopen = r; });
    return m;
  };
  const L = { ana: asculta('ana'), admin: asculta('admin'), bogdan: asculta('bogdan') };
  await Promise.all(Object.values(L).map(x => x.gata));
  const pauza = () => new Promise(r => setTimeout(r, 300));
  const goleste = () => Object.values(L).forEach(x => { x.mesaje.length = 0; });
  const afla = () => Object.fromEntries(Object.entries(L).map(([k, x]) => [k, x.mesaje.some(m => m.includes('schimbare'))]));
  goleste(); await cer('ana', 'POST', `/api/comenzi/${idA}/fixare`, { fixat: false }); await cer('ana', 'POST', '/api/comenzi', oferta('Live Ana', 'L-1')); await pauza();
  let a = afla();
  verifica('schimbare în demo birou → ana şi adminul, nu bogdan', a.ana && a.admin && !a.bogdan, JSON.stringify(a));
  goleste(); await cer('admin', 'POST', '/api/comenzi', oferta('Live Admin', 'L-2')); await pauza();
  a = afla();
  verifica('schimbare în demo admin → doar adminul', !a.ana && a.admin && !a.bogdan, JSON.stringify(a));
  goleste(); await cer('bogdan', 'POST', '/api/comenzi', oferta('Live Real', 'L-3')); await pauza();
  a = afla();
  verifica('schimbare pe bune → toţi', a.ana && a.admin && a.bogdan, JSON.stringify(a));
  Object.values(L).forEach(x => x.ws.close());

  // ── 5. Repornirea serverului ──
  console.log('\nRepornire');
  await laZi();
  const inainte = { real: instantaneu(DB), birou: instantaneu(BIROU), admin: instantaneu(ADMIN) };
  await opreste();
  await porneste();
  for (const u of ['admin', 'ana', 'bogdan', 'cora']) if ((await cer(u, 'GET', '/api/eu')).stare !== 200) await login(u);
  verifica('după repornire nimic pierdut / schimbat (real, demo birou, demo admin)',
    !schimbate(inainte.real, instantaneu(DB)).length && !schimbate(inainte.birou, instantaneu(BIROU)).length && !schimbate(inainte.admin, instantaneu(ADMIN)).length);
  verifica('după repornire: ana îşi vede oferta, adminul pe a lui, bogdan nimic', !!(await gaseste('ana', idA)) && !!(await gaseste('admin', idAd)) && !(await gaseste('bogdan', idA)));
  const idR5 = await comanda('bogdan', 'Real Cinci', 'R-5');
  await cer('ana', 'PUT', `/api/comenzi/${idA}`, oferta('Ana după repornire', 'D-1'));
  verifica('după repornire lanţul merge: real → ana + admin, ana → admin',
    !!(await gaseste('ana', idR5)) && !!(await gaseste('admin', idR5)) && (await gaseste('admin', idA))?.client_nume === 'Ana după repornire');

  // ── 6. Resetările ──
  console.log('\nResetări');
  const continut = (f, t) => rand(f, `SELECT * FROM "${t}" ORDER BY rowid`);
  const TABELE = ['comanda', 'pozitie', 'pozitie_linie', 'livrare', 'livrare_comanda', 'cerere', 'task'];
  const egale = (f1, f2) => TABELE.every(t => JSON.stringify(continut(f1, t)) === JSON.stringify(continut(f2, t)));
  await actiune('„Resetează demo admin"', () => cer('admin', 'POST', '/api/test/reface', { copie: 'admin' }), { birou: NIMIC, admin: [...C, 'utilizator'] });
  verifica('demo admin = exact demo birou', egale(ADMIN, BIROU));
  verifica('admin: oferta lui a dispărut, a anei e acolo', !(await gaseste('admin', idAd)) && !!(await gaseste('admin', idA)));
  await cer('admin', 'POST', '/api/comenzi', oferta('Admin înainte de reset', 'AD-9'));
  await actiune('„Resetează demo birou"', () => cer('admin', 'POST', '/api/test/reface', { copie: 'colegi' }),
    { birou: [...C, 'utilizator'], admin: [...C, 'utilizator'] });
  verifica('demo birou = exact baza reală', egale(BIROU, DB));
  verifica('… şi demo admin (făcut din demo birou) = baza reală', egale(ADMIN, DB));
  verifica('ana şi adminul: nimic DEMO după reset', !(await lista('ana')).some(c => c.demo) && !(await lista('admin')).some(c => c.demo));
  const idR6 = await comanda('bogdan', 'Real Şase', 'R-6');
  await cer('ana', 'POST', '/api/comenzi', oferta('Ana după reset', 'D-9'));
  const peAna = (await lista('admin')).filter(c => c.client_nume === 'Ana după reset');
  verifica('după resetări lanţul merge mai departe (real → ana + admin, ana → admin, numerele nu se bat)',
    !!(await gaseste('ana', idR6)) && !!(await gaseste('admin', idR6)) && peAna.length === 1 && peAna[0].demo === true, JSON.stringify(peAna));
  const ad2 = (await cer('admin', 'POST', '/api/comenzi', oferta('Admin după reset', 'AD-10'))).date.comanda;
  verifica('… şi adminul face din nou oferte în demo-ul lui (9501+), fără să ajungă la ana',
    +ad2.numar.slice(-4) > 9500 && !(await gaseste('ana', ad2.id)));
  await laZi();
  verifica('după resetări: cererea aprobată de admin rămâne aprobată, nu reapare', !(await cer('admin', 'GET', '/api/cereri')).date.cereri.some(x => x.comanda_id === idR7 && x.stare === 'deschisa')
    && rand(ADMIN, `SELECT anulat FROM comanda WHERE id = ${idR7}`)[0]?.anulat === 1);
  verifica('resetarea nu se poate cere decât de admin', (await cer('bogdan', 'POST', '/api/test/reface', { copie: 'colegi' })).stare === 403
    && (await cer('ana', 'POST', '/api/test/reface', { copie: 'colegi' })).stare === 403);

  // ── 7. Update cu migraţie: copiile vechi se refac singure, baza reală neatinsă ──
  console.log('\nUpdate cu migraţie (copii cu altă versiune de schemă)');
  await laZi();
  const realInainte = instantaneu(DB);
  await opreste();
  for (const f of [BIROU, ADMIN]) { const d = new DatabaseSync(f); d.exec('PRAGMA user_version = 1'); d.close(); }
  await porneste();
  for (const u of ['admin', 'ana', 'bogdan', 'cora']) if ((await cer(u, 'GET', '/api/eu')).stare !== 200) await login(u);
  verifica('serverul porneşte, copiile refăcute (la zi cu baza reală), baza reală neatinsă',
    !schimbate(realInainte, instantaneu(DB)).length && egale(BIROU, DB), proces.jurnal.slice(-400));
  verifica('după refacere: ana şi adminul văd comenzile reale, fără DEMO', !!(await gaseste('ana', idR6)) && !!(await gaseste('admin', idR6))
    && !(await lista('ana')).some(c => c.demo) && !(await lista('admin')).some(c => c.demo));

  await opreste();
  fs.rmSync(TEMP, { recursive: true, force: true });
  console.log(`\n${treceri} trecute, ${caderi} căzute`);
  process.exit(caderi ? 1 : 0);
}

main().catch(async e => {
  console.error(e);
  if (proces) { console.error(proces.jurnal.slice(-2000)); proces.kill('SIGKILL'); }
  process.exit(1);
});
