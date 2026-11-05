const { db, tranzactie, ACUM, comenziDemo } = require('./db.js');
const { json, eroare, corpJson } = require('./http.js');
const { anunta } = require('./evenimente.js');
const { FARA_CERERE } = require('./cereri.js');

// ═══════════════════════════════════════════════════════════════════════════
//  ORGANIZEAZĂ LIVRĂRI (userul, 2026-10-06) — comenzile care se livrează cu
//  maşina noastră (livrare = „Cu masina noastra"), în lucru sau finalizate,
//  încă neprogramate. Pe pagină alegi judeţele, bifezi comenzile, pui data →
//  o LIVRARE (o zi + comenzile ei în ordinea traseului). Anularea unei livrări
//  readuce comenzile în listă. Harta şi traseul se fac în browser (web/livrari).
// ═══════════════════════════════════════════════════════════════════════════

const CU_MASINA = 'cu masina noastra';   // valoarea din configurator (lib/comun/comanda.js LIVRARE)

// Judeţele + Bucureşti — pt. recunoaşterea din adresă şi pentru alegerea de mână.
const JUDETE = ['Alba', 'Arad', 'Argeș', 'Bacău', 'Bihor', 'Bistrița-Năsăud', 'Botoșani', 'Brăila', 'Brașov',
  'București', 'Buzău', 'Călărași', 'Caraș-Severin', 'Cluj', 'Constanța', 'Covasna', 'Dâmbovița', 'Dolj', 'Galați',
  'Giurgiu', 'Gorj', 'Harghita', 'Hunedoara', 'Ialomița', 'Iași', 'Ilfov', 'Maramureș', 'Mehedinți', 'Mureș',
  'Neamț', 'Olt', 'Prahova', 'Sălaj', 'Satu Mare', 'Sibiu', 'Suceava', 'Teleorman', 'Timiș', 'Tulcea', 'Vâlcea',
  'Vaslui', 'Vrancea'];

// fără diacritice (ş/ș, ţ/ț, ă, î, â), litere mici, cratima = spaţiu
const normal = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[-_]/g, ' ');
const NORMAL_JUDETE = JUDETE.map(j => [j, normal(j)]);

// Adresa pe bucăţi (web/adresa.js + lista SIRUTA): judeţul, localitatea, strada.
const Adresa = require('../web/adresa.js');
const Suma = require('../web/suma.js');   // „12,5" şi „12.5", „1.200,50" (userul, 2026-10-30)
const LOCALITATI = Adresa.index(require('../web/localitati.json'));
const adresaDin = text => Adresa.desface(text, LOCALITATI);

// Judeţul din adresă: întâi din adresa pe bucăţi („…, Cluj-Napoca" → Cluj, şi fără judeţ
// scris); altfel, dintre numele de judeţ găsite ca CUVINTE întregi, cel care apare
// ultimul — străzile au des nume de judeţe („Str. Iaşi, Bacău").
// Null dacă nu e niciunul (atunci îl alege omul pe pagină).
function judetDin(adresa) {
  const dinBucati = adresaDin(adresa).judet;
  if (dinBucati) return dinBucati;
  const a = ` ${normal(adresa).replace(/[^a-z0-9]+/g, ' ')} `;
  let gasit = null, poz = -1;
  for (const [j, n] of NORMAL_JUDETE) {
    const i = a.lastIndexOf(` ${n} `);
    if (i > poz) { gasit = j; poz = i; }
  }
  // „Sector 3" fără „Bucureşti" scris
  if (!gasit && /\bsector(ul)? [1-6]\b/.test(a)) gasit = 'București';
  return gasit;
}

