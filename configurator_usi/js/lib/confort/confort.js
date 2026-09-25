// ═══════════════════════════════════════════════════════════════════════════
//  CONFORT — helper comun pentru cele 4 modele (Verona/Gamma/Atrani/Alfa).
//  Formulele diferă de familia "suspendata": nr. de uşi (1-7) şi şina
//  (simplă/dublă) sunt ALESE de utilizator (state.doors / state.tracks),
//  nu fixe per sistem — de-aia formula stă o singură dată aici, nu
//  duplicată în fiecare fişier de sistem.
//
//  Spre deosebire de familia "suspendata" (uşi agăţate DOAR sus, nu se
//  sprijină pe jos — vezi hungDoor în lib/confort/scena.js), Confort are şină
//  şi jos: uşa stă direct pe ea (~1mm), iar şina de sus umple tot ce rămâne
//  până la linia golului, lipită de vârful uşii (fără joc) — vezi
//  floorRailConfort/topRailConfort mai jos.
// ═══════════════════════════════════════════════════════════════════════════

import { box } from '../comun/geo.js';
import { SCENE, trackZ } from './scena.js';
import { line, clientDoors } from './bom.js';
import { ceilHalf } from './num.js';
import { findGeam } from './geam.js';
import catalog from '../../catalog/catalog.generated.json';

// Înălţimea uşii — identică la toate 4 modelele.
export const doorHeightConfort = H => H - 40;

// nrSuprapuneri(nrUsi) — tabel dat de utilizator, NU o formulă aritmetică.
// Confirmat doar pentru şină dublă. 1 uşă → 0 (presupus: nicio uşă
// adiacentă cu care să se suprapună — de confirmat cu utilizatorul).
const OVERLAPS_2TRACK = { 1: 0, 2: 1, 3: 2, 4: 2, 5: 4, 6: 4, 7: 5 };

// Expusă separat (nu doar folosită intern de doorWidthConfort), pt. afişare
// directă pe fişa de atelier (js/fisa.js) — vezi nota din doorWidthConfort.
export const suprapuneriConfort = nrUsi => OVERLAPS_2TRACK[nrUsi] ?? 0;

// Suprapunerile REALE ale configuraţiei: la şina simplă (tracks 1) nu există
// suprapuneri, oricâte uşi ar fi — folosit peste tot unde contează cantitatea
// (perie spate, fişă, specificaţie), nu doar la afişarea opţiunilor din UI.
export const suprapuneriEfective = (nrUsi, tracks) => (tracks === 2 ? suprapuneriConfort(nrUsi) : 0);

// Şină DUBLĂ: doorW = (Lgol + Lprofil × nrSuprapuneri − 6) / nrUsi — toate uşile egale.
// Şină SIMPLĂ (1 uşă, sau 2 uşi cu 0 suprapuneri — tracks 1): uşa, respectiv
// cele două uşi la un loc, acoperă JUMĂTATE din gol (userul, 2026-09-18).
export function doorWidthConfort(W, profilMm, nrUsi, tracks) {
  if (tracks !== 2) return { doorW: W / 2 / nrUsi };
  const overlaps = OVERLAPS_2TRACK[nrUsi] ?? 0;
  return { doorW: (W + profilMm * overlaps - 6) / nrUsi };
}

// Lungimea şinei per pistă — PLACEHOLDER, nedată încă de utilizator.
export const railLengthConfort = W => W;   // TODO: formulă reală

