// ═══════════════════════════════════════════════════════════════════════════
//  SUSPENDATĂ STANDARD — suprapuneri şi aşezarea uşilor pe 2 piste.
//  Acelaşi tabel ca la Confort (2→1, 3→2, 4→2, 5→4, 6→4, 7→5), copiat la
//  separarea familiilor (2026-09-23) — cele două copii evoluează independent.
// ═══════════════════════════════════════════════════════════════════════════

const SUPRAPUNERI = { 1: 0, 2: 1, 3: 2, 4: 2, 5: 4, 6: 4, 7: 5 };
export const suprapuneri = nrUsi => SUPRAPUNERI[nrUsi] ?? 0;

// Poziţionarea foilor pe cele 2 piste — montajul e liber (utilizatorul:
// "se montează cum vrem"), o singură regulă fixă: prima uşă (stânga→dreapta)
// intră pe şina dinspre interior, apoi se alternează. `track` foloseşte
// numerotarea din lib/suspendata/suspended.js (0 = dinspre perete, 1 = a doua/interior)
// — deci uşa 0 (prima) ia track 1, uşa 1 ia track 0, ş.a.m.d.
//
// Şina e de lăţimea golului (railLengthConfort = W), dar suma lăţimilor
// foilor (nrUsi × doorW) e mai mare decât W — tocmai fiindcă doorW include
// termenul de suprapunere (Lprofil × nrSuprapuneri). Ca ansamblul închis să
// se întindă exact pe W (nu mai mult), diferenţa se distribuie ca overlap
// vizibil între uşi adiacente, egal pe fiecare îmbinare — nedat exact care
// îmbinare cât suprapune, doar totalul (nrSuprapuneri), deci împărţim egal.
// Întoarce [{ offsetX, track }], în aceeaşi unitate ca W/doorW.
export function layout2Track(W, doorW, nrUsi) {
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
