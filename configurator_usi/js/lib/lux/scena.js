import * as THREE from 'three';
import { buildDoor, DOOR_D } from './door.js';

// ── Elemente comune familiei "suspendată" ────────────────────────────────────
// Cotele de scenă (m) folosite de toate configuraţiile suspendate.
// Pereţii (walls.js) au faţa dinspre cameră la z=0 — toate decalajele de mai
// jos sunt calculate faţă de acel plan, ţinând cont de grosimea fiecărei piese
// (altfel jumătate din grosime intră în perete).

export const SCENE = {
  wallD:      0.30,   // grosime perete
  wallExtraH: 0.35,   // înălţime perete deasupra golului (unde e montată şina)
  wallGap:    0.002,  // spaţiu vizibil între faţa peretelui şi uşă/şină — 2mm
};

const FLOOR_GAP = 0.01;   // reveal fix uşă/pardoseală — restul înălţimii urcă peste linia golului
                          // (Confort suprascrie asta cu floorGap — vezi lib/confort/confort.js, uşile
                          //  lui stau direct pe şina de jos, nu au acest joc)

// Decalaj Z între cele 2 piste de culisare (şină dublă) — TODO: cifra reală
// (Confort n-a dat-o încă); track 0 = pista dinspre perete, 1 = a doua.
export const TRACK_GAP = 0.03;

export const trackZ = track => (track ?? 0) * TRACK_GAP;

// O uşă agăţată de şină. offsetX în metri. `floorGap` = cât de sus stă
// baza uşii faţă de pardoseală — implicit reveal-ul familiei "suspendata"
// (uşile nu se sprijină pe jos); Confort suprascrie cu propriul joc (uşa
// stă direct pe şina de jos — vezi lib/confort/confort.js).
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
