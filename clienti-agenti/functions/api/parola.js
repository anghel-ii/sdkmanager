import { raspuns, agentLogat, verificaParola, hashParola, sesiuneaCurenta } from '../../lib/comun.js';

// POST { veche, noua } — agentul / conducerea îşi schimbă singur parola (userul, 2026-10-29).
// Trebuie parola de acum; după schimbare rămâne logat doar aici, celelalte sesiuni (alt telefon) cad.
// Adminul intrat în contul agentului din manager nu-i poate schimba parola (pt. asta: „Parolă nouă" din /admin).
// Parola uitată: o face adminul din manager — pagina de login le spune să-l contacteze.
export async function onRequestPost({ request, env }) {
  const agent = await agentLogat(request, env);
  if (!agent) return raspuns(401, { eroare: 'Nu eşti logat.' });
  if (agent.admin) return raspuns(403, { eroare: 'Eşti intrat din manager — parola agentului se schimbă din /admin („Parolă nouă").' });
  const c = await request.json().catch(() => ({}));
  const veche = typeof c.veche === 'string' ? c.veche : '', noua = typeof c.noua === 'string' ? c.noua : '';
  if (noua.length < 8) return raspuns(400, { eroare: 'Parola nouă trebuie să aibă cel puţin 8 caractere.' });
  if (noua.length > 200) return raspuns(400, { eroare: 'Parola nouă e prea lungă.' });
  const a = await env.DB.prepare('SELECT parola_hash FROM agent WHERE id = ?').bind(agent.id).first();
  if (!(await verificaParola(veche, a.parola_hash))) return raspuns(400, { eroare: 'Parola de acum e greşită.' });
  if (veche === noua) return raspuns(400, { eroare: 'Parola nouă e aceeaşi cu cea de acum.' });
  await env.DB.batch([
    env.DB.prepare('UPDATE agent SET parola_hash = ? WHERE id = ?').bind(await hashParola(noua), agent.id),
    env.DB.prepare('DELETE FROM sesiune WHERE agent_id = ? AND token_hash <> ? AND admin = 0').bind(agent.id, await sesiuneaCurenta(request)),
  ]);
  return raspuns(200, { ok: true });
}
