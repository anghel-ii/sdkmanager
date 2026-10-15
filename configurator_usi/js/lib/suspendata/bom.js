import { garnituraCod, GARNITURA_DENUMIRE, glassPerDoor } from './geam.js';
import { ceilHalf } from './num.js';
import catalog from '../../catalog/catalog.generated.json';
import { FINISAJE_STANDARD } from './finish.js';
import { articolPentru } from './billing.js';

// ── Necesar de materiale (BOM) ───────────────────────────────────────────────
// O linie de BOM = { code, label, qty, unit, cut? }
//   code  – cod de catalog (înlocuieşte-l cu cel real al gamei)
//   qty   – cantitate
//   unit  – 'buc' | 'm' | 'mp'
//   cut   – text cotă de debitare (ex. "2180 mm" sau "480 × 560 mm", înălţime
//           × lăţime la panourile de sticlă/PAL — vezi cota() mai jos); opţional
//
// Cadrul (profile + şină) apare ÎNTOTDEAUNA — se taie/pregăteşte indiferent cine
// asamblează. Rolele, şuruburile, garnitura şi peria apar în necesar DOAR pentru
// uşile asamblate de CLIENT (`state.assembly[i] === 'client'`) — la uşile
// asamblate de noi, piesele astea se consumă direct la montaj, nu se pun în colet.
//
// GEAMUL nu intră niciodată în colet: la uşile asamblate de noi se montează la
// atelier, iar la cele asamblate de client nu-l livrăm deloc (şi-l procură
// singur). La fel PAL-ul — nu-l vindem. Cotele lor de debitare stau într-o
// LISTĂ SEPARATĂ (clientPanelRows), nu amestecate în necesarul nostru: una e
// ce împachetăm, alta e ce trebuie să-şi cumpere clientul.

export const line = (code, label, qty, unit, cut) => ({ code, label, qty, unit, cut });

// exportată — o refolosesc şi funcţiile Confort-specifice din lib/suspendata/aplicate.js
export const clientDoors = state => (state.assembly ?? []).filter(a => a === 'client').length;

// Codul din catalogul familiei pt. un rând de necesar: tip + finisaj + bandă de
// mărime [lmin, lmax] — aceeaşi căutare ca la facturare (articolPentru în billing.js).
// Denumirea vine din catalog când există; altfel rămâne eticheta dată. Fără cod
// → rândul o spune apăsat (⚠ LIPSĂ COD), nu se pierde printre celelalte.
function catalogLine(family, tip, finisaj, dimMm, label, qty, unit, cut) {
  const art = articolPentru(catalog[family], tip, finisaj, dimMm);
  return art
    ? line(art.cod, art.denumire || label, qty, unit, cut)
    : line('⚠ LIPSĂ COD', `${label} — fără cod pt. ${finisaj} · ${Math.round(dimMm)} mm`, qty, unit, cut);
}

// Liniile cadrului unei uşi (suspendate). Verticalele şi orizontalele au coduri
// proprii de necesar (pe culoare); divizarea — acelaşi cod ca la facturare
// (bandă pe lăţimea liberă a uşii). Userul, 2026-09-21.
export function doorFrameRows(profiles, spec, state, family) {
  const n      = spec.door.count;
  const innerW = spec.door.w - 2 * profiles.montant.w;   // cota traverselor
  const f      = state.finish;
  // Denumirea profilelor cu tot cu culoarea (userul, 2026-09-21), ex.
  // „Profil vertical Negru mat" — catalogul n-are denumiri pt. ele.
  const cul    = FINISAJE_STANDARD.find(x => x.id === f)?.label ?? f;
  const rows = [
    catalogLine(family, 'vertical',           f, spec.door.h, `Profil vertical ${cul}`,    2 * n, 'buc', `${spec.door.h} mm`),
    catalogLine(family, 'orizontal superior', f, innerW,      `Orizontal superior ${cul}`, 1 * n, 'buc', `${innerW} mm`),
    catalogLine(family, 'orizontal inferior', f, innerW,      `Orizontal inferior ${cul}`, 1 * n, 'buc', `${innerW} mm`),
  ];
  const totalDiv = (state.divisions ?? []).reduce((s, d) => s + d, 0);
  if (totalDiv > 0) {
    rows.push(catalogLine(family, 'divizare', f, innerW, 'Profil divizare', totalDiv, 'buc', `${innerW} mm`));
  }
  return rows;
}

// Şina + profilul de mascare (suspendate) — aceleaşi coduri ca la facturare,
// bandă pe lungimea şinei. `mascareCount` = câte profile de mascare (1 la
// A/C/D/F, 2 la B/E, 0 la Standard); `sinaCount` = câte şine (2 la Standard
// cu suprapuneri — o şină simplă pe fiecare pistă).
export function railRows(spec, state, family, mascareCount = 1, sinaCount = 1) {
  const L = spec.rail.length, f = state.finish;
  const rows = [catalogLine(family, 'sina', f, L, 'Şină superioară', sinaCount, 'buc', `${L} mm`)];
  if (mascareCount > 0) rows.push(catalogLine(family, 'mascare_sina', f, L, 'Profil mascare şină', mascareCount, 'buc', `${L} mm`));
  return rows;
}

