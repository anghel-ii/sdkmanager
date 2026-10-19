const { db, ACUM } = require('./db.js');
const { json, eroare } = require('./http.js');

// ═══════════════════════════════════════════════════════════════════════════
//  NOTIFICĂRI (userul, 2026-10-19). Ce primeşte un om — deocamdată: un răspuns
//  sau o stare nouă la tichetul lui (server/tichete.js) — stă în dreapta jos, pe
//  orice pagină a managerului (web/bara.js), se adună una sub alta şi dispare
//  DOAR când apasă X. Ţinute aici, nu în browser: rămân la reîncărcare, pe orice
//  calculator. Mereu pe bune (index.js PE_BUNE), şi pentru cei în demo.
// ═══════════════════════════════════════════════════════════════════════════

function notifica(utilizatorId, { titlu, text = '', link = null }) {
  db().prepare(`INSERT INTO notificare (utilizator_id, titlu, text, link, creat_la) VALUES (?, ?, ?, ?, ${ACUM()})`)
    .run(utilizatorId, String(titlu).slice(0, 200), String(text).slice(0, 1000), link);
}

// ale mele, deschise, cele mai vechi sus (se adaugă dedesubt)
const lista = ctx => json(ctx.res, 200, { notificari: db().prepare(`SELECT id, titlu, text, link, creat_la FROM notificare
  WHERE utilizator_id = ? AND inchisa_la IS NULL ORDER BY creat_la, id`).all(ctx.utilizator.id) });

function inchide(ctx) {
  const r = db().prepare(`UPDATE notificare SET inchisa_la = ${ACUM()} WHERE id = ? AND utilizator_id = ? AND inchisa_la IS NULL`)
    .run(Number(ctx.params.id), ctx.utilizator.id);
  if (!r.changes) return eroare(ctx.res, 404, 'Notificare inexistentă.');
  json(ctx.res, 200, { ok: true });
}

module.exports = {
  notifica,
  rute: [
    ['GET',  '/api/notificari',             { handler: lista }],
    ['POST', '/api/notificari/:id/inchide', { handler: inchide }],
  ],
};
