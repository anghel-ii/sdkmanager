const path = require('node:path');
const fs   = require('node:fs');
const zlib = require('node:zlib');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { json, eroare, corpJson } = require('./http.js');
const { config } = require('./config.js');
const { db, backup } = require('./db.js');
const { acumMs } = require('./ora.js');

// ── Actualizarea aplicaţiei din pagina /admin ───────────────────────────────
// Pe serverul Windows, update-ul (deploy/windows/actualizeaza.ps1) are nevoie
// de drepturi de administrator. Instalarea înregistrează pentru el o sarcină
// programată separată, „SDK Actualizare", care rulează ca SYSTEM. Serverul
// (tot SYSTEM) doar o porneşte — deci adminul aplicaţiei poate face update din
// browser fără să fie administrator pe Windows. Sarcina e separată de
// „SDK Manager" ca să supravieţuiască opririi serverului în timpul update-ului.
//
// FĂRĂ drepturi de administrator (userul, 2026-10-08): când managerul rulează sub
// contul unui utilizator obişnuit (ex. pornit cu porneste-manager.vbs) nu poate citi
// cheia de deploy, deci nici git, nici sarcina SYSTEM. Atunci: CI pune după fiecare
// push pe main un pachet GATA CONSTRUIT în release-ul „ultima" de pe GitHub
// (deploy/pachet.mjs), iar serverul îl descarcă cu o cheie GitHub doar de citire,
// lipită o dată în /admin. Cu cheia pusă, butoanele din /admin merg pe drumul ăsta:
//   1. backup la bază + copie la codul de acum (<date>/update/inainte)
//   2. fişierele noi peste cod (manager/, configurator_usi/dist/, deploy/windows/) + VERSIUNE.json
//   3. deploy/windows/reporneste.js (proces separat) porneşte serverul nou după ce ăsta
//      se opreşte; dacă nu răspunde în 60 s, pune înapoi codul de dinainte.

const SARCINA = 'SDK Actualizare';
const COD = path.resolve(config.radacina, '..');                          // clona git
const DATE = path.dirname(config.db);
const JURNAL = path.join(DATE, 'actualizari.log');                         // scris de actualizeaza.ps1
const FISIER_VERSIUNE = path.join(COD, 'VERSIUNE.json');                   // scris de update-ul fără admin
// jurnalul update-ului fără admin — separat: transcriptul PowerShell de mai sus poate fi UTF-16
const JURNAL_FARA_ADMIN = path.join(DATE, 'update', 'jurnal.log');
const peWindows = process.platform === 'win32';

const ruleaza = async (exe, args) => (await promisify(execFile)(exe, args, { windowsHide: true })).stdout.trim();
const git = (...args) => ruleaza('git', ['-C', COD, ...args]);

const REPO = 'anghel-ii/sdkmanager';
const cheieGithub = () => db().prepare("SELECT valoare FROM setare WHERE cheie = 'github_cheie'").get()?.valoare || '';
const SURSA_LOCALA = process.env.MANAGER_PACHET_URL;   // probă / teste: pachetul de la o adresă locală, fără GitHub
const faraAdmin = () => !!(SURSA_LOCALA || cheieGithub());
let inCurs = false;

async function sarcinaRuleaza() {
  if (!peWindows) return false;
  // /fo csv: "TaskName","Next Run Time","Status" — Status e tradus pe Windows în altă limbă,
  // deci ne uităm doar după „Running" / „În execuţie"
  const csv = await ruleaza('schtasks', ['/query', '/tn', SARCINA, '/fo', 'csv', '/nh']).catch(() => '');
  return /running|execu/i.test(csv);
}

// Coada jurnalului. PowerShell 5.1 poate scrie transcriptul în UTF-16.
function coadaJurnal(fisier, linii = 60) {
  let buf;
  try { buf = fs.readFileSync(fisier); } catch { return ''; }
  const text = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le') : buf.toString('utf8');
  return text.split(/\r?\n/).slice(-linii).join('\n');
}
function scrieJurnal(t) {
  fs.mkdirSync(path.dirname(JURNAL_FARA_ADMIN), { recursive: true });
  fs.appendFileSync(JURNAL_FARA_ADMIN, `${new Date(acumMs()).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' })}  ${t}\n`);
}

