const { db, ACUM } = require('./db.js');
const { json, eroare, corpJson } = require('./http.js');
const { anunta } = require('./evenimente.js');

// ═══════════════════════════════════════════════════════════════════════════
//  TASKURI + REMINDERE (userul, 2026-10-08). Un task e dat cuiva dintre
//  utilizatori (îl vede el şi cel care l-a creat), opţional legat de o comandă,
//  cu o scadenţă la care apare notificarea. Notificarea o face browserul:
//  bara.js întreabă din minut în minut /api/taskuri/scadente (web/taskuri).
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

const CAMPURI = `t.id, t.text, t.scadenta, t.pentru, t.creat_de, t.comanda_id, t.creat_la, t.facut_la,
  up.nume AS pentru_nume, uc.nume AS creat_de_nume, COALESCE(c.oferta_nr, c.numar) AS comanda_nr, c.client_nume`;
const DIN = `FROM task t JOIN utilizator up ON up.id = t.pentru JOIN utilizator uc ON uc.id = t.creat_de
  LEFT JOIN comanda c ON c.id = t.comanda_id`;

// Ale mele (date mie sau de mine altora): cele nefăcute + cele făcute în ultimele 14 zile.
function lista(ctx) {
  const eu = ctx.utilizator.id;
  json(ctx.res, 200, {
    taskuri: db().prepare(`SELECT ${CAMPURI} ${DIN} WHERE (t.pentru = ? OR t.creat_de = ?)
      AND (t.facut_la IS NULL OR t.facut_la > datetime(${ACUM()}, '-14 days'))
      ORDER BY t.facut_la IS NOT NULL, t.scadenta IS NULL, t.scadenta, t.id`).all(eu, eu),
    utilizatori: db().prepare('SELECT id, nume FROM utilizator WHERE activ = 1 ORDER BY nume').all(),
  });
}

// Pt. bara de sus: ale mele, nefăcute, ajunse la scadenţă.
const scadente = ctx => json(ctx.res, 200, { taskuri: db().prepare(`SELECT ${CAMPURI} ${DIN}
  WHERE t.pentru = ? AND t.facut_la IS NULL AND t.scadenta <= ${ACUM()} ORDER BY t.scadenta`).all(ctx.utilizator.id) });

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
  if ('facut' in corp) set.push(`facut_la = ${corp.facut ? ACUM() : 'NULL'}`);
  if (!set.length) return eroare(ctx.res, 400, 'Nimic de modificat.');
  db().prepare(`UPDATE task SET ${set.join(', ')} WHERE id = ?`).run(...Object.values(c), t.id);
  anunta();
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
  ],
};
