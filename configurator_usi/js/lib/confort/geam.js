import catalog from '../../catalog/catalog.generated.json';

// rotunjire în sus la 0,01 (necesar de cumpărat, nu de subestimat). Întâi se
// taie zgomotul de virgulă mobilă sub 1e-6 — altfel 1.1 × 100 = 110.00000000000001
// şi o arie de exact 1,1 mp ieşea facturată 1,11.
const ceil2 = x => Math.ceil(Math.round(x * 1e6) / 1e4) / 100;

// ═══════════════════════════════════════════════════════════════════════════
//  GEAM / OGLINDĂ — catalog UNIC, comun tuturor sistemelor (nu e per familie).
//  Sursă: js/catalog/geam.seed.sql → js/catalog/geam.sqlite → catalog.generated.json["geam"].
//  Utilizatorul alege un model (cod) în UI; restul (garnitură, folie de
//  securizare la oglinzi) rezultă automat din `grosime` / `oglinda`.
// ═══════════════════════════════════════════════════════════════════════════

export const geamList  = () => catalog.geam ?? [];
export const geamCount = () => geamList().length;
export const findGeam  = cod => geamList().find(g => g.cod === cod) ?? null;

// Garnitura depinde de grosimea geamului/oglinzii: 4mm → cod 277, 8mm → cod 278.
const GARNITURA_COD = { 4: '277', 8: '278' };
export const garnituraCod = grosime => GARNITURA_COD[grosime] ?? GARNITURA_COD[4];
export const GARNITURA_DENUMIRE = { '277': 'Garnitura pentru geam de 4 mm cod 277', '278': 'Garnitura pentru geam de 8 mm cod 278' };

// Folie de securizare — doar la oglinzi. Formulă: (aria sticlei / 25) × 1.15.
export const FOLIE_COD = '283';
export const folieCantitate = ariaMp => ceil2((ariaMp / 25) * 1.15);

// ── Uşi asamblate de CLIENT ────────────────────────────────────────────────
// Geamul nu circulă prin noi: nici nu-l livrăm, nici nu-l aducem — clientul
// şi-l procură singur, noi trimitem şi facturăm doar restul pieselor. Din el
// ne interesează exclusiv GROSIMEA, fiindcă de ea depinde codul de garnitură.
export const GROSIMI_CLIENT = [4, 8];
export const clientGeamLabel = g => `Clientul asamblează cu geam de ${g}mm`;

// ── Situaţia geamului, uşă cu uşă ──────────────────────────────────────
// Sursă unică pentru facturare (lib/confort/billing.js) şi necesar (lib/confort/bom.js), ca
// cele două să nu mai interpreteze diferit acelaşi panou. Per uşă:
//   client   – uşa e asamblată de client (state.assembly[i] === 'client')
//   geam     – modelul ales din catalog; null la uşile 'client' (nu-l livrăm)
//   grosime  – mm; de la modelul ales, sau grosimea declarată la uşile 'client'
//   panes    – nr. de panouri de STICLĂ (panourile PAL sunt excluse din glazing)
//   palPanes – nr. de panouri PAL (le aduce clientul; dăm doar cota)
//   heights  – înălţimea de debitare a FIECĂRUI panou, de jos în sus; la
//              Confort pot diferi (înălţimi introduse — glazingConfort), la Suspendată
//              sunt toate egale cu `paneH` (glazing.js nu dă `heights`)
//   mats     – materialul fiecărui panou, în aceeaşi ordine
//   glassHs / palHs – înălţimile doar ale panourilor de sticlă / PAL
export function glassPerDoor(spec, state) {
  const panels = spec.glass?.panels ?? [];
  const glassW = spec.glass?.glassW ?? 0;
  // Confort are lăţimi diferite pt. PAL vs sticlă (vezi glazingConfort în
  // lib/confort/confort.js) — familia "suspendata" n-are palW deloc (nu are PAL),
  // dar palPanes e mereu 0 acolo, deci fallback-ul nu ajunge să conteze.
  const palW = spec.glass?.palW ?? glassW;

  return panels.map((p, i) => {
    const client  = (state.assembly ?? [])[i] === 'client';
    const geam    = client ? null : findGeam(state.geam?.[i]);
    const grosime = client ? (state.geamClient?.[i] ?? GROSIMI_CLIENT[0]) : geam?.grosime;
    const heights = p.heights ?? Array(p.divisions + 1).fill(p.paneH);
    const mats    = p.mats ?? heights.map((_, k) => (state.panels?.[i]?.[k] === 'pal' ? 'pal' : 'sticla'));
    const glassHs = heights.filter((_, k) => mats[k] !== 'pal');
    const palHs   = heights.filter((_, k) => mats[k] === 'pal');

    return {
      i, client, geam, grosime, glassW, palW, heights, mats, glassHs, palHs,
      panes:    p.glassPanes,
      palPanes: p.palPanes,
      areaM2:   glassHs.reduce((s, h) => s + (glassW / 1000) * (h / 1000), 0),
      gasketM:  glassHs.reduce((s, h) => s + 2 * (glassW + h) / 1000, 0),
    };
  });
}

// Sticla pe care o COMANDĂM noi la furnizor (doar uşile asamblate de noi — la
// cele asamblate de client, geamul şi-l ia el): { cod, denumire, h, l, buc },
// grupat pe cod + cotă. Merge la manager la salvarea ofertei (lista „sticla").
export function sticlaDeComandat(spec, state) {
  const m = new Map();
  for (const g of glassPerDoor(spec, state)) {
    if (g.client || !g.geam) continue;
    for (const hh of g.glassHs) {
      if (!(hh > 0)) continue;
      const h = Math.round(hh), l = Math.round(g.glassW);
      const k = `${g.geam.cod}|${h}|${l}`;
      const e = m.get(k) ?? { cod: g.geam.cod, denumire: g.geam.denumire, h, l, buc: 0 };
      e.buc += 1;
      m.set(k, e);
    }
  }
  return [...m.values()];
}