// Poziţionarea foilor pe cele 2 piste — montajul e liber (utilizatorul:
// "se montează cum vrem"), o singură regulă fixă: prima uşă (stânga→dreapta)
// intră pe şina dinspre interior, apoi se alternează. `track` foloseşte
// numerotarea din lib/confort/scena.js (0 = dinspre perete, 1 = a doua/interior)
// — deci uşa 0 (prima) ia track 1, uşa 1 ia track 0, ş.a.m.d.
//
// Şina e de lăţimea golului (railLengthConfort = W), dar suma lăţimilor
// foilor (nrUsi × doorW) e mai mare decât W — tocmai fiindcă doorW include
// termenul de suprapunere (Lprofil × nrSuprapuneri). Ca ansamblul închis să
// se întindă exact pe W (nu mai mult), diferenţa se distribuie ca overlap
// vizibil între uşi adiacente, egal pe fiecare îmbinare — nedat exact care
// îmbinare cât suprapune, doar totalul (nrSuprapuneri), deci împărţim egal.
// Întoarce [{ offsetX, track }], în aceeaşi unitate ca W/doorW.
export function layoutConfort2Track(W, doorW, nrUsi) {
  const totalOverlap = nrUsi * doorW - W;                        // > 0, din formula doorW
  // egal pe fiecare îmbinare; la şina simplă uşile nu se suprapun (total < 0) —
  // stau una lângă alta
  const overlap = nrUsi > 1 ? Math.max(0, totalOverlap) / (nrUsi - 1) : 0;

  const offsets = [];
  // Şină simplă cu mai multe uşi (2 uşi, 0 suprapuneri): uşile, alăturate, stau
  // CENTRATE pe mijlocul şinei (userul, 2026-09-18). O uşă singură — tot din stânga.
  let leftEdge = totalOverlap < 0 && nrUsi > 1 ? -(nrUsi * doorW) / 2 : -W / 2;
  for (let i = 0; i < nrUsi; i++) {
    offsets.push({ offsetX: leftEdge + doorW / 2, track: i % 2 === 0 ? 1 : 0 });
    leftEdge += doorW - overlap;
  }
  return offsets;
}

// Stivă verticală Confort (de jos în sus): şină jos (~1mm) → uşă → şină sus,
// lipită de vârful uşii, umplând tot ce rămâne până la linia golului (H).
// Uşa stă direct pe şina de jos (fără joc suplimentar) — de-aia
// `floorGapConfort` (nu FLOOR_GAP din suspended.js, gândit pt uşi agăţate
// fără şină jos).
const FLOOR_RAIL_H = 0.001;   // ~1mm — dat aproximativ de utilizator
const FLOOR_RAIL_D = 0.03;    // TODO: cifră reală — adâncime secţiune

export const floorGapConfort = FLOOR_RAIL_H;

export function floorRailConfort(group, { length, centerX, mat, track = 0 }) {
  const rail = box(length, FLOOR_RAIL_H, FLOOR_RAIL_D, mat);
  rail.position.set(centerX, FLOOR_RAIL_H / 2, SCENE.wallGap + FLOOR_RAIL_D / 2 + trackZ(track));
  group.add(rail);
  return rail;
}

// Şină de SUS — nu o secţiune fixă ca la "suspendata": umple tot spaţiul
// rămas deasupra uşii, lipită de ea (fără joc), până exact la linia golului
// (H). Înălţimea ei rezultă din H/doorH/şina de jos — nu e o constantă.
const TOP_RAIL_D = 0.05;   // TODO: cifră reală — adâncime secţiune

// `acoperire` (m) — cât coboară şina peste capul uşii: orizontalul superior
// intră aproape complet în şina de sus (userul, 2026-09-18). Şina e mai adâncă
// decât uşa, deci îl ascunde.
export function topRailConfort(group, { length, centerX, H, doorH, mat, track = 0, acoperire = 0 }) {
  const railH = H - FLOOR_RAIL_H - doorH + acoperire;
  if (railH <= 0) return null;
  const rail = box(length, railH, TOP_RAIL_D, mat);
  rail.position.set(centerX, H - railH / 2, SCENE.wallGap + TOP_RAIL_D / 2 + trackZ(track));
  group.add(rail);
  return rail;
}

// ── Randare 3D — ce ştie Confort în plus faţă de uşa generică ──────────────
// (userul, 2026-09-18) Sticla şi PAL-ul au grosime reală şi stau la MIJLOCUL
// ramei; PAL 18mm, sticla grosimea modelului ales (la montaj client: grosimea
// declarată). Divizarea Confort ~20mm pe ambele feţe; H ~8mm pe faţă, ~20mm pe
// spate, cu panourile la doar 1mm unul de altul (buzele H le acoperă îmbinarea). Cât rămâne vizibil din orizontalul superior sub şină: ~5mm.
// Profil H — alternativă la divizarea Confort, permisă DOAR între două
// panouri de PAL (userul, 2026-09-17); scade doar 1mm din stivă.
const DEDUCERE_H = 1;
export const GROSIME_PAL_MM      = 18;
export const PROFIL_CONFORT_3D   = { fata: 20, spate: 20 };
export const PROFIL_H_3D         = { fata: 8,  spate: 20, slot: DEDUCERE_H };   // panourile aproape se ating
export const TRAVERSA_SUS_VIZIBIL_MM = 5;

