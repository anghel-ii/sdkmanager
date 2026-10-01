import { raspuns, clientDinCerere, agentLogat, eManager, vedereAgent } from '../../../lib/comun.js';

// ═══════════════════════════════════════════════════════════════════════════
//  GET   manager (Bearer CHEIE_MANAGER): ?dupa=<versiune> → tot ce s-a adăugat
//        sau modificat după ea, câte 500, în ordinea versiunii — DOAR ce s-a aprobat.
//        agent logat: clienţii LUI (agent = numele lui), cu propunerile lui în
//        aşteptare peste ei + clienţii noi încă neaprobaţi.
//  POST  agent logat: client nou, pe numele lui — ca PROPUNERE, până o aprobă cineva
//        din manager (vezi api/propuneri).
// ═══════════════════════════════════════════════════════════════════════════

export async function onRequestGet({ request, env }) {
  if (request.headers.has('Authorization')) {
    if (!eManager(request, env)) return raspuns(401, { eroare: 'Cheie greşită.' });
    const dupa = Math.max(0, parseInt(new URL(request.url).searchParams.get('dupa'), 10) || 0);
    const { results } = await env.DB.prepare('SELECT * FROM client WHERE versiune > ? ORDER BY versiune LIMIT 500').bind(dupa).all();
    return raspuns(200, { clienti: results });
  }
  const agent = await agentLogat(request, env);
  if (!agent) return raspuns(401, { eroare: 'Nu eşti logat.' });
  const [clienti, propuneri] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM client WHERE agent = ? ORDER BY nume COLLATE NOCASE').bind(agent.nume),
    env.DB.prepare('SELECT * FROM propunere WHERE agent = ?').bind(agent.nume),
  ]);
  const pe = new Map(propuneri.results.filter(p => p.client_id).map(p => [p.client_id, p]));
  return raspuns(200, { agent: agent.nume, admin: !!agent.admin, clienti: [
    ...propuneri.results.filter(p => !p.client_id).map(p => vedereAgent(p)),
    ...clienti.results.map(c => (pe.has(c.id) ? vedereAgent(pe.get(c.id), c) : c)),
  ] });
}

export async function onRequestPost({ request, env }) {
  const agent = await agentLogat(request, env);
  if (!agent) return raspuns(401, { eroare: 'Nu eşti logat.' });
  const { v, eroare } = await clientDinCerere(request, true);
  if (eroare) return raspuns(400, { eroare });
  const p = await env.DB.prepare(`INSERT INTO propunere (client_id, agent, date_json, creat_la)
    VALUES (NULL, ?, ?, datetime('now')) RETURNING *`).bind(agent.nume, JSON.stringify(v)).first();
  return raspuns(201, { client: vedereAgent(p) });
}