// Produsele unei comenzi, pe scurt: „Confort Verona · 3 uşi", „Ramă 822 · 6 rame"
function produse(ids) {
  if (!ids.length) return new Map();
  const m = new Map();
  for (const p of db().prepare(`SELECT comanda_id, sistem, eticheta, nr_usi FROM pozitie
                                  WHERE comanda_id IN (${ids.map(() => '?').join(',')}) ORDER BY comanda_id, idx`).all(...ids)) {
    const n = p.nr_usi;
    const text = p.sistem === 'amanunt' ? p.eticheta
      : `${p.eticheta}${n > 0 ? ` · ${n} ${/^rama/.test(p.sistem) ? (n === 1 ? 'ramă' : 'rame') : (n === 1 ? 'uşă' : 'uşi')}` : ''}`;
    m.set(p.comanda_id, [...(m.get(p.comanda_id) ?? []), text]);
  }
  return m;
}

const CAMPURI = `c.id, COALESCE(c.oferta_nr, c.numar) AS numar, c.client_nume, c.client_telefon, c.client_adresa,
  c.creat_la, c.confirmat_la, c.finalizat_la, c.plata, c.incasare, c.avans, c.achitat_la, c.factura_nr, c.observatii_livrare,
  c.judet AS judet_ales, c.de_incasat, c.coloana_borderou, c.lat, c.lon, c.geo_adresa`;

function cuDetalii(randuri) {
  const p = produse(randuri.map(r => r.id));
  const demo = comenziDemo();   // în demo: comenzile care nu mai sunt ca pe bune
  return randuri.map(r => ({ ...r, produse: p.get(r.id) ?? [], ...(demo.has(r.id) && { demo: true }),
    judet: r.judet_ales ?? judetDin(r.client_adresa), judet_recunoscut: !r.judet_ales }));
}

// ── Comenzi puse de mână pe lista de livrat (userul, 2026-11-05) — tabelul livrare_extra (v44):
//   • „Livrează din nou o comandă" — una deja livrată (ex. ceva trimis greşit), cu cost 0 pe borderou
//   • „Adaugă o comandă la livrare" — oricare în lucru / finalizată, şi fără „Cu maşina noastră"
// Pe pagină arată ca orice comandă, cu id-ul NEGATIV (−id al rândului): bifele, planul comun, traseul, preţul /
// coloana de pe borderou şi borderoul merg la fel. Datele clientului şi produsele vin din comandă.
const EXTRA = `e.id AS extra_id, e.din_nou, e.livrare_id, e.ordine, e.de_incasat AS e_de_incasat, e.coloana_borderou AS e_coloana,
  e.observatii_livrare AS e_obs, e.judet AS e_judet, e.lat AS e_lat, e.lon AS e_lon, e.geo_adresa AS e_geo, ${CAMPURI}`;
function extrase(unde) {
  const r = db().prepare(`SELECT ${EXTRA} FROM livrare_extra e JOIN comanda c ON c.id = e.comanda_id
    WHERE ${unde} ORDER BY e.creat_la, e.id`).all();
  const p = produse([...new Set(r.map(x => x.id))]);
  const demo = comenziDemo();
  return r.map(x => ({
    id: -x.extra_id, extra: true, din_nou: !!x.din_nou, comanda_id: x.id, numar: x.numar,
    client_nume: x.client_nume, client_telefon: x.client_telefon, client_adresa: x.client_adresa,
    creat_la: x.creat_la, confirmat_la: x.confirmat_la, finalizat_la: x.finalizat_la, plata: x.plata, incasare: x.incasare,
    avans: x.avans, achitat_la: x.achitat_la, factura_nr: x.factura_nr, observatii_livrare: x.e_obs,
    judet_ales: x.e_judet, de_incasat: x.din_nou ? 0 : x.e_de_incasat, coloana_borderou: x.e_coloana,
    lat: x.e_lat, lon: x.e_lon, geo_adresa: x.e_geo, livrare_id: x.livrare_id, ordine: x.ordine,
    produse: p.get(x.id) ?? [], ...(demo.has(x.id) && { demo: true }),
    judet: x.e_judet ?? judetDin(x.client_adresa), judet_recunoscut: !x.e_judet,
  }));
}

