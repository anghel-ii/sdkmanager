const { db, ACUM, tranzactie } = require('./db.js');
const { json, eroare, corpJson } = require('./http.js');
const { anunta, anuntaUtilizator } = require('./evenimente.js');

// ═══════════════════════════════════════════════════════════════════════════
//  TASKURI + REMINDERE (userul, 2026-10-08). Un task e dat unuia sau mai multor
//  utilizatori (2026-10-26, task_destinatar), opţional legat de o comandă, cu o
//  scadenţă la care apare notificarea — la fiecare destinatar. Notificarea o face
//  browserul: bara.js întreabă din minut în minut /api/taskuri/scadente (web/taskuri).
//  Participanţii = cel care l-a dat + destinatarii: toţi îl văd, îl pot bifa (făcut o
//  dată pentru toţi, ca în Planner / Trello) şi scriu în mini-conversaţia lui (userul,
//  2026-10-15): răspunsuri + ce s-a întâmplat (pus în aşteptare, reluat, făcut). Ce
//  scrie unul e „necitit” la ceilalţi până deschid conversaţia (task_citit, pe om) —
//  numărul intră în insigna „Taskuri” din meniu. Un task în aşteptare nu mai dă
//  reminder până se reia. Cui e dat îl schimbă doar cel care l-a dat.
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

const CAMPURI = `t.id, t.text, t.scadenta, t.creat_de, t.comanda_id, t.creat_la, t.facut_la, t.in_asteptare_la,
  uc.nume AS creat_de_nume, COALESCE(c.oferta_nr, c.numar) AS comanda_nr, c.client_nume`;
const DIN = `FROM task t JOIN utilizator uc ON uc.id = t.creat_de LEFT JOIN comanda c ON c.id = t.comanda_id`;
// eu (?) sunt printre destinatari / sunt participant (l-am dat sau mi-e dat) — parametri: eu, (eu)
const DESTINATAR = 'EXISTS (SELECT 1 FROM task_destinatar p WHERE p.task_id = t.id AND p.utilizator_id = ?)';
const PARTICIP = `(t.creat_de = ? OR ${DESTINATAR})`;
// ce au scris / făcut ceilalţi după ultimul mesaj văzut de mine (?, ?) — şi evenimentele („a bifat făcut"…)
const NECITITE = `SELECT COUNT(*) FROM task_mesaj m WHERE m.task_id = t.id AND m.autor != ?
  AND m.id > COALESCE((SELECT pana_la FROM task_citit WHERE task_id = t.id AND utilizator_id = ?), 0)`;

// destinatarii, pe fiecare task: destinatari [{ id, nume }] (după nume) + pentru_nume („Ana, Ion")
function cuDestinatari(taskuri) {
  if (!taskuri.length) return taskuri;
  const pe = Map.groupBy(db().prepare(`SELECT p.task_id, u.id, u.nume FROM task_destinatar p JOIN utilizator u ON u.id = p.utilizator_id
    WHERE p.task_id IN (${taskuri.map(() => '?').join(', ')}) ORDER BY u.nume`).all(...taskuri.map(t => t.id)), r => r.task_id);
  for (const t of taskuri) {
    t.destinatari = (pe.get(t.id) ?? []).map(({ id, nume }) => ({ id, nume }));
    t.pentru_nume = t.destinatari.map(d => d.nume).join(', ');
  }
  return taskuri;
}

// Ale mele (date mie sau de mine altora): cele nefăcute + cele făcute în ultimele 14 zile, cu conversaţia lor.
const ALE_MELE = `${PARTICIP} AND (t.facut_la IS NULL OR t.facut_la > datetime(${ACUM()}, '-14 days'))`;
function lista(ctx) {
  const eu = ctx.utilizator.id;
  const taskuri = cuDestinatari(db().prepare(`SELECT ${CAMPURI}, (${NECITITE}) AS necitite ${DIN} WHERE ${ALE_MELE}
    ORDER BY t.facut_la IS NOT NULL, t.scadenta IS NULL, t.scadenta, t.id`).all(eu, eu, eu, eu));
  const mesaje = Map.groupBy(db().prepare(`SELECT m.id, m.task_id, m.autor, u.nume AS autor_nume, m.text, m.eveniment,
      m.creat_la FROM task_mesaj m JOIN utilizator u ON u.id = m.autor JOIN task t ON t.id = m.task_id
    WHERE ${ALE_MELE} ORDER BY m.creat_la, m.id`).all(eu, eu), m => m.task_id);
  for (const t of taskuri) t.mesaje = mesaje.get(t.id) ?? [];
  json(ctx.res, 200, { taskuri, utilizatori: db().prepare('SELECT id, nume FROM utilizator WHERE activ = 1 ORDER BY nume').all() });
}

