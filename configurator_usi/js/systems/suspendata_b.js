// ═══════════════════════════════════════════════════════════════════════════
//  SUSPENDATĂ B — 2 uşi bi-partite (ca E), formulă proprie de gabarit
//  Fiecare uşă: DW = (gol + 34 mm) / 2 . Uşile se retrag simetric, stânga/dreapta.
//  Şină = DW × 4 − 60 mm.
// ═══════════════════════════════════════════════════════════════════════════

import { mm } from '../lib/comun/geo.js';
import { makeMaterials } from '../lib/suspendata/materials.js';
import { straightWalls } from '../lib/suspendata/walls.js';
import { glazing } from '../lib/suspendata/glazing.js';
import { doorFrameRows, railRows, wheelRows, screwRows, glassRows } from '../lib/suspendata/bom.js';
import { billQuantities } from '../lib/suspendata/billing.js';
import { billAplicate, aplicateRows, usa3D } from '../lib/suspendata/aplicate.js';
import { FINISAJE_STANDARD, finishHex } from '../lib/suspendata/finish.js';
import { GROSIME_PAL_SUSPENDATE_MM, SCENE, suspendedRail, hungDoor, DOOR_GAP } from '../lib/suspendata/suspended.js';

// ── 1. Identitate + limite gol (mm) ─────────────────────────────────────────
export const meta = {
  id:       'suspendataB',
  label:    'Suspendată B',
  family:   'suspendata',
  pal:      true,   // panouri de sticlă sau PAL 10mm (userul, 2026-09-21)
  doors:   2,
  sketch:   'assets/schita_b.png',
  // lăţimea minimă = cel mai mic gol cu uşa ≥ 601 mm (userul, 2026-10-15: „nu are voie mai îngustă de 600”; 601 = cel mai
  // mic cod, USA001) şi cu cod de şină (de la 1201 mm; la Cupru de la orice lungime) — verificat în test/referinta.mjs
  limits:   { width: [1167, 2800], height: [1900, 2700] },   // acoperit de catalog (uşă ≤2000, şină ≤5800)
  // Cupru: doar ce acoperă codurile Cupru din NeoManager — şina Cupru e bară de 3,5 m.
  limitsFinisaj: { CUPRU: { width: [1167, 1746] } },
  finishes: FINISAJE_STANDARD,
};

// ── 2. Profile din care e făcut modelul (mm) ────────────────────────────────
export const profiles = {
  montant:     { w: 19,  d: 35 },
  traversaSus: { w: 24,  d: 35 },
  traversaJos: { w: 36,  d: 35 },
  divizare:    { w: 28,  d: 30 },
  sina:        { w: 70,  h: 50 },   // şină mai grea — 2 uşi
};

// ── 3. Şina (mm) ───────────────────────────────────────────────────────────
const POCKET_MM  = 17;   // = 34mm / 2 uşi
const doorWidth  = W => Math.round((W + 34) / 2);
const railLength = DW => Math.round(DW * 4 - 60);

// ── 4. Cote de comandă — SURSĂ UNICĂ (mm) ──────────────────────────────────
export function spec(state) {
  const { width: W, height: H } = state;
  const doorW = doorWidth(W);
  const doorH = H + 18;
  const rail  = railLength(doorW);

  const parts = {
    opening: { w: W, h: H },
    door:    { w: doorW, h: doorH, count: meta.doors },
    rail:    { length: rail },
    glass:   glazing({ doorW, doorH, divisionsPerDoor: state.divisions, panelsPerDoor: state.panels, inaltimiPerDoor: state.hPanouri }),
  };

  return {
    ...parts,
    bill: { ...billQuantities(profiles, parts, state), ...billAplicate(parts, state) },
    summary: [
      // Înălţimea înaintea lăţimii, ca peste tot (userul, 2026-09-21).
      { label: 'Înălţime gol',    value: `${H} mm` },
      { label: 'Lăţime gol',      value: `${W} mm` },
      { label: 'Înălţimea uşii',  value: `${doorH} mm` },
      { label: 'Lăţimea uşii',    value: `${doorW} mm × 2 uşi` },
      { label: 'Lungime şină',    value: `${rail} mm` },
    ],
  };
}

