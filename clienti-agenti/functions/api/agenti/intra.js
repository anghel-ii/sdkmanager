import { raspuns, text, eManager, creeazaBilet } from '../../../lib/comun.js';

// POST { nume } — doar managerul (Bearer CHEIE_MANAGER), pt. butonul „Intră ca
// acest agent" din /admin: întoarce un link de o folosinţă, valabil 60 s
// (functions/api/intra.js îl transformă în sesiune). Parola agentului nu se atinge.
export async function onRequestPost({ request, env }) {
  if (!eManager(request, env)) return raspuns(401, { eroare: 'Cheie greşită.' });
  const nume = text((await request.json().catch(() => ({}))).nume, 80);
  const a = nume && await env.DB.prepare('SELECT id, activ FROM agent WHERE nume = ?').bind(nume).first();
  if (!a) return raspuns(404, { eroare: 'Agent inexistent.' });
  if (!a.activ) return raspuns(409, { eroare: 'Contul e dezactivat — reactivează-l întâi.' });
  const url = new URL('/api/intra', request.url);
  url.searchParams.set('t', await creeazaBilet(env, a.id));
  return raspuns(200, { url: url.href });
}
