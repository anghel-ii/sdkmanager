const { db, tranzactie, ACUM } = require('./db.js');
const { json, eroare, corpJson } = require('./http.js');
const { anunta } = require('./evenimente.js');

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

// Judeţul din adresă: dintre numele de judeţ găsite ca CUVINTE întregi, cel care
// apare ultimul — adresa e de obicei „strada, localitate, judeţ" (aşa o completează
// şi sugestiile de clienţi), iar străzile au des nume de judeţe („Str. Iaşi, Bacău").
// Null dacă nu e niciunul (atunci îl alege omul pe pagină).
function judetDin(adresa) {
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
  c.creat_la, c.confirmat_la, c.finalizat_la, c.plata, c.avans, c.factura_nr,
  c.judet AS judet_ales, c.de_incasat, c.lat, c.lon, c.geo_adresa`;

function cuDetalii(randuri) {
  const p = produse(randuri.map(r => r.id));
  return randuri.map(r => ({ ...r, produse: p.get(r.id) ?? [],
    judet: r.judet_ales ?? judetDin(r.client_adresa), judet_recunoscut: !r.judet_ales }));
}

// Comenzile de livrat: acceptate (în lucru sau finalizate), cu maşina noastră, neprogramate.
function candidati(ctx) {
  const r = db().prepare(`
    SELECT ${CAMPURI} FROM comanda c
     WHERE c.tip = 'comanda' AND c.anulat = 0 AND lower(trim(c.livrare)) = ?
       AND NOT EXISTS (SELECT 1 FROM livrare_comanda lc WHERE lc.comanda_id = c.id)
     ORDER BY c.creat_la`).all(CU_MASINA);
  json(ctx.res, 200, { comenzi: cuDetalii(r), judete: JUDETE });
}

// Pe comandă: judeţul ales de mână, suma de încasat, coordonatele găsite în browser.
async function modificaComanda(ctx) {
  const id = Number(ctx.params.id);
  const corp = await corpJson(ctx.req);
  if (!db().prepare('SELECT 1 FROM comanda WHERE id = ?').get(id)) return eroare(ctx.res, 404, 'Comandă inexistentă.');
  const set = [], val = [];
  if ('judet' in corp) {
    if (corp.judet != null && corp.judet !== '' && !JUDETE.includes(corp.judet)) return eroare(ctx.res, 400, 'Judeţ necunoscut.');
    set.push('judet = ?'); val.push(corp.judet || null);
  }
  if ('de_incasat' in corp) {
    const t = String(corp.de_incasat ?? '').trim().replace(',', '.');
    const v = t === '' ? null : Number(t);
    if (v != null && !(Number.isFinite(v) && v >= 0)) return eroare(ctx.res, 400, 'Suma de încasat trebuie să fie un număr (gol = nimic de încasat).');
    set.push('de_incasat = ?'); val.push(v == null ? null : Math.round(v * 100) / 100);
  }
  if ('lat' in corp || 'lon' in corp) {
    const lat = Number(corp.lat), lon = Number(corp.lon);
    // România, cu o margine — un punct găsit aiurea (alt continent) nu se salvează
    if (!(lat > 43 && lat < 48.6 && lon > 20 && lon < 30.5)) return eroare(ctx.res, 400, 'Coordonate în afara României.');
    set.push('lat = ?', 'lon = ?', 'geo_adresa = ?');
    val.push(lat, lon, String(corp.geo_adresa ?? '').slice(0, 300));
  }
  if (!set.length) return eroare(ctx.res, 400, 'Nimic de modificat.');
  db().prepare(`UPDATE comanda SET ${set.join(', ')} WHERE id = ?`).run(...val, id);
  anunta({ livrari: true });
  json(ctx.res, 200, { ok: true });
}

// Livrările (toate — pagina le împarte în programate / trecute după dată), cu comenzile în ordine.
function livrari(ctx) {
  const ls = db().prepare(`SELECT l.id, l.data, l.creat_la, u.nume AS creat_de_nume FROM livrare l
                             LEFT JOIN utilizator u ON u.id = l.creat_de ORDER BY l.data, l.id`).all();
  const comenzi = cuDetalii(db().prepare(`
    SELECT ${CAMPURI}, lc.livrare_id, lc.ordine FROM livrare_comanda lc JOIN comanda c ON c.id = lc.comanda_id
     ORDER BY lc.livrare_id, lc.ordine`).all());
  json(ctx.res, 200, { livrari: ls.map(l => ({ ...l, comenzi: comenzi.filter(c => c.livrare_id === l.id) })) });
}

// „Confirmă livrarea": data + comenzile bifate, în ordinea traseului.
async function creeaza(ctx) {
  const corp = await corpJson(ctx.req);
  const data = String(corp.data ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(data))) return eroare(ctx.res, 400, 'Alege data livrării.');
  const ids = (Array.isArray(corp.comenzi) ? corp.comenzi : []).map(Number).filter(Number.isInteger);
  if (!ids.length) return eroare(ctx.res, 400, 'Bifează cel puţin o comandă.');
  if (new Set(ids).size !== ids.length) return eroare(ctx.res, 400, 'O comandă apare de două ori.');

  const bune = new Set(db().prepare(`SELECT id FROM comanda WHERE tip = 'comanda' AND anulat = 0 AND lower(trim(livrare)) = ?
                                     AND id IN (${ids.map(() => '?').join(',')})`).all(CU_MASINA, ...ids).map(r => r.id));
  if (bune.size !== ids.length) return eroare(ctx.res, 400, 'Unele comenzi nu se livrează cu maşina noastră sau nu sunt acceptate.');

  try {
    const id = tranzactie(d => {
      const livrareId = Number(d.prepare(`INSERT INTO livrare (data, creat_la, creat_de) VALUES (?, ${ACUM()}, ?)`)
        .run(data, ctx.utilizator.id).lastInsertRowid);
      const pune = d.prepare('INSERT INTO livrare_comanda (livrare_id, comanda_id, ordine) VALUES (?, ?, ?)');
      ids.forEach((c, k) => pune.run(livrareId, c, k + 1));
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
  judetDin, JUDETE,
  rute: [
    ['GET',    '/api/livrari/candidati',    { handler: candidati }],
    ['PUT',    '/api/livrari/comanda/:id',  { handler: modificaComanda }],
    ['GET',    '/api/livrari',              { handler: livrari }],
    ['POST',   '/api/livrari',              { handler: creeaza }],
    ['DELETE', '/api/livrari/:id',          { handler: anuleaza }],
  ],
};
