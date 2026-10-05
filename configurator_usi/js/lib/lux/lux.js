// ═══════════════════════════════════════════════════════════════════════════
//  LUX — helper comun pentru modelele Vent şi Breda (userul, 2026-10-05).
//  Sursa: „Calculator profile LUX 2025.xlsx" (câte o foaie pe model + culoare);
//  codurile şi denumirile — verificate în „baza de date completa.xlsx" (NeoManager).
//
//  Formulele din Excel (Hgol/Lgol = golul, Nusi, Nsup = suprapuneri):
//    Husa = Hgol − 40 (userul, 2026-10-05; Excel zice −38)   Lusa = (Lgol + 8 × Nsup − 2) / Nusi
//    PAL:     H = Husa − 2,  L = Lusa − 3     sticlă: H = Husa − 4, L = Lusa − 5
//    fiecare profil de divizare „T" scade 2 mm din înălţime (nota din Excel)
//    şina sus + jos = Lgol (dublă, 1 buc fiecare)
//    mâner vertical = Husa (2 / uşă), orizontal „L" sus + jos = Lusa − 13 (Vent) / − 11 (Breda)
//    rama (uşile cu sticlă): vertical = Husa − 2, orizontal / intermediar = Lsticlă − 66
//    rotile: inferioare K100 2 / uşă, superioare Vent K8 / Breda K9 2 / uşă; opritor 1 / uşă
//    perie laterală 5×5 = 2 × Husa × Nusi
//  Facturarea (ca la Confort): uşa culisantă ÎNTREAGĂ pe lăţimea uşii (Vent V301 /
//  Breda B302 — preţul include şinele, profilele, roţile, opritorii), plus ce se
//  alege în plus: rama pt. sticlă (R300), divizările T şi aplicate (bare de 3 m),
//  peria spate, amortizările, sticla + garnitura Lux.
//  Totul stă aici, în familia „lux" — nu importă din alte familii.
// ═══════════════════════════════════════════════════════════════════════════

import { box } from '../comun/geo.js';
import { SCENE, trackZ } from './scena.js';
import { line, clientDoors } from './bom.js';
import { ceilHalf } from './num.js';
import { findGeam, glassPerDoor } from './geam.js';
import { billQuantities } from './billing.js';
import { makeMaterials } from './materials.js';
import { finishHex } from './finish.js';
import { hungDoor } from './scena.js';
import { mm } from '../comun/geo.js';
import catalog from '../../catalog/catalog.generated.json';

// ── Cote ─────────────────────────────────────────────────────────────────────
// −40, nu −38 ca în Excel (userul, 2026-10-05)
export const doorHeightLux = H => H - 40;

// Suprapunerile — LUX are doar şină dublă; în Excel Nsup se trece de mână, iar
// exemplele (1→0, 2→1, 3→2, 4→2) bat cu tabelul Confort, aşa că îl folosim (fix pe nr. de uşi).
export const SUPRAPUNERI_LUX = { 1: 0, 2: 1, 3: 2, 4: 2, 5: 4, 6: 4, 7: 5 };
export const USI_LUX = [1, 7];
export const suprapuneriLux = n => SUPRAPUNERI_LUX[n] ?? 0;

export const doorWidthLux = (W, n) => (W + 8 * suprapuneriLux(n) - 2) / n;
export const railLengthLux = W => W;

// Aşezarea pe cele 2 piste — ca la Confort: prima uşă pe pista dinspre interior,
// apoi alternant; suprapunerea totală se împarte egal pe îmbinări.
export function layoutLux(W, doorW, n) {
  const overlap = n > 1 ? Math.max(0, n * doorW - W) / (n - 1) : 0;
  const out = [];
  let st = -W / 2;
  for (let i = 0; i < n; i++) {
    out.push({ offsetX: st + doorW / 2, track: i % 2 === 0 ? 1 : 0 });
    st += doorW - overlap;
  }
  return out;
}

