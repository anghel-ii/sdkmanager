const { db, ACUM, inTest, copiaLui } = require('./db.js');
const { json, eroare, corpJson } = require('./http.js');
const { anunta, anuntaUtilizator } = require('./evenimente.js');

// ═══════════════════════════════════════════════════════════════════════════
//  TICHETE (userul, 2026-10-13) — colegii îi scriu administratorului ce nu merge,
//  ce ar mai vrea în aplicaţie sau altceva. Pagina /tichete: oricine trimite şi
//  îşi vede tichetele; adminul le vede pe toate, le schimbă starea şi răspunde.
//  Când adminul schimbă ceva, autorul vede o insignă în meniu până deschide pagina.
//  Din 2026-10-22 fiecare tichet are o conversaţie, ca la taskuri (tichet_mesaj): autorul şi adminii îşi
//  scriu; schimbările de stare apar şi ele în fir. „Necitite" = ce a scris cealaltă parte şi n-ai deschis.
// ═══════════════════════════════════════════════════════════════════════════

const TIPURI = ['problema', 'idee', 'altceva'];
const STARI = ['nou', 'in_lucru', 'rezolvat', 'respins'];
const ETICHETA = { nou: 'nou', in_lucru: 'în lucru', rezolvat: 'rezolvat', respins: 'respins' };
const eAdmin = ctx => ctx.utilizator.rol === 'admin';
const CAMPURI = `t.*, uc.nume AS creat_de_nume, ur.nume AS raspuns_de_nume,
    COALESCE(c.oferta_nr, c.numar) AS comanda_nr, c.client_nume AS comanda_client
  FROM tichet t JOIN utilizator uc ON uc.id = t.creat_de LEFT JOIN utilizator ur ON ur.id = t.raspuns_de
  LEFT JOIN comanda c ON c.id = t.comanda_id`;

// mesajele pe care `u` nu le-a citit în tichetul t: autorul — ale celorlalţi; adminul — ale autorului
const NECITITE = `SELECT COUNT(*) FROM tichet_mesaj m WHERE m.tichet_id = t.id AND m.citit = 0 AND m.eveniment IS NULL
  AND (CASE WHEN t.creat_de = :eu THEN m.autor != :eu ELSE m.autor = t.creat_de END)`;

// insigna din meniu: adminul — tichetele noi + cele cu mesaje noi de la autor; ceilalţi — ale lor cu un
// răspuns / o stare nouă nevăzută
const deVazut = u => (u.rol === 'admin'
  ? db().prepare(`SELECT COUNT(*) AS n FROM tichet t WHERE t.stare = 'nou' OR (t.creat_de != :eu AND (${NECITITE}) > 0)`).get({ eu: u.id }).n
  : db().prepare(`SELECT COUNT(*) AS n FROM tichet t WHERE t.creat_de = :eu AND (t.vazut_de_autor = 0 OR (${NECITITE}) > 0)`).get({ eu: u.id }).n);

// adminul: toate cele deschise + cele închise în ultimele 90 de zile; ceilalţi: ale lor
function lista(ctx) {
  const toate = eAdmin(ctx), eu = ctx.utilizator.id;
  const tichete = db().prepare(`SELECT ${CAMPURI.replace('FROM tichet t', `, (${NECITITE}) AS necitite FROM tichet t`)}
    WHERE (t.stare IN ('nou', 'in_lucru') OR t.modificat_la > datetime(${ACUM()}, '-90 days')) ${toate ? '' : 'AND t.creat_de = :eu'}
    ORDER BY t.stare NOT IN ('nou', 'in_lucru'), t.modificat_la DESC`).all({ eu });
  const mesaje = Map.groupBy(tichete.length ? db().prepare(`SELECT m.id, m.tichet_id, m.autor, u.nume AS autor_nume, m.text,
      m.eveniment, m.creat_la FROM tichet_mesaj m JOIN utilizator u ON u.id = m.autor
    WHERE m.tichet_id IN (${tichete.map(t => t.id).join(',')}) ORDER BY m.creat_la, m.id`).all() : [], m => m.tichet_id);
  for (const t of tichete) t.mesaje = mesaje.get(t.id) ?? [];
  json(ctx.res, 200, { admin: toate, tichete });
}

// un rând în conversaţia tichetului: mesaj (eveniment null) sau o schimbare de stare
const inConversatie = (tichetId, autor, eveniment, text = '') => db().prepare(`INSERT INTO tichet_mesaj
  (tichet_id, autor, text, eveniment, creat_la) VALUES (?, ?, ?, ?, ${ACUM()})`).run(tichetId, autor, text, eveniment);
// tichetul, dacă `ctx.utilizator` are voie la conversaţia lui (autorul sau un admin)
const alMeu = ctx => db().prepare('SELECT * FROM tichet WHERE id = ? AND (creat_de = ? OR ?)')
  .get(Number(ctx.params.id), ctx.utilizator.id, eAdmin(ctx) ? 1 : 0);
