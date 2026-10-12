const { db, tranzactie, ACUM } = require('./db.js');
const { json, eroare, corpJson } = require('./http.js');
const { anunta } = require('./evenimente.js');
const { config } = require('./config.js');
const { acumSql } = require('./ora.js');
const { judetDin, JUDETE, normal } = require('./livrari.js');

// ═══════════════════════════════════════════════════════════════════════════
//  AWB-URI FAN COURIER (userul, 2026-10-12) — din pagina unei comenzi cu curier
//  se generează AWB-ul la FAN (API selfAWB v2), se printează eticheta şi se
//  urmăreşte livrarea (din oră în oră). Contul FAN (user, parolă, clientId) se
//  pune o dată în /admin, în tabelul `setare`; parola nu pleacă spre browser.
//  Adresa: MANAGER_FAN_URL (config.fanUrl), ca testele să folosească un FAN fals.
//
//  Ce NU scrie în documentaţie (RO_FANCourier_API-2.0-100523.pdf) — verificat pe
//  contul de test din ea (clienttest / testing, clientId 7032158), 2026-10-12:
//
//  POST /login — username + password merg şi în corp JSON (nu doar în URL)
//    200 {status:'success', data:{token:'…', expiresAt:'2026-10-13 14:29:28'}}   (nu {token})
//    401 {status:'error', message:'These credentials do not match our records.'}
//  Fără token / token greşit, pe orice rută cu cont → 401 {message:'These credentials …'}
//  POST /intern-awb → MEREU 200, câte un element pe expediţie:
//    bun:    {response:[{awbNumber:7000172683355 (număr!), tariff:60.88, vat:12.78, packages:2,
//             weight:8, office:'Pascani', trackingUrl:'…', barcodes:['…'], errors:null}]}
//    greşit: {response:[{awbNumber:null, success:false, errors:{locality:['Locality is invalid']}}]}
//            errors:{'info.weight':['The info.weight must be at least 0.0001.']}
//            errors:'An error occurred'   (text — ex. fără greutate)
//    `dimensions` şi `observation` NU sunt de fapt obligatorii (AWB generat fără ele); strada e text liber, dar
//    obligatorie: errors:{'recipient.address.street':['The recipient.address.street field is required.']}
//  GET /awb/label?clientId&awbs[]=…&pdf=1 → application/pdf (fără pdf=1: pagină HTML)
//    AWB străin → 422 {status:'fail', message:'The awbs must contain only valid awb numbers…',
//                      data:{errors:{awbs:['…']}}}
//  GET /reports/awb/tracking?clientId&awb[]=…&language=ro — parametrul e `awb[]` (awbs[] → 422)
//    → {status:'success', data:[{awbNumber:'…' (text), message:'AWB-ul a fost inregistrat de catre
//       clientul expeditor', serviceId:1, optionCodes:[]}]}; `events:[{id, name, location, date}]`
//       apar după primul eveniment (ca în documentaţie); AWB necunoscut → {awbNumber, message:
//       'AWB-ul nu a fost gasit.'}; ordinea din `data` nu e cea cerută.
//  DELETE /awb?clientId&awb= → 200 {status:'success', data:'The AWB was deleted successfully.'}
//    a doua oară → 422 {status:'fail', message:'The AWB was already deleted.', data:{errors:{awb:[…]}}}
//  GET /reports/counties → judeţele FĂRĂ diacritice ('Arges', 'Bistrita-Nasaud', 'Bucuresti')
//  GET /reports/localities?county= → data:[{id, name:'Bosteni (Pascani)', county, agency, …}]
//  GET /reports/branches → data:[{id (= un clientId al contului), name, address, …}]
//  Orele de la FAN (date, expiresAt) sunt ora României.
//
//  Ca pe site-ul FAN (userul, 2026-10-12): doar nr. de colete + greutatea totală, fără
//  dimensiuni (FAN le acceptă lipsă — vezi mai sus); transportul îl plătim noi (payment
//  'sender'); rambursul îl scrie omul, nu vine din comandă. FAN ridică zilnic, singur —
//  deci fără comenzi de curier (POST /order nu se cheamă niciodată). „Livrat" NU
//  finalizează comanda (la noi „finalizată" = gata de livrare / ridicare).
//  ponytail: viramentele ramburs (/reports/bank-transfers) nu sunt făcute — userul n-a
//  hotărât încă; locul lor e lângă urmareste() de mai jos.
// ═══════════════════════════════════════════════════════════════════════════

