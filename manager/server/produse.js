const { db, tranzactie, ACUM, faraDiacritice } = require('./db.js');
const { json, eroare, corpJson } = require('./http.js');
const { citesteXlsx } = require('./xlsx.js');

// ═══════════════════════════════════════════════════════════════════════════
//  PRODUSELE (userul, 2026-11-02) — toată baza din NeoManager. Cele listate apar
//  la oferta cu amănuntul; cele nelistate stau în bază, dar nu le găsesc colegii.
//
//  Exportul încărcat din pagina /produse ADAUGĂ doar codurile noi, listate:
//    • un produs existent nu se atinge, nici denumirea
//    • ce e nelistat rămâne nelistat
//    • ce lipseşte din export rămâne cum e (exportul poate fi şi doar cu cele noi)
//  Listat ↔ nelistat se schimbă doar din pagină. Produsele noi se vând la bucată
//  întreagă: fără `bara` (debitare) şi fără `fact` (mod de facturare).
// ═══════════════════════════════════════════════════════════════════════════

const MAX_FISIER = 5 * 1024 * 1024;   // încape în limita corpului JSON (8 MB) şi ca base64
const PE_PAGINA = 100;
const COLOANE = ['Cod', 'Denumire', 'UM', 'Grupa'];
const ro = new Intl.Collator('ro');
const eroareFisier = mesaj => Object.assign(new Error(mesaj), { cod: 400 });

// Exportul .xlsx → { produse: [{ cod, denumire, um, grupa }], sarite }. Rândurile fără cod sau fără
// denumire se sar; la un cod repetat contează primul rând.
function dinExport(buf) {
  let tabel;
  try { tabel = citesteXlsx(buf); } catch { throw eroareFisier('Fişierul nu e un Excel .xlsx.'); }
  const [cap = [], ...randuri] = tabel;
  const col = n => [...cap].findIndex(c => String(c ?? '').trim() === n);
  const lipsa = COLOANE.filter(n => col(n) < 0);
  if (lipsa.length) throw eroareFisier(`Nu e exportul din NeoManager: lipsesc coloanele ${lipsa.join(', ')}.`);
  const [COD, DEN, UM, GRUPA] = COLOANE.map(col);
  const text = (r, i) => String(r[i] ?? '').trim();
  const peCod = new Map();
  let sarite = 0;
  for (const r of randuri) {
    const cod = text(r, COD), denumire = text(r, DEN);
    if (!cod || !denumire) { if (r.some(v => String(v ?? '').trim())) sarite++; continue; }
    if (!peCod.has(cod)) peCod.set(cod, { cod, denumire, um: text(r, UM), grupa: text(r, GRUPA) });
  }
  return { produse: [...peCod.values()], sarite };
}

// ce aduce nou exportul faţă de baza de acum — comparaţia e aceeaşi la verificare şi la încărcare
function compara(buf) {
  const { produse, sarite } = dinExport(buf);
  const are = new Set(db().prepare('SELECT cod FROM produs').all().map(p => p.cod));
  const noi = produse.filter(p => !are.has(p.cod)).sort((a, b) => ro.compare(a.denumire, b.denumire));
  return { noi, existente: produse.length - noi.length, sarite };
}

async function fisierDinCerere(ctx) {
  const buf = Buffer.from(String((await corpJson(ctx.req)).continut ?? ''), 'base64');
  if (!buf.length) throw eroareFisier('Alege fişierul cu exportul.');
  if (buf.length > MAX_FISIER) throw eroareFisier('Fişierul e prea mare (cel mult 5 MB).');
  return buf;
}

async function verifica(ctx) {
  json(ctx.res, 200, compara(await fisierDinCerere(ctx)));
}

async function incarca(ctx) {
  const buf = await fisierDinCerere(ctx);
  const rezultat = tranzactie(d => {
    const { noi, existente, sarite } = compara(buf);
    const pune = d.prepare(`INSERT INTO produs (cod, denumire, um, grupa, listat, adaugat_la) VALUES (?, ?, ?, ?, 1, ${ACUM()})`);
    for (const p of noi) pune.run(p.cod, p.denumire, p.um, p.grupa);
    return { adaugate: noi.length, existente, sarite };
  });
  json(ctx.res, 200, rezultat);
}

