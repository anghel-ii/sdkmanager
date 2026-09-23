// ── Utilitare numerice ───────────────────────────────────────────────────────

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// rotunjire în sus la pas de 0.5 (m) — pentru garnitură / perie livrate în rulouri
export const ceilHalf = x => Math.ceil(x / 0.5) * 0.5;