// Şinele în 3D — uşa stă pe şina de jos (~1 mm), cea de sus umple până la gol.
const FLOOR_RAIL_H = 0.001, FLOOR_RAIL_D = 0.03, TOP_RAIL_D = 0.05;
export const floorGapLux = FLOOR_RAIL_H;
export function floorRailLux(group, { length, mat, track }) {
  const r = box(length, FLOOR_RAIL_H, FLOOR_RAIL_D, mat);
  r.position.set(0, FLOOR_RAIL_H / 2, SCENE.wallGap + FLOOR_RAIL_D / 2 + trackZ(track));
  group.add(r);
}
export function topRailLux(group, { length, H, doorH, mat, track }) {
  const h = H - FLOOR_RAIL_H - doorH;
  if (h <= 0) return;
  const r = box(length, h, TOP_RAIL_D, mat);
  r.position.set(0, H - h / 2, SCENE.wallGap + TOP_RAIL_D / 2 + trackZ(track));
  group.add(r);
}

// ── Panouri (PAL / sticlă) ───────────────────────────────────────────────────
// Bara dintre două panouri (userul, 2026-10-05): divizarea „T" între PAL–PAL sau
// PAL–sticlă; între sticlă şi sticlă — profilul intermediar al ramei (171), nu T.
export const tipBara = (jos, sus) => (jos === 'sticla' && sus === 'sticla' ? 'R' : 'T');
// Un panou nedivizat: PAL Husa − 2, sticlă Husa − 4 (Excel). Cu divizări: fiecare
// profil T mai scade 2 mm (nota din Excel), iar marginile de sus/jos ale stivei iau
// jumătate din deducerea materialului panoului de acolo — ca la Confort, aşa că la
// un singur material rezultatul e exact formula din Excel. Panourile automate
// împart egal ce rămâne după cele fixate (opţiuni avansate).
const DEDUCERE_H = { pal: 2, sticla: 4 };   // Husa − …, panou nedivizat
const DEDUCERE_L = { pal: 3, sticla: 5 };   // Lusa − …
export const DEDUCERE_T = 2;
// ⚠ intermediarul ramei (sticlă–sticlă): cât scade din înălţime nu e în Excel — presupus
// tot 2 mm, ca T; de confirmat cu userul
export const DEDUCERE_INTERMEDIAR = 2;

function panouriUsa(doorH, mats, fixe) {
  const n = mats.length;
  let stiva = doorH - DEDUCERE_H[mats[0]] / 2 - DEDUCERE_H[mats[n - 1]] / 2;
  for (let k = 0; k < n - 1; k++) stiva -= tipBara(mats[k], mats[k + 1]) === 'R' ? DEDUCERE_INTERMEDIAR : DEDUCERE_T;
  const eFix = k => Number.isFinite(fixe?.[k]) && fixe[k] > 0;
  const sumaFixe = mats.reduce((s, _, k) => s + (eFix(k) ? fixe[k] : 0), 0);
  const libere = mats.filter((_, k) => !eFix(k)).length;
  const hLiber = libere ? (stiva - sumaFixe) / libere : 0;
  let eroare = null;
  if (libere && !(hLiber > 0)) eroare = `panourile introduse depăşesc uşa — mai rămân ${Math.round(stiva - sumaFixe)} mm pt. ${libere} panou(ri)`;
  else if (!libere && Math.abs(stiva - sumaFixe) >= 0.5) eroare = `suma panourilor e ${Math.round(sumaFixe)} mm, trebuie ${Math.round(stiva)} mm (diferenţă ${Math.round(sumaFixe) - Math.round(stiva)} mm)`;
  return { heights: mats.map((_, k) => Math.max(0, eFix(k) ? fixe[k] : hLiber)), stiva, eroare };
}

export function glazingLux({ doorW, doorH, divisionsPerDoor, panelsPerDoor, inaltimiPerDoor }) {
  const glassW = doorW - DEDUCERE_L.sticla;
  const palW   = doorW - DEDUCERE_L.pal;
  const panels = divisionsPerDoor.map((divisions, i) => {
    const panes = divisions + 1;
    const mats = (panelsPerDoor?.[i] ?? []).slice(0, panes);
    while (mats.length < panes) mats.push('sticla');
    const { heights, stiva, eroare } = panouriUsa(doorH, mats, inaltimiPerDoor?.[i]);
    const palPanes = mats.filter(m => m === 'pal').length;
    const profil = Array.from({ length: divisions }, (_, k) => tipBara(mats[k], mats[k + 1]));
    return { divisions, panes, palPanes, glassPanes: panes - palPanes, mats, heights, stiva, profil, eroare };
  });
  const sticle = p => p.heights.filter((_, k) => p.mats[k] !== 'pal');
  return {
    glassW, palW, panels,
    glassCount:  panels.reduce((s, p) => s + p.glassPanes, 0),
    glassAreaM2: panels.reduce((s, p) => s + sticle(p).reduce((a, h) => a + (glassW / 1000) * (h / 1000), 0), 0),
    gasketM:     ceilHalf(panels.reduce((s, p) => s + sticle(p).reduce((a, h) => a + 2 * (glassW + h) / 1000, 0), 0)),
    // perie laterală 5×5: 2 × Husa pe fiecare uşă (Excel)
    brushM:      ceilHalf(divisionsPerDoor.length * 2 * doorH / 1000),
  };
}