// Ce se poate alege (FANbox / PayPoint cer punct de ridicare, Export adresă din afară — nu).
// „Cont Colector" = ramburs încasat de curier şi virat în cont.
const SERVICII = ['Standard', 'Cont Colector', 'RedCode', 'Red code-Cont Colector', 'Transport Marfa', 'Transport Marfa-Cont Colector'];
const faraDiacritice = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const JUDETE_FAN = JUDETE.map(faraDiacritice);   // = lista de la /reports/counties

// ── Contul şi tokenul ────────────────────────────────────────────────────────

const setare = cheie => db().prepare('SELECT valoare FROM setare WHERE cheie = ?').get(cheie)?.valoare || '';
const clientId = () => setare('fan_client');
const activ = () => !!(setare('fan_user') && setare('fan_parola') && clientId());
const NECONFIGURAT = 'Legătura cu FAN Courier nu e configurată — administratorul o pune în pagina Utilizatori.';

// Ce a mers prost la FAN (refuz, nu răspunde) — mesajul ajunge în pagină, nu „Eroare internă".
const nuMerge = (cod, mesaj) => Object.assign(new Error(mesaj), { cod, fan: true });

async function cerere(cale, optiuni = {}) {
  try {
    return await fetch(config.fanUrl + cale, { ...optiuni, signal: AbortSignal.timeout(30000),
      headers: { Accept: 'application/json', ...(optiuni.body && { 'Content-Type': 'application/json' }), ...optiuni.headers } });
  } catch (e) {
    throw nuMerge(502, `FAN Courier nu răspunde (${e.cause?.code ?? e.message}).`);
  }
}

async function logheaza(user, parola) {
  const r = await cerere('/login', { method: 'POST', body: JSON.stringify({ username: user, password: parola }) });
  if (r.status === 401 || r.status === 422) throw nuMerge(400, 'FAN Courier a refuzat utilizatorul sau parola.');
  const token = (await r.json().catch(() => ({}))).data?.token;
  if (!r.ok || !token) throw nuMerge(502, `FAN Courier a răspuns ${r.status} la autentificare.`);
  return token;
}

// Tokenul ţine 24 h — îl folosim 23 h; un 401 (expirat mai devreme) = relogare şi încă o încercare.
let token = null;   // { valoare, la }
async function laFan(metoda, cale, corp) {
  if (!activ()) throw nuMerge(409, NECONFIGURAT);
  for (let incercare = 0; ; incercare++) {
    if (!token || Date.now() - token.la > 23 * 3600e3) token = { valoare: await logheaza(setare('fan_user'), setare('fan_parola')), la: Date.now() };
    const r = await cerere(cale, { method: metoda, body: corp && JSON.stringify(corp), headers: { Authorization: `Bearer ${token.valoare}` } });
    if (r.status !== 401 || incercare) return r;
    token = null;
  }
}

// Mesajul de eroare al FAN (formele de mai sus) → text pentru om
const CAMPURI = { locality: 'localitatea', county: 'judeţul', street: 'strada', streetNo: 'numărul', phone: 'telefonul',
  name: 'numele', email: 'e-mailul', zipCode: 'codul poştal', weight: 'greutatea', cod: 'rambursul', service: 'serviciul',
  parcel: 'coletele', payment: 'plata transportului', awb: 'AWB-ul', awbs: 'AWB-ul' };
