// ═══════════════════════════════════════════════════════════════════════════
//  SUSPENDATĂ A — 1 uşă, şină simplă, buzunar 19 mm pe ambele părţi
//  Uşa depăşeşte golul cu 19 mm pe fiecare parte  →  DW = gol + 38 mm
//  Ușa alunecă spre STÂNGA; şina se extinde predominant spre stânga.
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
  id:       'suspendataA',
  label:    'Suspendată A',
  family:   'suspendata',
  pal:      true,   // panouri de sticlă sau PAL 10mm (userul, 2026-09-21)
  doors:   1,
  sketch:   'assets/schita_a.png',
  // lăţimea minimă = cel mai mic gol cu uşa ≥ 601 mm (userul, 2026-10-15: „nu are voie mai îngustă de 600”; 601 = cel mai
  // mic cod, USA001) şi cu cod de şină (de la 1201 mm; la Cupru de la orice lungime) — verificat în test/referinta.mjs
  // maximul: şina ≤ 5800 mm, cât e bara (userul, 2026-10-15); uşă peste 2000 mm → fără cod, eroarea se vede
  limits:   { width: [578, 2877], height: [1900, 2700] },
  // Cupru: şina Cupru e bară de 3,5 m → golul maxim la şină ≤ 3500 (uşa peste 1500 n-are cod Cupru → eroare).
  limitsFinisaj: { CUPRU: { width: [563, 1727] } },
  finishes: FINISAJE_STANDARD,                              // culori disponibile (id → cod)
};

// ── 2. Profile din care e făcut modelul (mm) ────────────────────────────────
export const profiles = {
  montant:     { w: 19,  d: 35 },   // montant vertical
  traversaSus: { w: 24,  d: 35 },   // traversă superioară
  traversaJos: { w: 36,  d: 35 },   // traversă inferioară
  divizare:    { w: 28,  d: 30 },   // bară divizare orizontală
  sina:        { w: 70,  h: 50 },   // şină superioară (secţiune)
};

// ── 3. Şina (mm) ───────────────────────────────────────────────────────────
//  Sină = DW × 2 − 30 mm, extinsă predominant spre stânga.
const railLength = DW => DW * 2 - 30;
const POCKET_MM  = 19;   // depăşire uşă peste gol, pe fiecare parte

// ── 4. Cote de comandă — SURSĂ UNICĂ (mm) ──────────────────────────────────
export function spec(state) {
  const { width: W, height: H } = state;
  const doorW = W + 2 * POCKET_MM;   // = gol + 38
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
    bill: { ...billQuantities(profiles, parts, state), ...billAplicate(parts, state) },   // cantități facturabile numite
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
    ...railRows(s, state, meta.family, 1),   // A: 1 profil de mascare
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

  // capătul drept al şinei = marginea uşii în poziţie închisă; restul spre stânga
  const railRightEnd = W / 2 + mm(POCKET_MM);
  const railLeftEnd  = railRightEnd - railL;

  const leftW = Math.abs(railLeftEnd) - W / 2 + 0.08;   // peretele stâng acoperă şina
  straightWalls(group, { W, H, extraH: SCENE.wallExtraH, leftW, rightW: 0.50, wallD: SCENE.wallD, mat: mats.wallMat });

  suspendedRail(group, { length: railL, centerX: (railRightEnd + railLeftEnd) / 2, H, mat: mats.trackMat });

  hungDoor(group, { profiles, doorW, doorH, H, offsetX: 0, divisions: state.divisions[0], panelMaterials: state.panels[0],
      ...usa3D(s, state, 0, GROSIME_PAL_SUSPENDATE_MM), mats });
}

export const build = mirrorBuild(buildRaw);

// ── 7. Facturare (NeoManager) ─────────────────────────────────────────────
// { tip, dim, qty } → codul se caută în catalog după tip + finisaj +
//   banda [lmin,lmax] testată pe cota `dim`.   { cod, ... } → linie fixă.
// Chei bill: usi, doorWmm, innerWmm, openingWmm, openingHmm, sinaLenMm, divizariBuc,
//            sticlaMp, sticlaBuc, garnituraMl, perieMl, ariaGolMp, ariaUsiiMp,
//            roleSimple, roleAmortizor (din selecţia stânga/dreapta per uşă — UI „ROLE").
export const billing = {
  mode: 'complet',
  linii: [
    { tip: 'usa',          dim: 'doorWmm',   qty: 'usi' },
    { tip: 'sina',         dim: 'sinaLenMm', qty: 1 },
    { tip: 'mascare_sina', dim: 'sinaLenMm', qty: 1 },            // A: 1 profil de mascare
    { tip: 'divizare',     dim: 'innerWmm',  qty: 'divizariBuc' },

    // Role (feronerie) — tip + cantitate alese în UI, per parte (stânga/dreapta):
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
    // { cod: '', denumire: 'Set montaj A', qty: 1 },
  ],
};
