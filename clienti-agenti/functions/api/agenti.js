import { raspuns, text, eManager, hashParola, parolaNoua } from '../../lib/comun.js';

// ═══════════════════════════════════════════════════════════════════════════
//  Conturile agenţilor — DOAR managerul (Bearer CHEIE_MANAGER): pagina /admin
//  din manager şi agent.mjs de pe laptop. Numele agentului = exact ca în
//  coloana AGENT a clienţilor (agentul vede clienţii cu numele lui).
//  GET    conturile (fără parole) + numele din clienţi care n-au încă un cont
//  POST   { nume } → cont nou, sau parolă nouă dacă există (îl şi delogheaza);
//         întoarce parola O SINGURĂ DATĂ — în DB stă doar hash-ul ei
//  PATCH  { nume, activ } → dezactivează (şi delogheaza) / reactivează
// ═══════════════════════════════════════════════════════════════════════════

const interzis = () => raspuns(401, { eroare: 'Cheie greşită.' });

export async function onRequestGet({ request, env }) {
  if (!eManager(request, env)) return interzis();
  const [agenti, faraCont] = await env.DB.batch([
    env.DB.prepare(`SELECT a.user, a.nume, a.activ,
        (SELECT COUNT(*) FROM client c WHERE c.agent = a.nume) AS clienti,
        (SELECT COUNT(*) FROM sesiune s WHERE s.agent_id = a.id AND s.expira_la > datetime('now')) AS sesiuni
      FROM agent a ORDER BY a.activ DESC, a.nume`),
    env.DB.prepare(`SELECT agent AS nume, COUNT(*) AS clienti FROM client
      WHERE agent IS NOT NULL AND agent NOT IN (SELECT nume FROM agent) GROUP BY agent ORDER BY clienti DESC`),
  ]);
  return raspuns(200, { agenti: agenti.results, faraCont: faraCont.results });
}

const delogheaza = (env, nume) =>
  env.DB.prepare('DELETE FROM sesiune WHERE agent_id = (SELECT id FROM agent WHERE nume = ?)').bind(nume);

export async function onRequestPost({ request, env }) {
  if (!eManager(request, env)) return interzis();
  const nume = text((await request.json().catch(() => ({}))).nume, 80);
  if (!nume) return raspuns(400, { eroare: 'Scrie numele agentului.' });
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
    await env.DB.prepare('INSERT INTO agent (user, nume, parola_hash) VALUES (?, ?, ?)').bind(user, nume, hash).run();
  }
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM client WHERE agent = ?').bind(nume).first();
  return raspuns(exista ? 200 : 201, { user, nume, parola, clienti: n, nou: !exista });
}

export async function onRequestPatch({ request, env }) {
  if (!eManager(request, env)) return interzis();
  const c = await request.json().catch(() => ({}));
  const nume = text(c.nume, 80);
  if (!nume || typeof c.activ !== 'boolean') return raspuns(400, { eroare: 'Date invalide.' });
  const [r] = await env.DB.batch([
    env.DB.prepare('UPDATE agent SET activ = ? WHERE nume = ?').bind(c.activ ? 1 : 0, nume),
    ...(c.activ ? [] : [delogheaza(env, nume)]),
  ]);
  if (!r.meta.changes) return raspuns(404, { eroare: 'Agent inexistent.' });
  return raspuns(200, {});
}