// Versiunea care rulează: VERSIUNE.json (după un update fără admin), altfel git.
async function versiuneLocala() {
  try { return JSON.parse(fs.readFileSync(FISIER_VERSIUNE, 'utf8')); } catch { /* n-a fost update fără admin */ }
  const [sha, mesaj, data] = (await git('log', '-1', '--format=%H%n%s%n%cd', '--date=format:%d.%m.%Y %H:%M').catch(() => '')).split('\n');
  return sha ? { sha, scurt: sha.slice(0, 7), mesaj, data } : null;
}
const textVersiune = v => (v ? `${v.scurt} — ${v.mesaj} (${v.data})` : '');

// Un fişier din release-ul „ultima" (versiune.json / sdk.json.gz).
const antet = cheie => ({ Authorization: `Bearer ${cheie}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'sdk-manager' });
async function descarca(nume, cheie = cheieGithub()) {
  if (SURSA_LOCALA) {
    const r = await fetch(`${SURSA_LOCALA}/${nume}`);
    if (!r.ok) throw new Error(`${nume}: ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
  const gh = (url, accept) => fetch(url, { redirect: 'manual', headers: { ...antet(cheie), Accept: accept }, signal: AbortSignal.timeout(60000) });
  const rel = await gh(`https://api.github.com/repos/${REPO}/releases/tags/ultima`, 'application/vnd.github+json');
  if (rel.status === 401 || rel.status === 403) throw new Error('GitHub refuză cheia (greşită sau expirată).');
  if (rel.status === 404) throw new Error('Nu găsesc pachetul pe GitHub — fie cheia n-are acces la repository, fie nu s-a făcut încă (apare după primul push pe main).');
  if (!rel.ok) throw new Error(`GitHub a răspuns ${rel.status}.`);
  const fisier = (await rel.json()).assets?.find(a => a.name === nume);
  if (!fisier) throw new Error(`Pachetul „${nume}" nu e încă pe GitHub.`);
  let r = await gh(fisier.url, 'application/octet-stream');
  // GitHub dă fişierul de pe alt domeniu, printr-un link semnat — acolo fără cheie
  if (r.status >= 300 && r.status < 400) r = await fetch(r.headers.get('location'), { signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error(`Descărcarea „${nume}" a eşuat (${r.status}).`);
  return Buffer.from(await r.arrayBuffer());
}

// Commit-urile dintre versiunea care rulează şi cea nouă (cele mai noi întâi).
async function commituri(dela, nou) {
  const unu = [`${nou.scurt} — ${nou.mesaj}`];
  if (!dela || SURSA_LOCALA) return unu;
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/compare/${dela}...${nou.sha}`,
      { headers: { ...antet(cheieGithub()), Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(30000) });
    const c = r.ok ? (await r.json()).commits ?? [] : [];
    return c.length ? c.reverse().map(x => `${x.sha.slice(0, 7)} — ${x.commit.message.split('\n')[0]}`) : unu;
  } catch { return unu; }
}

async function dateStare() {
  const fara = faraAdmin();
  return {
    disponibil: fara || peWindows,
    mod: fara ? 'cheie' : 'sarcina',
    areCheie: !!cheieGithub(),
    versiune: textVersiune(await versiuneLocala()),
    ruleaza: fara ? inCurs : await sarcinaRuleaza(),
    jurnal: coadaJurnal(fara ? JURNAL_FARA_ADMIN : JURNAL),
  };
}
const stare = async ctx => json(ctx.res, 200, await dateStare());

// Ce e nou pe GitHub faţă de versiunea care rulează → listă de commituri (aruncă dacă nu se poate).
async function noutati() {
  try {
    if (!faraAdmin()) {
      await git('fetch', '--quiet', 'origin', 'main');
      const log = await git('log', '--format=%h — %s', 'HEAD..origin/main');
      return log ? log.split('\n') : [];
    }
    const nou = JSON.parse(await descarca('versiune.json'));
    const local = await versiuneLocala();
    return local?.sha === nou.sha ? [] : await commituri(local?.sha, nou);
  } catch (e) {
    throw new Error(`Nu am putut întreba GitHub: ${e.message}${faraAdmin() ? ''
      : ' — dacă managerul nu rulează ca administrator, pune în /admin cheia GitHub (doar citire).'}`);
  }
}
async function verifica(ctx) {
  try { json(ctx.res, 200, { noutati: await noutati() }); } catch (e) { eroare(ctx.res, 502, e.message); }
}

// ── Update fără admin: pachetul de pe GitHub peste codul de acum ─────────────
const PARTI = ['manager', 'configurator_usi/dist', 'deploy/windows'];
const NU_E_COD = new Set(['date', 'certs', 'node_modules']);   // manager/date (baza, la instalări vechi) etc. — nu se copiază
async function aplicaPachet() {
  scrieJurnal('=== Update din /admin (fără drepturi de administrator pe Windows) ===');
  scrieJurnal('Descarc pachetul de pe GitHub…');
  const p = JSON.parse(zlib.gunzipSync(await descarca('sdk.json.gz')).toString('utf8'));
  const fisiere = Object.entries(p.fisiere ?? {});
  if (!fisiere.length || !fisiere.every(([f]) => PARTI.some(x => f.startsWith(x + '/')) && !f.split('/').includes('..')))
    throw new Error('pachetul are căi neaşteptate — nu îl aplic.');
  scrieJurnal(`Versiunea nouă: ${textVersiune(p.versiune)} — ${fisiere.length} fişiere`);
  scrieJurnal(`Backup la bază: ${backup()}`);

  const inainte = path.join(DATE, 'update', 'inainte');
  fs.rmSync(inainte, { recursive: true, force: true });
  for (const x of PARTI) {
    const sursa = path.join(COD, x);
    if (fs.existsSync(sursa)) fs.cpSync(sursa, path.join(inainte, x), { recursive: true, filter: s => !NU_E_COD.has(path.basename(s)) });
  }
  if (fs.existsSync(FISIER_VERSIUNE)) fs.copyFileSync(FISIER_VERSIUNE, path.join(inainte, 'VERSIUNE.json'));
  scrieJurnal(`Copia codului de acum: ${inainte}`);

  try {
    for (const [f, b64] of fisiere) {
      const dest = path.join(COD, f);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(b64, 'base64'));
    }
    fs.writeFileSync(FISIER_VERSIUNE, JSON.stringify(p.versiune));
  } catch (e) {
    // scrierea s-a oprit la jumătate — înapoi codul de dinainte, serverul rămâne pornit pe el
    fs.rmSync(FISIER_VERSIUNE, { force: true });
    fs.cpSync(inainte, COD, { recursive: true, force: true });
    throw e;
  }
  scrieJurnal('Fişierele noi sunt la locul lor. Repornesc serverul…');

  // repornirea — proces separat, care trăieşte după ce ăsta se opreşte
  spawn(process.execPath, [path.join(COD, 'deploy', 'windows', 'reporneste.js')], {
    detached: true, stdio: 'ignore', windowsHide: true,
    env: { ...process.env, SDK_COD: COD, SDK_INAINTE: inainte, SDK_JURNAL: JURNAL_FARA_ADMIN, SDK_LOG: path.join(DATE, 'server.log'),
      SDK_URL: `${config.https ? 'https' : 'http'}://127.0.0.1:${config.port}/login` },
  }).unref();
  setTimeout(() => process.emit('SIGTERM'), 500);   // oprirea curată din index.js (închide baza)
}

// Porneşte update-ul (din /admin sau de pe pagina de pe Cloudflare); aruncă { cod, message } dacă nu se poate.
const nuSePoate = (cod, mesaj) => Object.assign(new Error(mesaj), { cod });
async function pornesteUpdate() {
  if (faraAdmin()) {
    if (inCurs) throw nuSePoate(409, 'O actualizare e deja în curs.');
    inCurs = true;
    aplicaPachet().catch(e => { scrieJurnal(`UPDATE-UL S-A OPRIT: ${e.message} Serverul a rămas pe versiunea de acum.`); inCurs = false; });
    return;
  }
  if (!peWindows) throw nuSePoate(400, 'Actualizarea din pagină merge doar pe serverul Windows.');
  if (await sarcinaRuleaza()) throw nuSePoate(409, 'O actualizare e deja în curs.');
  try {
    await ruleaza('schtasks', ['/run', '/tn', SARCINA]);
  } catch (e) {
    throw nuSePoate(500, `Nu am putut porni sarcina „${SARCINA}" (rulează din nou instalarea): ${e.message}`);
  }
}
async function porneste(ctx) {
  try { await pornesteUpdate(); json(ctx.res, 202, { ok: true }); } catch (e) { eroare(ctx.res, e.cod ?? 500, e.message); }
}

// ── Update şi când nu eşti la firmă (userul, 2026-10-08) ─────────────────────
// Serverul nu primeşte nimic din internet, deci pagina /admin de pe Cloudflare
// (clienti-agenti, functions/api/server) nu-l poate chema. El întreabă: la 20 s
// trimite acolo starea (versiunea, jurnalul, noutăţile) cu cheia managerului şi
// primeşte înapoi ce s-a cerut de pe pagină — „verifica" sau „actualizeaza".
let laDistanta = { noutati: null, eroare: null, la: null };   // rezultatul ultimei cereri de pe pagină
async function raporteaza() {
  const { laCF, activ } = require('./clienti.js');
  if (!activ()) return;
  const trimite = async () => laCF('POST', '/api/server', JSON.stringify({ ...(await dateStare()), ...laDistanta }));
  const r = await trimite();
  const cerere = r.stare === 200 ? r.date?.cerere : null;
  if (!cerere) return;
  laDistanta = { noutati: null, eroare: null, la: new Date(acumMs()).toISOString() };
  try {
    if (cerere === 'verifica') laDistanta.noutati = await noutati();
    else if (cerere === 'actualizeaza') { await pornesteUpdate(); if (faraAdmin()) scrieJurnal('(pornit de pe pagina de pe Cloudflare)'); }
  } catch (e) { laDistanta.eroare = e.message; }
  await trimite();   // rezultatul pe pagină imediat, nu peste 20 s
}
function pornesteRaportarea() {
  const tura = () => raporteaza().catch(e => console.error('Raportarea spre Cloudflare:', e.message));
  tura();
  setInterval(tura, 20 * 1000).unref();
}

// Cheia GitHub (fine-grained, doar citire, doar repository-ul ăsta) — se verifică
// pe loc; goală = se şterge (înapoi la update-ul cu sarcina SYSTEM).
async function puneCheie(ctx) {
  const cheie = String((await corpJson(ctx.req)).cheie ?? '').trim();
  if (!cheie) {
    db().prepare("DELETE FROM setare WHERE cheie = 'github_cheie'").run();
    return json(ctx.res, 200, { areCheie: false });
  }
  try { await descarca('versiune.json', cheie); } catch (e) { return eroare(ctx.res, 400, e.message); }
  db().prepare(`INSERT INTO setare (cheie, valoare) VALUES ('github_cheie', ?)
    ON CONFLICT(cheie) DO UPDATE SET valoare = excluded.valoare`).run(cheie);
  json(ctx.res, 200, { areCheie: true });
}

module.exports = {
  raporteaza, pornesteRaportarea,
  rute: [
    ['GET',  '/api/actualizare',          { rol: 'admin', handler: stare }],
    ['POST', '/api/actualizare/verifica', { rol: 'admin', handler: verifica }],
    ['POST', '/api/actualizare',          { rol: 'admin', handler: porneste }],
    ['PUT',  '/api/actualizare/cheie',    { rol: 'admin', handler: puneCheie }],
  ],
};