const tradu = m => String(m)
  .replace(/^The [\w.]+ field is required\.?$/i, 'lipseşte')
  .replace(/^.*\bis invalid\.?$/i, 'valoare nerecunoscută de FAN')
  .replace(/^The [\w.]+ must be at least ([\d.]+)\.?$/i, 'trebuie să fie cel puţin $1')
  .replace(/^An error occurred\.?$/i, 'datele n-au putut fi procesate — verifică greutatea, judeţul şi localitatea');
function mesajFan(j, stare) {
  const e = j?.response?.[0]?.errors ?? j?.data?.errors ?? j?.message;
  if (typeof e === 'string') return tradu(e);
  if (e && typeof e === 'object') return Object.entries(e).map(([k, v]) =>
    `${CAMPURI[k.split('.').pop()] ?? k}: ${[].concat(v).map(tradu).join(' ')}`).join('; ');
  return `răspuns ${stare}`;
}

// ── Nomenclatorul de localităţi ──────────────────────────────────────────────
// Pe judeţ, o zi în memorie (o promisiune — două cereri deodată fac o singură
// cerere la FAN). O eroare nu se ţine minte: următoarea cerere încearcă iar.
const nomenclator = new Map();   // judeţ FAN → { la, lista }
function localitati(judet) {
  const c = nomenclator.get(judet);
  if (c && Date.now() - c.la < 24 * 3600e3) return c.lista;
  const lista = laFan('GET', `/reports/localities?county=${encodeURIComponent(judet)}`).then(async r => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !Array.isArray(j.data)) throw nuMerge(502, `Nomenclatorul FAN: ${mesajFan(j, r.status)}`);
    return j.data.map(l => l.name);
  });
  nomenclator.set(judet, { la: Date.now(), lista });
  lista.catch(() => nomenclator.delete(judet));
  return lista;
}

// Adresa liberă din comandă („Str. Lunga nr. 1, Paşcani, Iaşi") → localitatea din
// nomenclatorul FAN, strada, numărul, codul poştal. Doar o propunere: omul o vede
// şi o corectează în fereastra AWB-ului.
// ponytail: localitatea se caută doar ca segment întreg între virgule (aşa se scrie
// adresa în configurator); „Str. X 1 Pascani" fără virgule rămâne de ales de mână.
function adresaFan(adresa, judet, lista) {
  const n = t => normal(t).replace(/[^a-z0-9]+/g, ' ').trim();
  const segmente = String(adresa ?? '').split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
  const curat = segmente.map(s => n(s).replace(/^(jud(etul)?|mun(icipiul)?|oras(ul)?|com(una)?|sat(ul)?|loc(alitatea)?) /, ''));
  const nj = n(judet);
  // „Bosteni (Pascani)" → „bosteni"; la nume la fel, cea fără paranteză
  const dupaNume = new Map();
  for (const l of lista) { const b = n(l.replace(/\(.*\)/, '')); if (!dupaNume.has(b) || !l.includes('(')) dupaNume.set(b, l); }
  // de la coada adresei, un segment care e chiar o localitate; cel cu numele judeţului
  // doar dacă nu e altul (reşedinţa cu acelaşi nume: „Str. X 1, Iaşi")
  let k = -1;
  for (const siJudetul of [false, true]) {
    for (let i = curat.length - 1; i >= 0 && k < 0; i--) if (dupaNume.has(curat[i]) && (siJudetul || curat[i] !== nj)) k = i;
  }
  // „Sat Lunca, com. Pascani" → „Lunca (Pascani)": la FAN satele unei comune au comuna în paranteză
  const sat = k < 0 ? -1 : curat.findIndex((s, i) => i !== k && lista.some(l => n(l) === `${s} ${curat[k]}`));
  const localitate = sat >= 0 ? lista.find(l => n(l) === `${curat[sat]} ${curat[k]}`)
    : k >= 0 ? dupaNume.get(curat[k]) : lista.length === 1 ? lista[0] : '';   // Bucureşti: una singură
  const codPostal = segmente.find(s => /^\d{6}$/.test(s)) ?? '';
  const rest = segmente.filter((s, i) => i !== k && i !== sat && curat[i] !== nj && !/^jud/.test(n(s)) && n(s) !== 'romania' && s !== codPostal);
  // numărul: „nr. 5A" oriunde, altfel un număr la coada primului segment („Str. Fabricii 12")
  let strada = rest.join(', '), numar = '';
  const m = strada.match(/,?\s*\b(?:nr|numar|numarul|număr|numărul)\b\.?\s*:?\s*(\d+[a-z]?(?:\s*[-/]\s*\d+[a-z]?)?)\b/i)
    ?? (rest[0] ?? '').match(/\s(\d+[a-z]?)$/i);
  if (m) {
    numar = m[1].replace(/\s+/g, '');
    strada = `${strada.slice(0, m.index)} ${strada.slice(m.index + m[0].length)}`
      .replace(/\s+/g, ' ').replace(/ ,/g, ',').replace(/^[\s,]+|[\s,]+$/g, '');
  }
  // FAN cere strada; la sat fără străzi, satul („Sat Lunca")
  return { localitate, strada: strada || (sat >= 0 ? segmente[sat] : ''), numar, codPostal };
}

