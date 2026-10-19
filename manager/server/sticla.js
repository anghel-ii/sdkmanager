const { db, tranzactie, ACUM, comenziDemo } = require('./db.js');
const { json, eroare, corpJson } = require('./http.js');
const { anunta } = require('./evenimente.js');
const { FARA_CERERE } = require('./cereri.js');

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

// Numele complete şi adresa de comenzi stau în tabelul `furnizor` (migraţia v24),
// modificabile din pagina Comandă sticlă (cardul „Mailuri furnizori"). Fără e-mail,
// butonul „Trimite pe mail" deschide un mail fără destinatar (îl scrii tu).
const EXCEPTII = { CT: 'CS' };   // prefix → furnizor (din Excel: CT063 → CS)
const furnizori = () => new Map(db().prepare('SELECT cod, nume, email FROM furnizor').all().map(f => [f.cod, f]));

function furnizorDupaCod(cod, F = furnizori()) {
  const p = String(cod || '').trim().toUpperCase().match(/^[A-Z]+/)?.[0] ?? '?';
  const f = EXCEPTII[p] ?? p;
  return { cod: f, nume: F.get(f)?.nume ?? f, email: F.get(f)?.email ?? '' };
}

// „1144 × 384 mm" → [1144, 384]
const cote = t => (String(t || '').match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/) ?? []).slice(1, 3).map(Number);

// Linie „sticla" din DB → cu cote numerice, mp şi furnizor (F = furnizorii, citiţi o dată pe cerere)
function imbogateste(r, F) {
  const [h, l] = cote(r.debitare);
  const buc = r.cantitate;
  return { ...r, h, l, buc, mp: h && l ? Math.round(h * l * buc / 1e4) / 100 : null,
           furnizor: furnizorDupaCod(r.cod, F) };
}

// Sticla unei singure comenzi (pagina comenzii: mail + bifă pe furnizor)
const sticlaComenzii = (comandaId, F = furnizori()) => db().prepare(`
  SELECT l.id, l.cod, l.denumire, l.cantitate, l.debitare, l.comandat_la, u.nume AS comandat_de_nume
    FROM pozitie_linie l JOIN pozitie p ON p.id = l.pozitie_id
    LEFT JOIN utilizator u ON u.id = l.comandat_de
   WHERE p.comanda_id = ? AND l.lista = 'sticla' ORDER BY l.idx`).all(comandaId).map(r => imbogateste(r, F));

function lista(ctx) {
  const comandate = new URL(ctx.req.url, 'http://x').searchParams.get('comandate') === '1';
  const randuri = db().prepare(`
    SELECT l.id, l.cod, l.denumire, l.cantitate, l.debitare, l.comandat_la,
           u.nume AS comandat_de_nume,
           c.id AS comanda_id, COALESCE(c.oferta_nr, c.numar) AS numar, c.client_nume
      FROM pozitie_linie l
      JOIN pozitie p ON p.id = l.pozitie_id
      JOIN comanda c ON c.id = p.comanda_id
      LEFT JOIN utilizator u ON u.id = l.comandat_de
     WHERE l.lista = 'sticla' AND c.tip = 'comanda' AND c.anulat = 0 AND ${FARA_CERERE}
       AND l.comandat_la IS ${comandate ? 'NOT NULL' : 'NULL'}
       ${comandate ? 'AND c.finalizat_la IS NULL' : ''}   -- „comandate": doar comenzile încă în lucru
     ORDER BY ${comandate ? 'l.comandat_la DESC,' : ''} c.creat_la, l.idx
     ${comandate ? 'LIMIT 500' : ''}`).all();

  // (comenzile salvate înainte de 2026-09-22 n-au lista sticla, deci nu apar aici)
  const demo = comenziDemo();   // în demo: comenzile care nu mai sunt ca pe bune
  const F = furnizori();
  json(ctx.res, 200, {
    linii: randuri.map(r => ({ ...imbogateste(r, F), ...(demo.has(r.comanda_id) && { demo: true }) })),
  });
}

