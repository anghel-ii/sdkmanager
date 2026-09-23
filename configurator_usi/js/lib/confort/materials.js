import * as THREE from 'three';

// ── Materiale de scenă ───────────────────────────────────────────────────────
// profileColor = finisajul ales de utilizator (aluminiu + şină).

// `palColor` — culoarea panourilor PAL (implicit ton lemn, ca la Confort; uşile
// suspendate îl cer ALB, userul 2026-09-21).
export function makeMaterials(profileColor, { palColor = 0xb08a63 } = {}) {
  const alu = new THREE.MeshStandardMaterial({
    color: profileColor, metalness: 0.65, roughness: 0.35,
  });
  return {
    aluMat:   alu,
    trackMat: alu,                       // şina are acelaşi finisaj ca uşa
    glassMat: new THREE.MeshPhysicalMaterial({
      color: 0xbfd6e0, transparent: true, opacity: 0.28,
      roughness: 0.05, side: THREE.DoubleSide,
    }),
    // Panou opac — TODO: culoare/textură reală PAL, deocamdată un ton lemn generic.
    palMat: new THREE.MeshStandardMaterial({
      color: palColor, roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide,
    }),
    wallMat: new THREE.MeshStandardMaterial({
      color: 0xcdd0d3, roughness: 0.9, metalness: 0.0,
    }),
  };
}
