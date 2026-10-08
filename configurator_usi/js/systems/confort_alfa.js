// ═══════════════════════════════════════════════════════════════════════════
//  CONFORT ALFA — culisantă suspendată, 1-7 uşi, şină simplă/dublă
//  Formula de gabarit e comună la toate modelele Confort — vezi js/lib/confort/confort.js.
//  Diferă doar Lprofil (lăţimea montantului): Alfa = 26mm.
// ═══════════════════════════════════════════════════════════════════════════

import { mm } from '../lib/comun/geo.js';
import { makeMaterials } from '../lib/confort/materials.js';
import { glassRows } from '../lib/confort/bom.js';
import { billQuantities } from '../lib/confort/billing.js';
import { FINISAJE_CONFORT, finishHex } from '../lib/confort/finish.js';
import { hungDoor } from '../lib/confort/scena.js';
import { clamp } from '../lib/confort/num.js';
import { doorHeightConfort, doorWidthConfort, railLengthConfort, layoutConfort2Track, floorRailConfort, topRailConfort, floorGapConfort, confortFrameRows, confortRailRows, glazingConfort, confortWheelRows, confortScrewRows,
  confortOpritoriRows, confortPerieSpateRows, confortAmortizareRows, confortClemeRows, suprapuneriEfective, areCodH, confortBillDivizari, confortBillAplicate, confortAplicateRows, confortDoor3D, TRAVERSA_SUS_VIZIBIL_MM,
  confortBillSinaSimpla, liniiSinaSimpla } from '../lib/confort/confort.js';

// ── 1. Identitate + limite gol (mm) ─────────────────────────────────────────
export const meta = {
  id:          'confortAlfa',
  label:       'Confort Alfa',
  family:      'confort',           // gamă comună — vezi meta.catalog pt. catalogul propriu
  catalog:     'confortAlfa',        // catalog propriu — vezi js/catalog/confortAlfa.seed.sql
  doorsRange: [1, 7],           // nr. de uşi ales de utilizator (stepper UI), nu fix
  pal:         true,             // panourile pot fi PAL (18mm)
  sketch:      'assets/alfa.jpeg',
  limits:      { width: [800, 5800], height: [800, 3400] },   // date de user, 2026-09-17
  limitsFinisaj: { CUPRU: { width: [800, 3500], height: [800, 3000] } },   // CUPRU: max 3500 × 3000 (userul, 2026-10-08)
  finishes:    FINISAJE_CONFORT,
};

// ── 2. Profile din care e făcut modelul (mm) ────────────────────────────────
// Doar montant e cota reală dată de utilizator (Lprofil Alfa = 26mm) — restul
// (w) rămân placeholder, TODO. Codurile NU mai stau aici — se caută în catalog
// după tip+finisaj (vezi confortFrameRows/confortRailRows în lib/confort/confort.js).
// Sticlă/PAL — offset-uri date de user (2026-09-16), per model. Vezi
// glazingConfort() în lib/confort/confort.js pt. formulă + nota INCERT despre cum
// se combină la uşile cu PAL şi sticlă AMESTECATE (necesar cu divizări).
const GLASS_H_OFFSET = 67, GLASS_W_OFFSET = 37;   // Husa-GLASS_H, Lusa-GLASS_W
const PAL_H_OFFSET   = 64, PAL_W_OFFSET   = 34;   // Husa-PAL_H,   Lusa-PAL_W

const LPROFIL = 26;
export const profiles = {
  montant:     { w: LPROFIL, d: 35 },
  traversaSus: { w: LPROFIL, d: 35 },   // TODO: cifră reală
  traversaJos: { w: 50,      d: 35 },   // ~50mm (userul, 2026-09-18) — doar 3D
  divizare:    { w: 20,      d: 30 },   // ~20mm (userul, 2026-09-18) — doar 3D
};
// Cota de debitare a orizontalelor (sus/jos) şi a divizărilor = lăţimea uşii
// minus 49mm (userul, 2026-09-21: 49 la Verona/Atrani/Alfa, 56 la Gamma).
const DEDUCERE_ORIZONTAL = 49;

// ── 3. Cote de comandă — SURSĂ UNICĂ (mm) ───────────────────────────────────
export function spec(state) {
  const { width: W, height: H, tracks } = state;
  const doors = clamp(state.doors ?? 1, meta.doorsRange[0], meta.doorsRange[1]);

  const doorH = doorHeightConfort(H);
  const { doorW: doorWraw } = doorWidthConfort(W, profiles.montant.w, doors, tracks);
  const doorW = Math.round(doorWraw);
  const rail  = railLengthConfort(W);

  const parts = {
    opening: { w: W, h: H },
    door:    { w: doorW, h: doorH, count: doors },
    orizontalMm: doorW - DEDUCERE_ORIZONTAL,
    rail:    { length: rail },
    glass:   glazingConfort({
      doorW, doorH, divisionsPerDoor: state.divisions, panelsPerDoor: state.panels,
      inaltimiPerDoor: state.hPanouri, profilePerDoor: state.divProfil,
      hDisponibil: areCodH(meta.catalog, state.finish),
      glassHOffset: GLASS_H_OFFSET, glassWOffset: GLASS_W_OFFSET,
      palHOffset: PAL_H_OFFSET, palWOffset: PAL_W_OFFSET,
    }),
  };

  return {
    ...parts,
    bill: {
      ...billQuantities(profiles, parts, state),
      ...confortBillDivizari(parts.glass, parts.orizontalMm),
      orizontalMm: parts.orizontalMm,
      ...confortBillAplicate(parts, state),
      ...confortBillSinaSimpla(parts, state),
    },
    summary: [
      // Înălţimea înaintea lăţimii, ca peste tot (userul, 2026-09-18).
      { label: 'Înălţime gol',    value: `${H} mm` },
      { label: 'Lăţime gol',      value: `${W} mm` },
      { label: 'Înălţimea uşii',  value: `${doorH} mm` },
      { label: 'Lăţimea uşii',    value: `${doorW} mm × ${doors} uşi` },
      { label: 'Nr. suprapuneri', value: `${suprapuneriEfective(doors, tracks)}` },
    ],
  };
}