// Partea comună ambelor familii: înălţimile panourilor, grosimea lor reală
// (centrate în ramă) şi divizările aplicate. Suspendatele o folosesc direct —
// barele lor rămân cu profilul din profiles.divizare.
export function usa3D(spec, state, i, grosimePal = GROSIME_PAL_MM) {
  const p = spec.glass?.panels?.[i];
  const client = state.assembly?.[i] === 'client';
  const grosimeGeam = client ? (state.geamClient?.[i] ?? 4) : (findGeam(state.geam?.[i])?.grosime ?? 4);
  return {
    paneHeights:   p?.heights,
    paneThickness: (p?.mats ?? []).map(m => (m === 'pal' ? grosimePal : grosimeGeam)),
    aplicate:      state.divAplicate?.[i],
  };
}

export function confortDoor3D(spec, state, i) {
  const p = spec.glass?.panels?.[i];
  return {
    ...usa3D(spec, state, i),
    barShapes: (p?.profil ?? []).map(pr => (pr === 'H' ? PROFIL_H_3D : PROFIL_CONFORT_3D)),
  };
}

// ── Necesar materiale — cod + denumire REALE din catalogul modelului ────────
// Catalogul Confort (js/catalog/confort<Model>.seed.sql, din "db debitare
// CONFORT.xlsx") are 6 tipuri: vertical, orizontal superior, orizontal
// inferior, divizare, sina superioara, sina inferioara. Codul (şi denumirea
// afişată) depind de finisaj (nu de lungimea de debitare — vezi nota din
// seed.sql), deci căutăm direct pe (tip, finisaj), fără bandă lmin/lmax.
// Denumirea vine DIN CATALOG (exact ca-n excel) — nu mai punem etichetă
// fixă; doar dacă lipseşte codul (finisaj nepopulat încă) cădem pe un nume
// generic după tip, ca linia să rămână lizibilă.
//
// Finisajele oferite în UI sunt deja filtrate după catalog (vezi finishesOf în
// lib/confort/finish.js), deci cazul „fără cod" n-ar trebui să apară din interfaţă. Dacă
// totuşi apare (catalog inconsistent), rândul o spune apăsat — să nu se piardă
// printre rândurile „doar cota", care n-au cod din construcţie.
const FALLBACK_DENUMIRE = {
  'vertical':           'Profil vertical',
  'orizontal superior': 'Orizontal superior',
  'orizontal inferior': 'Orizontal inferior',
  'divizare':           'Divizare Confort',
  'divizare H':         'Divizare H',
  'divizare aplicata 10': 'Divizare aplicată 10mm',
  'divizare aplicata 20': 'Divizare aplicată 20mm',
  'sina superioara':    'Şină superioară',
  'sina superioara simpla': 'Şină superioară simplă',
  'sina inferioara simpla': 'Şină inferioară simplă',
  'sina inferioara':    'Şină inferioară',
};

function confortLine(family, tip, finisaj, qty, cut, unit = 'buc') {
  const art = (catalog[family] ?? []).find(a => a.tip === tip && a.finisaj === finisaj);
  if (art) return line(art.cod, art.denumire, qty, unit, cut);
  return line('⚠ LIPSĂ COD', `${FALLBACK_DENUMIRE[tip]} — fără cod pentru finisajul ${finisaj}`, qty, unit, cut);
}

// Şina de sus + jos — câte 1 buc per pistă folosită (1 sau 2, după state.tracks).
export function confortRailRows(family, spec, state) {
  const f      = state.finish;
  const tracks = state.tracks === 2 ? 2 : 1;
  // Şina simplă are coduri proprii (sus + jos), o bucată fiecare la cota şinei.
  if (tracks === 1) return [
    confortLine(family, 'sina superioara simpla', f, 1, `${spec.rail.length} mm`),
    confortLine(family, 'sina inferioara simpla', f, 1, `${spec.rail.length} mm`),
  ];
  // Şina dublă are direct 2 căi de rulare — o singură bucată sus + una jos.
  return [
    confortLine(family, 'sina superioara', f, 1, `${spec.rail.length} mm`),
    confortLine(family, 'sina inferioara', f, 1, `${spec.rail.length} mm`),
  ];
}