// Propunerea pentru un AWB nou, din comandă
async function propunere(c) {
  const judetRo = c.judet ?? judetDin(c.client_adresa);
  const judet = judetRo ? faraDiacritice(judetRo) : '';
  const lista = judet && activ() ? await localitati(judet).catch(() => []) : [];
  const ramburs = String(c.livrare ?? '').trim().toLowerCase() === 'curier ramburs';
  return {
    destinatar: { nume: c.client_nume, telefon: c.client_telefon ?? '', email: c.client_email ?? '', judet,
                  ...adresaFan(c.client_adresa, judet, lista) },
    serviciu: ramburs ? 'Cont Colector' : 'Standard',
    ramburs: ramburs ? null : 0,   // null = de scris de mână în fereastră (obligatoriu la Cont Colector)
    colete: 1, greutate: null, observatii: '',
    continut: `Comanda ${c.oferta_nr || c.numar}`,
  };
}

// ── Rute ─────────────────────────────────────────────────────────────────────

const awbComenzii = id => db().prepare(`SELECT a.*, u.nume AS creat_de_nume FROM awb a LEFT JOIN utilizator u ON u.id = a.creat_de
                                         WHERE a.comanda_id = ? ORDER BY a.id`).all(id)
  .map(a => ({ ...a, destinatar: JSON.parse(a.destinatar ?? 'null') }));

// AWB-urile comenzii + propunerea pentru unul nou (fereastra „Generează AWB")
async function deComanda({ res, params }) {
  const c = db().prepare('SELECT * FROM comanda WHERE id = ?').get(Number(params.id));
  if (!c) return eroare(res, 404, 'Comandă inexistentă.');
  json(res, 200, { activ: activ(), awb: awbComenzii(c.id), propunere: await propunere(c), judete: JUDETE_FAN, servicii: SERVICII });
}

