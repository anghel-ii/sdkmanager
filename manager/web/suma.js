// ═══════════════════════════════════════════════════════════════════════════
//  SUME SCRISE DE MÂNĂ (userul, 2026-10-30: „preţul să meargă şi cu punct, şi cu virgulă").
//  Merge în browser (window.Suma) şi în Node (serverul: livrări, acceptare).
//
//    Suma.din(text) → număr | null (gol) | NaN (nu e o sumă)
//      „12,5" / „12.5" → 12,5 · „1.200" / „1,200" → 1200 (un separator urmat de exact 3 cifre = mii)
//      „1.200,50" / „1,200.50" → 1200,5 (cu amândouă: ultimul e virgula zecimală) · „1 200 lei" → 1200
//    Suma.text(n)   → „1200,5" — cum se pune înapoi în câmp
// ═══════════════════════════════════════════════════════════════════════════
(function (radacina, fabrica) {
  const Suma = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = Suma;
  else radacina.Suma = Suma;
})(typeof self !== 'undefined' ? self : this, function () {
  function din(text) {
    let t = String(text ?? '').replace(/\s+|lei/gi, '');
    if (t === '') return null;
    const virgule = (t.match(/,/g) ?? []).length, puncte = (t.match(/\./g) ?? []).length;
    if (virgule && puncte) {
      // ultimul separator e cel zecimal, celălalt desparte miile
      const zecimal = t.lastIndexOf(',') > t.lastIndexOf('.') ? ',' : '.';
      t = t.split(zecimal === ',' ? '.' : ',').join('').replace(zecimal, '.');
    } else if (virgule + puncte > 1 || /^\d{1,3}[.,]\d{3}$/.test(t)) {
      t = t.replace(/[.,]/g, '');   // „1.200.000", „1.200" — doar mii
    } else {
      t = t.replace(',', '.');
    }
    return /^\d*\.?\d+$/.test(t) ? Number(t) : NaN;
  }
  const text = n => (n == null ? '' : String(n).replace('.', ','));
  return { din, text };
});