// Uşile care au cel puţin un panou de sticlă — au nevoie de ramă (R300 / profilele 170-171).
export const usiCuSticla = glass => (glass?.panels ?? []).filter(p => p.glassPanes > 0);
const nrBare = (glass, tip) => (glass?.panels ?? []).reduce((s, p) => s + p.profil.filter(x => x === tip).length, 0);

// Mânerul aplicat — opţional pe uşă: stânga, dreapta sau ambele (userul, 2026-10-05).
export const MANER_APLICAT = { fara: 0, stanga: 1, dreapta: 1, ambele: 2 };
export const manereAplicate = state => (state.manerAplicat ?? []).reduce((s, m) => s + (MANER_APLICAT[m] ?? 0), 0);

// ── Divizări aplicate — aceleaşi reguli ca la Confort (bare de 3 m, FFD) ─────
export const BARA_3M = 3000;
export const BARA_SINA_CUPRU_MM = 3500;
export function segmenteAplicate(spec, state) {
  const { panels = [], glassW = 0, palW = glassW } = spec.glass ?? {};
  const out = [];
  panels.forEach((p, i) => {
    const da = state.divAplicate?.[i];
    if (!da || da.latime === 'fara') return;
    const fete = da.parte === 'ambele' ? 2 : 1;
    const V = da.verticale ?? 0, O = da.orizontale ?? 0;
    (p.heights ?? []).forEach((h, k) => {
      const w = p.mats?.[k] === 'pal' ? palW : glassW;
      for (let f = 0; f < fete; f++) {
        for (let v = 0; v < V; v++) out.push({ latime: da.latime, lungime: Math.round(h) });
        for (let o = 0; o < O * (V + 1); o++) out.push({ latime: da.latime, lungime: Math.round(w / (V + 1)) });
      }
    });
  });
  return out.filter(s => s.lungime > 0);
}

// Nr. de bare de 3 m pt. o listă de bucăţi (First Fit Decreasing); cele mai
// lungi de 3 m se numără ca bare întregi, separat.
export function bare3m(lungimi) {
  const bare = [], preaLungi = [];
  for (const L of [...lungimi].sort((a, b) => b - a)) {
    if (L > BARA_3M) { preaLungi.push(L); continue; }
    const loc = bare.findIndex(rest => rest >= L);
    if (loc >= 0) bare[loc] -= L; else bare.push(BARA_3M - L);
  }
  return { nr: bare.length + preaLungi.reduce((n, L) => n + Math.ceil(L / BARA_3M), 0), preaLungi };
}

// ── Cantităţile de facturare proprii gamei (spec.bill) ───────────────────────
export function luxBill(spec, state) {
  const nrT = nrBare(spec.glass, 'T');   // doar barele T (cele sticlă–sticlă sunt ale ramei)
  const seg = segmenteAplicate(spec, state);
  return {
    manereAplicate: manereAplicate(state),
    // divizarea T: bucăţi de spec.orizontalMm pe bare de 3 m
    bareT:          bare3m(Array(nrT).fill(spec.orizontalMm)).nr,
    bareAplicate10: bare3m(seg.filter(s => s.latime === '10').map(s => s.lungime)).nr,
    bareAplicate20: bare3m(seg.filter(s => s.latime === '20').map(s => s.lungime)).nr,
    usiCuSticla:    usiCuSticla(spec.glass).length,
    // perie spate antipraf: suprapuneri × Husa (ca la Confort Verona / Atrani)
    perieSpateM:    ceilHalf(suprapuneriLux(spec.door.count) * spec.door.h / 1000),
    // CUPRU (doar Vent): uşa vine FĂRĂ şine — 290 / 291 se facturează separat, la bară
    // de 3,5 m (NeoManager), întreagă sau jumătate (ca la Confort cupru)
    sinaCupru:      state.finish === 'CUPRU' ? ceilHalf(spec.rail.length / BARA_SINA_CUPRU_MM) : 0,
  };
}

