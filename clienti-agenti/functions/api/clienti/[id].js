import { raspuns, clientDinCerere, agentLogat, eManager, vedereAgent, clientul, scrieDirect, stergeClient, CAMPURI } from '../../../lib/comun.js';

// PUT — agentul modifică un client de-al LUI (altfel 404, ca să nu afle că există).
// Modificarea aşteaptă aprobarea din manager: se ţine ca propunere — UNA pe client
// (userul, 2026-10-29: „un rând modificat = o cerere"): ce trimite din nou, cât nu e
// aprobată, o înlocuieşte cu varianta finală (şi o cerere de ştergere). Dacă varianta
// finală e exact clientul de acum, cererea dispare. `client` rămâne neschimbat până la aprobare.
// Managerul (Bearer CHEIE_MANAGER — pagina Clienţi) şi conturile de conducere (userul,
// 2026-10-27) scriu DIRECT, la orice client, şi pot schimba agentul (clientul trece la el).
export async function onRequestPut({ request, env, params }) {
  const manager = request.headers.has('Authorization');
  if (manager && !eManager(request, env)) return raspuns(401, { eroare: 'Cheie greşită.' });
  const agent = manager ? null : await agentLogat(request, env);
  if (!manager && !agent) return raspuns(401, { eroare: 'Nu eşti logat.' });
  if (manager || agent.rol === 'conducere') {
    const r = await scrieDirect(request, env, params.id);
    return r.eroare ? raspuns(r.cod, { eroare: r.eroare }) : raspuns(200, { client: r.client });
  }
  const { v, eroare } = await clientDinCerere(request);
  if (eroare) return raspuns(400, { eroare });
  const c = await env.DB.prepare('SELECT * FROM client WHERE id = ? AND agent = ? AND sters_la IS NULL').bind(+params.id || 0, agent.nume).first();
  if (!c) return raspuns(404, { eroare: 'Clientul nu există sau nu e al tău.' });
  if (Object.keys(CAMPURI).every(k => (v[k] ?? null) === (c[k] ?? null))) {   // înapoi la ce e acum: nimic de aprobat
    await env.DB.prepare('DELETE FROM propunere WHERE client_id = ?').bind(c.id).run();
    return raspuns(200, { client: c });
  }
  const p = await env.DB.prepare(`INSERT INTO propunere (client_id, agent, date_json, creat_la, stergere) VALUES (?, ?, ?, datetime('now'), 0)
    ON CONFLICT(client_id) DO UPDATE SET date_json = excluded.date_json, creat_la = excluded.creat_la, stergere = 0 RETURNING *`)
    .bind(c.id, agent.nume, JSON.stringify(v)).first();
  return raspuns(200, { client: vedereAgent(p, c) });
}

// DELETE — managerul şi conturile de conducere: direct. Rândul rămâne, marcat şters şi cu
// versiune nouă, ca ştergerea să ajungă şi în copiile managerului (care trag „după versiunea X");
// agentul nu-l mai vede, iar cererea lui în aşteptare (dacă are) dispare.
// Agentul (userul, 2026-10-29): cerere de ştergere, de aprobat din manager — înlocuieşte
// modificarea lui în aşteptare pe client, dacă are una (tot o cerere pe rând).
export async function onRequestDelete({ request, env, params }) {
  const manager = request.headers.has('Authorization');
  if (manager && !eManager(request, env)) return raspuns(401, { eroare: 'Cheie greşită.' });
  const agent = manager ? null : await agentLogat(request, env);
  if (!manager && !agent) return raspuns(401, { eroare: 'Nu eşti logat.' });
  const c = await clientul(env, params.id);
  if (manager || agent.rol === 'conducere') {
    if (!c) return raspuns(404, { eroare: 'Clientul nu mai există — l-a şters cineva între timp.' });
    await stergeClient(env, c.id);
    return raspuns(200, { ok: true });
  }
  if (!c || c.agent !== agent.nume) return raspuns(404, { eroare: 'Clientul nu există sau nu e al tău.' });
  const p = await env.DB.prepare(`INSERT INTO propunere (client_id, agent, date_json, creat_la, stergere) VALUES (?, ?, '{}', datetime('now'), 1)
    ON CONFLICT(client_id) DO UPDATE SET date_json = '{}', creat_la = excluded.creat_la, stergere = 1 RETURNING *`)
    .bind(c.id, agent.nume).first();
  return raspuns(200, { client: vedereAgent(p, c) });
}
