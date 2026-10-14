const { db, tranzactie, ACUM } = require('./db.js');
const { json, eroare, corpJson } = require('./http.js');
const { anunta } = require('./evenimente.js');

// ═══════════════════════════════════════════════════════════════════════════
//  CERERI (TICHETE) PENTRU CONDUCERE — userul, 2026-10-13. Deocamdată anularea
//  unei comenzi (orice stare): oricine o cere din pagina comenzii, cu motivul;
//  conducerea sau adminul o aprobă (comanda devine anulată — iese din liste,
//  din sticlă, din livrări) ori o respinge, cu un răspuns. Pagina /cereri.
// ═══════════════════════════════════════════════════════════════════════════

const DECID = ['admin', 'conducere'];
const CAMPURI = `r.*, uc.nume AS creat_de_nume, ud.nume AS decis_de_nume,
  COALESCE(c.oferta_nr, c.numar) AS comanda_nr, c.client_nume, c.tip AS comanda_tip, c.factura_nr, c.finalizat_la`;
const DIN = `FROM cerere r JOIN utilizator uc ON uc.id = r.creat_de LEFT JOIN utilizator ud ON ud.id = r.decis_de
  LEFT JOIN comanda c ON c.id = r.comanda_id`;

// pt. pagina comenzii: ultima cerere de anulare (deschisă sau decisă)
const cerereComenzii = id => db().prepare(`SELECT ${CAMPURI} ${DIN} WHERE r.comanda_id = ? AND r.tip = 'anulare'
  ORDER BY r.id DESC LIMIT 1`).get(id) ?? null;
// „Pe hold" (userul, 2026-10-14): o comandă cu cerere de anulare nedecisă nu mai apare la
// sticlă şi la livrări, iar operaţiile pe ea sunt refuzate (index.js) — până decide conducerea.
// FARA_CERERE se pune în WHERE-ul unei interogări cu comanda ca alias `c`.
const FARA_CERERE = "NOT EXISTS (SELECT 1 FROM cerere r WHERE r.comanda_id = c.id AND r.stare = 'deschisa')";
const peHold = id => !!db().prepare("SELECT 1 FROM cerere WHERE comanda_id = ? AND stare = 'deschisa'").get(id);
// pt. insigna din meniu (conducere / admin)
const nrDeschise = () => db().prepare("SELECT COUNT(*) AS n FROM cerere WHERE stare = 'deschisa'").get().n;

async function cereAnulare(ctx) {
  const id = Number(ctx.params.id);
  const motiv = String((await corpJson(ctx.req)).motiv ?? '').trim().slice(0, 1000);
  const c = db().prepare('SELECT * FROM comanda WHERE id = ?').get(id);
  if (!c) return eroare(ctx.res, 404, 'Comanda nu există.');
  if (c.anulat) return eroare(ctx.res, 409, 'Comanda e deja anulată.');
  if (motiv.length < 3) return eroare(ctx.res, 400, 'Scrie motivul anulării.');
  try {
    const r = db().prepare(`INSERT INTO cerere (tip, comanda_id, motiv, creat_de, creat_la) VALUES ('anulare', ?, ?, ?, ${ACUM()})`)
      .run(id, motiv, ctx.utilizator.id);
    anunta({ comanda: id });
    json(ctx.res, 201, { cerere: cerereComenzii(id), id: Number(r.lastInsertRowid) });
  } catch (e) {
    if (/UNIQUE/i.test(e.message)) return eroare(ctx.res, 409, 'Există deja o cerere de anulare pentru comanda asta, aşteaptă decizia conducerii.');
    throw e;
  }
}

// conducerea / adminul: toate (deschise primele, apoi cele decise în ultimele 60 de zile); ceilalţi: ale lor
function lista(ctx) {
  const toate = DECID.includes(ctx.utilizator.rol);
  json(ctx.res, 200, { poateDecide: toate, cereri: db().prepare(`SELECT ${CAMPURI} ${DIN}
    WHERE (r.stare = 'deschisa' OR r.decis_la > datetime(${ACUM()}, '-60 days')) ${toate ? '' : 'AND r.creat_de = ?'}
    ORDER BY r.stare <> 'deschisa', COALESCE(r.decis_la, r.creat_la) DESC`).all(...(toate ? [] : [ctx.utilizator.id])) });
}

// aprobă: comanda devine anulată (şi iese din livrarea programată, dacă era într-una); respinge: doar se închide
const decide = aproba => async ctx => {
  const id = Number(ctx.params.id);
  const raspuns = String((await corpJson(ctx.req)).raspuns ?? '').trim().slice(0, 1000) || null;
  const r = db().prepare('SELECT * FROM cerere WHERE id = ?').get(id);
  if (!r) return eroare(ctx.res, 404, 'Cererea nu există.');
  if (r.stare !== 'deschisa') return eroare(ctx.res, 409, 'Cererea a fost deja decisă.');
  tranzactie(d => {
    d.prepare(`UPDATE cerere SET stare = ?, decis_de = ?, decis_la = ${ACUM()}, raspuns = ? WHERE id = ?`)
      .run(aproba ? 'aprobata' : 'respinsa', ctx.utilizator.id, raspuns, id);
    if (aproba && r.tip === 'anulare' && r.comanda_id) {
      d.prepare('UPDATE comanda SET anulat = 1 WHERE id = ?').run(r.comanda_id);
      d.prepare('DELETE FROM livrare_comanda WHERE comanda_id = ?').run(r.comanda_id);
    }
  });
  anunta({ comanda: r.comanda_id });
  json(ctx.res, 200, { ok: true });
};

module.exports = {
  cerereComenzii, nrDeschise, FARA_CERERE, peHold,
  rute: [
    ['POST', '/api/comenzi/:id/anulare',     { handler: cereAnulare }],
    ['GET',  '/api/cereri',                  { handler: lista }],
    ['POST', '/api/cereri/:id/aproba',       { handler: decide(true), rol: DECID }],
    ['POST', '/api/cereri/:id/respinge',     { handler: decide(false), rol: DECID }],
  ],
};