// Căutarea din cele două ferestre. Fiecare cuvânt scris trebuie găsit (fără diacritice) în client, nr., adresă,
// produse sau în date (zz.ll.aaaa — „05.11", „5/11/2026" merg şi ele). Cele mai noi întâi, cel mult 60.
const AZI = `date(${ACUM()}, 'localtime')`;
const zi = col => `strftime('%d.%m.%Y', ${col}, 'localtime')`;
const TEXT_COMANDA = `fara_diacritice(c.client_nume || ' ' || COALESCE(c.oferta_nr, '') || ' ' || c.numar || ' ' || COALESCE(c.client_adresa, '')
  || ' ' || COALESCE((SELECT GROUP_CONCAT(p.eticheta, ' ') FROM pozitie p WHERE p.comanda_id = c.id), '')
  || ' ' || COALESCE(${zi('c.creat_la')}, '') || ' ' || COALESCE(${zi('c.confirmat_la')}, '') || ' ' || COALESCE(${zi('c.finalizat_la')}, ''))`;
// zz.ll.aaaa — a datei livrării (zi fără oră)
const ziLivrare = col => `strftime('%d.%m.%Y', ${col})`;
// fiecare cuvânt: aşa cum e scris (ex. „OF-2026-0003") SAU ca dată („05/11" → „05.11")
const tipar = c => `%${c.replace(/[\\%_]/g, '\\$&')}%`;
const cuvinteCautare = q => String(q ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/\s+/).filter(Boolean).slice(0, 8).flatMap(c => [tipar(c), tipar(c.replace(/(\d)[/-](?=\d)/g, '$1.'))]);

function cauta(ctx) {
  const url = new URL(ctx.req.url, 'http://x').searchParams;
  const dinNou = url.get('fel') === 'din_nou';
  const cuv = cuvinteCautare(url.get('q'));
  // „deja livrate" = au fost într-o livrare cu data de azi sau trecută (programată obişnuit sau pusă de mână)
  const livrata = `(SELECT MAX(l.data) FROM livrare l WHERE l.data <= ${AZI} AND (
      l.id IN (SELECT lc.livrare_id FROM livrare_comanda lc WHERE lc.comanda_id = c.id)
      OR l.id IN (SELECT e.livrare_id FROM livrare_extra e WHERE e.comanda_id = c.id)))`;
  const text = dinNou ? `(${TEXT_COMANDA} || ' ' || COALESCE(${ziLivrare(livrata)}, ''))` : TEXT_COMANDA;
  const randuri = db().prepare(`
    SELECT c.id, COALESCE(c.oferta_nr, c.numar) AS numar, c.client_nume, c.client_adresa, c.livrare, c.judet AS judet_ales,
           c.confirmat_la, c.finalizat_la, ${livrata} AS livrata_la,
           NOT EXISTS (SELECT 1 FROM livrare_comanda lc WHERE lc.comanda_id = c.id) AS neprogramata
      FROM comanda c
     WHERE c.tip = 'comanda' AND c.anulat = 0 AND ${FARA_CERERE}
       ${dinNou ? `AND ${livrata} IS NOT NULL` : ''}
       -- ce e deja pe lista de livrat nu se mai arată
       AND NOT EXISTS (SELECT 1 FROM livrare_extra e WHERE e.comanda_id = c.id AND e.livrare_id IS NULL)
       -- „Adaugă o comandă la livrare": doar cele cu maşina noastră (userul, 2026-11-05). Cele încă neprogramate sunt deja
       -- la comenzile de livrat (poate în alt judeţ) — pagina doar le aduce la vedere; celelalte intră încă o dată pe listă.
       ${dinNou ? '' : `AND lower(trim(COALESCE(c.livrare, ''))) = '${CU_MASINA}'`}
       ${cuv.filter((_, k) => k % 2 === 0).map(() => `AND (${text} LIKE ? ESCAPE '\\' OR ${text} LIKE ? ESCAPE '\\')`).join(' ')}
     ORDER BY ${dinNou ? 'livrata_la DESC,' : ''} COALESCE(c.finalizat_la, c.confirmat_la, c.creat_la) DESC
     LIMIT 60`).all(...cuv);
  const p = produse(randuri.map(r => r.id));
  json(ctx.res, 200, { comenzi: randuri.map(({ judet_ales, ...r }) => ({ ...r, neprogramata: !!r.neprogramata, produse: p.get(r.id) ?? [],
    judet: judet_ales ?? judetDin(r.client_adresa) })) });
}

