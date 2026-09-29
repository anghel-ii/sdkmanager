import { raspuns, text, verificaParola, creeazaSesiune } from '../../lib/comun.js';

// POST { user, parola } → cookie de sesiune
export async function onRequestPost({ request, env }) {
  const c = await request.json().catch(() => ({}));
  const user = text(c.user, 60)?.toLowerCase(), parola = typeof c.parola === 'string' ? c.parola : '';
  const a = user && await env.DB.prepare('SELECT id, nume, parola_hash FROM agent WHERE user = ? AND activ = 1').bind(user).first();
  if (!a || !(await verificaParola(parola, a.parola_hash))) return raspuns(401, { eroare: 'User sau parolă greşită.' });
  // curăţenie ieftină: sesiunile expirate ale tuturor
  await env.DB.prepare("DELETE FROM sesiune WHERE expira_la <= datetime('now')").run();
  return raspuns(200, { agent: a.nume }, { 'Set-Cookie': await creeazaSesiune(env, a.id) });
}
