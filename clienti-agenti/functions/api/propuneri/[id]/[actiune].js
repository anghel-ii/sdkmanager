import { raspuns, eManager, CAMPURI, VERSIUNE_NOUA, clientul, stergeClient, anunta } from '../../../../lib/comun.js';

// POST /api/propuneri/:id/aproba   — DOAR managerul: propunerea intră în `client`
//      (client nou sau modificat, cu versiune nouă → managerul o preia), apoi dispare.
//      Cererea de ştergere: clientul se şterge (sters_la + versiune nouă, ca din manager).
// POST /api/propuneri/:id/respinge — propunerea dispare, `client` rămâne neschimbat.
export async function onRequestPost({ request, env, params }) {
  if (!eManager(request, env)) return raspuns(401, { eroare: 'Cheie greşită.' });
  if (!['aproba', 'respinge'].includes(params.actiune)) return raspuns(404, { eroare: 'Acţiune necunoscută.' });
  const p = await env.DB.prepare('SELECT * FROM propunere WHERE id = ?').bind(+params.id || 0).first();
  if (!p) return raspuns(404, { eroare: 'Propunerea nu mai există — a aprobat-o sau a respins-o deja cineva.' });
  const sterge = env.DB.prepare('DELETE FROM propunere WHERE id = ?').bind(p.id);
  // aprobarea / respingerea ajunge imediat pe pagina agentului (şi a conducerii, dacă s-a schimbat un client)
  if (params.actiune === 'respinge') { await sterge.run(); await anunta(env, { agenti: [p.agent] }); return raspuns(200, { ok: true }); }
  if (p.stergere) {
    if (await clientul(env, p.client_id)) await stergeClient(env, p.client_id);
    else { await sterge.run(); await anunta(env, { agenti: [p.agent] }); }
    return raspuns(200, { ok: true });
  }

  const v = JSON.parse(p.date_json), col = Object.keys(CAMPURI);
  const scrie = p.client_id
    ? env.DB.prepare(`UPDATE client SET ${col.map(k => `${k} = ?`).join(', ')}, modificat_la = datetime('now'),
        versiune = ${VERSIUNE_NOUA} WHERE id = ?`).bind(...col.map(k => v[k] ?? null), p.client_id)
    : env.DB.prepare(`INSERT INTO client (agent, ${col.join(', ')}, creat_la, modificat_la, versiune)
        VALUES (?${', ?'.repeat(col.length)}, ?, datetime('now'), ${VERSIUNE_NOUA})`)
        .bind(p.agent, ...col.map(k => v[k] ?? null), p.creat_la);
  await env.DB.batch([scrie, sterge]);   // amândouă sau niciuna
  await anunta(env, { agenti: [p.agent], conducere: true });
  return raspuns(200, { ok: true });
}
