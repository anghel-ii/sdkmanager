import { raspuns, eManager } from '../../../lib/comun.js';

// ═══════════════════════════════════════════════════════════════════════════
//  Managerul (serverul din firmă) raportează aici la 20 s — Bearer CHEIE_MANAGER.
//  POST <starea lui: versiune, mod, jurnal, noutăţi…> → { cerere: null | 'verifica' | 'actualizeaza' }
//  Cererea lăsată de pe pagina /admin (api/server/admin) se dă o singură dată.
// ═══════════════════════════════════════════════════════════════════════════

export async function onRequestPost({ request, env }) {
  if (!eManager(request, env)) return raspuns(401, { eroare: 'Cheie greşită.' });
  const corp = await request.text();
  if (corp.length > 100000) return raspuns(413, { eroare: 'Raport prea mare.' });
  try { JSON.parse(corp); } catch { return raspuns(400, { eroare: 'Date invalide.' }); }
  await env.DB.prepare('INSERT OR IGNORE INTO server (id) VALUES (1)').run();
  const cerere = (await env.DB.prepare('SELECT cerere FROM server WHERE id = 1').first())?.cerere ?? null;
  // „IS ?": dacă între timp s-a cerut altceva de pe pagină, cererea nouă rămâne pt. data viitoare
  await env.DB.prepare(`UPDATE server SET raport_json = ?, raportat_la = datetime('now'),
    cerere = CASE WHEN cerere IS ? THEN NULL ELSE cerere END WHERE id = 1`).bind(corp, cerere).run();
  return raspuns(200, { cerere });
}