// { comanda_id, din_nou } — pe lista de livrat; locul de pe hartă, judeţul şi observaţiile de livrare se iau din comandă
async function adaugaExtra(ctx) {
  const corp = await corpJson(ctx.req);
  const id = Number(corp.comanda_id), dinNou = corp.din_nou === true;
  const c = db().prepare(`SELECT c.* FROM comanda c WHERE c.id = ? AND c.tip = 'comanda' AND c.anulat = 0 AND ${FARA_CERERE}`).get(id);
  if (!c) return eroare(ctx.res, 404, 'Comanda nu e în lucru sau finalizată (sau are o anulare cerută).');
  if (db().prepare('SELECT 1 FROM livrare_extra WHERE comanda_id = ? AND livrare_id IS NULL').get(id))
    return eroare(ctx.res, 409, 'Comanda e deja pe lista de livrat.');
  if (!dinNou && String(c.livrare ?? '').trim().toLowerCase() !== CU_MASINA)
    return eroare(ctx.res, 400, 'La livrare se adaugă doar comenzi cu „Cu maşina noastră".');
  if (!dinNou && !db().prepare('SELECT 1 FROM livrare_comanda WHERE comanda_id = ?').get(id))
    return eroare(ctx.res, 409, 'Comanda e deja la comenzile de livrat — alege-i judeţul de sus.');
  const r = db().prepare(`INSERT INTO livrare_extra (comanda_id, din_nou, observatii_livrare, judet, lat, lon, geo_adresa, creat_la, creat_de)
      VALUES (?, ?, ?, ?, ?, ?, ?, ${ACUM()}, ?)`)
    .run(id, dinNou ? 1 : 0, c.observatii_livrare, c.judet, c.lat, c.lon, c.geo_adresa, ctx.utilizator.id);
  anunta({ livrari: true });
  json(ctx.res, 201, { comanda: extrase(`e.id = ${Number(r.lastInsertRowid)}`)[0] });
}

// scoasă de pe lista de livrat — doar cât nu e într-o livrare (după programare se anulează livrarea)
function stergeExtra(ctx) {
  const id = Math.abs(Number(ctx.params.id));
  const e = db().prepare('SELECT livrare_id FROM livrare_extra WHERE id = ?').get(id);
  if (!e) return eroare(ctx.res, 404, 'Nu e pe lista de livrat.');
  if (e.livrare_id != null) return eroare(ctx.res, 409, 'E într-o livrare programată — anulează întâi livrarea.');
  db().prepare('DELETE FROM livrare_extra WHERE id = ?').run(id);
  anunta({ livrari: true });
  json(ctx.res, 200, { ok: true });
}

// Comenzile de livrat: acceptate (în lucru sau finalizate), cu maşina noastră, neprogramate.
function candidati(ctx) {
  const r = db().prepare(`
    SELECT ${CAMPURI} FROM comanda c
     WHERE c.tip = 'comanda' AND c.anulat = 0 AND lower(trim(c.livrare)) = ? AND ${FARA_CERERE}
       AND NOT EXISTS (SELECT 1 FROM livrare_comanda lc WHERE lc.comanda_id = c.id)
     ORDER BY c.creat_la`).all(CU_MASINA);
  json(ctx.res, 200, { comenzi: [...cuDetalii(r), ...extrase('e.livrare_id IS NULL')], judete: JUDETE, plan: citestePlan() });
}

const COLOANE = ['bon', 'factura', 'op'];   // coloanele borderoului în care poate intra preţul

