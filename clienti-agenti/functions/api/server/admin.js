import { raspuns, nuEAdmin } from '../../../lib/comun.js';

// ═══════════════════════════════════════════════════════════════════════════
//  Pagina /admin (public/admin.html) — antet X-Parola = PAROLA_ADMIN.
//  GET  → ultima stare a serverului din firmă + cererea care încă aşteaptă
//  POST { cerere: 'verifica' | 'actualizeaza' } → o ia serverul la următoarea raportare (≤ 20 s)
// ═══════════════════════════════════════════════════════════════════════════

export async function onRequestGet({ request, env }) {
  const nu = await nuEAdmin(request, env);
  if (nu) return nu;
  const r = await env.DB.prepare(`SELECT raport_json, raportat_la, cerere, cerere_la,
    CAST(strftime('%s', 'now') - strftime('%s', raportat_la) AS INTEGER) AS secunde FROM server WHERE id = 1`).first();
  return raspuns(200, { raport: r?.raport_json ? JSON.parse(r.raport_json) : null, raportat_la: r?.raportat_la ?? null,
    secunde: r?.secunde ?? null, cerere: r?.cerere ?? null, cerere_la: r?.cerere_la ?? null });
}

export async function onRequestPost({ request, env }) {
  const nu = await nuEAdmin(request, env);
  if (nu) return nu;
  const { cerere } = await request.json().catch(() => ({}));
  if (!['verifica', 'actualizeaza'].includes(cerere)) return raspuns(400, { eroare: 'Cerere necunoscută.' });
  await env.DB.prepare("UPDATE server SET cerere = ?, cerere_la = datetime('now') WHERE id = 1").bind(cerere).run();
  return raspuns(200, { ok: true });
}
