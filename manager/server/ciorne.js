const { db, ACUM } = require('./db.js');
const { json, eroare, corpJson } = require('./http.js');

// ═══════════════════════════════════════════════════════════════════════════
//  CIORNE (userul, 2026-10-13) — oferta începută în configurator şi nesalvată:
//  la plecare („Salvează ca ciornă") starea paginii se păstrează aici, pe contul
//  omului, ca s-o reia de pe orice calculator (pagina principală: „Ciornele mele").
//  Serverul nu interpretează nimic din ea — e starea configuratorului, ca JSON.
//  Ciorna se şterge când oferta se salvează de-adevăratelea.
// ═══════════════════════════════════════════════════════════════════════════

const MAX_PE_OM = 30;   // cele mai vechi peste număr se şterg
const PAGINI = ['configurator', 'amanunt'];
const ale = ctx => db().prepare('SELECT * FROM ciorna WHERE id = ? AND utilizator_id = ?').get(Number(ctx.params.id), ctx.utilizator.id);

const lista = ctx => json(ctx.res, 200, { ciorne: db().prepare(`SELECT id, pagina, gama, titlu, creat_la, modificat_la
  FROM ciorna WHERE utilizator_id = ? ORDER BY modificat_la DESC`).all(ctx.utilizator.id) });

function una(ctx) {
  const c = ale(ctx);
  if (!c) return eroare(ctx.res, 404, 'Ciorna nu (mai) există.');
  json(ctx.res, 200, { ciorna: { ...c, date: JSON.parse(c.date_json), date_json: undefined } });
}

// { id?, pagina, gama, titlu, date } — fără id = ciornă nouă; cu id = o actualizează (doar pe a ta)
async function salveaza(ctx) {
  const corp = await corpJson(ctx.req);
  if (!PAGINI.includes(corp.pagina)) return eroare(ctx.res, 400, 'Pagină necunoscută.');
  if (!corp.date || typeof corp.date !== 'object') return eroare(ctx.res, 400, 'Ciorna e goală.');
  const titlu = String(corp.titlu ?? '').trim().slice(0, 200) || 'Ofertă începută';
  const gama = corp.gama ? String(corp.gama).slice(0, 40) : null, date = JSON.stringify(corp.date);
  const eu = ctx.utilizator.id;
  let id = Number(corp.id) || null;
  if (id && db().prepare('SELECT 1 FROM ciorna WHERE id = ? AND utilizator_id = ?').get(id, eu)) {
    db().prepare(`UPDATE ciorna SET pagina = ?, gama = ?, titlu = ?, date_json = ?, modificat_la = ${ACUM()} WHERE id = ?`)
      .run(corp.pagina, gama, titlu, date, id);
  } else {
    id = Number(db().prepare(`INSERT INTO ciorna (utilizator_id, pagina, gama, titlu, date_json, creat_la, modificat_la)
      VALUES (?, ?, ?, ?, ?, ${ACUM()}, ${ACUM()})`).run(eu, corp.pagina, gama, titlu, date).lastInsertRowid);
    db().prepare(`DELETE FROM ciorna WHERE utilizator_id = ? AND id NOT IN
      (SELECT id FROM ciorna WHERE utilizator_id = ? ORDER BY modificat_la DESC, id DESC LIMIT ${MAX_PE_OM})`).run(eu, eu);
  }
  json(ctx.res, 200, { id });
}

function sterge(ctx) {
  const c = ale(ctx);
  if (c) db().prepare('DELETE FROM ciorna WHERE id = ?').run(c.id);
  json(ctx.res, 200, { ok: true });   // deja ştearsă = tot bine (oferta salvată o şterge oricum)
}

module.exports = {
  rute: [
    ['GET',    '/api/ciorne',     { handler: lista }],
    ['GET',    '/api/ciorne/:id', { handler: una }],
    ['POST',   '/api/ciorne',     { handler: salveaza }],
    ['DELETE', '/api/ciorne/:id', { handler: sterge }],
  ],
};