// ── Necesar CLIENT — panourile pe care şi le procură singur ─────────────────
// Listă separată de necesarul nostru: aici nu e nimic de împachetat sau de
// facturat, doar cotele de debitare de care are nevoie clientul ca să comande.
//   • PAL   – nu-l vindem deloc; îl aduce el la ORICE uşă (şi când asamblăm noi)
//   • Geam  – doar la uşile pe care le asamblează el; noi nu i-l livrăm
// O linie = { label, qty, unit, cut } — fără cod, fiindcă nu sunt articole
// de-ale noastre. Generic pentru toate sistemele, deci nu stă în bom()-ul
// fiecăruia: îl cheamă direct builder.js (currentClientPanels).
const panelLine = (label, qty, cut) => ({ label, qty, unit: 'buc', cut });

const cota = (glassW, paneH) => `${Math.round(paneH)} × ${glassW} mm`;   // înălţime × lăţime

export function clientPanelRows(spec, state) {
  const pal   = new Map();   // cotă panou            → { panes, glassW, paneH }
  const geam  = new Map();   // grosime + cotă panou  → { panes, glassW, paneH, grosime }

  // Per panou, nu per uşă: la Confort panourile aceleiaşi uşi pot avea
  // înălţimi diferite (introduse în opţiuni avansate) — grupăm pe cota fiecăruia.
  for (const g of glassPerDoor(spec, state)) {
    for (const h of g.palHs) {
      if (h <= 0) continue;
      const k = Math.round(h);
      // PAL are lăţimea LUI (g.palW), diferită de a sticlei la Confort.
      const e = pal.get(k) ?? { panes: 0, glassW: g.palW, paneH: h };
      e.panes += 1;
      pal.set(k, e);
    }

    if (!g.client) continue;
    for (const h of g.glassHs) {
      if (h <= 0) continue;
      const k = `${g.grosime}|${Math.round(h)}`;
      const e = geam.get(k) ?? { panes: 0, glassW: g.glassW, paneH: h, grosime: g.grosime };
      e.panes += 1;
      geam.set(k, e);
    }
  }

  return [
    ...[...pal.values()].map(({ panes, glassW, paneH }) =>
      panelLine('Panou PAL', panes, cota(glassW, paneH))),
    ...[...geam.values()].map(({ panes, glassW, paneH, grosime }) =>
      panelLine(`Geam ${grosime}mm`, panes, cota(glassW, paneH))),
  ];
}

// Piesele NOASTRE pentru uşile asamblate de CLIENT: garnitura (doar unde e geam,
// cu codul dat de grosimea declarată) şi peria laterală — pe ORICE uşă, şi pe cea
// numai din PAL: n-are legătură cu umplutura (userul, 2026-10-15). Geamul în sine
// nu apare aici — vezi clientPanelRows. Uşile asamblate de noi nu pun nimic din
// astea în colet (se consumă la montaj).
export function glassRows(spec, state) {
  const client = glassPerDoor(spec, state).filter(g => g.client);
  if (!client.length) return [];

  const byGarnitura = new Map();   // cod garnitură → { grosime, m }
  for (const g of client.filter(u => u.glassHs.some(h => h > 0))) {
    const cod = garnituraCod(g.grosime);
    const e = byGarnitura.get(cod) ?? { grosime: g.grosime, m: 0 };
    e.m += g.gasketM;
    byGarnitura.set(cod, e);
  }

  const rows = [...byGarnitura].map(([cod, { m }]) =>
    line(cod, GARNITURA_DENUMIRE[cod], ceilHalf(m), 'm'));

  const doorH = spec.door.h;
  rows.push(line('274', 'Perie laterala 11x5mm cod 274', ceilHalf(client.length * 2 * doorH / 1000), 'm'));

  return rows;
}

// Rolele uşilor asamblate de CLIENT (feronerie) — 2 per uşă (stânga/dreapta).
// Vin la set de 2, dar se taie/facturează la bucată (se poate vinde 1/2 set).
export function wheelRows(state) {
  const wheels   = state.wheels ?? [];
  const assembly = state.assembly ?? [];
  const countSide = tip => wheels.reduce((s, w, i) =>
    assembly[i] !== 'client' ? s : s + (w.left === tip ? 1 : 0) + (w.right === tip ? 1 : 0), 0);
  const simpla    = countSide('simpla');
  const amortizor = countSide('amortizor');

  const rows = [];
  if (simpla)    rows.push(line('381', 'Rotile pentru 1 usa cu rama din aluminiu, opritor si ghidaj cu rulment inclus cod 381',       simpla,    'buc'));
  if (amortizor) rows.push(line('380', 'Rotile la set cu amortizare pentru 1 usa cu rama din aluminiu, opritor si ghidaj cu rulment inclus cod 380', amortizor, 'buc'));
  return rows;
}

// Şuruburi de asamblare — cod 276, 4 per uşă asamblată de CLIENT (denumirea din
// NeoManager). La facturare sunt incluse în codul uşii.
export function screwRows(state) {
  const n = clientDoors(state);
  return n ? [line('276', 'Suruburi cuplare Confort/Lux cod 276', 4 * n, 'buc')] : [];
}
