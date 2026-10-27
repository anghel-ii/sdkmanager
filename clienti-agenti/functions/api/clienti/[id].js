import { raspuns, clientDinCerere, agentLogat, eManager, vedereAgent, clientul, scrieDirect, deCine, VERSIUNE_NOUA } from '../../../lib/comun.js';

// PUT — agentul modifică un client de-al LUI (altfel 404, ca să nu afle că există).
// Modificarea aşteaptă aprobarea din manager: se ţine ca propunere (una pe client —
// o nouă trimitere o înlocuieşte); `client` rămâne neschimbat până la aprobare.
// Managerul (Bearer CHEIE_MANAGER — pagina Clienţi) şi conturile de conducere (userul,
// 2026-10-27) scriu DIRECT, la orice client, şi pot schimba agentul (clientul trece la el).
export async function onRequestPut({ request, env, params }) {
  const manager = request.headers.has('Authorization');
  if (manager && !eManager(request, env)) return raspuns(401, { eroare: 'Cheie greşită.' });
  const agent = manager ? null : await agentLogat(request, env);
  if (!manager && !agent) return raspuns(401, { eroare: 'Nu eşti logat.' });
  if (manager || agent.rol === 'conducere') {
    const r = await scrieDirect(request, env, params.id, deCine(request, agent));
    return r.eroare ? raspuns(r.cod, { eroare: r.eroare }) : raspuns(200, { client: r.client });
  }
  const { v, eroare } = await clientDinCerere(request);
  if (eroare) return raspuns(400, { eroare });
  const c = await env.DB.prepare('SELECT * FROM client WHERE id = ? AND agent = ? AND sters_la IS NULL').bind(+params.id || 0, agent.nume).first();
  if (!c) return raspuns(404, { eroare: 'Clientul nu există sau nu e al tău.' });
  const p = await env.DB.prepare(`INSERT INTO propunere (client_id, agent, date_json, creat_la) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(client_id) DO UPDATE SET date_json = excluded.date_json, creat_la = excluded.creat_la RETURNING *`)
    .bind(c.id, agent.nume, JSON.stringify(v)).first();
  return raspuns(200, { client: vedereAgent(p, c) });
}

// DELETE — doar managerul. Rândul rămâne, marcat şters şi cu versiune nouă, ca
// ştergerea să ajungă şi în copiile managerului (care trag „după versiunea X");
// agentul nu-l mai vede, iar modificarea lui în aşteptare (dacă are) dispare.
export async function onRequestDelete({ request, env, params }) {
  if (!eManager(request, env)) return raspuns(401, { eroare: 'Cheie greşită.' });
  if (!await clientul(env, params.id)) return raspuns(404, { eroare: 'Clientul nu mai există — l-a şters cineva între timp.' });
  await env.DB.batch([
    env.DB.prepare(`UPDATE client SET sters_la = datetime('now'), modificat_de = ?, versiune = ${VERSIUNE_NOUA} WHERE id = ?`)
      .bind(deCine(request, null), +params.id),
    env.DB.prepare('DELETE FROM propunere WHERE client_id = ?').bind(+params.id),
  ]);
  return raspuns(200, { ok: true });
}
