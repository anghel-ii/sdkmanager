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