// Datele din fereastră → expediţia pentru FAN, sau { gresit: mesaj }
function valideaza(corp) {
  const gresit = m => ({ gresit: m });
  const t = (v, max = 100) => String(v ?? '').trim().slice(0, max);
  const nr = v => (v == null || String(v).trim() === '' ? NaN : Number(String(v).trim().replace(',', '.')));
  const d = corp.destinatar ?? {};
  const telefon = t(d.telefon, 30).replace(/[\s.\-()/]/g, '');
  if (!t(d.nume)) return gresit('Completează numele destinatarului.');
  if (!/^\+?\d{9,15}$/.test(telefon)) return gresit('Telefonul destinatarului nu e valid.');
  if (!JUDETE_FAN.includes(d.judet)) return gresit('Alege judeţul.');
  if (!t(d.localitate)) return gresit('Completează localitatea (din lista FAN).');
  if (!t(d.strada)) return gresit('Completează strada.');
  if (!SERVICII.includes(corp.serviciu)) return gresit('Alege serviciul.');
  const colete = Number(corp.colete);
  if (!Number.isInteger(colete) || colete < 1 || colete > 99) return gresit('Numărul de colete: cel puţin 1.');
  const greutate = nr(corp.greutate);
  if (!(greutate > 0 && greutate <= 10000)) return gresit('Completează greutatea totală (kg).');
  // rambursul doar la „Cont Colector" (scris de mână, > 0); la celelalte servicii 0
  const ramburs = /Cont Colector/.test(corp.serviciu) ? nr(corp.ramburs) : 0;
  if (/Cont Colector/.test(corp.serviciu) && !(ramburs > 0)) return gresit('La „Cont Colector" scrie suma de încasat (rambursul).');
  if (!(ramburs < 1e6)) return gresit('Rambursul e prea mare.');
  const optiuni = (Array.isArray(corp.optiuni) ? corp.optiuni : []).filter(o => /^[A-Z]$/.test(o));
  const rotunjit = v => Math.round(v * 100) / 100;
  const destinatar = { nume: t(d.nume), telefon, email: t(d.email), judet: d.judet, localitate: t(d.localitate),
                       strada: t(d.strada, 200), numar: t(d.numar, 20), codPostal: t(d.codPostal, 10) };
  return {
    destinatar, serviciu: corp.serviciu, ramburs: rotunjit(ramburs), colete, greutate: rotunjit(greutate),
    expeditie: {
      info: { service: corp.serviciu, packages: { parcel: colete, envelopes: 0 }, weight: rotunjit(greutate), cod: rotunjit(ramburs),
              declaredValue: 0, payment: 'sender', observation: t(corp.observatii, 200), content: t(corp.continut, 200), options: optiuni },
      recipient: { name: destinatar.nume, phone: telefon, email: destinatar.email,
                   address: { county: d.judet, locality: destinatar.localitate, street: destinatar.strada,
                              streetNo: destinatar.numar, zipCode: destinatar.codPostal } },
    },
  };
}

async function genereaza({ req, res, params, utilizator }) {
  const id = Number(params.id);
  const c = db().prepare('SELECT * FROM comanda WHERE id = ?').get(id);
  if (!c) return eroare(res, 404, 'Comandă inexistentă.');
  if (c.anulat || !['comanda', 'plata'].includes(c.tip)) return eroare(res, 409, 'AWB doar pentru o comandă acceptată (sau care aşteaptă plata).');
  if (!activ()) return eroare(res, 409, NECONFIGURAT);
  const v = valideaza(await corpJson(req));
  if (v.gresit) return eroare(res, 400, v.gresit);

  const r = await laFan('POST', '/intern-awb', { clientId: Number(clientId()), shipments: [v.expeditie] });
  const j = await r.json().catch(() => ({}));
  const awb = j.response?.[0];
  if (!awb?.awbNumber) return eroare(res, r.ok ? 400 : 502, `FAN Courier a refuzat AWB-ul — ${mesajFan(j, r.status)}.`);

  const numar = String(awb.awbNumber);
  db().prepare(`INSERT INTO awb (comanda_id, numar, serviciu, ramburs, colete, greutate, cost, destinatar, creat_la, creat_de)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${ACUM()}, ?)`)
    .run(id, numar, v.serviciu, v.ramburs, v.colete, v.greutate, Number.isFinite(awb.tariff) ? awb.tariff : null,
         JSON.stringify(v.destinatar), utilizator.id);
  anunta({ comanda: id });
  json(res, 201, { awb: awbComenzii(id).find(a => a.numar === numar) });
}

const unAwb = numar => db().prepare('SELECT * FROM awb WHERE numar = ?').get(String(numar));

