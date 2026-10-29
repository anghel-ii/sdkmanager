import { raspuns, agentLogat } from '../../lib/comun.js';

// GET (WebSocket) — legătura live a paginii (userul, 2026-10-29): pagina nu mai întreabă
// singură; primeşte „schimbat" când portalul atinge clienţii / cererile ei (vezi anunta() în
// lib/comun.js şi anunturi/worker.js). Doar cine e logat; eticheta spune ce anunţuri primeşte.
export async function onRequestGet({ request, env }) {
  if (request.headers.get('Upgrade') !== 'websocket') return raspuns(426, { eroare: 'Doar WebSocket.' });
  const agent = await agentLogat(request, env);
  if (!agent) return raspuns(401, { eroare: 'Nu eşti logat.' });
  if (!env.ANUNTURI) return raspuns(503, { eroare: 'Legătura live nu e configurată.' });
  const obiect = env.ANUNTURI.get(env.ANUNTURI.idFromName('portal'));
  return obiect.fetch('https://anunturi/conecteaza', {
    headers: { Upgrade: 'websocket', 'X-Cine': agent.rol === 'conducere' ? 'conducere' : `a:${agent.nume}` },
  });
}
