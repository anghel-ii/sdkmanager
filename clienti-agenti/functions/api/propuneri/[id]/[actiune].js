import { raspuns, eManager, CAMPURI, VERSIUNE_NOUA } from '../../../../lib/comun.js';

// POST /api/propuneri/:id/aproba   — DOAR managerul: propunerea intră în `client`
//      (client nou sau modificat, cu versiune nouă → managerul o preia), apoi dispare.
// POST /api/propuneri/:id/respinge — propunerea dispare, `client` rămâne neschimbat.
export async function onRequestPost({ request, env, params }) {
  if (!eManager(request, env)) return raspuns(401, { eroare: 'Cheie greşită.' });
  if (!['aproba', 'respinge'].includes(params.actiune)) return raspuns(404, { eroare: 'Acţiune necunoscută.' });
  const p = await env.DB.prepare('SELECT * FROM propunere WHERE id = ?').bind(+params.id || 0).first();
  if (!p) return raspuns(404, { eroare: 'Propunerea nu mai există — a aprobat-o sau a respins-o deja cineva.' });
  const sterge = env.DB.prepare('DELETE FROM propunere WHERE id = ?').bind(p.id);
  if (params.actiune === 'respinge') { await sterge.run(); return raspuns(200, { ok: true }); }

  const v = JSON.parse(p.date_json), col = Object.keys(CAMPURI);
  const scrie = p.client_id
    ? env.DB.prepare(`UPDATE client SET ${col.map(k => `${k} = ?`).join(', ')}, modificat_la = datetime('now'),
        versiune = ${VERSIUNE_NOUA} WHERE id = ?`).bind(...col.map(k => v[k] ?? null), p.client_id)
    : env.DB.prepare(`INSERT INTO client (agent, ${col.join(', ')}, creat_la, modificat_la, versiune)
        VALUES (?${', ?'.repeat(col.length)}, ?, datetime('now'), ${VERSIUNE_NOUA})`)
        .bind(p.agent, ...col.map(k => v[k] ?? null), p.creat_la);
  await env.DB.batch([scrie, sterge]);   // amândouă sau niciuna
  return raspuns(200, { ok: true });
}