// ── Necesar (atelier / ambalare) ─────────────────────────────────────────────
const DENUMIRE_LIPSA = { 'sina superioara': 'Şină superioară', 'sina inferioara': 'Şină inferioară', vertical: 'Profil mâner',
  orizontal: 'Orizontal „L"', divizare: 'Divizare „T"', 'divizare aplicata 10': 'Divizare aplicată 10 mm', 'divizare aplicata 20': 'Divizare aplicată 20 mm' };
function luxLine(cat, tip, finisaj, qty, cut, unit = 'buc') {
  const art = (catalog[cat] ?? []).find(a => a.tip === tip && a.finisaj === finisaj);
  if (art) return line(art.cod, art.denumire, qty, unit, cut);
  return line('⚠ LIPSĂ COD', `${DENUMIRE_LIPSA[tip]} — fără cod pentru finisajul ${finisaj}`, qty, unit, cut);
}

// Profilele — mereu (lista de debitare), ca la Confort.
export function luxProfileRows(cat, spec, state) {
  const n = spec.door.count, f = state.finish;
  const nrT = nrBare(spec.glass, 'T');
  const rows = [
    luxLine(cat, 'sina superioara', f, 1, `${spec.rail.length} mm`),
    luxLine(cat, 'sina inferioara', f, 1, `${spec.rail.length} mm`),
    luxLine(cat, 'vertical', f, 2 * n, `${spec.door.h} mm`),
    luxLine(cat, 'orizontal', f, 2 * n, `${spec.orizontalMm} mm`),
  ];
  if (nrT) rows.push(luxLine(cat, 'divizare', f, nrT, `${spec.orizontalMm} mm`));
  return rows;
}

export function luxAplicateRows(cat, spec, state) {
  const seg = segmenteAplicate(spec, state);
  const rows = [];
  for (const latime of ['10', '20']) {
    const { nr, preaLungi } = bare3m(seg.filter(s => s.latime === latime).map(s => s.lungime));
    if (nr) rows.push(luxLine(cat, `divizare aplicata ${latime}`, state.finish, nr, undefined, 'bară'));
    [...new Set(preaLungi)].forEach(L => rows.push(line('⚠', `Divizare aplicată ${latime}mm: o bucată de ${L} mm e mai lungă decât bara de 3000 mm`, '', '')));
  }
  return rows;
}

// Rama uşilor cu sticlă (Excel: vertical Husa − 2, orizontal + intermediar Lsticlă − 66)
// — profile de aluminiu 170 / 171, indiferent de culoare. Orizontalele: sus + jos +
// intermediarul dintre două sticle (userul, 2026-10-05).
export function luxRamaRows(spec) {
  const usi = usiCuSticla(spec.glass);
  if (!usi.length) return [];
  const oriz = usi.reduce((s, p) => s + 2 + p.profil.filter(x => x === 'R').length, 0);
  return [
    line('170', 'Profil vertical pentru rama la modelul Lux finisaj aluminiu 5,5 m cod 170', 2 * usi.length, 'buc', `${spec.door.h - 2} mm`),
    line('171', 'Profil orizontal pentru rama la modelul Lux finisaj aluminiu 5,8 m cod 171', oriz, 'buc', `${Math.round(spec.glass.glassW - 66)} mm`),
  ];
}

