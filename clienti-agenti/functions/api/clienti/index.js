import { raspuns, agentLogat, eManager, vedereAgent, scrieDirect, numeAgenti, semn, versiunePagina, text } from '../../../lib/comun.js';
import { anuntaClientNou } from '../../../lib/mail.js';

// ═══════════════════════════════════════════════════════════════════════════
//  GET   manager (Bearer CHEIE_MANAGER): ?dupa=<versiune> → tot ce s-a adăugat
//        sau modificat după ea, câte 500, în ordinea versiunii — DOAR ce s-a aprobat.
//        Şi cei şterşi (sters_la completat) — copia managerului îi scoate.
//        agent logat: clienţii LUI (agent = numele lui), cu propunerile lui în
//        aşteptare peste ei + clienţii noi încă neaprobaţi.
//        cont de conducere: TOŢI clienţii + agenţii pe care îi poate primi un client.
//        ?semn → doar { semn } (vezi semn() în lib/comun.js): managerul, la 30 s / 10 min;
//        pagina, doar când i se redeschide legătura live (functions/api/live.js).
//  POST  client nou, direct în bază (fără aprobare, userul 2026-11-02) + mail pentru NeoManager:
//        agentul pe numele lui, conducerea cu agentul ales. `avertisment` = mailul n-a plecat.
//        Şi managerul (Bearer CHEIE_MANAGER, 2026-11-03): agentul din cerere, `adaugat_de` în mail.
// ═══════════════════════════════════════════════════════════════════════════

export async function onRequestGet({ request, env }) {
  if (request.headers.has('Authorization')) {
    if (!eManager(request, env)) return raspuns(401, { eroare: 'Cheie greşită.' });
    // ?semn → managerul întreabă dacă s-a schimbat ceva (clienţi sau cereri), ieftin, la 30 s / 10 min
    if (new URL(request.url).searchParams.has('semn')) return raspuns(200, { semn: await semn(env, null) });
    const dupa = Math.max(0, parseInt(new URL(request.url).searchParams.get('dupa'), 10) || 0);
    const { results } = await env.DB.prepare('SELECT * FROM client WHERE versiune > ? ORDER BY versiune LIMIT 500').bind(dupa).all();
    return raspuns(200, { clienti: results });
  }
  const agent = await agentLogat(request, env);
  if (!agent) return raspuns(401, { eroare: 'Nu eşti logat.' });
  // semnul se citeşte ÎNAINTEA listei: o schimbare venită între ele se vede la următoarea întrebare
  const s = await semn(env, agent), versiune = await versiunePagina();
  if (new URL(request.url).searchParams.has('semn')) return raspuns(200, { semn: s, versiune });
  if (agent.rol === 'conducere') {
    const { results } = await env.DB.prepare('SELECT * FROM client WHERE sters_la IS NULL ORDER BY nume COLLATE NOCASE').all();
    return raspuns(200, { agent: agent.nume, admin: !!agent.admin, conducere: true, agenti: await numeAgenti(env), clienti: results, semn: s, versiune });
  }
  const [clienti, propuneri] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM client WHERE agent = ? AND sters_la IS NULL ORDER BY nume COLLATE NOCASE').bind(agent.nume),
    env.DB.prepare('SELECT * FROM propunere WHERE agent = ?').bind(agent.nume),
  ]);
  const pe = new Map(propuneri.results.filter(p => p.client_id).map(p => [p.client_id, p]));
  return raspuns(200, { agent: agent.nume, admin: !!agent.admin, clienti: [
    ...propuneri.results.filter(p => !p.client_id).map(p => vedereAgent(p)),
    ...clienti.results.map(c => (pe.has(c.id) ? vedereAgent(pe.get(c.id), c) : c)),
  ], semn: s, versiune });
}

export async function onRequestPost({ request, env }) {
  // managerul de comenzi (Bearer CHEIE_MANAGER — pagina Clienţi, userul 2026-11-03): biroul / conducerea de acolo
  // adaugă cu agentul ales (implicit BIROU, pus de manager); `adaugat_de` = cine, pentru mail
  if (request.headers.has('Authorization')) {
    if (!eManager(request, env)) return raspuns(401, { eroare: 'Cheie greşită.' });
    const adaugatDe = text((await request.clone().json().catch(() => ({}))).adaugat_de, 120) ?? 'managerul de comenzi';
    const r = await scrieDirect(request, env, null);
    if (r.eroare) return raspuns(r.cod, { eroare: r.eroare });
    return raspuns(201, { client: r.client, avertisment: await anuntaClientNou(env, r.client, adaugatDe) });
  }
  const agent = await agentLogat(request, env);
  if (!agent) return raspuns(401, { eroare: 'Nu eşti logat.' });
  const r = await scrieDirect(request, env, null, agent.rol === 'conducere' ? null : agent.nume);
  if (r.eroare) return raspuns(r.cod, { eroare: r.eroare });
  return raspuns(201, { client: r.client, avertisment: await anuntaClientNou(env, r.client, agent.nume) });
}