// Şina simplă nu există în toate culorile (nu la AURIU / CUPRU) — acolo nu se
// pot face uşi pe şină simplă: minim 2 uşi, cu suprapunere (vezi ui.js).
export const areSinaSimpla = (catalogId, finisaj) =>
  (catalog[catalogId] ?? []).some(a => a.tip === 'sina superioara simpla' && a.finisaj === finisaj);

// Cadrul uşii: profil vertical + orizontal inferior/superior + divizare
// (dacă are). `profiles` tot dă lăţimile (mm) pt. cotele de debitare — doar
// codul/denumirea vin acum din catalog, nu mai sunt fixe per sistem.
export function confortFrameRows(family, profiles, spec, state) {
  const n      = spec.door.count;
  // Orizontalele şi divizările: lăţimea uşii minus deducerea modelului
  // (spec.orizontalMm, calculat în spec() — vezi DEDUCERE_ORIZONTAL).
  const orizW  = spec.orizontalMm;
  const f      = state.finish;
  const rows = [
    confortLine(family, 'vertical',           f, 2 * n, `${spec.door.h} mm`),
    confortLine(family, 'orizontal inferior', f, 1 * n, `${orizW} mm`),
    confortLine(family, 'orizontal superior', f, 1 * n, `${orizW} mm`),
  ];
  // Barele cu profil H (doar între două PAL-uri, opţiuni avansate) ies pe
  // linie separată, cod din catalog (tip 'divizare H').
  const bare   = (spec.glass?.panels ?? []).flatMap(p => p.profil ?? []);
  const totalH = bare.filter(pr => pr === 'H').length;
  const totalDiv = (state.divisions ?? []).reduce((s, d) => s + d, 0) - totalH;
  if (totalDiv > 0) {
    rows.push(confortLine(family, 'divizare', f, totalDiv, `${orizW} mm`));
  }
  if (totalH > 0) {
    rows.push(confortLine(family, 'divizare H', f, totalH, `${orizW} mm`));
  }
  return rows;
}

// ── Sticlă / PAL — formulă proprie, DIFERITĂ de familia "suspendata"
//    (lib/suspendata/glazing.js) ──────────────────────────────────────────────────────
//  Date de utilizator (2026-09-16), per model — un panou NEDIVIZAT (o
//  singură foaie, pe toată înălţimea uşii):
//    sticlă:  H = Husa − glassHOffset,  L = Lusa − glassWOffset
//    PAL:     H = Husa − palHOffset,    L = Lusa − palWOffset
//  offset-urile diferă pe fiecare model (vezi GLASS_H_OFFSET etc. din
//  fiecare confort_x.js) — L (lăţimea) nu e afectată de divizări, doar H.
//
//  Cu divizări (mai multe panouri într-o uşă): TOATE panourile ies la
//  ACEEAŞI cotă de debitare pe verticală, indiferent de material — altfel nu
//  s-ar alinia la bara de divizare. Algoritmul (confirmat de utilizator):
//    1. se scade din Husa alocaţia fiecărei margini a stivei de panouri —
//       la marginile care ating TRAVERSA (sus/jos), jumătate din offset-ul
//       materialului acelui panou; la fiecare profil INTERMEDIAR, deducerea
//       completă din DEDUCERE_PROFIL (după perechea de materiale de-o parte
//       şi de alta)
//    2. restul (stackH) se împarte EGAL la numărul de panouri — cu înălţimi
//       introduse (opţiuni avansate), restul panourilor împart egal ce rămâne
//
//  ⚠ INCERT (2026-09-16): împărţirea "jumătate" la marginile de sus/jos e o
//  ipoteză de-a noastră, NECONFIRMATĂ explicit — doar dedusă prin analogie cu
//  regula de la profilul intermediar (care ESTE confirmată: "se scad ... în
//  total din ambele bucăţi"). La o uşă cu UN SINGUR material rezultatul e
//  identic oricum s-ar împărţi (dă exact Husa−offset, aşa cum a confirmat
//  utilizatorul) — incertitudinea contează DOAR la uşile cu PAL şi sticlă
//  AMESTECATE în aceeaşi uşă. De clarificat cu utilizatorul; până atunci nu
//  schimba formula fără să actualizezi şi comentariul ăsta.