// Feroneria — doar la uşile asamblate de CLIENT (necesar de ambalare, ca la Confort).
const ROTILE_SUP = {
  vent:  { cod: '160', denumire: 'Rotila superioara Vent K8 cod 160' },
  breda: { cod: '161', denumire: 'Rotila superioara Breda K9 cod 161' },
};
export function luxFeronerieRows(model, cat, spec, state) {
  const n = clientDoors(state);
  if (!n) return [];
  const rows = [
    line('162', 'Rotila inferioara aplicata  K100 cod 162', 2 * n, 'buc'),
    line(ROTILE_SUP[model].cod, ROTILE_SUP[model].denumire, 2 * n, 'buc'),
    line('280', 'Opritor din aluminiu cod 280', n, 'buc'),
    // perie laterală 5×5: 2 × Husa pe uşă (Excel), la orice panou
    line('164', 'Perie laterala 5x5 mm cod 164', ceilHalf(n * 2 * spec.door.h / 1000), 'm'),
  ];
  // garnitura Lux — doar pe panourile de sticlă ale uşilor client
  const garnitura = glassPerDoor(spec, state).filter(g => g.client).reduce((m, g) => m + g.gasketM, 0);
  if (garnitura > 0) rows.push(line('163', 'Garnitura Lux pentru sticla 4 mm cod 163', ceilHalf(garnitura), 'm'));
  // mânerul aplicat al uşilor client
  const manere = manereAplicate({ manerAplicat: (state.manerAplicat ?? []).filter((_, i) => state.assembly?.[i] === 'client') });
  const artManer = (catalog[cat] ?? []).find(a => a.tip === 'maner aplicat' && a.finisaj === state.finish);
  if (manere && artManer) rows.push(line(artManer.cod, artManer.denumire, manere, 'buc'));
  const supr = suprapuneriLux(spec.door.count);
  if (supr) rows.push(line('275', 'Perie spate antipraf 6x8mm Confort/Lux cod 275', ceilHalf(supr * spec.door.h / 1000), 'm'));
  return rows;
}

// Amortizări — opţionale pe fiecare parte; o parte = ½ set (ca la Confort). 281 = 60 kg, 282 = 35 kg.
export const AMORTIZARE = {
  '35kg': { cod: '282', denumire: 'Amortizare la set 35 kg pentru gama Confort/Lux cod 282' },
  '60kg': { cod: '281', denumire: 'Amortizare la set 60kg pentru gama Confort/Lux cod 281' },
};
export function luxAmortizareRows(state) {
  const rows = [];
  for (const clasa of ['35kg', '60kg']) {
    const buc = (state.amortizare ?? []).reduce((s, a, i) => (state.assembly?.[i] !== 'client' ? s
      : s + (a?.left === clasa ? 1 : 0) + (a?.right === clasa ? 1 : 0)), 0);
    if (buc) rows.push(line(AMORTIZARE[clasa].cod, AMORTIZARE[clasa].denumire, buc * 0.5, 'set'));
  }
  return rows;
}

// ── 3D — panourile cu grosimea reală, la mijlocul ramei ──────────────────────
export const GROSIME_PAL_MM = 18;
export function luxDoor3D(spec, state, i) {
  const p = spec.glass?.panels?.[i];
  const client = state.assembly?.[i] === 'client';
  const grosimeGeam = client ? (state.geamClient?.[i] ?? 4) : (findGeam(state.geam?.[i])?.grosime ?? 4);
  return {
    paneHeights:   p?.heights,
    paneThickness: (p?.mats ?? []).map(m => (m === 'pal' ? GROSIME_PAL_MM : grosimeGeam)),
    aplicate:      state.divAplicate?.[i],
    barShapes:     (p?.profil ?? []).map(pr => (pr === 'R' ? { fata: 12, spate: 12 } : { fata: 5, spate: 5 })),   // T 5 mm; intermediarul ramei mai lat
  };
}

export { glassPerDoor };

// ═══ Modelele — Vent şi Breda diferă doar prin ce diferă în Excel ═══════════
//   orizontalul „L" (şi divizarea T): Lusa − 13 la Vent, Lusa − 11 la Breda
//   rotila superioară: Vent K8 (160), Breda K9 (161); profilul mâner şi uşa (V301 / B302) — din catalog
export const MODELE_LUX = { vent: { deducereOrizontal: 13 }, breda: { deducereOrizontal: 11 } };

// Profilele pt. 3D şi pt. lăţimea liberă a uşii — aproximative (secţiunile din Excel
// n-au cote): mânerul ~25 mm, orizontalele „L" 18 mm, divizarea T 5 mm.
export const PROFILE_LUX = {
  montant:     { w: 25, d: 30 },
  traversaSus: { w: 18, d: 30 },
  traversaJos: { w: 18, d: 30 },
  divizare:    { w: 5,  d: 20 },
};

