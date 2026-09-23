import { box } from '../comun/geo.js';

// ── Pereţi de cameră ─────────────────────────────────────────────────────────
// Piese individuale — un model le combină cum are nevoie (drept, în L, etc.).
// Toate cotele în METRI.

// Perete lateral (bloc vertical lipit de marginea golului).
//   side: -1 stânga, +1 dreapta.  depth = adâncimea peretelui pe X.
export function sideWall(group, { W, H, extraH, side, depth, wallD, mat }) {
  const wallH = H + extraH;
  const w = box(depth, wallH, wallD, mat, { receive: true });
  w.position.set(side * (W / 2 + depth / 2), wallH / 2, -wallD / 2);
  group.add(w);
  return w;
}

// Transom — secţiunea de perete deasupra golului (susţine şina).
export function transom(group, { W, H, extraH, wallD, mat }) {
  const t = box(W, extraH, wallD, mat, { receive: true });
  t.position.set(0, H + extraH / 2, -wallD / 2);
  group.add(t);
  return t;
}

// Configuraţia uzuală: perete stânga + perete dreapta + transom.
export function straightWalls(group, { W, H, extraH, leftW, rightW, wallD, mat }) {
  sideWall(group, { W, H, extraH, side: -1, depth: leftW,  wallD, mat });
  sideWall(group, { W, H, extraH, side:  1, depth: rightW, wallD, mat });
  transom (group, { W, H, extraH, wallD, mat });
}
