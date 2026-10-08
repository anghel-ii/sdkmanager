// ═══════════════════════════════════════════════════════════════════════════
//  LUX VENT — uşă culisantă pe şină dublă, 1-7 uşi (gama „lux")
//  Toată logica e comună gamei — vezi js/lib/lux/lux.js, din
//  „Calculator profile LUX 2025.xlsx" + codurile din NeoManager.
// ═══════════════════════════════════════════════════════════════════════════

import { FINISAJE_LUX } from '../lib/lux/finish.js';
import { SUPRAPUNERI_LUX, USI_LUX, PROFILE_LUX, specLux, bomLux, buildLux, BILLING_LUX } from '../lib/lux/lux.js';

const MODEL = 'vent';

// ── 1. Identitate ────────────────────────────────────────────────────────────
export const meta = {
  id:          'luxVent',
  label:       'Lux Vent',
  family:      'lux',
  catalog:     'luxVent',                    // js/catalog/luxVent.seed.sql
  sketch:      'assets/lux_vent.png',        // secţiunea profilului (poza din Excel)
  doorsRange:  USI_LUX,
  suprapuneri: n => SUPRAPUNERI_LUX[n],      // doar şină dublă, fixe pe nr. de uşi
  pal:         true,                         // panourile pot fi PAL sau sticlă
  // şina = bară de 5,8 m; mânerul = bară de 5,5 m (2 bucăţi din una → uşa max 2750, gol max 2790)
  limits:      { width: [800, 5800], height: [800, 2790] },
  limitsFinisaj: { CUPRU: { width: [800, 3500], height: [800, 3000] } },   // şina de cupru e bară de 3,5 m; înălţime max 3000 (userul, 2026-10-08)
  finishes:    FINISAJE_LUX,
};

// profilele (lăţimi aproximative) — pt. 3D şi pt. desenele de pe fişă
export const profiles = PROFILE_LUX;

export const spec = state => specLux(MODEL, state);
export const bom = bomLux(MODEL, meta.catalog);
export const build = (group, state, s) => buildLux(group, meta, state, s);
export const billing = BILLING_LUX;