// Eticheta (PDF) — de la FAN direct spre browser; se deschide în tab nou şi se printează
async function eticheta({ res, params }) {
  const a = unAwb(params.numar);
  if (!a) return eroare(res, 404, 'AWB necunoscut.');
  if (a.sters_la) return eroare(res, 410, 'AWB-ul a fost şters.');
  const r = await laFan('GET', `/awb/label?clientId=${clientId()}&awbs[]=${encodeURIComponent(a.numar)}&pdf=1`);
  if (!r.ok || !/pdf/i.test(r.headers.get('content-type') ?? '')) {
    return eroare(res, 502, `FAN Courier nu a dat eticheta — ${mesajFan(await r.json().catch(() => ({})), r.status)}.`);
  }
  const pdf = Buffer.from(await r.arrayBuffer());
  res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': pdf.length,
    'Content-Disposition': `inline; filename="AWB-${a.numar}.pdf"`, 'Cache-Control': 'no-store' });
  res.end(pdf);
}

// AWB greşit → se şterge la FAN (cât n-a fost ridicat), rândul rămâne cu `sters_la`
async function sterge({ res, params, utilizator }) {
  const a = unAwb(params.numar);
  if (!a) return eroare(res, 404, 'AWB necunoscut.');
  if (a.sters_la) return eroare(res, 409, 'AWB-ul e deja şters.');
  const r = await laFan('DELETE', `/awb?clientId=${clientId()}&awb=${encodeURIComponent(a.numar)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok && !/already deleted/i.test(j.message ?? '')) {
    return eroare(res, r.status === 422 ? 409 : 502, `FAN Courier nu a şters AWB-ul — ${mesajFan(j, r.status)}.`);
  }
  db().prepare(`UPDATE awb SET sters_la = ${ACUM()}, sters_de = ? WHERE id = ?`).run(utilizator.id, a.id);
  anunta({ comanda: a.comanda_id });
  json(res, 200, { ok: true });
}

// ── Tracking ─────────────────────────────────────────────────────────────────

// ora României de la FAN („2026-10-12 14:29:28") → UTC, ca restul datelor din bază
function dinOraRo(t) {
  const ca = Date.parse(String(t ?? '').replace(' ', 'T') + 'Z');
  if (!Number.isFinite(ca)) return null;
  const acolo = Date.parse(new Date(ca).toLocaleString('sv-SE', { timeZone: 'Europe/Bucharest' }).replace(' ', 'T') + 'Z');
  return new Date(2 * ca - acolo).toISOString().slice(0, 19).replace('T', ' ');
}

// AWB-urile pe drum (nelivrate, neşterse, din ultimele 30 de zile) → starea de la FAN.
// Întoarce câte s-au schimbat; aruncă dacă FAN nu răspunde.
async function urmareste() {
  if (!activ()) return 0;
  const numere = db().prepare(`SELECT numar FROM awb WHERE sters_la IS NULL AND livrat_la IS NULL
                                 AND creat_la >= datetime(${ACUM()}, '-30 days')`).all().map(a => a.numar);
  if (!numere.length) return 0;
  // ponytail: o singură cerere pt. toate — la sute de AWB-uri pe drum, în loturi (URL-ul creşte)
  const r = await laFan('GET', `/reports/awb/tracking?clientId=${clientId()}&language=ro&${numere.map(n => `awb[]=${encodeURIComponent(n)}`).join('&')}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !Array.isArray(j.data)) throw nuMerge(502, `Tracking FAN: ${mesajFan(j, r.status)}`);
  const pune = db().prepare(`UPDATE awb SET stare = ?, stare_text = ?, stare_la = ?, livrat_la = ?
                              WHERE numar = ? AND (stare IS NOT ? OR stare_text IS NOT ? OR stare_la IS NOT ?)`);
  let schimbate = 0;
  for (const t of j.data) {
    const numar = String(t.awbNumber);
    if (!numere.includes(numar)) continue;
    const ev = (t.events ?? []).reduce((a, b) => (!a || String(b.date) >= String(a.date) ? b : a), null);   // cel mai nou
    const stare = ev?.id ?? null, text = ev?.name ?? t.message ?? null, la = ev ? dinOraRo(ev.date) : null;
    schimbate += pune.run(stare, text, la, stare === 'S2' ? la ?? acumSql() : null, numar, stare, text, la).changes;
  }
  if (schimbate) anunta();
  return schimbate;
}