const scurt = (t, n) => (t.length > n ? t.slice(0, n) + '…' : t);

// mesaj în conversaţie: autorul ↔ adminii. Cealaltă parte primeşte o notificare (dreapta jos).
async function raspunde(ctx) {
  const t = alMeu(ctx);
  if (!t) return eroare(ctx.res, 404, 'Tichetul nu există.');
  const text = String((await corpJson(ctx.req)).text ?? '').trim().slice(0, 4000);
  if (!text) return eroare(ctx.res, 400, 'Scrie mesajul.');
  inConversatie(t.id, ctx.utilizator.id, null, text);
  db().prepare(`UPDATE tichet SET modificat_la = ${ACUM()} WHERE id = ?`).run(t.id);
  const catre = t.creat_de === ctx.utilizator.id
    ? db().prepare("SELECT id FROM utilizator WHERE rol = 'admin' AND activ = 1 AND id != ?").all(ctx.utilizator.id).map(u => u.id)
    : [t.creat_de];
  const { notifica } = require('./notificari.js');
  for (const id of catre) notifica(id, {
    titlu: t.creat_de === ctx.utilizator.id ? `Mesaj de la ${ctx.utilizator.nume} (tichet)` : 'Răspuns la tichetul tău',
    text: `„${scurt(t.text, 90)}”\n${ctx.utilizator.nume}: ${scurt(text, 220)}`,
    link: `/tichete?tichet=${t.id}`,
  });
  anunta({ tichet: t.id });
  json(ctx.res, 201, { ok: true });
}

// am deschis conversaţia: ce a scris cealaltă parte e citit (insigna din meniu scade)
function citit(ctx) {
  const t = alMeu(ctx);
  if (!t) return eroare(ctx.res, 404, 'Tichetul nu există.');
  const r = t.creat_de === ctx.utilizator.id
    ? db().prepare('UPDATE tichet_mesaj SET citit = 1 WHERE tichet_id = ? AND autor != ? AND citit = 0').run(t.id, ctx.utilizator.id)
    : db().prepare('UPDATE tichet_mesaj SET citit = 1 WHERE tichet_id = ? AND autor = ? AND citit = 0').run(t.id, t.creat_de);
  if (r.changes) anuntaUtilizator(ctx.utilizator.id);
  json(ctx.res, 200, { ok: true });
}

async function trimite(ctx) {
  const corp = await corpJson(ctx.req);
  const text = String(corp.text ?? '').trim().slice(0, 4000);
  if (!TIPURI.includes(corp.tip)) return eroare(ctx.res, 400, 'Alege ce fel de tichet e.');
  const pagina = corp.pagina ? String(corp.pagina).slice(0, 300) : null;
  // „+ Tichet" de pe o comandă: tichetul e mereu pe bune (index.js), comanda o căutăm unde lucrează omul (test sau nu)
  const comandaId = corp.comanda_id == null ? null : Number(corp.comanda_id);
  const exista = () => db().prepare('SELECT 1 FROM comanda WHERE id = ?').get(comandaId);
  if (comandaId !== null && !(ctx.utilizator.mod_test ? inTest(exista, copiaLui(ctx.utilizator)) : exista())) return eroare(ctx.res, 400, 'Comandă inexistentă.');
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
  // şi în conversaţie: răspunsul (câmpul vechi) ca mesaj, starea nouă ca eveniment
  if (raspuns && raspuns !== t.raspuns) inConversatie(id, ctx.utilizator.id, null, raspuns);
  if (stare !== t.stare) inConversatie(id, ctx.utilizator.id, 'stare', stare);
  // autorul primeşte o notificare (stânga jos, până o închide — server/notificari.js; userul, 2026-10-19)
  if (t.creat_de !== ctx.utilizator.id) {
    const raspunsNou = raspuns && raspuns !== t.raspuns, stareNoua = stare !== t.stare;
    require('./notificari.js').notifica(t.creat_de, {
      titlu: raspunsNou ? 'Răspuns la tichetul tău' : `Tichetul tău: ${ETICHETA[stare]}`,
      text: [`„${t.text.length > 90 ? t.text.slice(0, 90) + '…' : t.text}”`,
        raspunsNou && `${ctx.utilizator.nume}: ${raspuns.length > 220 ? raspuns.slice(0, 220) + '…' : raspuns}`,
        raspunsNou && stareNoua && `Stare: ${ETICHETA[stare]}`].filter(Boolean).join('\n'),
      link: '/tichete',
    });
  }
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
    ['POST',  '/api/tichete/:id/raspuns', { handler: raspunde }],
    ['POST',  '/api/tichete/:id/citit',   { handler: citit }],
  ],
};
