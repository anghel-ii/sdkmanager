import catalog from '../../catalog/catalog.generated.json';
import { garnituraCod, FOLIE_COD, folieCantitate, glassPerDoor } from './geam.js';
import { ceilHalf } from './num.js';
// catalog = { "<family>": [ {articol}, ... ] } — un tabel per familie de sisteme

// ═══════════════════════════════════════════════════════════════════════════
//  FACTURARE — din configurație → linii `Cod  Cantitate` pentru grila NeoManager
//
//  Rețeta unui sistem stă în `export const billing` (secțiunea 7 a fișierului
//  suspendata_x.js). O linie are una din două forme:
//
//    { tip, dim, qty }        → se CAUTĂ codul în catalog după
//                               tip + finisaj + banda [lmin,lmax] testată pe
//                               cota `dim` (cheie din spec.bill, mm)
//
//    { cod, qty, denumire?, um?, factor? }
//                             → cod FIX (sticlă, accesorii), fără căutare
//
//  `qty` = cheie din spec.bill (nr.), număr literal, sau listă de chei (sumă).
//  `factor` = multiplicator opțional. Liniile cu cantitate 0 se omit.
//
//  Geam/oglindă + garnitura ei + folia de securizare (la oglinzi) NU stau în
//  rețeta sistemului — sunt comune tuturor și se adaugă automat mai jos, din
//  modelul ales în UI PER UŞĂ (`state.geam[i]`, catalog în js/lib/confort/geam.js) —
//  uşile cu acelaşi model se grupează pe o singură linie de facturare.
//
//  Uşile asamblate de CLIENT nu primesc linie de geam: geamul nu circulă prin
//  noi (nici livrat, nici adus), clientul şi-l procură singur — trimitem şi
//  facturăm doar restul pieselor. Rămâne garnitura, aleasă după grosimea
//  declarată în UI (`state.geamClient[i]`: 4mm → 277, 8mm → 278).
//  Panourile PAL nu produc nicio linie — nici geam, nici garnitură; nu le
//  vindem, le aduce clientul (dăm doar cota, vezi clientPanelRows în lib/confort/bom.js).
//
//  Manoperă (cod 'Manopera 1') — o linie per uşă cu `state.assembly[i] === 'noi'`
//  (asamblată de noi, nu de client). Nu afectează celelalte linii de facturare.
// ═══════════════════════════════════════════════════════════════════════════

// rotunjire în sus la 0,01 (necesar de cumpărat, nu de subestimat). Întâi se
// taie zgomotul de virgulă mobilă sub 1e-6 — altfel 1.1 × 100 = 110.00000000000001
// şi o arie de exact 1,1 mp ieşea facturată 1,11.
const ceil2 = x => Math.ceil(Math.round(x * 1e6) / 1e4) / 100;

// ── Cantități facturabile numite ────────────────────────────────────────────
// `spec` = obiectul cu door / rail / glass / opening deja calculate în spec().
export function billQuantities(profiles, spec, state) {
  const door   = spec.door;
  const glass  = spec.glass ?? {};
  const n      = door.count;
  const innerW = door.w - 2 * profiles.montant.w;   // lățimea liberă a uşii (mm)
  const wheels = state.wheels ?? [];
  const countSide = tip => wheels.reduce((s, w) =>
    s + (w.left === tip ? 1 : 0) + (w.right === tip ? 1 : 0), 0);

  // Amortizare (doar Confort — state.amortizare rămâne mereu 'fara' la
  // celelalte familii, câmpurile de mai jos ies 0 acolo, inofensiv). Ca şi
  // rolele, NEFILTRAT pe assembly: facturarea Confort se face la TOATE uşile,
  // indiferent cine asamblează (userul, 2026-09-17) — spre deosebire de
  // necesar (confortAmortizareRows, lib/confort/confort.js), care rămâne doar client.
  const amortizare = state.amortizare ?? [];
  const countAmortizare = clasa => amortizare.reduce((s, a) =>
    s + (a?.left === clasa ? 1 : 0) + (a?.right === clasa ? 1 : 0), 0);

  return {
    usi:            n,   // nr. uşi — denumirea din facturi/UI e „uşi", nu „foi"
    doorWmm:        door.w,
    doorHmm:        door.h,
    innerWmm:       innerW,
    openingWmm:     spec.opening.w,
    openingHmm:     spec.opening.h,
    sinaLenMm:      spec.rail?.length ?? 0,
    divizariBuc:    (state.divisions ?? []).reduce((s, d) => s + d, 0),
    sticlaMp:       ceil2(glass.glassAreaM2 ?? 0),
    sticlaBuc:      glass.glassCount ?? 0,
    garnituraMl:    glass.gasketM ?? 0,
    perieMl:        glass.brushM ?? 0,
    ariaGolMp:      ceil2((spec.opening.w / 1000) * (spec.opening.h / 1000)),
    ariaUsiiMp:     ceil2(n * (door.w / 1000) * (door.h / 1000)),
    roleSimple:     countSide('simpla'),      // rolă simplă,      cod 381 — 1 per parte (stânga/dreapta)
    roleAmortizor:  countSide('amortizor'),   // rolă cu amortizor, cod 380
    sinaCount:      state.tracks ?? 1,        // nr. piste de culisare — folosit doar la Confort (A-F au qty:1 literal)
    amortizare35:   countAmortizare('35kg'),  // cod 282 — 1 per parte cu clasa aleasă
    amortizare60:   countAmortizare('60kg'),  // cod 281
  };
}