function porneste() {
  const tura = () => urmareste().catch(e => console.error('Tracking FAN:', e.message));
  tura();
  setInterval(tura, 60 * 60 * 1000).unref();
}

// ── Contul (doar admin) ──────────────────────────────────────────────────────
// Se încearcă întâi la FAN (login + codul de client să fie al contului), se salvează
// doar dacă merge. Totul gol = se şterge legătura.
async function puneCont({ req, res }) {
  const corp = await corpJson(req);
  const user = String(corp.user ?? '').trim(), parola = String(corp.parola ?? ''), client = String(corp.clientId ?? '').trim();
  token = null;
  nomenclator.clear();
  if (!user && !parola && !client) {
    db().prepare("DELETE FROM setare WHERE cheie IN ('fan_user', 'fan_parola', 'fan_client')").run();
    return json(res, 200, { activ: false });
  }
  if (!user || !parola || !/^\d+$/.test(client)) return eroare(res, 400, 'Completează utilizatorul, parola şi codul de client (clientId, doar cifre).');
  const tk = await logheaza(user, parola);
  const r = await cerere('/reports/branches', { headers: { Authorization: `Bearer ${tk}` } });
  const conturi = (await r.json().catch(() => ({}))).data;
  if (!r.ok || !Array.isArray(conturi)) throw nuMerge(502, `FAN Courier a răspuns ${r.status} la lista de conturi.`);
  const cont = conturi.find(x => String(x.id) === client);
  if (!cont) return eroare(res, 400, `Codul de client ${client} nu e al utilizatorului ${user}${conturi.length
    ? ` — ale lui: ${conturi.map(x => `${x.id} (${x.name})`).join(', ')}` : ''}.`);
  const pune = db().prepare('INSERT INTO setare (cheie, valoare) VALUES (?, ?) ON CONFLICT(cheie) DO UPDATE SET valoare = excluded.valoare');
  tranzactie(() => { pune.run('fan_user', user); pune.run('fan_parola', parola); pune.run('fan_client', client); });
  token = { valoare: tk, la: Date.now() };
  json(res, 200, { activ: true, user, clientId: client, cont: cont.name });
}

const stare = ({ res }) => json(res, 200, activ() ? { activ: true, user: setare('fan_user'), clientId: clientId() } : { activ: false });

async function rutaLocalitati({ req, res }) {
  const judet = new URL(req.url, 'http://x').searchParams.get('judet');
  if (!JUDETE_FAN.includes(judet)) return eroare(res, 400, 'Judeţ necunoscut.');
  json(res, 200, { localitati: await localitati(judet) });
}

// erorile de la FAN (nuMerge) ajung în pagină cu mesajul lor; restul → „Eroare internă" (index.js)
const cuFan = h => async ctx => {
  try { return await h(ctx); } catch (e) { if (!e.fan) throw e; eroare(ctx.res, e.cod, e.message); }
};

module.exports = {
  porneste, urmareste, adresaFan, dinOraRo,
  rute: [
    ['GET',    '/api/fan/stare',           { handler: stare }],
    ['PUT',    '/api/fan/cont',            { handler: puneCont, rol: 'admin' }],
    ['GET',    '/api/fan/localitati',      { handler: rutaLocalitati }],
    ['GET',    '/api/comenzi/:id/awb',     { handler: deComanda }],
    ['POST',   '/api/comenzi/:id/awb',     { handler: genereaza }],
    ['GET',    '/api/awb/:numar/eticheta', { handler: eticheta }],
    ['DELETE', '/api/awb/:numar',          { handler: sterge }],
    ['POST',   '/api/awb/actualizeaza',    { handler: async ({ res }) => json(res, 200, { schimbate: await urmareste() }) }],
  ].map(([metoda, cale, spec]) => [metoda, cale, { ...spec, handler: cuFan(spec.handler) }]),
};
