import * as THREE from 'three';

// ── Oglindire stânga ↔ dreapta ───────────────────────────────────────────────
// Construieşte randarea de bază într-un sub-grup, apoi îl oglindeşte pe X
// (three.js gestionează corect winding-ul/normalele la scale negativ).

// Oglindeşte direct un build() — util când un sistem se randează mereu oglindit
// (vezi suspendata_a.js / suspendata_d.js: build = mirrorBuild(buildRaw)).
export function mirrorBuild(buildFn) {
  return (group, state, s) => {
    const sub = new THREE.Group();
    buildFn(sub, state, s);
    sub.scale.x = -1;
    group.add(sub);
  };
}

// Variantă oglindită a unui sistem întreg — reutilizează profiles/spec/bom/billing,
// suprascrie doar build(). Util pt un sistem nou care e pur şi simplu oglinda altuia.
export function mirrorSystem(base, metaOverrides = {}) {
  return {
    ...base,
    meta: { ...base.meta, ...metaOverrides },
    build: mirrorBuild(base.build),
  };
}
