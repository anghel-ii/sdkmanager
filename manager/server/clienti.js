const { db, tranzactie } = require('./db.js');
const { json, eroare, corpJson } = require('./http.js');
const { anunta } = require('./evenimente.js');
const { config } = require('./config.js');

// ═══════════════════════════════════════════════════════════════════════════
//  BAZA DE CLIENŢI — originalul e pe Cloudflare (clienti-agenti/, D1): agenţii
//  de vânzări intră cu user + parolă, îşi modifică clienţii şi adaugă alţii.
//  Aici e o COPIE, doar de citit. Serverul din firmă nu primeşte nimic din
//  internet: el TRAGE tot ce s-a schimbat (GET ?dupa=<cea mai mare versiune
//  de aici>) la pornire, la fiecare 5 minute şi la butonul „Preia acum".
//  Oprit cât lipseşte cheia (se lipeşte o dată în /admin; sau MANAGER_CLIENTI_CHEIE).
// ═══════════════════════════════════════════════════════════════════════════

// coloanele din Excel-ul de clienţi (+ agent) — aceleaşi pe Cloudflare
const CAMPURI = ['agent', 'nume', 'cui', 'judet', 'localitate', 'adresa_sediu', 'adresa_livrare', 'administrator',
  'telefon_administrator', 'email', 'delegat', 'telefon_delegat', 'discounturi', 'creat_la', 'modificat_la', 'versiune'];

// cheia managerului: din mediu, altfel cea lipită în /admin
const cheie = () => config.clientiCheie
  || db().prepare("SELECT valoare FROM setare WHERE cheie = 'clienti_cheie'").get()?.valoare || '';
const activ = () => !!(config.clientiUrl && cheie());

let ultimaPreluare = null;   // { la, noi } sau { la, eroare } — pt. pagina /clienti

async function preia() {
  if (!activ()) return 0;
  let noi = 0;   // adăugaţi sau modificaţi
  try {
    for (;;) {   // câte 500 pe cerere (limita de acolo), până nu mai vin
      const dupa = db().prepare('SELECT COALESCE(MAX(versiune), 0) AS m FROM client').get().m;
      const r = await fetch(`${config.clientiUrl}/api/clienti?dupa=${dupa}`, {
        headers: { Authorization: `Bearer ${cheie()}` }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`răspuns ${r.status}`);
      const { clienti } = await r.json();
      if (!clienti.length) break;
      const pune = db().prepare(`INSERT INTO client (extern_id, ${CAMPURI.join(', ')})
        VALUES (?${', ?'.repeat(CAMPURI.length)})
        ON CONFLICT(extern_id) DO UPDATE SET ${CAMPURI.map(k => `${k} = excluded.${k}`).join(', ')}`);
      tranzactie(() => { for (const c of clienti) pune.run(c.id, ...CAMPURI.map(k => c[k] ?? null)); });
      noi += clienti.length;
    }
    ultimaPreluare = { la: new Date().toISOString(), noi };
  } catch (e) {
    ultimaPreluare = { la: new Date().toISOString(), eroare: e.message };
    console.error('Preluare clienţi eşuată:', e.message);
  }
  if (noi) anunta();
  return noi;
}

// porneşte oricum: cheia poate fi lipită mai târziu în /admin (preia() nu face nimic fără ea)
function porneste() {
  preia();
  setInterval(preia, 5 * 60 * 1000).unref();
}

const lista = ({ res }) => json(res, 200, {
  activ: activ(), ultimaPreluare,
  clienti: db().prepare('SELECT * FROM client ORDER BY modificat_la IS NULL, modificat_la DESC, nume').all(),
});

async function preiaAcum({ res }) {
  if (!activ()) return eroare(res, 409, 'Legătura cu Cloudflare nu e configurată — lipeşte cheia în /admin.');
  const noi = await preia();
  if (ultimaPreluare?.eroare) return eroare(res, 502, `Nu s-a putut prelua: ${ultimaPreluare.eroare}`);
  json(res, 200, { noi });
}

// Conturile agenţilor stau pe Cloudflare (clienti-agenti/functions/api/agenti.js);
// pagina /admin le vede şi le administrează prin serverul ăsta, cu cheia
// managerului. Nimic nu se ţine aici — parola nouă trece doar în răspuns.
const laCloudflare = cale => async function ({ req, res }) {
  if (!activ()) return req.method === 'GET' ? json(res, 200, { activ: false, agenti: [], faraCont: [] })
    : eroare(res, 409, 'Legătura cu Cloudflare nu e configurată.');
  const corp = req.method === 'GET' ? undefined : JSON.stringify(await corpJson(req));
  let r;
  try {
    r = await fetch(`${config.clientiUrl}${cale}`, { method: req.method, body: corp,
      headers: { Authorization: `Bearer ${cheie()}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000) });
  } catch (e) {
    return eroare(res, 502, `Cloudflare nu răspunde: ${e.message}`);
  }
  const date = await r.json().catch(() => ({}));
  if (r.status === 401) return eroare(res, 502, 'Cloudflare a refuzat cheia managerului.');
  json(res, r.status, r.ok && req.method === 'GET' ? { activ: true, ...date } : date);
};
const agenti = laCloudflare('/api/agenti');
// „Intră ca acest agent": link de o folosinţă (60 s) spre site-ul agenţilor
const intraCaAgent = laCloudflare('/api/agenti/intra');

// /admin: lipeşte cheia — se încearcă întâi pe Cloudflare, se salvează doar dacă merge;
// nu se trimite niciodată înapoi spre browser
async function puneCheie({ req, res }) {
  const noua = String((await corpJson(req)).cheie ?? '').trim();
  if (!noua) return eroare(res, 400, 'Lipeşte cheia.');
  let r;
  try {
    r = await fetch(`${config.clientiUrl}/api/agenti`, { headers: { Authorization: `Bearer ${noua}` },
      signal: AbortSignal.timeout(15000) });
  } catch (e) {
    return eroare(res, 502, `Cloudflare nu răspunde: ${e.message}`);
  }
  if (r.status === 401) return eroare(res, 400, 'Cheie greşită — Cloudflare a refuzat-o.');
  if (!r.ok) return eroare(res, 502, `Cloudflare a răspuns ${r.status}.`);
  db().prepare(`INSERT INTO setare (cheie, valoare) VALUES ('clienti_cheie', ?)
    ON CONFLICT(cheie) DO UPDATE SET valoare = excluded.valoare`).run(noua);
  json(res, 200, { activ: activ() });
  preia();   // prima preluare imediat, nu peste 5 minute
}

module.exports = {
  preia, porneste,
  rute: [
    ['GET',  '/api/clienti',       { handler: lista }],
    ['POST', '/api/clienti/preia', { handler: preiaAcum }],
    ['PUT',   '/api/clienti/cheie', { handler: puneCheie, rol: 'admin' }],
    ['GET',   '/api/agenti',       { handler: agenti, rol: 'admin' }],
    ['POST',  '/api/agenti',       { handler: agenti, rol: 'admin' }],
    ['PATCH', '/api/agenti',       { handler: agenti, rol: 'admin' }],
    ['POST',  '/api/agenti/intra', { handler: intraCaAgent, rol: 'admin' }],
  ],
};