// ── Rezolvarea unei linii ───────────────────────────────────────────────────

function pickQty(qty, bill) {
  if (Array.isArray(qty)) return qty.reduce((s, k) => s + (bill?.[k] ?? 0), 0);
  return typeof qty === 'number' ? qty : (bill?.[qty] ?? 0);
}

function resolveLine(articole, linie, ctx) {
  const { finisaj, bill } = ctx;
  const cant = ceil2(pickQty(linie.qty, bill) * (linie.factor ?? 1));
  if (!(cant > 0)) return { skip: true };

  // linie cu cod fix (sticlă, accesorii) — nu se caută în catalog
  if (linie.cod) {
    return { cod: linie.cod, denumire: linie.denumire ?? null, um: linie.um ?? 'buc', cantitate: cant };
  }

  const dimMm = pickQty(linie.dim, bill);
  const hit = (articole ?? []).find(a =>
    a.tip === linie.tip &&
    (a.finisaj == null || a.finisaj === finisaj) &&
    (a.lmin == null || dimMm >= a.lmin) &&
    (a.lmax == null || dimMm <= a.lmax)
  );

  return hit
    ? { cod: hit.cod, denumire: hit.denumire ?? null, um: hit.um ?? 'buc', cantitate: cant }
    : { eroare: `lipsă cod: ${linie.tip} · ${finisaj} · ${Math.round(dimMm)} mm` };
}

// ── API ─────────────────────────────────────────────────────────────────────

export function billingLines(system, state, spec) {
  const b = system?.billing;
  if (!b || !Array.isArray(b.linii)) {
    return { lines: [], errors: ['Sistemul nu are rețetă de facturare (secțiunea 7 / export const billing).'], mode: null };
  }

  const ctx = { finisaj: state.finish, bill: spec.bill ?? {} };
  // `meta.catalog` suprascrie catalogul folosit pentru căutare — necesar la
  // Confort, unde fiecare model (Verona/Gamma/Atrani/Alfa) are propriul
  // catalog (coduri diferite la acelaşi finisaj), deşi toate 4 rămân în
  // gama 'confort' (meta.family — vezi ui.js, GAMĂ/MODEL).
  const articole = catalog[system.meta.catalog ?? system.meta.family] ?? [];
  const lines = [], errors = [];

  for (const linie of b.linii) {
    const r = resolveLine(articole, linie, ctx);
    if (r.skip) continue;
    if (r.eroare) { errors.push(r.eroare); continue; }
    lines.push({ cod: r.cod, denumire: r.denumire, um: r.um, cantitate: r.cantitate });
  }

  // Geam / garnitură / folie — vezi nota din antetul fişierului.
  // Geamul se grupează pe cod (uşile cu acelaşi model → o singură linie), iar
  // garnitura pe CODUL ei (277/278): două modele diferite de 4mm dau tot o
  // singură linie de 277, nu două.
  const byGeam      = new Map();   // cod geam      → { geam, areaM2 }
  const byGarnitura = new Map();   // cod garnitură → { grosime, m }

  for (const g of glassPerDoor(spec, state)) {
    if (g.panes <= 0) continue;   // uşă numai din PAL → nimic de facturat aici

    if (!g.client && !g.geam) {
      errors.push(`geam/oglindă neselectat(ă) pentru uşa ${g.i + 1} — alege un model în panoul UŞI.`);
      continue;
    }

    if (!g.client) {
      const e = byGeam.get(g.geam.cod) ?? { geam: g.geam, areaM2: 0 };
      e.areaM2 += g.areaM2;
      byGeam.set(g.geam.cod, e);
    }

    const cod = garnituraCod(g.grosime);
    const e = byGarnitura.get(cod) ?? { grosime: g.grosime, m: 0 };
    e.m += g.gasketM;
    byGarnitura.set(cod, e);
  }

  for (const { geam, areaM2 } of byGeam.values()) {
    lines.push({ cod: geam.cod, denumire: geam.denumire, um: 'mp', cantitate: ceil2(areaM2) });
    if (geam.oglinda) {
      lines.push({ cod: FOLIE_COD, denumire: 'Folie de securizare', um: 'buc', cantitate: folieCantitate(areaM2) });
    }
  }
  for (const [cod, { grosime, m }] of byGarnitura) {
    lines.push({ cod, denumire: `Garnitură sticlă ${grosime}mm`, um: 'm', cantitate: ceilHalf(m) });
  }

  // Manoperă — o linie per uşă asamblată de NOI (nu de client). Restul liniilor
  // (rolă/perie/geam/garnitură/folie) se facturează la fel indiferent cine
  // asamblează — doar manopera se adaugă/scoate în funcţie de asta.
  const noiCount = (state.assembly ?? []).filter(a => a === 'noi').length;
  if (noiCount > 0) {
    lines.push({ cod: 'Manopera 1', denumire: 'Manoperă asamblare', um: 'buc', cantitate: noiCount });
  }

  return { lines, errors, mode: b.mode ?? null };
}
