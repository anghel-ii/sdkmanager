const { db, tranzactie, faraDiacritice } = require('./db.js');
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
//  Conducerea modifică / şterge clienţi din pagina Clienţi: cererea merge la
//  Cloudflare şi se preia imediat înapoi (userul, 2026-10-27). Cei şterşi rămân
//  aici cu sters_la (vin aşa de acolo) şi nu se mai arată nicăieri.
// ═══════════════════════════════════════════════════════════════════════════

// coloanele din Excel-ul de clienţi (+ agent) — aceleaşi pe Cloudflare
const CAMPURI = ['agent', 'nume', 'cui', 'judet', 'localitate', 'adresa_sediu', 'adresa_livrare', 'administrator',
  'telefon_administrator', 'email', 'delegat', 'telefon_delegat', 'discounturi', 'creat_la', 'modificat_la', 'versiune', 'sters_la'];

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
    ultimaPreluare = { la: new Date(require('./ora.js').acumMs()).toISOString(), noi };
  } catch (e) {
    ultimaPreluare = { la: new Date(require('./ora.js').acumMs()).toISOString(), eroare: e.message };
    console.error('Preluare clienţi eşuată:', e.message);
  }
  if (noi) anunta();
  return noi;
}

// porneşte oricum: cheia poate fi lipită mai târziu în /admin (preia() nu face nimic fără ea)
function porneste() {
  preia();
  setInterval(preia, 5 * 60 * 1000).unref();
  // propunerile agenţilor — pentru insigna de pe butonul „Clienţi" (din minut în minut)
  reimprospateazaPropuneri();
  setInterval(reimprospateazaPropuneri, 60 * 1000).unref();
}

const lista = ({ res }) => json(res, 200, {
  activ: activ(), ultimaPreluare,
  clienti: db().prepare('SELECT * FROM client WHERE sters_la IS NULL ORDER BY modificat_la IS NULL, modificat_la DESC, nume').all(),
});

// Configuratorul: sugestii pt. câmpul „Nume client" (doar propune — se vinde şi
// celor care nu sunt în bază). Numele care ÎNCEP cu textul vin primele. Fără
// diacritice şi majuscule (fara_diacritice din db.js — userul, 2026-10-26).
function cauta({ req, res }) {
  const q = (new URL(req.url, 'http://x').searchParams.get('q') ?? '').trim();
  if (q.length < 2) return json(res, 200, { clienti: [] });
  const text = faraDiacritice(q).replace(/[\\%_]/g, '\\$&');   // % şi _ tastate se caută ca atare
  json(res, 200, { clienti: db().prepare(`
    SELECT nume, cui, agent, judet, localitate, adresa_sediu, adresa_livrare, telefon_administrator, telefon_delegat
      FROM client WHERE sters_la IS NULL AND fara_diacritice(nume) LIKE ? ESCAPE '\\'
     ORDER BY fara_diacritice(nume) NOT LIKE ? ESCAPE '\\', nume LIMIT 20`).all(`%${text}%`, `${text}%`) });
}

async function preiaAcum({ res }) {
  if (!activ()) return eroare(res, 409, 'Legătura cu Cloudflare nu e configurată — lipeşte cheia în /admin.');
  const noi = await preia();
  if (ultimaPreluare?.eroare) return eroare(res, 502, `Nu s-a putut prelua: ${ultimaPreluare.eroare}`);
  json(res, 200, { noi });
}

