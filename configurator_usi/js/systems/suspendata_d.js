// ═══════════════════════════════════════════════════════════════════════════
//  SUSPENDATĂ D — 1 uşă, şină simplă, ușa alunecă spre STÂNGA
//  Uşa depăşeşte golul cu 50 mm STÂNGA + 19 mm DREAPTA  →  DW = gol + 69 mm
//  (cu 31 mm mai lată ca la A; plusul merge tot spre stânga)
// ═══════════════════════════════════════════════════════════════════════════

import { mm } from '../lib/comun/geo.js';
import { makeMaterials } from '../lib/suspendata/materials.js';
import { straightWalls } from '../lib/suspendata/walls.js';
import { glazing } from '../lib/suspendata/glazing.js';
import { doorFrameRows, railRows, wheelRows, screwRows, glassRows } from '../lib/suspendata/bom.js';
import { billQuantities } from '../lib/suspendata/billing.js';
import { billAplicate, aplicateRows, usa3D } from '../lib/suspendata/aplicate.js';
import { FINISAJE_STANDARD, finishHex } from '../lib/suspendata/finish.js';
import { GROSIME_PAL_SUSPENDATE_MM, SCENE, suspendedRail, hungDoor } from '../lib/suspendata/suspended.js';
import { mirrorBuild } from '../lib/suspendata/mirror.js';

// ── 1. Identitate + limite gol (mm) ─────────────────────────────────────────
export const meta = {
  id:       'suspendataD',
  label:    'Suspendată D',
  family:   'suspendata',
  pal:      true,   // panouri de sticlă sau PAL 10mm (userul, 2026-09-21)
  doors:   1,
  sketch:   'assets/schita_d.png',
  // lăţimea minimă = cel mai mic gol cu uşa ≥ 601 mm (userul, 2026-10-15: „nu are voie mai îngustă de 600”; 601 = cel mai
  // mic cod, USA001) şi cu cod de şină (de la 1201 mm; la Cupru de la orice lungime) — verificat în test/referinta.mjs
  // maximul: şina ≤ 5800 mm, cât e bara (userul, 2026-10-15); uşă peste 2000 mm → fără cod, eroarea se vede
  limits:   { width: [557, 2856], height: [1900, 3400] },
  // Cupru: şina Cupru e bară de 3,5 m → golul maxim la şină ≤ 3500 (uşa peste 1500 n-are cod Cupru → eroare).
  limitsFinisaj: { CUPRU: { width: [532, 1706] } },
  finishes: FINISAJE_STANDARD,
};

// ── 2. Profile din care e făcut modelul (mm) ────────────────────────────────
export const profiles = {
  montant:     { w: 19,  d: 35 },
  traversaSus: { w: 24,  d: 35 },
  traversaJos: { w: 36,  d: 35 },
  divizare:    { w: 28,  d: 30 },
  sina:        { w: 70,  h: 50 },
};

// ── 3. Şina (mm) + geometria depăşirilor ───────────────────────────────────
const OVERHANG_LEFT_MM  = 50;   // depăşire uşă peste gol spre stânga
const OVERHANG_RIGHT_MM = 19;   // depăşire uşă peste gol spre dreapta
const railLength = DW => DW * 2 - 50;

// ── 4. Cote de comandă — SURSĂ UNICĂ (mm) ──────────────────────────────────
export function spec(state) {
  const { width: W, height: H } = state;
  const doorW = W + OVERHANG_LEFT_MM + OVERHANG_RIGHT_MM;   // = gol + 69
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
      { label: 'Înălţimea uşii', value: `${doorH} mm` },
      { label: 'Lăţimea uşii',   value: `${doorW} mm` },
      { label: 'Lungime şină',   value: `${rail} mm` },
    ],
  };
}

// ── 5. Necesar materiale (atelier) ─────────────────────────────────────────
export function bom(state, s) {
  return [
    ...doorFrameRows(profiles, s, state, meta.family),
    ...railRows(s, state, meta.family, 1),
    ...wheelRows(state),
    ...screwRows(state),
    ...glassRows(s, state),
    ...aplicateRows(meta.family, s, state),

  ];
}

// ── 6. Randare 3D — oglindită pe X (buzunarul + sensul de culisare pe dreapta) ──
function buildRaw(group, state, s) {
  const mats = makeMaterials(finishHex(meta, state), { palColor: 0xf4f4f2 });   // PAL alb
  const W = mm(s.opening.w), H = mm(s.opening.h);
  const doorW = mm(s.door.w), doorH = mm(s.door.h);
  const railL = mm(s.rail.length);

  const railRightEnd = W / 2 + mm(OVERHANG_RIGHT_MM);
  const railLeftEnd  = railRightEnd - railL;

  const leftW = Math.abs(railLeftEnd) - W / 2 + 0.08;
  straightWalls(group, { W, H, extraH: SCENE.wallExtraH, leftW, rightW: 0.50, wallD: SCENE.wallD, mat: mats.wallMat });

  suspendedRail(group, { length: railL, centerX: (railRightEnd + railLeftEnd) / 2, H, mat: mats.trackMat });

  // uşa nu e centrată pe gol: marginea dreaptă la W/2 + 19 mm, restul cade în stânga
  const offsetX = railRightEnd - doorW / 2;
  hungDoor(group, { profiles, doorW, doorH, H, offsetX, divisions: state.divisions[0], panelMaterials: state.panels[0],
      ...usa3D(s, state, 0, GROSIME_PAL_SUSPENDATE_MM), mats });
}

export const build = mirrorBuild(buildRaw);

// ── 7. Facturare (NeoManager) — vezi suspendata_a.js pentru cheile bill ───
export const billing = {
  mode: 'complet',
  linii: [
    { tip: 'usa',          dim: 'doorWmm',   qty: 'usi' },
    { tip: 'sina',         dim: 'sinaLenMm', qty: 1 },
    { tip: 'mascare_sina', dim: 'sinaLenMm', qty: 1 },
    { tip: 'divizare',     dim: 'innerWmm',  qty: 'divizariBuc' },

    // role: vin la set de 2 buc → se facturează în 'set', 0.5/rolă (factor)
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
    // { cod: '', denumire: 'Set montaj D', qty: 1 },
  ],
};
