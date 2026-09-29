import { raspuns, CAMPURI, clientDinCerere, agentLogat, VERSIUNE_NOUA } from '../../../lib/comun.js';

// PUT — agentul modifică un client de-al LUI (altfel 404, ca să nu afle că există)
export async function onRequestPut({ request, env, params }) {
  const agent = await agentLogat(request, env);
  if (!agent) return raspuns(401, { eroare: 'Nu eşti logat.' });
  const { v, eroare } = await clientDinCerere(request);
  if (eroare) return raspuns(400, { eroare });
  const col = Object.keys(CAMPURI);
  const r = await env.DB.prepare(`UPDATE client SET ${col.map(k => `${k} = ?`).join(', ')},
      modificat_la = datetime('now'), versiune = ${VERSIUNE_NOUA}
    WHERE id = ? AND agent = ? RETURNING *`)
    .bind(...col.map(k => v[k]), +params.id || 0, agent.nume).first();
  if (!r) return raspuns(404, { eroare: 'Clientul nu există sau nu e al tău.' });
  return raspuns(200, { client: r });
}