// Conturile agenţilor stau pe Cloudflare (clienti-agenti/functions/api/agenti.js);
// pagina /admin le vede şi le administrează prin serverul ăsta, cu cheia
// managerului. Nimic nu se ţine aici — parola nouă trece doar în răspuns.
// O cerere la Cloudflare cu cheia managerului → { stare, date } sau { eroare: [cod, mesaj] }.
async function laCF(metoda, cale, corp) {
  let r;
  try {
    r = await fetch(`${config.clientiUrl}${cale}`, { method: metoda, body: corp,
      headers: { Authorization: `Bearer ${cheie()}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000) });
  } catch (e) {
    return { eroare: [502, `Cloudflare nu răspunde: ${e.message}`] };
  }
  const date = await r.json().catch(() => ({}));
  if (r.status === 401) return { eroare: [502, 'Cloudflare a refuzat cheia managerului.'] };
  return { stare: r.status, date };
}

// ruta de aici → aceeaşi cerere acolo; `inactiv` = răspunsul la GET fără legătură
const laCloudflare = (cale, inactiv = { agenti: [], faraCont: [] }) => async function ({ req, res }) {
  if (!activ()) return req.method === 'GET' ? json(res, 200, { activ: false, ...inactiv })
    : eroare(res, 409, 'Legătura cu Cloudflare nu e configurată.');
  const r = await laCF(req.method, cale, req.method === 'GET' ? undefined : JSON.stringify(await corpJson(req)));
  if (r.eroare) return eroare(res, ...r.eroare);
  json(res, r.stare, r.stare < 300 && req.method === 'GET' ? { activ: true, ...r.date } : r.date);
};
const agenti = laCloudflare('/api/agenti');

// Clienţii noi / modificările agenţilor aşteaptă APROBAREA de aici (userul, 2026-10-01):
// pe Cloudflare stau ca propuneri şi abia aprobarea le scrie în baza de clienţi (de
// unde le preia copia de aici). Lista o vede oricine; aprobă conducerea sau adminul.
const APROBA = ['admin', 'conducere'];
// Pagina Clienţi (lista, preluarea, propunerile) — nu şi biroul (userul, 2026-10-02).
// Sugestiile din configurator (/api/clienti/cauta) rămân pt. toţi: biroul face oferte.
const CLIENTI = ['admin', 'conducere'];
// Ultima listă citită de pe Cloudflare: o reîmprospătează serverul din minut în minut
// (nu fiecare pagină deschisă) şi anunţă paginile când se schimbă numărul — insigna de
// pe „Clienţi" (în /api/sumar) şi secţiunea „De aprobat" se actualizează singure.
let deAprobat = { propuneri: [], la: 0 };
async function reimprospateazaPropuneri() {
  if (!activ()) return;
  const r = await laCF('GET', '/api/propuneri');
  if (r.eroare || r.stare !== 200) return;   // rămâne lista de dinainte
  const cheieLista = l => l.map(p => `${p.id}:${p.trimis_la}`).join();
  const inainte = cheieLista(deAprobat.propuneri);
  deAprobat = { propuneri: r.date.propuneri ?? [], la: Date.now() };
  if (cheieLista(deAprobat.propuneri) !== inainte) anunta();   // s-a schimbat ceva → paginile se reîmprospătează
}
const nrDeAprobat = () => (activ() ? deAprobat.propuneri.length : 0);
// pagina „Clienţi": lista de acum (citită din nou dacă e mai veche de 15 s)
async function propuneri({ res }) {
  if (!activ()) return json(res, 200, { activ: false, propuneri: [] });
  if (Date.now() - deAprobat.la > 15 * 1000) await reimprospateazaPropuneri();
  json(res, 200, { activ: true, propuneri: deAprobat.propuneri });
}
async function decide({ res, params }) {
  if (!['aproba', 'respinge'].includes(params.actiune)) return eroare(res, 404, 'Acţiune necunoscută.');
  if (!activ()) return eroare(res, 409, 'Legătura cu Cloudflare nu e configurată.');
  const r = await laCF('POST', `/api/propuneri/${encodeURIComponent(params.id)}/${params.actiune}`);
  if (r.eroare) return eroare(res, ...r.eroare);
  if (r.stare === 200 && params.actiune === 'aproba') await preia();   // intră imediat şi în copia de aici
  await reimprospateazaPropuneri();   // insigna scade la toţi
  json(res, r.stare, r.date);
}
// Conducerea modifică (direct, fără aprobare) sau şterge un client — :id = id-ul de pe
// Cloudflare (extern_id). Copia de aici se ia de acolo imediat după, ca la aprobare.
async function modificaSauSterge({ req, res, params }) {
  if (!/^\d+$/.test(params.id)) return eroare(res, 404, 'Client necunoscut.');
  if (!activ()) return eroare(res, 409, 'Legătura cu Cloudflare nu e configurată.');
  const r = await laCF(req.method, `/api/clienti/${params.id}`, req.method === 'PUT' ? JSON.stringify(await corpJson(req)) : undefined);
  if (r.eroare) return eroare(res, ...r.eroare);
  if (r.stare === 200) await preia();
  json(res, r.stare, r.date);
}

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
  preia, porneste, nrDeAprobat, laCF, activ, cheie,
  rute: [
    ['GET',  '/api/clienti',       { handler: lista, rol: CLIENTI }],
    ['GET',  '/api/clienti/cauta', { handler: cauta }],
    ['POST', '/api/clienti/preia', { handler: preiaAcum, rol: CLIENTI }],
    ['GET',  '/api/clienti/propuneri', { handler: propuneri, rol: CLIENTI }],
    ['POST', '/api/clienti/propuneri/:id/:actiune', { handler: decide, rol: APROBA }],
    ['PUT',   '/api/clienti/cheie', { handler: puneCheie, rol: 'admin' }],
    ['PUT',    '/api/clienti/:id',  { handler: modificaSauSterge, rol: APROBA }],
    ['DELETE', '/api/clienti/:id',  { handler: modificaSauSterge, rol: APROBA }],
    ['GET',   '/api/agenti',       { handler: agenti, rol: 'admin' }],
    ['POST',  '/api/agenti',       { handler: agenti, rol: 'admin' }],
    ['PATCH', '/api/agenti',       { handler: agenti, rol: 'admin' }],
    ['POST',  '/api/agenti/intra', { handler: intraCaAgent, rol: 'admin' }],
  ],
};