// Pt. bara de sus: ale mele (mi-sunt date), nefăcute, ajunse la scadenţă (nu şi cele în aşteptare) + câte răspunsuri
// n-am citit, din toate la care particip. de_la_altcineva — reminderul spune „de la X".
function scadente(ctx) {
  const eu = ctx.utilizator.id;
  json(ctx.res, 200, {
    taskuri: db().prepare(`SELECT ${CAMPURI}, t.creat_de != ? AS de_la_altcineva ${DIN} WHERE ${DESTINATAR} AND t.facut_la IS NULL
      AND t.in_asteptare_la IS NULL AND t.scadenta <= ${ACUM()} ORDER BY t.scadenta`).all(eu, eu),
    necitite: db().prepare(`SELECT COALESCE(SUM((${NECITITE})), 0) AS n FROM task t WHERE ${PARTICIP}`).get(eu, eu, eu, eu).n,
  });
}

// un rând în conversaţia taskului: răspuns (eveniment null) sau ce s-a întâmplat cu el
const inConversatie = (taskId, autor, eveniment, text = '') => db().prepare(`INSERT INTO task_mesaj
  (task_id, autor, text, eveniment, creat_la) VALUES (?, ?, ?, ?, ${ACUM()})`).run(taskId, autor, text, eveniment);

