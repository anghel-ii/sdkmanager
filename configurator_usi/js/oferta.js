import { state } from './state.js';
import { systems } from './systems/registry.js';
import { finishesOf } from './familii.js';
import { currentSpec, currentBom, currentClientPanels, currentBilling, currentSticla } from './builder.js';

import { salveaza } from './manager.js';

// ═══════════════════════════════════════════════════════════════════════════
//  OFERTĂ — configuraţia de uşi de pe ecran, gata de trimis la manager
//  (cererile HTTP sunt în js/manager.js).
//
//  O ofertă = O SINGURĂ configuraţie. Nu există coş: configurezi, completezi
//  clientul, confirmi. (Structura de pe server acceptă mai multe poziţii —
//  tabelul `pozitie` rămâne aşa — dar de aici se trimite mereu una singură.)
// ═══════════════════════════════════════════════════════════════════════════

export { stareOferta, initOferta, cautaClienti, incarcaOferta, treceIn } from './manager.js';

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
      // numele culorii, ca în configurator şi NeoManager (nu id-ul intern)
      finisaj:  finishesOf(sys.meta).find(f => f.id === state.finish)?.label ?? state.finish,
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

// `pozitii` = toate produsele ofertei (coşul + cel de pe ecran, vezi js/cos.js);
// `id` = oferta deschisă pt. modificare (PUT); fără id → ofertă nouă (POST).
export async function confirma(date) {
  if (!String(date.nume || '').trim()) return { eroare: 'Completează numele clientului.' };
  return salveaza(date);
}
