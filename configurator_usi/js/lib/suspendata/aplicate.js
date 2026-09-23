// ═══════════════════════════════════════════════════════════════════════════
//  SUSPENDATE — ce au în comun cu Confort ca REGULĂ, dar ţinut separat ca
//  schimbările la Confort să nu atingă suspendatele (şi invers):
//    • usa3D — grosimea reală a panourilor + divizările aplicate, pt. randare
//    • divizări APLICATE — benzi lipite pe panouri (opţiuni avansate)
//  Copiat din lib/confort/confort.js la separarea familiilor (2026-09-23);
//  de atunci cele două copii evoluează independent.
// ═══════════════════════════════════════════════════════════════════════════

import { line } from './bom.js';
import { findGeam } from './geam.js';
import { GROSIME_PAL_SUSPENDATE_MM } from './suspended.js';
import catalog from '../../catalog/catalog.generated.json';

// Înălţimile panourilor, grosimea lor reală (centrate în ramă) şi divizările
// aplicate — pt. buildDoor. Barele rămân cu profilul din profiles.divizare.
export function usa3D(spec, state, i, grosimePal = GROSIME_PAL_SUSPENDATE_MM) {
  const p = spec.glass?.panels?.[i];
  const client = state.assembly?.[i] === 'client';
  const grosimeGeam = client ? (state.geamClient?.[i] ?? 4) : (findGeam(state.geam?.[i])?.grosime ?? 4);
  return {
    paneHeights:   p?.heights,
    paneThickness: (p?.mats ?? []).map(m => (m === 'pal' ? grosimePal : grosimeGeam)),
    aplicate:      state.divAplicate?.[i],
  };
}

// Cod din catalogul familiei pe (tip, finisaj) — fără bandă de mărime.
const FALLBACK_DENUMIRE = {
  'divizare aplicata 10': 'Divizare aplicată 10mm',
  'divizare aplicata 20': 'Divizare aplicată 20mm',
};

function liniePeFinisaj(family, tip, finisaj, qty, cut, unit = 'buc') {
  const art = (catalog[family] ?? []).find(a => a.tip === tip && a.finisaj === finisaj);
  if (art) return line(art.cod, art.denumire, qty, unit, cut);
  return line('⚠ LIPSĂ COD', `${FALLBACK_DENUMIRE[tip]} — fără cod pentru finisajul ${finisaj}`, qty, unit, cut);
}

// ── Divizări APLICATE — benzi lipite pe panouri (opţiuni avansate) ─────────
//  Regulile userului (2026-09-18), per uşă, pe TOATE panourile ei:
//    • verticalele se pun întregi pe fiecare panou → lungime = înălţimea
//      panoului (cota lui de debitare)
//    • orizontalele se taie ca să facă loc verticalelor → pe fiecare panou,
//      fiecare orizontală = (verticale + 1) segmente, lungime = lăţimea
//      panoului / (verticale + 1)
//      ⚠ DE CONFIRMAT: userul a zis „lăţimea / nr. de verticale"; am luat
//      verticale + 1 (câte bucăţi rezultă efectiv). La 0 verticale, o bucată
//      întreagă.
//    • „faţă şi spate" dublează tot
//  Lăţimea panoului = glassW la sticlă, palW la PAL. Segmentele se aşază pe
//  bare de 3000mm (First Fit Decreasing), separat pe 10mm şi 20mm, pe TOATĂ
//  poziţia (toate uşile la un loc) — asta dă nr. de bare, singurul lucru care
//  apare în necesar şi facturare (bucăţile se taie pe uşa montată).
export const BARA_APLICATA_MM = 3000;

export function segmenteAplicate(spec, state) {
  const panels = spec.glass?.panels ?? [];
  const glassW = spec.glass?.glassW ?? 0;
  const palW   = spec.glass?.palW ?? glassW;
  const out = [];
  panels.forEach((p, i) => {
    const da = state.divAplicate?.[i];
    if (!da || da.latime === 'fara') return;
    const fete = da.parte === 'ambele' ? 2 : 1;
    const V = da.verticale ?? 0, O = da.orizontale ?? 0;
    (p.heights ?? []).forEach((h, k) => {
      const w = p.mats?.[k] === 'pal' ? palW : glassW;
      for (let f = 0; f < fete; f++) {
        for (let v = 0; v < V; v++) out.push({ latime: da.latime, lungime: Math.round(h), usa: i });
        for (let o = 0; o < O * (V + 1); o++) out.push({ latime: da.latime, lungime: Math.round(w / (V + 1)), usa: i });
      }
    });
  });
  return out.filter(s => s.lungime > 0);
}

// Nr. de bare de 3m pt. o listă de lungimi. Bucăţile mai lungi decât bara nu
// încap — le raportăm separat (nu le putem tăia dintr-o singură bară).
export function bareNecesare(lungimi) {
  const bare = [];
  const preaLungi = [];
  for (const L of [...lungimi].sort((a, b) => b - a)) {
    if (L > BARA_APLICATA_MM) { preaLungi.push(L); continue; }
    const loc = bare.findIndex(rest => rest >= L);
    if (loc >= 0) bare[loc] -= L;
    else bare.push(BARA_APLICATA_MM - L);
  }
  return { nrBare: bare.length, preaLungi };
}

// Nr. de bare de 3m pe o lăţime de bandă. Bucăţile mai lungi de 3m se
// numără totuşi, ca nr. de bare întregi din care ar ieşi — să nu scape.
function nrBareAplicate(seg, latime) {
  const { nrBare, preaLungi } = bareNecesare(seg.filter(s => s.latime === latime).map(s => s.lungime));
  return { nr: nrBare + preaLungi.reduce((n, L) => n + Math.ceil(L / BARA_APLICATA_MM), 0), preaLungi };
}

export function billAplicate(spec, state) {
  const seg = segmenteAplicate(spec, state);
  return { bareAplicate10: nrBareAplicate(seg, '10').nr, bareAplicate20: nrBareAplicate(seg, '20').nr };
}

// Necesar: DOAR nr. de bare, fără bucăţi şi cote — benzile se măsoară şi se
// taie abia pe uşa montată (userul, 2026-09-18). Avertisment dacă o bucată ar
// ieşi mai lungă de 3m (atunci nu se poate tăia dintr-o singură bară).
export function aplicateRows(family, spec, state) {
  const seg = segmenteAplicate(spec, state);
  const rows = [];
  for (const latime of ['10', '20']) {
    const { nr, preaLungi } = nrBareAplicate(seg, latime);
    if (nr > 0) rows.push(liniePeFinisaj(family, `divizare aplicata ${latime}`, state.finish, nr, undefined, 'bară'));
    [...new Set(preaLungi)].forEach(L => rows.push(line('⚠', `Divizare aplicată ${latime}mm: o bucată de ${L} mm e mai lungă decât bara de ${BARA_APLICATA_MM} mm`, '', '')));
  }
  return rows;
}
