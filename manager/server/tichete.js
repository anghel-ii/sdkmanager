const { db, ACUM, inTest } = require('./db.js');
const { json, eroare, corpJson } = require('./http.js');
const { anunta } = require('./evenimente.js');

// ═══════════════════════════════════════════════════════════════════════════
//  TICHETE (userul, 2026-10-13) — colegii îi scriu administratorului ce nu merge,
//  ce ar mai vrea în aplicaţie sau altceva. Pagina /tichete: oricine trimite şi
//  îşi vede tichetele; adminul le vede pe toate, le schimbă starea şi răspunde.
//  Când adminul schimbă ceva, autorul vede o insignă în meniu până deschide pagina.
// ═══════════════════════════════════════════════════════════════════════════

const TIPURI = ['problema', 'idee', 'altceva'];
const STARI = ['nou', 'in_lucru', 'rezolvat', 'respins'];
const eAdmin = ctx => ctx.utilizator.rol === 'admin';
const CAMPURI = `t.*, uc.nume AS creat_de_nume, ur.nume AS raspuns_de_nume,
    COALESCE(c.oferta_nr, c.numar) AS comanda_nr, c.client_nume AS comanda_client
  FROM tichet t JOIN utilizator uc ON uc.id = t.creat_de LEFT JOIN utilizator ur ON ur.id = t.raspuns_de
  LEFT JOIN comanda c ON c.id = t.comanda_id`;

// insigna din meniu: adminul — tichetele noi; ceilalţi — ale lor cu un răspuns / o stare nouă nevăzută
const deVazut = u => (u.rol === 'admin'
  ? db().prepare("SELECT COUNT(*) AS n FROM tichet WHERE stare = 'nou'").get().n
  : db().prepare('SELECT COUNT(*) AS n FROM tichet WHERE creat_de = ? AND vazut_de_autor = 0').get(u.id).n);

// adminul: toate cele deschise + cele închise în ultimele 90 de zile; ceilalţi: ale lor
function lista(ctx) {
  const toate = eAdmin(ctx);
  json(ctx.res, 200, { admin: toate, tichete: db().prepare(`SELECT ${CAMPURI}
    WHERE (t.stare IN ('nou', 'in_lucru') OR t.modificat_la > datetime(${ACUM()}, '-90 days')) ${toate ? '' : 'AND t.creat_de = ?'}
    ORDER BY t.stare NOT IN ('nou', 'in_lucru'), t.modificat_la DESC`).all(...(toate ? [] : [ctx.utilizator.id])) });
}

async function trimite(ctx) {
  const corp = await corpJson(ctx.req);
  const text = String(corp.text ?? '').trim().slice(0, 4000);
  if (!TIPURI.includes(corp.tip)) return eroare(ctx.res, 400, 'Alege ce fel de tichet e.');
  const pagina = corp.pagina ? String(corp.pagina).slice(0, 300) : null;
  // „+ Tichet" de pe o comandă: tichetul e mereu pe bune (index.js), comanda o căutăm unde lucrează omul (test sau nu)
  const comandaId = corp.comanda_id == null ? null : Number(corp.comanda_id);
  const exista = () => db().prepare('SELECT 1 FROM comanda WHERE id = ?').get(comandaId);
  if (comandaId !== null && !(ctx.utilizator.mod_test ? inTest(exista) : exista())) return eroare(ctx.res, 400, 'Comandă inexistentă.');
  // fără minim de caractere (userul, 2026-10-15); gol doar dacă e pus pe o comandă
  if (!text && comandaId === null) return eroare(ctx.res, 400, 'Scrie pe scurt ce s-a întâmplat sau ce ai vrea.');
  const r = db().prepare(`INSERT INTO tichet (tip, text, pagina, comanda_id, creat_de, creat_la, modificat_la)
    VALUES (?, ?, ?, ?, ?, ${ACUM()}, ${ACUM()})`).run(corp.tip, text, pagina, comandaId, ctx.utilizator.id);
  anunta({ tichet: Number(r.lastInsertRowid) });
  json(ctx.res, 201, { id: Number(r.lastInsertRowid) });
}

// adminul: starea şi / sau răspunsul (răspunsul gol îl şterge)
async function modifica(ctx) {
  const id = Number(ctx.params.id);
  const corp = await corpJson(ctx.req);
  const t = db().prepare('SELECT * FROM tichet WHERE id = ?').get(id);
  if (!t) return eroare(ctx.res, 404, 'Tichetul nu există.');
  if (corp.stare != null && !STARI.includes(corp.stare)) return eroare(ctx.res, 400, 'Stare necunoscută.');
  const stare = corp.stare ?? t.stare;
  const raspuns = corp.raspuns === undefined ? t.raspuns : (String(corp.raspuns ?? '').trim().slice(0, 4000) || null);
  if (stare === t.stare && raspuns === t.raspuns) return json(ctx.res, 200, { ok: true });
  db().prepare(`UPDATE tichet SET stare = ?, raspuns = ?, raspuns_de = ?, modificat_la = ${ACUM()}, vazut_de_autor = ? WHERE id = ?`)
    .run(stare, raspuns, ctx.utilizator.id, t.creat_de === ctx.utilizator.id ? 1 : 0, id);
  anunta({ tichet: id });
  json(ctx.res, 200, { ok: true });
}

// autorul a deschis pagina: răspunsurile lui sunt văzute
function vazute(ctx) {
  db().prepare('UPDATE tichet SET vazut_de_autor = 1 WHERE creat_de = ? AND vazut_de_autor = 0').run(ctx.utilizator.id);
  json(ctx.res, 200, { ok: true });
}

module.exports = {
  deVazut,
  rute: [
    ['GET',   '/api/tichete',         { handler: lista }],
    ['POST',  '/api/tichete',         { handler: trimite }],
    ['POST',  '/api/tichete/vazute',  { handler: vazute }],
    ['PATCH', '/api/tichete/:id',     { handler: modifica, rol: ['admin'] }],
  ],
};
