import { raspuns, clientDinCerere, agentLogat, vedereAgent } from '../../../lib/comun.js';

// PUT — agentul modifică un client de-al LUI (altfel 404, ca să nu afle că există).
// Modificarea aşteaptă aprobarea din manager: se ţine ca propunere (una pe client —
// o nouă trimitere o înlocuieşte); `client` rămâne neschimbat până la aprobare.
export async function onRequestPut({ request, env, params }) {
  const agent = await agentLogat(request, env);
  if (!agent) return raspuns(401, { eroare: 'Nu eşti logat.' });
  const { v, eroare } = await clientDinCerere(request);
  if (eroare) return raspuns(400, { eroare });
  const c = await env.DB.prepare('SELECT * FROM client WHERE id = ? AND agent = ?').bind(+params.id || 0, agent.nume).first();
  if (!c) return raspuns(404, { eroare: 'Clientul nu există sau nu e al tău.' });
  const p = await env.DB.prepare(`INSERT INTO propunere (client_id, agent, date_json, creat_la) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(client_id) DO UPDATE SET date_json = excluded.date_json, creat_la = excluded.creat_la RETURNING *`)
    .bind(c.id, agent.nume, JSON.stringify(v)).first();
  return raspuns(200, { client: vedereAgent(p, c) });
}
