import { raspuns, text, eManager, hashParola, parolaNoua } from '../../../lib/comun.js';

// ═══════════════════════════════════════════════════════════════════════════
//  Conturile agenţilor — DOAR managerul (Bearer CHEIE_MANAGER): pagina /admin
//  din manager şi agent.mjs de pe laptop. Numele agentului = exact ca în
//  coloana AGENT a clienţilor (agentul vede clienţii cu numele lui).
//  Două tipuri de cont (`rol`, userul 2026-10-27): 'agent' — îşi vede clienţii şi
//  propune modificări; 'conducere' — vede şi modifică direct toţi clienţii.
//  GET    conturile (fără parole) + numele din clienţi care n-au încă un cont
//  POST   { nume, rol? } → cont nou (implicit agent), sau parolă nouă dacă există (îl
//         şi delogheaza); întoarce parola O SINGURĂ DATĂ — în DB stă doar hash-ul ei
//  PATCH  { nume, activ } → dezactivează (şi delogheaza) / reactivează
//  PATCH  { nume, rol }   → alt tip de cont (delogat, ca să reintre cu drepturile noi)
// ═══════════════════════════════════════════════════════════════════════════

const interzis = () => raspuns(401, { eroare: 'Cheie greşită.' });
const ROLURI = ['agent', 'conducere'];

export async function onRequestGet({ request, env }) {
  if (!eManager(request, env)) return interzis();
  const [agenti, faraCont] = await env.DB.batch([
    env.DB.prepare(`SELECT a.user, a.nume, a.activ, a.rol,
        (SELECT COUNT(*) FROM client c WHERE c.agent = a.nume AND c.sters_la IS NULL) AS clienti,
        (SELECT COUNT(*) FROM sesiune s WHERE s.agent_id = a.id AND s.expira_la > datetime('now') AND s.admin = 0) AS sesiuni
      FROM agent a ORDER BY a.activ DESC, a.nume`),
    env.DB.prepare(`SELECT agent AS nume, COUNT(*) AS clienti FROM client
      WHERE agent IS NOT NULL AND sters_la IS NULL AND agent NOT IN (SELECT nume FROM agent) GROUP BY agent ORDER BY clienti DESC`),
  ]);
  return raspuns(200, { agenti: agenti.results, faraCont: faraCont.results });
}

const delogheaza = (env, nume) =>
  env.DB.prepare('DELETE FROM sesiune WHERE agent_id = (SELECT id FROM agent WHERE nume = ?)').bind(nume);

export async function onRequestPost({ request, env }) {
  if (!eManager(request, env)) return interzis();
  const corp = await request.json().catch(() => ({}));
  const nume = text(corp.nume, 80), rol = corp.rol ?? 'agent';
  if (!nume) return raspuns(400, { eroare: 'Scrie numele agentului.' });
  if (!ROLURI.includes(rol)) return raspuns(400, { eroare: 'Tip de cont necunoscut.' });
  const parola = parolaNoua(), hash = await hashParola(parola);

  const exista = await env.DB.prepare('SELECT user FROM agent WHERE nume = ?').bind(nume).first();
  let user = exista?.user;
  if (exista) {
    await env.DB.batch([
      env.DB.prepare('UPDATE agent SET parola_hash = ?, activ = 1 WHERE nume = ?').bind(hash, nume),
      delogheaza(env, nume),
    ]);
  } else {
    // „Serban Dragos" → serban.dragos; dacă e luat (alt nume, acelaşi user) → serban.dragos2, …
    const baza = nume.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'agent';
    for (let i = 1; ; i++) {
      user = i === 1 ? baza : `${baza}${i}`;
      if (!await env.DB.prepare('SELECT 1 FROM agent WHERE user = ?').bind(user).first()) break;
    }
    await env.DB.prepare('INSERT INTO agent (user, nume, parola_hash, rol) VALUES (?, ?, ?, ?)').bind(user, nume, hash, rol).run();
  }
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM client WHERE agent = ? AND sters_la IS NULL').bind(nume).first();
  const { rol: rolCont } = await env.DB.prepare('SELECT rol FROM agent WHERE nume = ?').bind(nume).first();
  return raspuns(exista ? 200 : 201, { user, nume, parola, clienti: n, nou: !exista, rol: rolCont });
}

export async function onRequestPatch({ request, env }) {
  if (!eManager(request, env)) return interzis();
  const c = await request.json().catch(() => ({}));
  const nume = text(c.nume, 80);
  if (nume && ROLURI.includes(c.rol)) {
    const [r] = await env.DB.batch([
      env.DB.prepare('UPDATE agent SET rol = ? WHERE nume = ?').bind(c.rol, nume),
      delogheaza(env, nume),
    ]);
    return r.meta.changes ? raspuns(200, {}) : raspuns(404, { eroare: 'Agent inexistent.' });
  }
  if (!nume || typeof c.activ !== 'boolean') return raspuns(400, { eroare: 'Date invalide.' });
  const [r] = await env.DB.batch([
    env.DB.prepare('UPDATE agent SET activ = ? WHERE nume = ?').bind(c.activ ? 1 : 0, nume),
    ...(c.activ ? [] : [delogheaza(env, nume)]),
  ]);
  if (!r.meta.changes) return raspuns(404, { eroare: 'Agent inexistent.' });
  return raspuns(200, {});
}