// Pe comandă: judeţul ales de mână, suma de încasat, coordonatele găsite în browser.
// Id negativ = livrare din afara managerului (livrare_extra): aceleaşi coloane, alt tabel.
async function modificaComanda(ctx) {
  const idPagina = Number(ctx.params.id);
  const tabel = idPagina < 0 ? 'livrare_extra' : 'comanda', id = Math.abs(idPagina);
  const corp = await corpJson(ctx.req);
  if (!db().prepare(`SELECT 1 FROM ${tabel} WHERE id = ?`).get(id)) return eroare(ctx.res, 404, 'Comandă inexistentă.');
  const set = [], val = [];
  if ('judet' in corp) {
    if (corp.judet != null && corp.judet !== '' && !JUDETE.includes(corp.judet)) return eroare(ctx.res, 400, 'Judeţ necunoscut.');
    set.push('judet = ?'); val.push(corp.judet || null);
  }
  if ('de_incasat' in corp) {
    if (tabel === 'livrare_extra' && db().prepare('SELECT din_nou FROM livrare_extra WHERE id = ?').get(id)?.din_nou)
      return eroare(ctx.res, 400, 'La o comandă livrată din nou costul e 0.');
    const v = Suma.din(corp.de_incasat);
    if (v != null && !(Number.isFinite(v) && v >= 0)) return eroare(ctx.res, 400, 'Suma de încasat trebuie să fie un număr (gol = nimic de încasat).');
    set.push('de_incasat = ?'); val.push(v == null ? null : Math.round(v * 100) / 100);
  }
  // unde ajunge preţul pe borderou (userul, 2026-10-22); gol = nealeasă
  if ('coloana_borderou' in corp) {
    if (corp.coloana_borderou && !COLOANE.includes(corp.coloana_borderou)) return eroare(ctx.res, 400, 'Coloana de pe borderou: Bon, Factură + chitanţă sau OP.');
    set.push('coloana_borderou = ?'); val.push(corp.coloana_borderou || null);
  }
  // observaţiile de livrare (userul, 2026-10-19): pe borderou, lângă telefon; gol = niciuna
  if ('observatii_livrare' in corp) {
    set.push('observatii_livrare = ?'); val.push(String(corp.observatii_livrare ?? '').trim().slice(0, 300) || null);
  }
  if ('lat' in corp || 'lon' in corp) {
    const lat = Number(corp.lat), lon = Number(corp.lon);
    // România, cu o margine — un punct găsit aiurea (alt continent) nu se salvează
    if (!(lat > 43 && lat < 48.6 && lon > 20 && lon < 30.5)) return eroare(ctx.res, 400, 'Coordonate în afara României.');
    set.push('lat = ?', 'lon = ?', 'geo_adresa = ?');
    val.push(lat, lon, String(corp.geo_adresa ?? '').slice(0, 300));
  }
  if (!set.length) return eroare(ctx.res, 400, 'Nimic de modificat.');
  db().prepare(`UPDATE ${tabel} SET ${set.join(', ')} WHERE id = ?`).run(...val, id);
  anunta({ livrari: true });
  json(ctx.res, 200, { ok: true });
}

// ── Planul în lucru (userul, 2026-11-03): judeţele alese, comenzile debifate şi data — COMUNE tuturor
// utilizatorilor şi păstrate pe server până se programează livrarea (înainte: judeţele în localStorage-ul
// fiecăruia, bifele doar cât era deschisă pagina). Un rând în `setare` (fără migraţie). Pagina trimite
// fiecare schimbare ca diferenţă — doi colegi care bifează în acelaşi timp nu-şi şterg unul altuia
// bifele —, apoi toţi primesc anunţul şi reîncarcă. Implicit comenzile sunt bifate: se ţin cele DEBIFATE.
const CHEIE_PLAN = 'livrari_plan';
function citestePlan() {
  let p = {};
  try { p = JSON.parse(db().prepare('SELECT valoare FROM setare WHERE cheie = ?').get(CHEIE_PLAN)?.valoare ?? '{}'); } catch {}
  return {
    judete: Array.isArray(p.judete) ? p.judete.filter(j => typeof j === 'string') : [],
    debifate: Array.isArray(p.debifate) ? p.debifate.filter(Number.isInteger) : [],
    data: typeof p.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.data) ? p.data : null,
  };
}
const scriePlan = (d, p) => d.prepare(`INSERT INTO setare (cheie, valoare) VALUES (?, ?)
  ON CONFLICT(cheie) DO UPDATE SET valoare = excluded.valoare`).run(CHEIE_PLAN, JSON.stringify(p));
