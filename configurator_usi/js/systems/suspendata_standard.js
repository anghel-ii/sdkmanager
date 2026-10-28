// ═══════════════════════════════════════════════════════════════════════════
//  SUSPENDATĂ STANDARD — 2–7 uşi alese de user, fără pereţi, cu suprapuneri
//  (acelaşi tabel ca la Confort: 2→1, 3→2, 4→2, 5→4, 6→4, 7→5).
//  Date de user (2026-09-21):
//    lăţime uşă  = (gol + 19 × nr. suprapuneri − 5) ÷ nr. uşi
//    înălţime    = gol − 62
//    şină        = doar SIMPLĂ, lungime = lăţimea golului; cu suprapuneri
//                  vin 2 şine (una pe pistă).
//    mascare     = la alegere (2026-10-13): fără / faţă / faţă şi spate →
//                  0 / 1 / 2 profile, pe lungimea şinei (state.mascare).
// ═══════════════════════════════════════════════════════════════════════════

import { mm } from '../lib/comun/geo.js';
import { makeMaterials } from '../lib/suspendata/materials.js';
import { glazing } from '../lib/suspendata/glazing.js';
import { doorFrameRows, railRows, wheelRows, screwRows, glassRows } from '../lib/suspendata/bom.js';
import { billQuantities } from '../lib/suspendata/billing.js';
import { billAplicate, aplicateRows, usa3D } from '../lib/suspendata/aplicate.js';
import { suprapuneri, layout2Track } from '../lib/suspendata/suprapuneri.js';
import { FINISAJE_STANDARD, finishHex } from '../lib/suspendata/finish.js';
import { GROSIME_PAL_SUSPENDATE_MM, suspendedRail, hungDoor } from '../lib/suspendata/suspended.js';
import { clamp } from '../lib/suspendata/num.js';

// ── 1. Identitate + limite gol (mm) ─────────────────────────────────────────
export const meta = {
  id:          'suspendataStandard',
  label:       'Suspendată Standard',
  family:      'suspendata',
  pal:         true,                  // sticlă sau PAL 10mm
  doorsRange:  [2, 7],                // nr. de uşi ales de user (stepper UI)
  suprapuneriObligatorii: true,       // fără varianta „0 suprapuneri" (vezi ui.js)
  mascareOptiune: true,               // butonul „Mascare şină" fără / faţă / faţă şi spate (ui.js)
  // lăţimea pe nr. de uşi (userul, 2026-10-15): minimul — uşa ≥ 601 mm („nu are voie mai îngustă de 600”, 601 = cel
  // mai mic cod, USA001) şi şina = golul cu cod de la 1201 mm (Cupru de la orice lungime); maximul — şina ≤ 5800, cât
  // e bara (uşă peste 2000 → fără cod, eroarea se vede). Uşa = (gol + 19 × suprapuneri − 5) ÷ uşi. Test: referinta.mjs.
  limits:      { width: [1201, 5800], height: [1900, 3400],
                 widthUsi: { 2: [1201, 5800], 3: [1769, 5800], 4: [2369, 5800], 5: [2932, 5800], 6: [3532, 5800], 7: [4114, 5800] } },
  // Cupru: şina Cupru e bară de 3,5 m → golul max 3500; de la 6 uşi, uşile (≥ 601) nu mai încap în 3,5 m.
  limitsFinisaj: { CUPRU: { width: [1187, 3500], widthUsi: { 2: [1187, 3500], 3: [1769, 3500], 4: [2369, 3500], 5: [2932, 3500] }, doors: [2, 5] } },
  finishes:    FINISAJE_STANDARD,
};

// ── 2. Profile (mm) — aceleaşi secţiuni ca la celelalte suspendate ─────────
const LPROFIL = 19;
export const profiles = {
  montant:     { w: LPROFIL, d: 35 },
  traversaSus: { w: 24,      d: 35 },
  traversaJos: { w: 36,      d: 35 },
  divizare:    { w: 28,      d: 30 },
  sina:        { w: 70,      h: 50 },
};

