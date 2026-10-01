import { raspuns, eManager } from '../../../lib/comun.js';

// ═══════════════════════════════════════════════════════════════════════════
//  Propunerile agenţilor (clienţi noi / modificări) care aşteaptă aprobarea —
//  DOAR managerul (Bearer CHEIE_MANAGER), pagina Clienţi.
//  GET → [{ id, tip: 'nou' | 'modificare', agent, trimis_la, propus, actual }]
//        `actual` = clientul de acum (null la cel nou) — managerul arată diferenţele.
//  Aprobare / respingere: api/propuneri/:id/aproba | respinge.
// ═══════════════════════════════════════════════════════════════════════════

export async function onRequestGet({ request, env }) {
  if (!eManager(request, env)) return raspuns(401, { eroare: 'Cheie greşită.' });
  const { results } = await env.DB.prepare(`SELECT p.*, json_object(${
    ['id', 'agent', 'nume', 'cui', 'judet', 'localitate', 'adresa_sediu', 'adresa_livrare', 'administrator',
     'telefon_administrator', 'email', 'delegat', 'telefon_delegat', 'discounturi'].map(k => `'${k}', c.${k}`).join(', ')
  }) AS actual_json FROM propunere p LEFT JOIN client c ON c.id = p.client_id ORDER BY p.creat_la`).all();
  return raspuns(200, { propuneri: results.map(p => ({
    id: p.id, tip: p.client_id ? 'modificare' : 'nou', agent: p.agent, trimis_la: p.creat_la,
    propus: JSON.parse(p.date_json), actual: p.client_id ? JSON.parse(p.actual_json) : null,
  })) });
}
