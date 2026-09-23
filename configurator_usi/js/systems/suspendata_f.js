// ═══════════════════════════════════════════════════════════════════════════
//  SUSPENDATĂ F — 1 uşă, ușa alunecă spre STÂNGA
//  Perete STÂNGA în formă de L (acoperă şina, braţ perpendicular spre interior).
//  Perete DREAPTA perpendicular pe gol, opreşte şina la nivel.
//  DW = gol + 50 mm (overlap doar pe stânga)  |  Şină = DW × 2 − 50 mm
// ═══════════════════════════════════════════════════════════════════════════

import { mm, box } from '../lib/comun/geo.js';
import { makeMaterials } from '../lib/suspendata/materials.js';
import { transom } from '../lib/suspendata/walls.js';
import { glazing } from '../lib/suspendata/glazing.js';
import { doorFrameRows, railRows, wheelRows, screwRows, glassRows } from '../lib/suspendata/bom.js';
import { billQuantities } from '../lib/suspendata/billing.js';
import { billAplicate, aplicateRows, usa3D } from '../lib/suspendata/aplicate.js';
import { FINISAJE_STANDARD, finishHex } from '../lib/suspendata/finish.js';
import { GROSIME_PAL_SUSPENDATE_MM, SCENE, suspendedRail, hungDoor } from '../lib/suspendata/suspended.js';

// ── 1. Identitate + limite gol (mm) ─────────────────────────────────────────
export const meta = {
  id:       'suspendataF',
  label:    'Suspendată F',
  family:   'suspendata',
  pal:      true,   // panouri de sticlă sau PAL 10mm (userul, 2026-09-21)
  doors:   1,
  sketch:   'assets/schita_f.png',
  limits:   { width: [700, 1900], height: [1900, 2700] },   // acoperit de catalog (uşă ≤2000)
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

// ── 3. Şina (mm) ───────────────────────────────────────────────────────────
const OVERHANG_LEFT_MM = 50;
const railLength = DW => DW * 2 - 50;

// ── 4. Cote de comandă — SURSĂ UNICĂ (mm) ──────────────────────────────────
export function spec(state) {
  const { width: W, height: H } = state;
  const doorW = W + OVERHANG_LEFT_MM;
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

// ── 6. Randare 3D — pereţi în L, logică proprie ─────────────────────────────
const L_ARM_D = 0.80;   // adâncimea braţului perpendicular (m)

export function build(group, state, s) {
  const mats = makeMaterials(finishHex(meta, state), { palColor: 0xf4f4f2 });   // PAL alb
  const { wallD, wallExtraH } = SCENE;
  const W = mm(s.opening.w), H = mm(s.opening.h);
  const doorW = mm(s.door.w), doorH = mm(s.door.h);
  const railL = mm(s.rail.length);

  const railRightEnd = W / 2;                 // opreşte fix în peretele dreapta
  const railLeftEnd  = railRightEnd - railL;
  const leftW = Math.abs(railLeftEnd) - W / 2 + 0.08;
  const wallH = H + wallExtraH;

  // perete stânga: faţă + braţ perpendicular spre interiorul camerei (L)
  const lFront = box(leftW, wallH, wallD, mats.wallMat, { receive: true });
  lFront.position.set(-(W / 2 + leftW / 2), wallH / 2, -wallD / 2);
  const lArm = box(wallD, wallH, L_ARM_D, mats.wallMat, { receive: true });
  lArm.position.set(-(W / 2 + leftW - wallD / 2), wallH / 2, L_ARM_D / 2);
  group.add(lFront, lArm);

  // transom deasupra golului
  transom(group, { W, H, extraH: wallExtraH, wallD, mat: mats.wallMat });

  // perete dreapta: bloc perpendicular pe gol (acoperă axa Z de la −wallD la L_ARM_D)
  const rDepth = wallD + L_ARM_D;
  const rWall  = box(wallD, wallH, rDepth, mats.wallMat, { receive: true });
  rWall.position.set(W / 2 + wallD / 2, wallH / 2, (L_ARM_D - wallD) / 2);
  group.add(rWall);

  // şină asimetrică — extinsă spre stânga
  suspendedRail(group, { length: railL, centerX: (railRightEnd + railLeftEnd) / 2, H, mat: mats.trackMat });

  // 1 uşă în poziţie închisă: marginea dreaptă fixată la W/2
  hungDoor(group, {
    profiles, doorW, doorH, H,
    offsetX: W / 2 - doorW / 2,
    divisions: state.divisions[0], panelMaterials: state.panels[0],
      ...usa3D(s, state, 0, GROSIME_PAL_SUSPENDATE_MM), mats,
  });
}

// ── 7. Facturare (NeoManager) — vezi suspendata_a.js pentru cheile bill ───
export const billing = {
  mode: 'complet',
  linii: [
    { tip: 'usa',          dim: 'doorWmm',   qty: 'usi' },
    { tip: 'sina',         dim: 'sinaLenMm', qty: 1 },
    { tip: 'mascare_sina', dim: 'sinaLenMm', qty: 1 },
    { tip: 'divizare',     dim: 'innerWmm',  qty: 'divizariBuc' },

    // role: vin la set de 2 buc → se facturează în 'set', 0.5/rolă (factor)
    { cod: '381', denumire: 'Rolă simplă',       qty: 'roleSimple',    factor: 0.5, um: 'set' },
    { cod: '380', denumire: 'Rolă cu amortizor', qty: 'roleAmortizor', factor: 0.5, um: 'set' },
    { cod: '274', denumire: 'Perie laterală',    qty: 'perieMl', um: 'm' },

    // Divizări aplicate (opţiuni avansate) — bare de 3m, nr. calculat din
    // segmente (vezi segmenteAplicate / bareNecesare în lib/suspendata/aplicate.js).
    { tip: 'divizare aplicata 10', dim: 'innerWmm', qty: 'bareAplicate10' },
    { tip: 'divizare aplicata 20', dim: 'innerWmm', qty: 'bareAplicate20' },

    // Geam/oglindă + garnitură + folie (la oglinzi) se adaugă automat — vezi js/lib/suspendata/geam.js.
    // Şurubul de asamblare NU se facturează separat — e inclus în codul uşii
    // (rămâne doar în necesar, vezi bom() → screwRows).
    // Linie fixă — completează cu codul real:
    // { cod: '', denumire: 'Set montaj F', qty: 1 },
  ],
};