// ── 3. Cote de comandă — SURSĂ UNICĂ (mm) ───────────────────────────────────
export function spec(state) {
  const { width: W, height: H } = state;
  const doors = clamp(state.doors ?? 2, meta.doorsRange[0], meta.doorsRange[1]);
  const supr  = suprapuneri(doors);
  const doorW = Math.round((W + LPROFIL * supr - 5) / doors);
  const doorH = H - 62;
  const rail  = W;
  const nrSine = supr > 0 ? 2 : 1;
  const mascare = clamp(state.mascare ?? 0, 0, 2);

  const parts = {
    opening: { w: W, h: H },
    door:    { w: doorW, h: doorH, count: doors },
    rail:    { length: rail },
    glass:   glazing({ doorW, doorH, divisionsPerDoor: state.divisions, panelsPerDoor: state.panels, inaltimiPerDoor: state.hPanouri }),
  };

  return {
    ...parts,
    nrSine, mascare,
    bill: { ...billQuantities(profiles, parts, state), ...billAplicate(parts, state), nrSine, mascare },
    summary: [
      { label: 'Înălţime gol',    value: `${H} mm` },
      { label: 'Lăţime gol',      value: `${W} mm` },
      { label: 'Înălţimea uşii',  value: `${doorH} mm` },
      { label: 'Lăţimea uşii',    value: `${doorW} mm × ${doors} uşi` },
      { label: 'Nr. suprapuneri', value: `${supr}` },
      { label: 'Lungime şină',    value: `${rail} mm × ${nrSine}` },
      { label: 'Mascare şină',    value: ['fără', 'faţă', 'faţă şi spate'][mascare] },
    ],
  };
}

// ── 4. Necesar materiale (atelier) ─────────────────────────────────────────
export function bom(state, s) {
  return [
    ...doorFrameRows(profiles, s, state, meta.family),
    ...railRows(s, state, meta.family, s.mascare, s.nrSine),   // mascare: 0 / 1 / 2 profile, la alegere
    ...wheelRows(state),
    ...screwRows(state),
    ...glassRows(s, state),
    ...aplicateRows(meta.family, s, state),
  ];
}

// ── 5. Randare 3D — fără pereţi; câte o şină pe pistă, uşile pe 2 piste ─────
export function build(group, state, s) {
  const mats = makeMaterials(finishHex(meta, state), { palColor: 0xf4f4f2 });   // PAL alb
  const W = mm(s.opening.w), H = mm(s.opening.h);
  const doorW = mm(s.door.w), doorH = mm(s.door.h);
  const piste = s.nrSine === 2 ? [0, 1] : [0];

  // şina stă în gol, sub buiandrug (uşa e cu 62mm mai joasă decât golul)
  piste.forEach(t => suspendedRail(group, { length: W, centerX: 0, H: H - 0.07, mat: mats.trackMat, track: t }));

  layout2Track(W, doorW, s.door.count).forEach(({ offsetX, track }, i) => {
    hungDoor(group, {
      profiles, doorW, doorH, offsetX,
      track: piste.length === 2 ? track : 0,
      divisions: state.divisions[i], panelMaterials: state.panels[i],
      ...usa3D(s, state, i, GROSIME_PAL_SUSPENDATE_MM), mats,
    });
  });
}

// ── 6. Facturare (NeoManager) ─────────────────────────────────────────────
export const billing = {
  mode: 'complet',
  linii: [
    { tip: 'usa',      dim: 'doorWmm',   qty: 'usi' },
    { tip: 'sina',     dim: 'sinaLenMm', qty: 'nrSine' },
    { tip: 'mascare_sina', dim: 'sinaLenMm', qty: 'mascare' },   // 0 = fără → linia se omite
    { tip: 'divizare', dim: 'innerWmm',  qty: 'divizariBuc' },

    { cod: '381', denumire: 'Rotile pentru 1 usa cu rama din aluminiu, opritor si ghidaj cu rulment inclus cod 381',       qty: 'roleSimple',    factor: 0.5, um: 'set' },
    { cod: '380', denumire: 'Rotile la set cu amortizare pentru 1 usa cu rama din aluminiu, opritor si ghidaj cu rulment inclus cod 380', qty: 'roleAmortizor', factor: 0.5, um: 'set' },
    { cod: '274', denumire: 'Perie laterala 11x5mm cod 274',    qty: 'perieMl', um: 'm' },

    { tip: 'divizare aplicata 10', dim: 'innerWmm', qty: 'bareAplicate10' },
    { tip: 'divizare aplicata 20', dim: 'innerWmm', qty: 'bareAplicate20' },
    // Geam/oglindă + garnitură + folie se adaugă automat (js/lib/suspendata/geam.js).
    // Verticalele, orizontalele şi şuruburile sunt incluse în codul uşii.
  ],
};
