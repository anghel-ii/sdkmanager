import * as THREE from 'three';
import { box } from '../comun/geo.js';
import { buildDoor, DOOR_D } from './door.js';

// ── Elemente comune familiei "suspendată" ────────────────────────────────────
// Cotele de scenă (m) folosite de toate configuraţiile suspendate.
// Pereţii (walls.js) au faţa dinspre cameră la z=0 — toate decalajele de mai
// jos sunt calculate faţă de acel plan, ţinând cont de grosimea fiecărei piese
// (altfel jumătate din grosime intră în perete).

// PAL-ul la uşile suspendate are 10mm (userul, 2026-09-21; la Confort 18mm).
export const GROSIME_PAL_SUSPENDATE_MM = 10;

export const SCENE = {
  wallD:      0.30,   // grosime perete
  wallExtraH: 0.35,   // înălţime perete deasupra golului (unde e montată şina)
  wallGap:    0.002,  // spaţiu vizibil între faţa peretelui şi uşă/şină — 2mm
};

const RAIL_H = 0.07;   // lăţime şină (secţiune) — 70mm
const RAIL_D = 0.05;

const FLOOR_GAP = 0.01;   // reveal fix uşă/pardoseală — restul înălţimii urcă peste linia golului
                          // (Confort suprascrie asta cu floorGap — vezi lib/suspendata/aplicate.js, uşile
                          //  lui stau direct pe şina de jos, nu au acest joc)

// Spaţiu vizibil între cele 2 uşi la configuraţiile bi-partite (B, E).
export const DOOR_GAP = 0.004;

// Decalaj Z între cele 2 piste de culisare (şină dublă) — TODO: cifra reală
// (Confort n-a dat-o încă); track 0 = pista dinspre perete, 1 = a doua.
export const TRACK_GAP = 0.03;

export const trackZ = track => (track ?? 0) * TRACK_GAP;

// Şina superioară (poartă greutatea uşilor). length, centerX în metri.
export function suspendedRail(group, { length, centerX, H, mat, track = 0 }) {
  const rail = box(length, RAIL_H, RAIL_D, mat);
  rail.position.set(centerX, H + RAIL_H / 2, SCENE.wallGap + RAIL_D / 2 + trackZ(track));
  group.add(rail);
  return rail;
}

// O uşă agăţată de şină. offsetX în metri. `floorGap` = cât de sus stă
// baza uşii faţă de pardoseală — implicit reveal-ul familiei "suspendata"
// (uşile nu se sprijină pe jos); Confort suprascrie cu propriul joc (uşa
// stă direct pe şina de jos — vezi lib/suspendata/aplicate.js).
export function hungDoor(group, { profiles, doorW, doorH, offsetX = 0, track = 0, floorGap = FLOOR_GAP, divisions, panelMaterials, paneHeights, paneThickness, barShapes, aplicate, mats }) {
  const pg = new THREE.Group();
  pg.position.set(offsetX, 0, SCENE.wallGap + DOOR_D / 2 + trackZ(track));
  buildDoor(pg, {
    profiles,
    outerW: doorW,
    outerH: doorH,
    yBase:  doorH / 2 + floorGap,   // ancorat de jos — restul urcă spre şină
    divisions,
    panelMaterials,
    paneHeights,
    paneThickness,
    barShapes,
    aplicate,
    mats,
  });
  group.add(pg);
  return pg;
}