// { judet, ales } | { comenzi: [id…], bifat } | { data } — una sau mai multe odată
async function schimbaPlan(ctx) {
  const corp = await corpJson(ctx.req);
  const areJudet = typeof corp.judet === 'string' && typeof corp.ales === 'boolean';
  const ids = Array.isArray(corp.comenzi) ? corp.comenzi.map(Number).filter(Number.isInteger) : [];
  const areBife = ids.length > 0 && typeof corp.bifat === 'boolean';
  const areData = 'data' in corp && (corp.data === null || corp.data === '' || /^\d{4}-\d{2}-\d{2}$/.test(String(corp.data)));
  if (!areJudet && !areBife && !areData) return eroare(ctx.res, 400, 'Nimic de schimbat în planul de livrare.');
  const plan = tranzactie(d => {
    const p = citestePlan();
    if (areJudet) {
      const j = corp.judet.slice(0, 60);
      p.judete = corp.ales ? [...new Set([...p.judete, j])] : p.judete.filter(x => x !== j);
    }
    if (areBife) {
      const deb = new Set(p.debifate);
      for (const id of ids) corp.bifat ? deb.delete(id) : deb.add(id);
      p.debifate = [...deb];
    }
    if (areData) p.data = corp.data || null;
    scriePlan(d, p);
    return p;
  });
  anunta({ livrari: true });
  json(ctx.res, 200, { plan });
}

// Livrările (toate — pagina le împarte în programate / trecute după dată), cu comenzile în ordine.
function livrari(ctx) {
  const ls = db().prepare(`SELECT l.id, l.data, l.creat_la, u.nume AS creat_de_nume FROM livrare l
                             LEFT JOIN utilizator u ON u.id = l.creat_de ORDER BY l.data, l.id`).all();
  const comenzi = cuDetalii(db().prepare(`
    SELECT ${CAMPURI}, lc.livrare_id, lc.ordine FROM livrare_comanda lc JOIN comanda c ON c.id = lc.comanda_id
     WHERE ${FARA_CERERE}
     ORDER BY lc.livrare_id, lc.ordine`).all());
  const extra = extrase('e.livrare_id IS NOT NULL');
  json(ctx.res, 200, { livrari: ls.map(l => ({ ...l, comenzi: [...comenzi, ...extra].filter(c => c.livrare_id === l.id)
    .sort((a, b) => a.ordine - b.ordine) })) });
}

