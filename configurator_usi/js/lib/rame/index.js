// Gama „rame" — ce foloseşte stratul comun al aplicaţiei. Facturarea, necesarul,
// cotele clientului şi sticla le dă fiecare sistem rama_*.js (billing.calcul,
// bom, clientPanels, sticlaComanda); aici doar dispecerul de facturare.
export { finishesOf } from './finish.js';

export const billingLines = (system, state, spec) =>
  ({ mode: system.billing.mode ?? null, ...system.billing.calcul(state, spec) });
