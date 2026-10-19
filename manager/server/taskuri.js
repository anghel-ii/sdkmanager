const { db, ACUM } = require('./db.js');
const { json, eroare, corpJson } = require('./http.js');
const { anunta, anuntaUtilizator } = require('./evenimente.js');

// ═══════════════════════════════════════════════════════════════════════════
//  TASKURI + REMINDERE (userul, 2026-10-08). Un task e dat cuiva dintre
//  utilizatori (îl vede el şi cel care l-a creat), opţional legat de o comandă,
//  cu o scadenţă la care apare notificarea. Notificarea o face browserul:
//  bara.js întreabă din minut în minut /api/taskuri/scadente (web/taskuri).
//  Fiecare task are o mini-conversaţie (userul, 2026-10-15) între cei doi: răspunsuri
//  + ce s-a întâmplat (pus în aşteptare, reluat, făcut). Ce scrie unul e „necitit” la
//  celălalt până deschide conversaţia — numărul intră în insigna „Taskuri” din meniu.
//  Un task în aşteptare nu mai dă reminder până se reia.
// ═══════════════════════════════════════════════════════════════════════════

// „2026-10-09T09:00" din <input type=datetime-local> = ora ROMÂNIEI (oricare ar fi
// fusul calculatorului) → UTC în formatul SQLite. null dacă nu e o dată.
const RO = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const caUtc = ms => { const p = Object.fromEntries(RO.formatToParts(ms).map(x => [x.type, x.value]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute); };
function dinOraRomaniei(t) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t) || Number.isNaN(Date.parse(t + 'Z'))) return null;
  const perete = Date.parse(t + 'Z');                 // ora scrisă, citită ca UTC
  let utc = perete - (caUtc(perete) - perete);        // minus decalajul României (2 sau 3 ore)
  utc = perete - (caUtc(utc) - utc);                  // decalajul din momentul ăla (schimbarea orei)
  return new Date(utc).toISOString().slice(0, 19).replace('T', ' ');
}

const CAMPURI = `t.id, t.text, t.scadenta, t.pentru, t.creat_de, t.comanda_id, t.creat_la, t.facut_la, t.in_asteptare_la,
  up.nume AS pentru_nume, uc.nume AS creat_de_nume, COALESCE(c.oferta_nr, c.numar) AS comanda_nr, c.client_nume`;
const DIN = `FROM task t JOIN utilizator up ON up.id = t.pentru JOIN utilizator uc ON uc.id = t.creat_de
  LEFT JOIN comanda c ON c.id = t.comanda_id`;

// Ale mele (date mie sau de mine altora): cele nefăcute + cele făcute în ultimele 14 zile, cu conversaţia lor.
const ALE_MELE = `(t.pentru = ? OR t.creat_de = ?) AND (t.facut_la IS NULL OR t.facut_la > datetime(${ACUM()}, '-14 days'))`;
function lista(ctx) {
  const eu = ctx.utilizator.id;
  const taskuri = db().prepare(`SELECT ${CAMPURI} ${DIN} WHERE ${ALE_MELE}
    ORDER BY t.facut_la IS NOT NULL, t.scadenta IS NULL, t.scadenta, t.id`).all(eu, eu);
  const mesaje = Map.groupBy(db().prepare(`SELECT m.id, m.task_id, m.autor, u.nume AS autor_nume, m.text, m.eveniment,
      m.creat_la, m.citit FROM task_mesaj m JOIN utilizator u ON u.id = m.autor JOIN task t ON t.id = m.task_id
    WHERE ${ALE_MELE} ORDER BY m.creat_la, m.id`).all(eu, eu), m => m.task_id);
  for (const t of taskuri) {
    t.mesaje = mesaje.get(t.id) ?? [];
    t.necitite = t.mesaje.filter(m => m.autor !== eu && !m.citit).length;
  }
  json(ctx.res, 200, { taskuri, utilizatori: db().prepare('SELECT id, nume FROM utilizator WHERE activ = 1 ORDER BY nume').all() });
}

// Pt. bara de sus: ale mele, nefăcute, ajunse la scadenţă (nu şi cele în aşteptare) + câte răspunsuri n-am citit.
const scadente = ctx => json(ctx.res, 200, {
  taskuri: db().prepare(`SELECT ${CAMPURI} ${DIN} WHERE t.pentru = ? AND t.facut_la IS NULL AND t.in_asteptare_la IS NULL
    AND t.scadenta <= ${ACUM()} ORDER BY t.scadenta`).all(ctx.utilizator.id),
  necitite: db().prepare(`SELECT COUNT(*) AS n FROM task_mesaj m JOIN task t ON t.id = m.task_id
    WHERE (t.pentru = ? OR t.creat_de = ?) AND m.autor != ? AND m.citit = 0`).get(...Array(3).fill(ctx.utilizator.id)).n,
});

// un rând în conversaţia taskului: răspuns (eveniment null) sau ce s-a întâmplat cu el
const inConversatie = (taskId, autor, eveniment, text = '') => db().prepare(`INSERT INTO task_mesaj
  (task_id, autor, text, eveniment, creat_la) VALUES (?, ?, ?, ?, ${ACUM()})`).run(taskId, autor, text, eveniment);

