const { db, ACUM, tranzactie } = require('./db.js');
const { json, eroare, corpJson } = require('./http.js');
const { anunta, anuntaUtilizator } = require('./evenimente.js');

// ═══════════════════════════════════════════════════════════════════════════
//  TASKURI + REMINDERE (userul, 2026-10-08). Un task e dat unuia sau mai multor
//  utilizatori (2026-10-26, task_destinatar), opţional legat de o comandă, cu o
//  scadenţă la care apare notificarea — la fiecare destinatar. Notificarea o face
//  browserul: bara.js întreabă din minut în minut /api/taskuri/scadente (web/taskuri).
//  Fiecare destinatar îşi bifează PARTEA făcută şi o poate pune în aşteptare (fără
//  reminder până o reia) — userul: „dacă cineva face taskul nu trebuie să apară făcut
//  pentru toţi"; taskul e făcut (task.facut_la) când şi-au făcut partea toţi.
//  Participanţii = cel care l-a dat + destinatarii: toţi îl văd şi scriu în
//  mini-conversaţia lui (userul, 2026-10-15): răspunsuri + ce s-a întâmplat (pus în
//  aşteptare, reluat, făcut). Ce scrie unul e „necitit” la ceilalţi până deschid
//  conversaţia (task_citit, pe om) — numărul intră în insigna „Taskuri” din meniu.
//  Cui e dat îl schimbă doar cel care l-a dat.
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

// Taskurile se citesc din perspectiva celui care le cere ($eu): e = partea lui, dacă taskul îi e dat. facut_la şi
// in_asteptare_la din răspuns sunt ale LUI; la un task dat de el altora, făcut = când şi-au făcut partea toţi.
const DIN = `FROM task t JOIN utilizator uc ON uc.id = t.creat_de LEFT JOIN comanda c ON c.id = t.comanda_id
  LEFT JOIN task_destinatar e ON e.task_id = t.id AND e.utilizator_id = $eu`;
const FACUT = '(CASE WHEN e.task_id IS NULL THEN t.facut_la ELSE e.facut_la END)';
const CAMPURI = `t.id, t.text, t.scadenta, t.creat_de, t.comanda_id, t.creat_la, ${FACUT} AS facut_la, e.in_asteptare_la,
  uc.nume AS creat_de_nume, COALESCE(c.oferta_nr, c.numar) AS comanda_nr, c.client_nume`;
const PARTICIP = '(t.creat_de = $eu OR e.task_id IS NOT NULL)';   // l-am dat sau mi-e dat
// ce au scris / făcut ceilalţi după ultimul mesaj văzut de mine — şi evenimentele („şi-a făcut partea"…)
const NECITITE = `SELECT COUNT(*) FROM task_mesaj m WHERE m.task_id = t.id AND m.autor != $eu
  AND m.id > COALESCE((SELECT pana_la FROM task_citit WHERE task_id = t.id AND utilizator_id = $eu), 0)`;

// destinatarii, pe fiecare task: destinatari [{ id, nume, facut_la, in_asteptare_la }] (după nume) + pentru_nume („Ana, Ion")
function cuDestinatari(taskuri) {
  if (!taskuri.length) return taskuri;
  const pe = Map.groupBy(db().prepare(`SELECT p.task_id, u.id, u.nume, p.facut_la, p.in_asteptare_la FROM task_destinatar p
    JOIN utilizator u ON u.id = p.utilizator_id WHERE p.task_id IN (${taskuri.map(() => '?').join(', ')}) ORDER BY u.nume`)
    .all(...taskuri.map(t => t.id)), r => r.task_id);
  for (const t of taskuri) {
    t.destinatari = (pe.get(t.id) ?? []).map(({ task_id, ...d }) => d);
    t.pentru_nume = t.destinatari.map(d => d.nume).join(', ');
  }
  return taskuri;
}

// Ale mele (date mie sau de mine altora): cele nefăcute + cele făcute în ultimele 14 zile, cu conversaţia lor.
const ALE_MELE = `${PARTICIP} AND (${FACUT} IS NULL OR ${FACUT} > datetime(${ACUM()}, '-14 days'))`;
function lista(ctx) {
  const eu = ctx.utilizator.id;
  const taskuri = cuDestinatari(db().prepare(`SELECT ${CAMPURI}, (${NECITITE}) AS necitite ${DIN} WHERE ${ALE_MELE}
    ORDER BY ${FACUT} IS NOT NULL, t.scadenta IS NULL, t.scadenta, t.id`).all({ eu }));
  const mesaje = Map.groupBy(db().prepare(`SELECT m.id, m.task_id, m.autor, u.nume AS autor_nume, m.text, m.eveniment,
      m.creat_la FROM task_mesaj m JOIN utilizator u ON u.id = m.autor JOIN task t ON t.id = m.task_id
      LEFT JOIN task_destinatar e ON e.task_id = t.id AND e.utilizator_id = $eu
    WHERE ${ALE_MELE} ORDER BY m.creat_la, m.id`).all({ eu }), m => m.task_id);
  for (const t of taskuri) t.mesaje = mesaje.get(t.id) ?? [];
  json(ctx.res, 200, { taskuri, utilizatori: db().prepare('SELECT id, nume FROM utilizator WHERE activ = 1 ORDER BY nume').all() });
}

