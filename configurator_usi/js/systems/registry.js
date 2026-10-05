import * as suspendataA from './suspendata_a.js';
import * as suspendataB from './suspendata_b.js';
import * as suspendataC from './suspendata_c.js';
import * as suspendataD from './suspendata_d.js';
import * as suspendataE from './suspendata_e.js';
import * as suspendataF from './suspendata_f.js';
import * as suspendataStandard from './suspendata_standard.js';
import * as confortVerona from './confort_verona.js';
import * as confortGamma  from './confort_gamma.js';
import * as confortAtrani from './confort_atrani.js';
import * as confortAlfa   from './confort_alfa.js';
import * as rama820 from './rama_820.js';
import * as rama822 from './rama_822.js';
import * as rama824 from './rama_824.js';
import * as rama831 from './rama_831.js';
import * as rama841 from './rama_841.js';
import * as rama842 from './rama_842.js';
import * as utilAtena from './util_atena.js';
import * as utilRoma  from './util_roma.js';
import * as utilSoft  from './util_soft.js';
// Gama LUX (Vent, Breda) — Calculator profile LUX 2025.xlsx (2026-10-05)
import * as luxVent   from './lux_vent.js';
import * as luxBreda  from './lux_breda.js';

// Sistem nou:
//   1) copiază un fişier din js/systems/ ca şablon (secţiunile 1–7)
//   2) ajustează profiles / spec / bom / build / billing pentru gama nouă
//   3) importă-l şi adaugă-l aici
// Sistem oglindit (stânga ↔ dreapta) al unuia existent: vezi js/lib/suspendata/mirror.js
// (`mirrorBuild` — randare oglindită direct în acelaşi fişier, ca la A/D;
//  `mirrorSystem` — variantă separată completă, dacă vrei ambele sensuri).
export const systems = {
  suspendataA,
  suspendataB,
  suspendataC,
  suspendataD,
  suspendataE,
  suspendataF,
  suspendataStandard,
  confortVerona,
  confortGamma,
  confortAtrani,
  confortAlfa,
  rama820,
  rama822,
  rama824,
  rama831,
  rama841,
  rama842,
  utilAtena,
  utilRoma,
  utilSoft,
  luxVent,
  luxBreda,
};

export const defaultSystem = 'suspendataA';