// pt. oferta cu amănuntul: doar ce are, ca lista de până acum
const pentruOferta = ({ cod, denumire, um, grupa, bara, fact }) => ({ cod, denumire, um, grupa,
  ...(bara && { bara }), ...(fact && { fact: JSON.parse(fact) }) });

function listate(ctx) {
  const produse = db().prepare('SELECT * FROM produs WHERE listat = 1').all();
  json(ctx.res, 200, { produse: produse.sort((a, b) => ro.compare(a.denumire, b.denumire)).map(pentruOferta) });
}

// o ofertă veche poate avea produse trecute între timp pe nelistat — le trebuie în continuare bara şi modul de facturare
function dupaCoduri(ctx) {
  const coduri = new URL(ctx.req.url, 'http://x').searchParams.getAll('cod').slice(0, 500);
  const unul = db().prepare('SELECT * FROM produs WHERE cod = ?');
  json(ctx.res, 200, { produse: coduri.map(c => unul.get(c)).filter(Boolean).map(pentruOferta) });
}

// pagina /produse: căutare după cuvinte (cod sau denumire, fără diacritice), câte 100 pe pagină
function lista(ctx) {
  const url = new URL(ctx.req.url, 'http://x').searchParams;
  const cuvinte = faraDiacritice(url.get('cauta') ?? '').split(/\s+/).filter(Boolean);
  const stare = { listate: 1, nelistate: 0 }[url.get('stare')];
  const unde = cuvinte.map(() => `fara_diacritice(cod || ' ' || denumire) LIKE ? ESCAPE '\\'`);
  const valori = cuvinte.map(c => `%${c.replace(/[\\%_]/g, '\\$&')}%`);
  if (stare != null) { unde.push('listat = ?'); valori.push(stare); }
  const conditie = unde.length ? `WHERE ${unde.join(' AND ')}` : '';
  const total = db().prepare(`SELECT COUNT(*) AS n FROM produs ${conditie}`).get(...valori).n;
  const pagini = Math.max(1, Math.ceil(total / PE_PAGINA));
  const pagina = Math.min(pagini, Math.max(1, Number(url.get('pagina')) || 1));
  const produse = db().prepare(`SELECT cod, denumire, um, grupa, listat, adaugat_la FROM produs ${conditie}
    ORDER BY fara_diacritice(denumire), cod LIMIT ${PE_PAGINA} OFFSET ${(pagina - 1) * PE_PAGINA}`).all(...valori);
  const { listate: nrListate, nelistate } = db().prepare('SELECT SUM(listat = 1) AS listate, SUM(listat = 0) AS nelistate FROM produs').get();
  json(ctx.res, 200, { produse, total, pagina, pagini, listate: nrListate ?? 0, nelistate: nelistate ?? 0 });
}

// codurile au spaţii şi „/" („SM10/GLASS"), de-aia vin în corp, nu în adresă
async function listare(ctx) {
  const { cod, listat } = await corpJson(ctx.req);
  const r = db().prepare('UPDATE produs SET listat = ? WHERE cod = ?').run(listat ? 1 : 0, String(cod ?? ''));
  if (!r.changes) return eroare(ctx.res, 404, 'Produsul nu există.');
  json(ctx.res, 200, { ok: true });
}

module.exports = {
  dinExport,
  rute: [
    ['GET',  '/api/produse',          { handler: listate }],
    ['GET',  '/api/produse/coduri',   { handler: dupaCoduri }],
    ['GET',  '/api/produse/lista',    { handler: lista }],
    ['POST', '/api/produse/verifica', { handler: verifica }],
    ['POST', '/api/produse/incarca',  { handler: incarca }],
    ['POST', '/api/produse/listare',  { handler: listare }],
  ],
};
