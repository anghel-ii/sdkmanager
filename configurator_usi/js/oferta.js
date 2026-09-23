import { state } from './state.js';
import { systems } from './systems/registry.js';
import { currentSpec, currentBom, currentClientPanels, currentBilling, currentSticla } from './builder.js';

// ═══════════════════════════════════════════════════════════════════════════
//  OFERTĂ — leagă configuratorul de managerul de comenzi
//
//  O ofertă = O SINGURĂ configuraţie. Nu există coş: configurezi, completezi
//  clientul, confirmi. (Structura de pe server acceptă mai multe poziţii —
//  tabelul `pozitie` rămâne aşa — dar de aici se trimite mereu una singură.)
//
//  Configuratorul rămâne folosibil şi SINGUR, deschis direct de pe disc, fără
//  server (aşa a fost gândit de la început). De-aia tot panoul se ascunde când
//  nu găseşte un API: `stare` rămâne 'fara-server' şi nu se randează nimic.
// ═══════════════════════════════════════════════════════════════════════════

let stare = 'necunoscut';       // 'fara-server' | 'nelogat' | 'logat'
let utilizator = null;
let laSchimbare = () => {};

export const stareOferta = () => ({ stare, utilizator });

export function initOferta(onSchimbare) {
  laSchimbare = onSchimbare || (() => {});
  return verificaSesiunea();
}

// Un singur apel decide totul: eroare de reţea → suntem pe disc, fără server;
// 401 → server există dar nu suntem logaţi; 200 → putem trimite oferte.
async function verificaSesiunea() {
  try {
    const r = await fetch('/api/eu', { headers: { Accept: 'application/json' } });
    if (r.status === 401) { stare = 'nelogat'; utilizator = null; }
    else if (r.ok)        { stare = 'logat'; utilizator = (await r.json()).utilizator; }
    else                  { stare = 'fara-server'; }
  } catch {
    stare = 'fara-server';
  }
  laSchimbare();
  return stare;
}

// ── Poziţia curentă ──────────────────────────────────────────────────────────

// Îngheaţă configuraţia curentă. Întoarce { eroare } dacă facturarea are coduri
// lipsă — o ofertă cu linii nerezolvate n-are ce căuta la client, iar problema
// trebuie văzută ACUM, nu după ce a plecat.
export function pozitieCurenta() {
  const sys  = systems[state.system];
  const spec = currentSpec();
  if (!sys || !spec) return { eroare: 'Configuraţia nu e gata.' };

  const facturare = currentBilling();
  if (facturare.errors.length) return { eroare: facturare.errors[0] };
  if (!facturare.lines.length) return { eroare: 'Facturarea n-are nicio linie.' };

  return {
    pozitie: {
      sistem:   sys.meta.id,
      eticheta: sys.meta.label,
      finisaj:  state.finish,
      // rame: n-au gol — cea mai mare ramă din comandă (spec.opening)
      latime:   sys.meta.rame ? spec.opening.w : state.width,
      inaltime: sys.meta.rame ? spec.opening.h : state.height,
      // rame: nr. de rame (informativ — codul de bare e unul pe comandă)
      nrUsi:    sys.meta.rame ? Math.max(1, spec.nrRame) : spec.door.count,
      config:   structuredClone(state),
      linii: {
        facturare: facturare.lines.map(l => ({
          cod: l.cod, denumire: l.denumire, um: l.um, cantitate: l.cantitate,
        })),
        necesar: currentBom().map(r => ({
          cod: r.code, denumire: r.label, um: r.unit, cantitate: r.qty, debitare: r.cut,
        })),
        client: currentClientPanels().map(r => ({
          cod: null, denumire: r.label, um: r.unit, cantitate: r.qty, debitare: r.cut,
        })),
        // sticla de comandat la furnizor (pagina „Comandă sticlă" din manager)
        sticla: currentSticla().map(g => ({
          cod: g.cod, denumire: g.denumire, um: 'buc', cantitate: g.buc, debitare: `${g.h} × ${g.l} mm`,
        })),
      },
    },
  };
}

// ── Trimitere ────────────────────────────────────────────────────────────────

// Oferta deschisă din manager („Modifică oferta" → ?oferta=<id>): configuraţia
// salvată + clientul + codul de bare. null dacă nu se poate citi.
export async function incarcaOferta(id) {
  try {
    const r = await fetch('/api/comenzi/' + encodeURIComponent(id), { headers: { Accept: 'application/json' } });
    if (!r.ok) return { eroare: r.status === 401 ? 'Autentifică-te ca să modifici oferta.' : 'Oferta nu există.' };
    return await r.json();
  } catch {
    return { eroare: 'Managerul nu răspunde.' };
  }
}

// `id` = oferta deschisă pt. modificare (PUT, acelaşi număr şi cod de bare);
// fără id → ofertă nouă (POST).
export async function confirma({ nume, telefon, email, observatii, id = null }) {
  if (!String(nume || '').trim()) return { eroare: 'Completează numele clientului.' };

  const p = pozitieCurenta();
  if (p.eroare) return { eroare: p.eroare };

  let r;
  try {
    r = await fetch(id ? `/api/comenzi/${id}` : '/api/comenzi', {
      method:  id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        client: { nume, telefon, email },
        observatii,
        pozitii: [p.pozitie],
      }),
    });
  } catch {
    return { eroare: 'Serverul nu răspunde. Verifică legătura la reţea.' };
  }

  if (r.status === 401) {
    stare = 'nelogat'; utilizator = null; laSchimbare();
    return { eroare: 'Sesiunea a expirat. Autentifică-te din nou.' };
  }

  const date = await r.json().catch(() => ({}));
  if (!r.ok) return { eroare: date.eroare || `Trimiterea a eşuat (${r.status}).` };

  return { ok: true, comanda: date.comanda };
}
