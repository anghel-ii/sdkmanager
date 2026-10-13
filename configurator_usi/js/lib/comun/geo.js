import * as THREE from 'three';

// ── Primitive de geometrie ───────────────────────────────────────────────────
// Scena lucrează în METRI. Toate cotele de comandă sunt în MM → converteşte cu mm().

export const mm = x => x / 1000;   // mm → m

// Cutie (box) cu shadow-uri configurabile. Implicit aruncă umbră, nu primeşte.
export function box(w, h, d, mat, { cast = true, receive = false } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow    = cast;
  m.receiveShadow = receive;
  return m;
}

// Goleşte recursiv un THREE.Group şi eliberează memoria GPU.
// Conturul golului (dreptunghi subţire) — cât nu e ales nr. de uşi (Confort), în locul uşilor
// desenate implicit: 3D-ul arăta „1 uşă" înainte să alegi (testarea ca începător, 2026-10-13).
export function conturGol(group, latimeMm, inaltimeMm) {
  const W = mm(latimeMm) / 2, H = mm(inaltimeMm);
  const linie = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
    [new THREE.Vector3(-W, 0, 0), new THREE.Vector3(W, 0, 0), new THREE.Vector3(W, H, 0), new THREE.Vector3(-W, H, 0)]),
    new THREE.LineDashedMaterial({ color: 0x4da3ff, dashSize: 0.06, gapSize: 0.04 }));
  linie.computeLineDistances();
  group.add(linie);
}

export function clearGroup(g) {
  while (g.children.length) {
    const child = g.children.pop();
    if (child.children.length) clearGroup(child);
    child.geometry?.dispose();
    const mat = child.material;
    if (Array.isArray(mat)) mat.forEach(m => m.dispose());
    else mat?.dispose();
  }
}
