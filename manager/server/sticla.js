const { db, tranzactie } = require('./db.js');
const { json, eroare, corpJson } = require('./http.js');
const { anunta } = require('./evenimente.js');

// ═══════════════════════════════════════════════════════════════════════════
//  COMANDĂ STICLĂ — tot ce trebuie comandat la furnizori, grupat pe furnizor.
//
//  Sursa: lista „sticla" salvată cu fiecare comandă (configuratorul o trimite la
//  „Salvează oferta": sticla uşilor / ramelor asamblate de NOI — cod, cotă,
//  bucăţi). Intră doar comenzile ACCEPTATE (nu ofertele), neanulate. O linie
//  iese din „de comandat" când e marcată comandată (`comandat_la`).
//
//  Furnizorul = literele de la începutul codului (GG001 → GG), cu excepţiile
//  din formularul Excel de rame (foaia ComandaSticla): CT063 se comandă la CS.
// ═══════════════════════════════════════════════════════════════════════════

// Numele complete şi adresa de comenzi — ce lipseşte rămâne codul / gol, până
// le completează userul. Fără e-mail, butonul „Trimite pe mail" deschide un
// mail fără destinatar (îl scrii tu).
const FURNIZORI = {
  GG:  { nume: 'GoldenGlass', email: 'comenzi@goldenglass.ro' },
  OVI: { nume: 'OviBest',     email: '' },
  CS:  { nume: 'CS',          email: '' },
  HD:  { nume: 'HD',          email: '' },
  CG:  { nume: 'CG',          email: '' },
  TG:  { nume: 'TG',          email: '' },
};
const EXCEPTII = { CT: 'CS' };   // prefix → furnizor (din Excel: CT063 → CS)

function furnizorDupaCod(cod) {
  const p = String(cod || '').trim().toUpperCase().match(/^[A-Z]+/)?.[0] ?? '?';
  const f = EXCEPTII[p] ?? p;
  return { cod: f, nume: FURNIZORI[f]?.nume ?? f, email: FURNIZORI[f]?.email ?? '' };
}

// „1144 × 384 mm" → [1144, 384]
const cote = t => (String(t || '').match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/) ?? []).slice(1, 3).map(Number);

// Linie „sticla" din DB → cu cote numerice, mp şi furnizor
function imbogateste(r) {
  const [h, l] = cote(r.debitare);
  const buc = r.cantitate;
  return { ...r, h, l, buc, mp: h && l ? Math.round(h * l * buc / 1e4) / 100 : null,
           furnizor: furnizorDupaCod(r.cod) };
}

// Sticla unei singure comenzi (pagina comenzii: mail + bifă pe furnizor)
const sticlaComenzii = comandaId => db().prepare(`
  SELECT l.id, l.cod, l.denumire, l.cantitate, l.debitare, l.comandat_la, u.nume AS comandat_de_nume
    FROM pozitie_linie l JOIN pozitie p ON p.id = l.pozitie_id
    LEFT JOIN utilizator u ON u.id = l.comandat_de
   WHERE p.comanda_id = ? AND l.lista = 'sticla' ORDER BY l.idx`).all(comandaId).map(imbogateste);

function lista(ctx) {
  const comandate = new URL(ctx.req.url, 'http://x').searchParams.get('comandate') === '1';
  const randuri = db().prepare(`
    SELECT l.id, l.cod, l.denumire, l.cantitate, l.debitare, l.comandat_la,
           u.nume AS comandat_de_nume,
           c.id AS comanda_id, COALESCE(c.numar_comanda, c.numar) AS numar, c.client_nume
      FROM pozitie_linie l
      JOIN pozitie p ON p.id = l.pozitie_id
      JOIN comanda c ON c.id = p.comanda_id
      LEFT JOIN utilizator u ON u.id = l.comandat_de
     WHERE l.lista = 'sticla' AND c.tip = 'comanda' AND c.anulat = 0
       AND l.comandat_la IS ${comandate ? 'NOT NULL' : 'NULL'}
     ORDER BY ${comandate ? 'l.comandat_la DESC,' : ''} c.creat_la, l.idx
     ${comandate ? 'LIMIT 500' : ''}`).all();

  // (comenzile salvate înainte de 2026-09-22 n-au lista sticla, deci nu apar aici)
  json(ctx.res, 200, {
    linii: randuri.map(imbogateste),
  });
}

// Marchează liniile ca trimise la furnizor (sau le readuce la „de comandat").
function marcheaza(comandat) {
  return async ctx => {
    const corp = await corpJson(ctx.req);
    const ids = (Array.isArray(corp.ids) ? corp.ids : []).map(Number).filter(Number.isInteger);
    if (!ids.length) return eroare(ctx.res, 400, 'Nicio linie aleasă.');
    const n = tranzactie(d => {
      const st = d.prepare(`UPDATE pozitie_linie SET comandat_la = ${comandat ? "datetime('now')" : 'NULL'},
                              comandat_de = ? WHERE id = ? AND lista = 'sticla'`);
      return ids.reduce((s, id) => s + Number(st.run(comandat ? ctx.utilizator.id : null, id).changes), 0);
    });
    anunta({ sticla: true });
    json(ctx.res, 200, { actualizate: n });
  };
}

// Pt. pagina principală: câte bucăţi aşteaptă să fie comandate
const sumarSticla = () => db().prepare(`
  SELECT COALESCE(SUM(l.cantitate), 0) AS buc FROM pozitie_linie l
    JOIN pozitie p ON p.id = l.pozitie_id JOIN comanda c ON c.id = p.comanda_id
   WHERE l.lista = 'sticla' AND l.comandat_la IS NULL AND c.tip = 'comanda' AND c.anulat = 0`).get().buc;

module.exports = {
  furnizorDupaCod, sumarSticla, sticlaComenzii,
  rute: [
    ['GET',  '/api/sticla',          { handler: lista }],
    ['POST', '/api/sticla/comanda',  { handler: marcheaza(true) }],
    ['POST', '/api/sticla/anuleaza', { handler: marcheaza(false) }],
  ],
};