// ── Mailurile furnizorilor (userul, 2026-10-19 — cardul din dreapta al paginii) ──
const ADRESA = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/;

function listaFurnizori(ctx) {
  json(ctx.res, 200, { furnizori: db().prepare(`SELECT f.cod, f.nume, f.email, f.modificat_la, u.nume AS modificat_de_nume
    FROM furnizor f LEFT JOIN utilizator u ON u.id = f.modificat_de ORDER BY f.nume COLLATE NOCASE`).all() });
}

// { email }: una sau mai multe adrese (virgulă / punct şi virgulă / spaţiu), sau gol = fără adresă.
// Un furnizor nou (prefix apărut în coduri, încă fără rând) se adaugă cu numele = codul.
async function schimbaEmail(ctx) {
  const cod = String(ctx.params.cod).toUpperCase();
  if (!/^[A-Z]{1,10}$/.test(cod)) return eroare(ctx.res, 400, 'Cod de furnizor greşit.');
  const adrese = String((await corpJson(ctx.req)).email ?? '').split(/[\s,;]+/).map(a => a.trim().toLowerCase()).filter(Boolean);
  const gresita = adrese.find(a => !ADRESA.test(a));
  if (gresita) return eroare(ctx.res, 400, `„${gresita}" nu e o adresă de e-mail bună.`);
  const email = [...new Set(adrese)].join(', ');
  if (email.length > 300) return eroare(ctx.res, 400, 'Prea multe adrese.');
  db().prepare(`INSERT INTO furnizor (cod, nume, email, modificat_la, modificat_de) VALUES (?, ?, ?, ${ACUM()}, ?)
    ON CONFLICT (cod) DO UPDATE SET email = excluded.email, modificat_la = excluded.modificat_la, modificat_de = excluded.modificat_de`)
    .run(cod, cod, email, ctx.utilizator.id);
  anunta({ sticla: true });
  json(ctx.res, 200, { furnizor: db().prepare(`SELECT f.cod, f.nume, f.email, f.modificat_la, u.nume AS modificat_de_nume
    FROM furnizor f LEFT JOIN utilizator u ON u.id = f.modificat_de WHERE f.cod = ?`).get(cod) });
}

// Marchează liniile ca trimise la furnizor (sau le readuce la „de comandat").
function marcheaza(comandat) {
  return async ctx => {
    const corp = await corpJson(ctx.req);
    const ids = (Array.isArray(corp.ids) ? corp.ids : []).map(Number).filter(Number.isInteger);
    if (!ids.length) return eroare(ctx.res, 400, 'Nicio linie aleasă.');
    const n = tranzactie(d => {
      const st = d.prepare(`UPDATE pozitie_linie SET comandat_la = ${comandat ? ACUM() : 'NULL'},
                              comandat_de = ? WHERE id = ? AND lista = 'sticla'
                              AND NOT EXISTS (SELECT 1 FROM pozitie p JOIN cerere r ON r.comanda_id = p.comanda_id
                                               AND r.stare = 'deschisa' WHERE p.id = pozitie_linie.pozitie_id)`);
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
   WHERE l.lista = 'sticla' AND l.comandat_la IS NULL AND c.tip = 'comanda' AND c.anulat = 0 AND ${FARA_CERERE}`).get().buc;

module.exports = {
  furnizorDupaCod, sumarSticla, sticlaComenzii,
  rute: [
    ['GET',  '/api/sticla',          { handler: lista }],
    ['POST', '/api/sticla/comanda',  { handler: marcheaza(true) }],
    ['POST', '/api/sticla/anuleaza', { handler: marcheaza(false) }],
    ['GET',  '/api/sticla/furnizori',      { handler: listaFurnizori }],
    ['PUT',  '/api/sticla/furnizori/:cod', { handler: schimbaEmail }],
  ],
};