// text, pentru, scadenta, comanda_id — validate; întoarce { campuri } sau { eroare }
function citeste(corp, nou) {
  const c = {};
  if (nou || 'text' in corp) {
    c.text = String(corp.text ?? '').trim().slice(0, 1000);
    if (!c.text) return { eroare: 'Scrie ce e de făcut.' };
  }
  if (nou || 'pentru' in corp) {
    c.pentru = Number(corp.pentru);
    if (!db().prepare('SELECT 1 FROM utilizator WHERE id = ? AND activ = 1').get(c.pentru)) return { eroare: 'Alege cui îi dai taskul.' };
  }
  if (nou || 'scadenta' in corp) {
    c.scadenta = corp.scadenta ? dinOraRomaniei(String(corp.scadenta)) : null;
    if (corp.scadenta && !c.scadenta) return { eroare: 'Data reminderului nu e bună.' };
  }
  if (nou && corp.comanda_id != null) {
    c.comanda_id = Number(corp.comanda_id);
    if (!db().prepare('SELECT 1 FROM comanda WHERE id = ?').get(c.comanda_id)) return { eroare: 'Comandă inexistentă.' };
  }
  return { campuri: c };
}

async function creeaza(ctx) {
  const { campuri: c, eroare: e } = citeste(await corpJson(ctx.req), true);
  if (e) return eroare(ctx.res, 400, e);
  const id = Number(db().prepare(`INSERT INTO task (text, scadenta, pentru, creat_de, comanda_id, creat_la)
    VALUES (?, ?, ?, ?, ?, ${ACUM()})`).run(c.text, c.scadenta, c.pentru, ctx.utilizator.id, c.comanda_id ?? null).lastInsertRowid);
  anunta();
  json(ctx.res, 201, { id });
}

// Doar cel care l-a primit sau cel care l-a dat îl schimbă / bifează.
const alMeu = ctx => db().prepare('SELECT * FROM task WHERE id = ? AND (pentru = ? OR creat_de = ?)')
  .get(Number(ctx.params.id), ctx.utilizator.id, ctx.utilizator.id);

async function modifica(ctx) {
  const t = alMeu(ctx);
  if (!t) return eroare(ctx.res, 404, 'Task inexistent.');
  const corp = await corpJson(ctx.req);
  const { campuri: c, eroare: e } = citeste(corp, false);
  if (e) return eroare(ctx.res, 400, e);
  const set = Object.keys(c).map(k => `${k} = ?`);
  // făcut / în aşteptare: doar când chiar se schimbă — fiecare schimbare apare şi în conversaţie
  const facut = 'facut' in corp && !!corp.facut !== !!t.facut_la ? !!corp.facut : null;
  const asteapta = 'asteptare' in corp && !!corp.asteptare !== !!t.in_asteptare_la ? !!corp.asteptare : null;
  if (facut !== null) set.push(`facut_la = ${facut ? ACUM() : 'NULL'}`);
  // făcut = nu mai aşteaptă (fără „reluat” în conversaţie — „făcut” spune tot)
  if (asteapta !== null || (facut && t.in_asteptare_la)) set.push(`in_asteptare_la = ${asteapta ? ACUM() : 'NULL'}`);
  if (!set.length) return 'facut' in corp || 'asteptare' in corp ? json(ctx.res, 200, { ok: true }) : eroare(ctx.res, 400, 'Nimic de modificat.');
  db().prepare(`UPDATE task SET ${set.join(', ')} WHERE id = ?`).run(...Object.values(c), t.id);
  if (facut !== null) inConversatie(t.id, ctx.utilizator.id, facut ? 'facut' : 'redeschis');
  if (asteapta !== null) inConversatie(t.id, ctx.utilizator.id, asteapta ? 'asteptare' : 'reluat',
    String(corp.motiv ?? '').trim().slice(0, 500));
  anunta();
  json(ctx.res, 200, { ok: true });
}

// răspuns în conversaţia taskului — oricare dintre cei doi
async function raspunde(ctx) {
  const t = alMeu(ctx);
  if (!t) return eroare(ctx.res, 404, 'Task inexistent.');
  const text = String((await corpJson(ctx.req)).text ?? '').trim().slice(0, 2000);
  if (!text) return eroare(ctx.res, 400, 'Scrie răspunsul.');
  inConversatie(t.id, ctx.utilizator.id, null, text);
  anunta();
  json(ctx.res, 201, { ok: true });
}

// am deschis conversaţia: ce a scris celălalt e citit (insigna din meniu scade, şi în celelalte taburi)
function citit(ctx) {
  const t = alMeu(ctx);
  if (!t) return eroare(ctx.res, 404, 'Task inexistent.');
  const r = db().prepare('UPDATE task_mesaj SET citit = 1 WHERE task_id = ? AND autor != ? AND citit = 0').run(t.id, ctx.utilizator.id);
  if (r.changes) anuntaUtilizator(ctx.utilizator.id);
  json(ctx.res, 200, { ok: true });
}

function sterge(ctx) {
  const t = alMeu(ctx);
  if (!t) return eroare(ctx.res, 404, 'Task inexistent.');
  if (t.creat_de !== ctx.utilizator.id) return eroare(ctx.res, 403, 'Doar cel care a dat taskul îl poate şterge.');
  db().prepare('DELETE FROM task WHERE id = ?').run(t.id);
  anunta();
  json(ctx.res, 200, { ok: true });
}

module.exports = {
  dinOraRomaniei,
  rute: [
    ['GET',    '/api/taskuri',          { handler: lista }],
    ['GET',    '/api/taskuri/scadente', { handler: scadente }],
    ['POST',   '/api/taskuri',          { handler: creeaza }],
    ['PATCH',  '/api/taskuri/:id',      { handler: modifica }],
    ['DELETE', '/api/taskuri/:id',      { handler: sterge }],
    ['POST',   '/api/taskuri/:id/raspuns', { handler: raspunde }],
    ['POST',   '/api/taskuri/:id/citit',   { handler: citit }],
  ],
};