// text, pentru, scadenta, comanda_id — validate; întoarce { campuri } sau { eroare }. `pentru` = un id sau o listă
// de id-uri (conturi active), fără dubluri → listă
function citeste(corp, nou) {
  const c = {};
  if (nou || 'text' in corp) {
    c.text = String(corp.text ?? '').trim().slice(0, 1000);
    if (!c.text) return { eroare: 'Scrie ce e de făcut.' };
  }
  if (nou || 'pentru' in corp) {
    c.pentru = [...new Set([corp.pentru].flat().map(Number))];
    const activ = db().prepare('SELECT 1 FROM utilizator WHERE id = ? AND activ = 1');
    if (!c.pentru.length || !c.pentru.every(id => Number.isInteger(id) && activ.get(id))) return { eroare: 'Alege cui îi dai taskul.' };
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

// cui e dat taskul: lista întreagă (înlocuieşte ce era); task.pentru = primul, pt. compatibilitate
function puneDestinatari(d, id, pentru) {
  d.prepare('DELETE FROM task_destinatar WHERE task_id = ?').run(id);
  const pune = d.prepare('INSERT INTO task_destinatar (task_id, utilizator_id) VALUES (?, ?)');
  for (const om of pentru) pune.run(id, om);
  d.prepare('UPDATE task SET pentru = ? WHERE id = ?').run(pentru[0], id);
}

async function creeaza(ctx) {
  const { campuri: c, eroare: e } = citeste(await corpJson(ctx.req), true);
  if (e) return eroare(ctx.res, 400, e);
  const id = tranzactie(d => {
    const nou = Number(d.prepare(`INSERT INTO task (text, scadenta, pentru, creat_de, comanda_id, creat_la)
      VALUES (?, ?, ?, ?, ?, ${ACUM()})`).run(c.text, c.scadenta, c.pentru[0], ctx.utilizator.id, c.comanda_id ?? null).lastInsertRowid);
    puneDestinatari(d, nou, c.pentru);
    return nou;
  });
  anunta();
  json(ctx.res, 201, { id });
}

// Doar participanţii (cel care l-a dat + destinatarii) îl văd, îl schimbă, îl bifează.
const alMeu = ctx => db().prepare(`SELECT t.* FROM task t WHERE t.id = ? AND ${PARTICIP}`)
  .get(Number(ctx.params.id), ctx.utilizator.id, ctx.utilizator.id);

async function modifica(ctx) {
  const t = alMeu(ctx);
  if (!t) return eroare(ctx.res, 404, 'Task inexistent.');
  const corp = await corpJson(ctx.req);
  const { campuri: c, eroare: e } = citeste(corp, false);
  if (e) return eroare(ctx.res, 400, e);
  // cui e dat: doar cel care l-a dat; în conversaţie apare cine e acum
  const pentru = c.pentru;
  delete c.pentru;
  if (pentru && t.creat_de !== ctx.utilizator.id) return eroare(ctx.res, 403, 'Doar cel care a dat taskul schimbă cui e dat.');
  const set = Object.keys(c).map(k => `${k} = ?`);
  // făcut / în aşteptare: doar când chiar se schimbă — fiecare schimbare apare şi în conversaţie
  const facut = 'facut' in corp && !!corp.facut !== !!t.facut_la ? !!corp.facut : null;
  const asteapta = 'asteptare' in corp && !!corp.asteptare !== !!t.in_asteptare_la ? !!corp.asteptare : null;
  if (facut !== null) set.push(`facut_la = ${facut ? ACUM() : 'NULL'}`);
  // făcut = nu mai aşteaptă (fără „reluat” în conversaţie — „făcut” spune tot)
  if (asteapta !== null || (facut && t.in_asteptare_la)) set.push(`in_asteptare_la = ${asteapta ? ACUM() : 'NULL'}`);
  if (!set.length && !pentru) return 'facut' in corp || 'asteptare' in corp ? json(ctx.res, 200, { ok: true }) : eroare(ctx.res, 400, 'Nimic de modificat.');
  tranzactie(d => {
    if (set.length) d.prepare(`UPDATE task SET ${set.join(', ')} WHERE id = ?`).run(...Object.values(c), t.id);
    if (pentru) {
      puneDestinatari(d, t.id, pentru);
      const nume = d.prepare(`SELECT nume FROM utilizator WHERE id IN (${pentru.map(() => '?').join(', ')}) ORDER BY nume`).all(...pentru);
      inConversatie(t.id, ctx.utilizator.id, 'destinatari', nume.map(u => u.nume).join(', '));
    }
  });
  if (facut !== null) inConversatie(t.id, ctx.utilizator.id, facut ? 'facut' : 'redeschis');
  if (asteapta !== null) inConversatie(t.id, ctx.utilizator.id, asteapta ? 'asteptare' : 'reluat',
    String(corp.motiv ?? '').trim().slice(0, 500));
  anunta();
  json(ctx.res, 200, { ok: true });
}

// răspuns în conversaţia taskului — oricare dintre participanţi
async function raspunde(ctx) {
  const t = alMeu(ctx);
  if (!t) return eroare(ctx.res, 404, 'Task inexistent.');
  const text = String((await corpJson(ctx.req)).text ?? '').trim().slice(0, 2000);
  if (!text) return eroare(ctx.res, 400, 'Scrie răspunsul.');
  inConversatie(t.id, ctx.utilizator.id, null, text);
  anunta();
  json(ctx.res, 201, { ok: true });
}

// am deschis conversaţia: tot ce e în ea până acum e citit de mine (insigna din meniu scade, şi în celelalte taburi)
function citit(ctx) {
  const t = alMeu(ctx);
  if (!t) return eroare(ctx.res, 404, 'Task inexistent.');
  const ultim = db().prepare('SELECT MAX(id) AS id FROM task_mesaj WHERE task_id = ?').get(t.id).id;
  const r = ultim ? db().prepare(`INSERT INTO task_citit (task_id, utilizator_id, pana_la) VALUES (?, ?, ?)
    ON CONFLICT (task_id, utilizator_id) DO UPDATE SET pana_la = excluded.pana_la WHERE excluded.pana_la > task_citit.pana_la`)
    .run(t.id, ctx.utilizator.id, ultim) : { changes: 0 };
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
