// Familia „util" (profile UTIL: Atena, Roma, Soft) — ce foloseşte stratul comun
// al aplicaţiei. Facturarea, necesarul şi cotele clientului le dă fiecare
// sistem util_*.js (billing.calcul, bom, clientPanels); aici doar dispecerii.
export const finishesOf = meta => meta?.finishes ?? [];

export const billingLines = (system, state, spec) =>
  ({ mode: system.billing.mode ?? null, ...system.billing.calcul(state, spec) });
