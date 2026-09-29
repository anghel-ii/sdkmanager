import { raspuns, CAMPURI, clientDinCerere, agentLogat, eManager, VERSIUNE_NOUA } from '../../../lib/comun.js';

// ═══════════════════════════════════════════════════════════════════════════
//  GET   manager (Bearer CHEIE_MANAGER): ?dupa=<versiune> → tot ce s-a adăugat
//        sau modificat după ea, câte 500, în ordinea versiunii.
//        agent logat: clienţii LUI (agent = numele lui).
//  POST  agent logat: client nou, pe numele lui.
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
  const { results } = await env.DB.prepare('SELECT * FROM client WHERE agent = ? ORDER BY nume COLLATE NOCASE').bind(agent.nume).all();
  return raspuns(200, { agent: agent.nume, admin: !!agent.admin, clienti: results });
}

export async function onRequestPost({ request, env }) {
  const agent = await agentLogat(request, env);
  if (!agent) return raspuns(401, { eroare: 'Nu eşti logat.' });
  const { v, eroare } = await clientDinCerere(request, true);
  if (eroare) return raspuns(400, { eroare });
  const col = Object.keys(CAMPURI);
  const r = await env.DB.prepare(`INSERT INTO client (agent, ${col.join(', ')}, creat_la, modificat_la, versiune)
    VALUES (?${', ?'.repeat(col.length)}, datetime('now'), datetime('now'), ${VERSIUNE_NOUA}) RETURNING *`)
    .bind(agent.nume, ...col.map(k => v[k])).first();
  return raspuns(201, { client: r });
}
