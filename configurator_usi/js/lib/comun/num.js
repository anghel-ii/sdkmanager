// ── Utilitare numerice ───────────────────────────────────────────────────────

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// text de cantitate pt paste: întotdeauna cu zecimală (1 → "1.0"), ca NeoManager
// să vadă acelaşi „fel" de valoare (numeric cu punct) pe toate liniile, nu un
// amestec de întregi fără punct şi zecimale cu punct.
export const qtyText = n => (Number.isInteger(n) ? n.toFixed(1) : String(n));