// ── 4. Necesar materiale (atelier) — coduri reale din catalogul modelului ──
export function bom(state, s) {
  return [
    ...confortRailRows(meta.catalog, s, state),
    ...confortFrameRows(meta.catalog, profiles, s, state),
    ...confortAplicateRows(meta.catalog, s, state),
    ...confortWheelRows(meta.id, state),
    ...confortScrewRows(state),
    ...confortOpritoriRows(state),
    ...confortClemeRows(state),
    ...confortPerieSpateRows(meta.id, state, s),
    ...confortAmortizareRows(state),
    ...glassRows(s, state),
  ];
}

// ── 5. Randare 3D ────────────────────────────────────────────────────────────
export function build(group, state, s) {
  const mats = makeMaterials(finishHex(meta, state));
  const W = mm(s.opening.w), H = mm(s.opening.h);
  const doorW = mm(s.door.w), doorH = mm(s.door.h);
  const railL = mm(s.rail.length);

  const tracksUsed = state.tracks === 2 ? [0, 1] : [0];
  tracksUsed.forEach(t => {
    floorRailConfort(group, { length: railL, centerX: 0, mat: mats.trackMat, track: t });
    topRailConfort(group, { length: railL, centerX: 0, H, doorH, mat: mats.trackMat, track: t,
      acoperire: mm(profiles.traversaSus.w - TRAVERSA_SUS_VIZIBIL_MM) });
  });

  layoutConfort2Track(W, doorW, s.door.count).forEach(({ offsetX, track }, i) => {
    hungDoor(group, {
      profiles, doorW, doorH, offsetX,
      track: state.tracks === 2 ? track : 0,
      floorGap: floorGapConfort,
      divisions: state.divisions[i], panelMaterials: state.panels[i],
      ...confortDoor3D(s, state, i), mats,
    });
  });
}

// ── 6. Facturare (NeoManager) — catalog familia 'confortAlfa', coduri reale
//    din "db debitare CONFORT.xlsx" (vezi confortFrameRows/confortRailRows) ─
export const billing = {
  mode: 'complet',
  linii: [
    // Din "coduri facturare confort.xlsx" (2026-09-17) — uşa CULISANTĂ
    // întreagă (nu piesele individuale) + divizarea, la fel ca familia
    // "suspendata". tip='divizare_vanzare' e DISTINCT de tip='divizare'
    // din necesar (profil brut, fără bandă) — vezi js/catalog/confortAlfa.seed.sql.
    { tip: 'usa',               dim: 'doorWmm',  qty: 'usi' },
    // Şină simplă: fără linia 'usa' (usi = 0), în schimb fiecare piesă — vezi
    // confortBillSinaSimpla / liniiSinaSimpla în lib/confort/confort.js.
    ...liniiSinaSimpla(meta.id),
    { tip: 'divizare_vanzare',  dim: 'orizontalMm', qty: 'divizariBuc' },
    // Divizare H (doar între PAL-uri) — la bară de 5800mm, rotunjit la ½ bară;
    // divizariBuc de mai sus exclude barele H (vezi confortBillDivizari).
    { tip: 'divizare H',        dim: 'orizontalMm', qty: 'barH' },
    // Divizări aplicate — bare de 3m, nr. calculat din segmente (vezi
    // segmenteAplicate / bareNecesare în lib/confort/confort.js).
    { tip: 'divizare aplicata 10', dim: 'innerWmm', qty: 'bareAplicate10' },
    { tip: 'divizare aplicata 20', dim: 'innerWmm', qty: 'bareAplicate20' },

    // Lista completă de facturare Confort (userul, 2026-09-17) — la TOATE
    // uşile, indiferent cine asamblează (spre deosebire de necesar, care
    // rămâne doar la uşile client — vezi lib/confort/confort.js). Şina, profilele
    // vertical/orizontal, roţile, şuruburile, opritorii şi clemele NU se mai
    // facturează separat — sunt deja incluse în preţul liniei 'usa' de mai
    // sus. Rolele vechi (380/381) au fost SCOASE — nu mai corespund la nimic
    // fizic de când roţile (273/270-272) sunt piesa reală.
    { cod: '274', denumire: 'Perie laterala 11x5mm cod 274',                qty: 'perieMl', um: 'm' },
    // Perie spate — doar Verona/Atrani; la Gamma/Alfa bill.perieSpateM nu
    // există, deci linia asta se omite automat (cantitate 0).
    { cod: '275', denumire: 'Perie spate antipraf 6x8mm Confort/Lux cod 275',    qty: 'perieSpateM', um: 'm' },

    { cod: '282', denumire: 'Amortizare la set 35 kg pentru gama Confort/Lux cod 282', qty: 'amortizare35', factor: 0.5, um: 'set' },
    { cod: '281', denumire: 'Amortizare la set 60kg pentru gama Confort/Lux cod 281', qty: 'amortizare60', factor: 0.5, um: 'set' },

    // Geam/oglindă + garnitura ei + folia de securizare (la oglinzi) NU stau
    // aici — se adaugă automat de billingLines() (lib/confort/billing.js), la uşile
    // NOI, exact ca la familia "suspendata".

    // Linie fixă — completează cu codul real:
    // { cod: '', denumire: 'Set montaj Confort Alfa', qty: 1 },
  ],
};