// ── 5. Necesar materiale (atelier) ─────────────────────────────────────────
export function bom(state, s) {
  return [
    ...doorFrameRows(profiles, s, state, meta.family),
    ...railRows(s, state, meta.family, 2),   // B: 2 profile de mascare (ca E)
    ...wheelRows(state),
    ...screwRows(state),
    ...glassRows(s, state),
    ...aplicateRows(meta.family, s, state),

  ];
}

// ── 6. Randare 3D ──────────────────────────────────────────────────────────
export function build(group, state, s) {
  const mats = makeMaterials(finishHex(meta, state), { palColor: 0xf4f4f2 });   // PAL alb
  const W = mm(s.opening.w), H = mm(s.opening.h);
  const doorW = mm(s.door.w), doorH = mm(s.door.h);
  const railL = mm(s.rail.length);
  const pocket = mm(POCKET_MM);

  const sideW = railL / 2 - W / 2 + 0.08;   // pereţi simetrici acoperă şina
  straightWalls(group, { W, H, extraH: SCENE.wallExtraH, leftW: sideW, rightW: sideW, wallD: SCENE.wallD, mat: mats.wallMat });

  suspendedRail(group, { length: railL, centerX: 0, H, mat: mats.trackMat });

  [-1, 1].forEach(side => {
    hungDoor(group, {
      profiles, doorW, doorH, H,
      offsetX: side * (W / 4 + pocket / 2 + DOOR_GAP / 2),
      divisions: state.divisions[side === -1 ? 0 : 1], panelMaterials: state.panels[side === -1 ? 0 : 1],
      ...usa3D(s, state, side === -1 ? 0 : 1, GROSIME_PAL_SUSPENDATE_MM), mats,
    });
  });
}

// ── 7. Facturare (NeoManager) — B bi-partit: qty:'usi' = 2, mascare = 2 ───
export const billing = {
  mode: 'complet',
  linii: [
    { tip: 'usa',          dim: 'doorWmm',   qty: 'usi' },
    { tip: 'sina',         dim: 'sinaLenMm', qty: 1 },
    { tip: 'mascare_sina', dim: 'sinaLenMm', qty: 2 },
    { tip: 'divizare',     dim: 'innerWmm',  qty: 'divizariBuc' },

    { cod: '381', denumire: 'Rotile pentru 1 usa cu rama din aluminiu, opritor si ghidaj cu rulment inclus cod 381',       qty: 'roleSimple',    factor: 0.5, um: 'set' },
    { cod: '380', denumire: 'Rotile la set cu amortizare pentru 1 usa cu rama din aluminiu, opritor si ghidaj cu rulment inclus cod 380', qty: 'roleAmortizor', factor: 0.5, um: 'set' },
    { cod: '274', denumire: 'Perie laterala 11x5mm cod 274',    qty: 'perieMl', um: 'm' },

    // Divizări aplicate (opţiuni avansate) — bare de 3m, nr. calculat din
    // segmente (vezi segmenteAplicate / bareNecesare în lib/suspendata/aplicate.js).
    { tip: 'divizare aplicata 10', dim: 'innerWmm', qty: 'bareAplicate10' },
    { tip: 'divizare aplicata 20', dim: 'innerWmm', qty: 'bareAplicate20' },

    // Geam/oglindă + garnitură + folie (la oglinzi) se adaugă automat — vezi js/lib/suspendata/geam.js.
    // Şurubul de asamblare NU se facturează separat — e inclus în codul uşii
    // (rămâne doar în necesar, vezi bom() → screwRows).
    // Linie fixă — completează cu codul real:
    // { cod: '', denumire: 'Set montaj B', qty: 1 },
  ],
};
