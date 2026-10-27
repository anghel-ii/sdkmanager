import { raspuns, text, verificaParola, creeazaSesiune } from '../../lib/comun.js';

// POST { user, parola } → cookie de sesiune.
// 10 parole greşite în 15 minute → contul e blocat 15 minute (userul, 2026-10-27: de când
// conducerea vede toţi clienţii, un cont ghicit ar da acces la toată baza). „Parolă nouă"
// din /admin-ul managerului îl deblochează.
const MAX_GRESELI = 10, FEREASTRA = 15 * 60e3;

export async function onRequestPost({ request, env }) {
  const c = await request.json().catch(() => ({}));
  const user = text(c.user, 60)?.toLowerCase(), parola = typeof c.parola === 'string' ? c.parola : '';
  const a = user && await env.DB.prepare('SELECT id, nume, parola_hash, esecuri FROM agent WHERE user = ? AND activ = 1').bind(user).first();
  const acum = Date.now();
  const recente = JSON.parse(a?.esecuri || '[]').filter(t => acum - t < FEREASTRA);
  if (recente.length >= MAX_GRESELI) return raspuns(429, { eroare: 'Prea multe parole greşite — contul e blocat 15 minute.' });
  if (!a || !(await verificaParola(parola, a.parola_hash))) {
    if (a) await env.DB.prepare('UPDATE agent SET esecuri = ? WHERE id = ?').bind(JSON.stringify([...recente, acum]), a.id).run();
    return raspuns(401, { eroare: 'User sau parolă greşită.' });
  }
  // curăţenie ieftină: sesiunile expirate ale tuturor + greşelile de dinainte ale lui
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sesiune WHERE expira_la <= datetime('now')"),
    env.DB.prepare('UPDATE agent SET esecuri = NULL WHERE id = ?').bind(a.id),
  ]);
  return raspuns(200, { agent: a.nume }, { 'Set-Cookie': await creeazaSesiune(env, a.id) });
}
