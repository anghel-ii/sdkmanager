import { raspuns, clientDinCerere, agentLogat, vedereAgent } from '../../../lib/comun.js';

// PUT — agentul îşi corectează un client NOU încă neaprobat (al lui).
// (Modificările la clienţii existenţi trec prin PUT /api/clienti/:id.)
export async function onRequestPut({ request, env, params }) {
  const agent = await agentLogat(request, env);
  if (!agent) return raspuns(401, { eroare: 'Nu eşti logat.' });
  const { v, eroare } = await clientDinCerere(request, true);
  if (eroare) return raspuns(400, { eroare });
  const p = await env.DB.prepare(`UPDATE propunere SET date_json = ?, creat_la = datetime('now')
    WHERE id = ? AND agent = ? AND client_id IS NULL RETURNING *`).bind(JSON.stringify(v), +params.id || 0, agent.nume).first();
  if (!p) return raspuns(404, { eroare: 'Clientul a fost deja aprobat sau respins — reîncarcă pagina.' });
  return raspuns(200, { client: vedereAgent(p) });
}

// DELETE — agentul îşi retrage o cerere (a lui) încă neaprobată: clientul nou dispare,
// modificarea / ştergerea cerută se anulează, clientul rămâne cum e.
export async function onRequestDelete({ request, env, params }) {
  const agent = await agentLogat(request, env);
  if (!agent) return raspuns(401, { eroare: 'Nu eşti logat.' });
  const p = await env.DB.prepare('DELETE FROM propunere WHERE id = ? AND agent = ? RETURNING id')
    .bind(+params.id || 0, agent.nume).first();
  if (!p) return raspuns(404, { eroare: 'Cererea a fost deja aprobată sau respinsă — reîncarcă pagina.' });
  return raspuns(200, { ok: true });
}