export function specLux(model, state) {
  const { width: W, height: H } = state;
  const n = Math.min(USI_LUX[1], Math.max(USI_LUX[0], state.doors || 1));
  const doorH = doorHeightLux(H);
  const doorW = Math.round(doorWidthLux(W, n));
  const parts = {
    opening: { w: W, h: H },
    door:    { w: doorW, h: doorH, count: n },
    orizontalMm: doorW - MODELE_LUX[model].deducereOrizontal,
    rail:    { length: railLengthLux(W) },
    glass:   glazingLux({ doorW, doorH, divisionsPerDoor: state.divisions, panelsPerDoor: state.panels, inaltimiPerDoor: state.hPanouri }),
  };
  return {
    ...parts,
    bill: { ...billQuantities(PROFILE_LUX, parts, state), orizontalMm: parts.orizontalMm, ...luxBill(parts, state) },
    summary: [
      { label: 'Înălţime gol',    value: `${H} mm` },
      { label: 'Lăţime gol',      value: `${W} mm` },
      { label: 'Înălţimea uşii',  value: `${doorH} mm` },
      { label: 'Lăţimea uşii',    value: `${doorW} mm × ${n} uşi` },
      { label: 'Nr. suprapuneri', value: `${suprapuneriLux(n)}` },
    ],
  };
}

export const bomLux = (model, cat) => (state, s) => [
  ...luxProfileRows(cat, s, state),
  ...luxAplicateRows(cat, s, state),
  ...luxRamaRows(s),
  ...luxFeronerieRows(model, cat, s, state),
  ...luxAmortizareRows(state),
];

export function buildLux(group, meta, state, s) {
  const mats = makeMaterials(finishHex(meta, state));
  const W = mm(s.opening.w), H = mm(s.opening.h), doorW = mm(s.door.w), doorH = mm(s.door.h);
  for (const t of [0, 1]) {
    floorRailLux(group, { length: mm(s.rail.length), mat: mats.trackMat, track: t });
    topRailLux(group, { length: mm(s.rail.length), H, doorH, mat: mats.trackMat, track: t });
  }
  layoutLux(W, doorW, s.door.count).forEach(({ offsetX, track }, i) => {
    hungDoor(group, {
      profiles: PROFILE_LUX, doorW, doorH, offsetX, track, floorGap: floorGapLux,
      divisions: state.divisions[i], panelMaterials: state.panels[i], ...luxDoor3D(s, state, i), mats,
    });
  });
}

// Facturarea (NeoManager) — ca la Confort: uşa întreagă pe lăţime, la TOATE uşile
// (oricine asamblează), plus ce se alege în plus. Sticla + garnitura Lux + folia
// (oglinzi) + manopera le adaugă billingLines (billing.js), ca la Confort.
export const BILLING_LUX = {
  mode: 'complet',
  linii: [
    { tip: 'usa',  dim: 'doorWmm', qty: 'usi' },
    // rama pt. uşile cu cel puţin un panou de sticlă (R300, pe lăţimea uşii)
    { tip: 'rama', dim: 'doorWmm', qty: 'usiCuSticla' },
    // doar la CUPRU (uşa fără şine) — la celelalte culori cantitatea e 0 şi linia se omite
    { tip: 'sina superioara', dim: 'sinaLenMm', qty: 'sinaCupru' },
    { tip: 'sina inferioara', dim: 'sinaLenMm', qty: 'sinaCupru' },
    { tip: 'divizare',             dim: 'orizontalMm', qty: 'bareT' },
    { tip: 'divizare aplicata 10', dim: 'innerWmm',    qty: 'bareAplicate10' },
    { tip: 'divizare aplicata 20', dim: 'innerWmm',    qty: 'bareAplicate20' },
    { tip: 'maner aplicat',        dim: 'doorWmm',     qty: 'manereAplicate' },
    { cod: '164', denumire: 'Perie laterala 5x5 mm cod 164', qty: 'perieMl', um: 'm' },
    { cod: '275', denumire: 'Perie spate antipraf 6x8mm Confort/Lux cod 275', qty: 'perieSpateM', um: 'm' },
    { cod: '282', denumire: AMORTIZARE['35kg'].denumire, qty: 'amortizare35', factor: 0.5, um: 'set' },
    { cod: '281', denumire: AMORTIZARE['60kg'].denumire, qty: 'amortizare60', factor: 0.5, um: 'set' },
  ],
};