// Pt. bara de sus: ale mele (mi-sunt date), cu partea mea nefăcută şi nu în aşteptare, ajunse la scadenţă + câte
// răspunsuri n-am citit, din toate la care particip. de_la_altcineva — reminderul spune „de la X".
function scadente(ctx) {
  const eu = ctx.utilizator.id;
  json(ctx.res, 200, {
    taskuri: db().prepare(`SELECT ${CAMPURI}, t.creat_de != $eu AS de_la_altcineva ${DIN} WHERE e.task_id IS NOT NULL
      AND e.facut_la IS NULL AND e.in_asteptare_la IS NULL AND t.scadenta <= ${ACUM()} ORDER BY t.scadenta`).all({ eu }),
    necitite: db().prepare(`SELECT COALESCE(SUM((${NECITITE})), 0) AS n FROM task t
      LEFT JOIN task_destinatar e ON e.task_id = t.id AND e.utilizator_id = $eu WHERE ${PARTICIP}`).get({ eu }).n,
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

// taskul e făcut când şi-au făcut partea toţi destinatarii (atunci trece la „Făcute" şi la cel care l-a dat)
const actualizeazaFacut = (d, id) => d.prepare(`UPDATE task SET facut_la = CASE WHEN EXISTS (SELECT 1 FROM task_destinatar
  WHERE task_id = $id AND facut_la IS NULL) THEN NULL ELSE (SELECT MAX(facut_la) FROM task_destinatar WHERE task_id = $id) END
  WHERE id = $id`).run({ id });

// cui e dat taskul: lista întreagă; cei care rămân îşi păstrează partea (făcută / în aşteptare). task.pentru = primul.
function puneDestinatari(d, id, pentru) {
  d.prepare(`DELETE FROM task_destinatar WHERE task_id = ? AND utilizator_id NOT IN (${pentru.map(() => '?').join(', ')})`).run(id, ...pentru);
  const pune = d.prepare('INSERT OR IGNORE INTO task_destinatar (task_id, utilizator_id) VALUES (?, ?)');
  for (const om of pentru) pune.run(id, om);
  d.prepare('UPDATE task SET pentru = ? WHERE id = ?').run(pentru[0], id);
  actualizeazaFacut(d, id);
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

// Doar participanţii (cel care l-a dat + destinatarii) îl văd şi îl schimbă; `parte` = partea mea, dacă mi-e dat.
const alMeu = ctx => db().prepare(`SELECT t.*, e.task_id IS NOT NULL AS mi_e_dat, e.facut_la AS facut_meu,
    e.in_asteptare_la AS asteptare_mea FROM task t LEFT JOIN task_destinatar e ON e.task_id = t.id AND e.utilizator_id = $eu
  WHERE t.id = $id AND ${PARTICIP}`).get({ eu: ctx.utilizator.id, id: Number(ctx.params.id) });

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
  // făcut / în aşteptare: partea MEA, doar când chiar se schimbă — fiecare schimbare apare şi în conversaţie
  if (('facut' in corp || 'asteptare' in corp) && !t.mi_e_dat) {
    return eroare(ctx.res, 403, 'Taskul nu e dat ţie — fiecare destinatar îşi bifează partea.');
  }
  const facut = 'facut' in corp && !!corp.facut !== !!t.facut_meu ? !!corp.facut : null;
  const asteapta = 'asteptare' in corp && !!corp.asteptare !== !!t.asteptare_mea ? !!corp.asteptare : null;
  const parte = [];
  if (facut !== null) parte.push(`facut_la = ${facut ? ACUM() : 'NULL'}`);
  // făcut = nu mai aşteaptă (fără „reluat” în conversaţie — „făcut” spune tot)
  if (asteapta !== null || (facut && t.asteptare_mea)) parte.push(`in_asteptare_la = ${asteapta ? ACUM() : 'NULL'}`);
  const set = Object.keys(c).map(k => `${k} = ?`);
  if (!set.length && !parte.length && !pentru) {
    return 'facut' in corp || 'asteptare' in corp ? json(ctx.res, 200, { ok: true }) : eroare(ctx.res, 400, 'Nimic de modificat.');
  }
  tranzactie(d => {
    if (set.length) d.prepare(`UPDATE task SET ${set.join(', ')} WHERE id = ?`).run(...Object.values(c), t.id);
    if (parte.length) {
      d.prepare(`UPDATE task_destinatar SET ${parte.join(', ')} WHERE task_id = ? AND utilizator_id = ?`).run(t.id, ctx.utilizator.id);
      actualizeazaFacut(d, t.id);
    }
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