// „Confirmă livrarea": data + comenzile bifate, în ordinea traseului.
async function creeaza(ctx) {
  const corp = await corpJson(ctx.req);
  const data = String(corp.data ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(data))) return eroare(ctx.res, 400, 'Alege data livrării.');
  const ids = (Array.isArray(corp.comenzi) ? corp.comenzi : []).map(Number).filter(Number.isInteger);
  if (!ids.length) return eroare(ctx.res, 400, 'Bifează cel puţin o comandă.');
  if (new Set(ids).size !== ids.length) return eroare(ctx.res, 400, 'O comandă apare de două ori.');

  // id negativ = livrare din afara managerului (livrare_extra), încă neprogramată
  const din = xs => xs.map(() => '?').join(',');
  const cmd = ids.filter(i => i > 0), ext = ids.filter(i => i < 0).map(i => -i);
  const bune = new Set(cmd.length ? db().prepare(`SELECT id FROM comanda c WHERE tip = 'comanda' AND anulat = 0 AND lower(trim(livrare)) = ?
                                     AND ${FARA_CERERE} AND id IN (${din(cmd)})`).all(CU_MASINA, ...cmd).map(r => r.id) : []);
  if (bune.size !== cmd.length) return eroare(ctx.res, 400, 'Unele comenzi nu se livrează cu maşina noastră, nu sunt acceptate sau au o cerere de anulare.');
  const bunePeExtra = ext.length ? db().prepare(`SELECT COUNT(*) AS n FROM livrare_extra WHERE livrare_id IS NULL AND id IN (${din(ext)})`).get(...ext).n : 0;
  if (bunePeExtra !== ext.length) return eroare(ctx.res, 409, 'O comandă pusă de mână a fost scoasă sau programată între timp — reîncarcă pagina.');
  // preţ fără coloană → n-ar apărea corect pe borderou (după programare nu se mai modifică)
  const faraColoana = [
    ...(cmd.length ? db().prepare(`SELECT client_nume FROM comanda WHERE de_incasat IS NOT NULL AND coloana_borderou IS NULL
                                    AND id IN (${din(cmd)})`).all(...cmd) : []),
    ...(ext.length ? db().prepare(`SELECT c.client_nume FROM livrare_extra e JOIN comanda c ON c.id = e.comanda_id
                                    WHERE e.din_nou = 0 AND e.de_incasat IS NOT NULL AND e.coloana_borderou IS NULL
                                    AND e.id IN (${din(ext)})`).all(...ext) : []),
  ].map(r => r.client_nume);
  if (faraColoana.length) return eroare(ctx.res, 400, `Alege unde ajunge preţul pe borderou (Bon / Factură + chitanţă / OP) la: ${faraColoana.join(', ')}.`);

  try {
    const id = tranzactie(d => {
      const livrareId = Number(d.prepare(`INSERT INTO livrare (data, creat_la, creat_de) VALUES (?, ${ACUM()}, ?)`)
        .run(data, ctx.utilizator.id).lastInsertRowid);
      const pune = d.prepare('INSERT INTO livrare_comanda (livrare_id, comanda_id, ordine) VALUES (?, ?, ?)');
      const puneExtra = d.prepare('UPDATE livrare_extra SET livrare_id = ?, ordine = ? WHERE id = ? AND livrare_id IS NULL');
      ids.forEach((c, k) => {
        if (c > 0) pune.run(livrareId, c, k + 1);
        else if (!puneExtra.run(livrareId, k + 1, -c).changes) throw new Error('UNIQUE: pusă de mână, deja programată');
      });
      return livrareId;
    });
    anunta({ livrari: true });
    json(ctx.res, 201, { id });
  } catch (e) {
    // UNIQUE(comanda_id): între timp a programat-o altcineva
    if (/UNIQUE/i.test(e.message)) return eroare(ctx.res, 409, 'O comandă bifată e deja într-o livrare programată — reîncarcă pagina.');
    throw e;
  }
}

// Anulează o livrare — comenzile ei se întorc în lista de organizat.
function anuleaza(ctx) {
  const n = db().prepare('DELETE FROM livrare WHERE id = ?').run(Number(ctx.params.id)).changes;
  if (!n) return eroare(ctx.res, 404, 'Livrare inexistentă.');
  anunta({ livrari: true });
  json(ctx.res, 200, { ok: true });
}

module.exports = {
  judetDin, adresaDin, JUDETE,
  rute: [
    ['GET',    '/api/livrari/candidati',    { handler: candidati }],
    ['GET',    '/api/livrari/cauta',        { handler: cauta }],         // ferestrele „Livrează din nou" / „Adaugă o comandă"
    ['POST',   '/api/livrari/extra',        { handler: adaugaExtra }],   // comandă pusă de mână pe lista de livrat
    ['DELETE', '/api/livrari/extra/:id',    { handler: stergeExtra }],
    ['PUT',    '/api/livrari/comanda/:id',  { handler: modificaComanda }],
    ['POST',   '/api/livrari/plan',         { handler: schimbaPlan }],   // judeţe / bife / data, comune tuturor
    ['GET',    '/api/livrari',              { handler: livrari }],
    ['POST',   '/api/livrari',              { handler: creeaza }],
    ['DELETE', '/api/livrari/:id',          { handler: anuleaza }],
  ],
};