// Deducere de profil intermediar — cât "mănâncă" bara de divizare din stiva
// de panouri, după cele DOUĂ materiale care se ating acolo. Valoarea e
// TOTALĂ (înainte de eventuala împărţire) şi, conform utilizatorului,
// IDENTICĂ la toate cele 4 modele Confort (nu s-a dat o defalcare pe model,
// spre deosebire de offset-urile de mai sus) — de verificat şi asta.
const DEDUCERE_PROFIL = { 'pal-pal': 13, 'sticla-sticla': 4, 'pal-sticla': 8 };
const cheieProfil = (a, b) => [a, b].sort().join('-');


// Divizarea H există doar în unele culori (catalog tip 'divizare H') — la
// celelalte (AURIU, CUPRU) opţiunea nu se oferă şi nici nu se aplică.
export const areCodH = (catalogId, finisaj) =>
  (catalog[catalogId] ?? []).some(a => a.tip === 'divizare H' && a.finisaj === finisaj);

// Profilul EFECTIV al barei dintre panoul de jos şi cel de sus: 'H' doar dacă
// a fost ales, ambele panouri sunt PAL şi culoarea are cod H; altfel 'confort'.
export const profilEfectiv = (matJos, matSus, ales, hDisponibil = true) =>
  hDisponibil && ales === 'H' && matJos === 'pal' && matSus === 'pal' ? 'H' : 'confort';

// Facturarea divizărilor la Confort: cele Confort rămân la bucată (linia
// 'divizare_vanzare'), cele H se facturează la BARĂ de 5800mm — lungimea totală
// a bucăţilor H (cota de debitare = spec.orizontalMm, ca la necesar),
// rotunjită în sus la jumătate de bară (userul, 2026-09-17).
export const BARA_H_MM = 5800;
export function confortBillDivizari(glass, innerWmm) {
  const bare   = (glass?.panels ?? []).flatMap(p => p.profil ?? []);
  const nrH    = bare.filter(pr => pr === 'H').length;
  return {
    divizariBuc: bare.length - nrH,
    barH:        nrH ? ceilHalf(nrH * innerWmm / BARA_H_MM) : 0,
  };
}

const deducereBara = (matJos, matSus, profil) =>
  profil === 'H' ? DEDUCERE_H : DEDUCERE_PROFIL[cheieProfil(matJos, matSus)];

// Înălţimile de debitare ale panourilor unei uşi (de JOS în SUS).
//   `fixe[k]` = înălţimea de debitare introdusă de user pt. panoul k (opţiuni
//   avansate), sau null = automat. Panourile automate împart EGAL ce rămâne din
//   stivă după panourile fixate (userul, 2026-09-17). Fără nicio valoare fixată
//   rezultatul e identic cu formula de dinainte (stivă / nr. panouri).
function panouriUsa({ doorH, mats, fixe, profil, offsetH }) {
  const panes = mats.length;
  let stiva = doorH - offsetH(mats[0]) / 2 - offsetH(mats[panes - 1]) / 2;
  for (let k = 0; k < panes - 1; k++) stiva -= deducereBara(mats[k], mats[k + 1], profil[k]);

  const eFix     = k => Number.isFinite(fixe?.[k]) && fixe[k] > 0;
  const sumaFixe = mats.reduce((s, _, k) => s + (eFix(k) ? fixe[k] : 0), 0);
  const libere   = mats.filter((_, k) => !eFix(k)).length;
  const hLiber   = libere ? (stiva - sumaFixe) / libere : 0;
  const heights  = mats.map((_, k) => (eFix(k) ? fixe[k] : hLiber));

  let eroare = null;
  if (libere && !(hLiber > 0)) {
    eroare = `panourile introduse depăşesc uşa — mai rămân ${Math.round(stiva - sumaFixe)} mm pt. ${libere} panou(ri)`;
  } else if (!libere && Math.abs(stiva - sumaFixe) >= 0.5) {
    eroare = `suma panourilor e ${Math.round(sumaFixe)} mm, trebuie ${Math.round(stiva)} mm (diferenţă ${Math.round(sumaFixe) - Math.round(stiva)} mm)`;
  }
  return { heights: heights.map(h => (h > 0 ? h : 0)), stiva, eroare };
}

export function glazingConfort({
  doorW, doorH, divisionsPerDoor, panelsPerDoor, inaltimiPerDoor, profilePerDoor, hDisponibil,
  glassHOffset, glassWOffset, palHOffset, palWOffset,
}) {
  const offsetH = mat => (mat === 'pal' ? palHOffset : glassHOffset);
  const glassW  = doorW - glassWOffset;
  const palW    = doorW - palWOffset;
  const doors   = divisionsPerDoor.length;

  const panels = divisionsPerDoor.map((divisions, i) => {
    const panes = divisions + 1;
    const mats  = (panelsPerDoor?.[i] ?? []).slice(0, panes);
    while (mats.length < panes) mats.push('sticla');   // lipsă = sticlă, ca-n glazing.js

    const profil = Array.from({ length: divisions }, (_, k) =>
      profilEfectiv(mats[k], mats[k + 1], profilePerDoor?.[i]?.[k], hDisponibil));
    const { heights, stiva, eroare } = panouriUsa({ doorH, mats, fixe: inaltimiPerDoor?.[i], profil, offsetH });

    const palPanes = mats.filter(m => m === 'pal').length;
    return {
      divisions, panes, palPanes,
      glassPanes: panes - palPanes,
      mats, heights, stiva, profil, eroare,
    };
  });

  const sticle = p => p.heights.filter((_, k) => p.mats[k] !== 'pal');
  const glassCount  = panels.reduce((s, p) => s + p.glassPanes, 0);
  const glassAreaM2 = panels.reduce((s, p) => s + sticle(p).reduce((a, h) => a + (glassW / 1000) * (h / 1000), 0), 0);
  const gasketM     = ceilHalf(panels.reduce((s, p) => s + sticle(p).reduce((a, h) => a + 2 * (glassW + h) / 1000, 0), 0));
  const brushM      = ceilHalf(doors * 2 * doorH / 1000);

  return { glassW, palW, glassCount, glassAreaM2, gasketM, brushM, panels };
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

export function confortBillAplicate(spec, state) {
  const seg = segmenteAplicate(spec, state);
  return { bareAplicate10: nrBareAplicate(seg, '10').nr, bareAplicate20: nrBareAplicate(seg, '20').nr };
}

// Necesar: DOAR nr. de bare, fără bucăţi şi cote — benzile se măsoară şi se
// taie abia pe uşa montată (userul, 2026-09-18). Avertisment dacă o bucată ar
// ieşi mai lungă de 3m (atunci nu se poate tăia dintr-o singură bară).
export function confortAplicateRows(family, spec, state) {
  const seg = segmenteAplicate(spec, state);
  const rows = [];
  for (const latime of ['10', '20']) {
    const { nr, preaLungi } = nrBareAplicate(seg, latime);
    if (nr > 0) rows.push(confortLine(family, `divizare aplicata ${latime}`, state.finish, nr, undefined, 'bară'));
    [...new Set(preaLungi)].forEach(L => rows.push(line('⚠', `Divizare aplicată ${latime}mm: o bucată de ${L} mm e mai lungă decât bara de ${BARA_APLICATA_MM} mm`, '', '')));
  }
  return rows;
}

// ── Feronerie (roţi) — DIFERITĂ de familia "suspendata" (lib/confort/bom.js →
// wheelRows, care foloseşte perechea Simplă/Amortizor + codurile 381/380).
// Date de utilizator (2026-09-16): Confort NU mai foloseşte alegerea din UI
// „ROLE" (rămâne vizibilă, dar fără efect asupra necesarului la Confort) —
// sunt DOUĂ piese FIXE per uşă:
//   • roţi INFERIOARE — universale (acelaşi cod la toate 4 modelele), vin la
//     SET de 2 buc, cod 273, 1 set/uşă
//   • roţi SUPERIOARE — cod ŞI model diferite per sistem, vin la BUCATĂ,
//     2 buc/uşă (Verona/Atrani model K3 cod 270, Gamma model K4 cod 271,
//     Alfa model K5 cod 272)
// Ca şi înainte, apar în necesar DOAR la uşile asamblate de CLIENT — regulă
// păstrată explicit (necesar = necesar de AMBALARE, nu de asamblare; vezi
// [[configurator-usi-facturare-neomanager]]).
//
// Facturarea: la şina dublă roţile sunt incluse în linia 'usa'; la şina simplă
// se facturează separat — vezi confortBillSinaSimpla / liniiSinaSimpla mai jos.
//
// Denumirile de mai jos sunt cele din NeoManager („baza de date completa.xlsx",
// 2026-09-24), verbatim — nu le reformula.
const ROTI_SUPERIOARE = {
  confortVerona: { cod: '270', denumire: 'Rotila superioara Verona/Atrani K3 cod 270' },
  confortAtrani: { cod: '270', denumire: 'Rotila superioara Verona/Atrani K3 cod 270' },
  confortGamma:  { cod: '271', denumire: 'Rotila superioara Gamma K4 cod 271' },
  confortAlfa:   { cod: '272', denumire: 'Rotila superioara Alfa K5 cod 272' },
};
const ROATA_INFERIOARA_COD = '273';

export function confortWheelRows(sistemId, state) {
  const n = clientDoors(state);
  if (!n) return [];

  const rows = [line(ROATA_INFERIOARA_COD, 'Rotila inferioara Confort la set cod 273', n, 'set')];
  const sup = ROTI_SUPERIOARE[sistemId];
  if (sup) rows.push(line(sup.cod, sup.denumire, 2 * n, 'buc'));
  return rows;
}

// Şuruburi de asamblare — cod real (înlocuieşte placeholder-ul
// 'SURUB-ASAMBLARE' folosit de familia "suspendata"), 4 buc/uşă, tot doar
// la uşile asamblate de CLIENT.
export function confortScrewRows(state) {
  const n = clientDoors(state);
  return n ? [line('276', 'Suruburi cuplare Confort/Lux cod 276', 4 * n, 'buc')] : [];
}

// Opritori cu adeziv — cod fix, 1 per uşă, tot doar la CLIENT.
// Denumirea din NeoManager.
export function confortOpritoriRows(state) {
  const n = clientDoors(state);
  return n ? [line('280', 'Opritor din aluminiu cod 280', n, 'buc')] : [];
}

// Cleme perie laterală — cod fix, 2 buc/uşă, tot doar la CLIENT (dat explicit
// de utilizator, 2026-09-17). Însoţeşte peria laterală (cod 274, glassRows în
// lib/confort/bom.js — comună cu familia "suspendata"), dar rămâne Confort-only ca
// tot restul feroneriei noi (roţi/şuruburi/opritori/amortizare).
export function confortClemeRows(state) {
  const n = clientDoors(state);
  return n ? [line('279', 'Cleme fixare perie cod 279', 2 * n, 'buc')] : [];
}

// ── Facturare la ŞINĂ SIMPLĂ (userul, 2026-09-18) ──────────────────────────
// La şina simplă uşa NU se mai facturează întreagă (linia 'usa' — preţul ei
// include şinele duble, profilele, roţile, şuruburile, opritorii, clemele), ci
// FIECARE piesă din care e compusă, la TOATE uşile (facturarea nu ţine cont cine
// asamblează): profilele la bucată ca în necesar, feroneria cu codurile fixe, iar
// şinele simple la bară de 5,8m, întreagă sau jumătate. La şina dublă toate
// cantităţile de aici ies 0 şi liniile lor se omit — rămâne linia 'usa'.
export const BARA_SINA_SIMPLA_MM = 5800;

export function confortBillSinaSimpla(spec, state) {
  const simpla = state.tracks !== 2;
  const n = spec.door.count;
  const bareSina = ceilHalf(spec.rail.length / BARA_SINA_SIMPLA_MM);
  const bare = simpla ? bareSina : 0;
  // CUPRU pe şină dublă: codul de uşă NU include şinele (userul, 2026-09-18) —
  // se facturează separat 290 (sus) / 291 (jos), la bucată sau jumătate.
  // ⚠ lungimea barei de şină dublă presupusă tot 5,8m — de confirmat.
  const dublaSeparat = !simpla && state.finish === 'CUPRU' ? bareSina : 0;
  return {
    sinaSupDubla:  dublaSeparat,
    sinaInfDubla:  dublaSeparat,
    usi:           simpla ? 0 : n,
    verticaleBuc:  simpla ? 2 * n : 0,
    orizInfBuc:    simpla ? n : 0,
    orizSupBuc:    simpla ? n : 0,
    sinaSupSimpla: bare,
    sinaInfSimpla: bare,
    rotiInfSet:    simpla ? n : 0,
    rotiSupBuc:    simpla ? 2 * n : 0,
    suruburiBuc:   simpla ? 4 * n : 0,
    opritoriBuc:   simpla ? n : 0,
    clemeBuc:      simpla ? 2 * n : 0,
  };
}

// Liniile de facturare corespunzătoare (în billing.linii al fiecărui model) —
// denumirile feroneriei sunt aceleaşi, verbatim, ca în necesar.
export function liniiSinaSimpla(sistemId) {
  const sup = ROTI_SUPERIOARE[sistemId];
  return [
    { tip: 'vertical',               dim: 'doorHmm',   qty: 'verticaleBuc' },
    { tip: 'orizontal inferior',     dim: 'orizontalMm', qty: 'orizInfBuc' },
    { tip: 'orizontal superior',     dim: 'orizontalMm', qty: 'orizSupBuc' },
    { tip: 'sina superioara simpla', dim: 'sinaLenMm', qty: 'sinaSupSimpla' },
    { tip: 'sina inferioara simpla', dim: 'sinaLenMm', qty: 'sinaInfSimpla' },
    { tip: 'sina superioara',        dim: 'sinaLenMm', qty: 'sinaSupDubla' },
    { tip: 'sina inferioara',        dim: 'sinaLenMm', qty: 'sinaInfDubla' },
    { cod: ROATA_INFERIOARA_COD, denumire: 'Rotila inferioara Confort la set cod 273', qty: 'rotiInfSet', um: 'set' },
    ...(sup ? [{ cod: sup.cod, denumire: sup.denumire, qty: 'rotiSupBuc' }] : []),
    { cod: '276', denumire: 'Suruburi cuplare Confort/Lux cod 276',   qty: 'suruburiBuc' },
    { cod: '280', denumire: 'Opritor din aluminiu cod 280',   qty: 'opritoriBuc' },
    { cod: '279', denumire: 'Cleme fixare perie cod 279', qty: 'clemeBuc' },
  ];
}

// Perie spate antipraf — DOAR la Verona şi Atrani (dat explicit de utilizator,
// 2026-09-16; Gamma/Alfa nu au piesa asta). Formulă: nr. de suprapuneri ×
// înălţimea uşii → metri → ceilHalf (rotunjit în sus la 0.5 m) — acelaşi tipar
// ca peria laterală (cod 274, lib/confort/bom.js). Poziţia întreagă (nu per uşă) —
// gate binar pe „există cel puţin o uşă client" (ca la roţi/şuruburi/opritori),
// nu proporţional cu nr. de uşi client.
const PERIE_SPATE_MODELE = new Set(['confortVerona', 'confortAtrani']);

export function confortPerieSpateRows(sistemId, state, spec) {
  if (!PERIE_SPATE_MODELE.has(sistemId) || !clientDoors(state)) return [];
  const suprapuneri = suprapuneriEfective(state.doors, state.tracks);
  if (!suprapuneri) return [];
  const m = ceilHalf(suprapuneri * spec.door.h / 1000);
  return [line('275', 'Perie spate antipraf 6x8mm Confort/Lux cod 275', m, 'm')];
}

// Amortizare — accesoriu opţional per PARTE (stânga/dreapta), 3 clase:
// 'fara' (nimic), '35kg', '60kg' — vezi selectorul din UI (renderWheels).
// Fiecare parte aleasă cu o clasă = 0.5 set din clasa aia (acelaşi tipar ca
// rolele vechi din familia "suspendata": vin la set de 2, se facturează/
// consumă la bucată). Tot doar la uşile asamblate de CLIENT.
const AMORTIZARE_COD = { '35kg': '282', '60kg': '281' };
const AMORTIZARE_DENUMIRE = {
  '35kg': 'Amortizare la set 35 kg pentru gama Confort/Lux cod 282',
  '60kg': 'Amortizare la set 60kg pentru gama Confort/Lux cod 281',
};

export function confortAmortizareRows(state) {
  const amortizare = state.amortizare ?? [];
  const assembly   = state.assembly ?? [];
  const numara = clasa => amortizare.reduce((s, a, i) =>
    assembly[i] !== 'client' ? s : s + (a?.left === clasa ? 1 : 0) + (a?.right === clasa ? 1 : 0), 0);

  const rows = [];
  for (const clasa of ['35kg', '60kg']) {
    const buc = numara(clasa);
    if (buc) rows.push(line(AMORTIZARE_COD[clasa], AMORTIZARE_DENUMIRE[clasa], buc * 0.5, 'set'));
  }
  return rows;
}
