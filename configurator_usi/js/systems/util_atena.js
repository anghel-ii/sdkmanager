// ═══════════════════════════════════════════════════════════════════════════
//  UTIL ATENA — uşă culisantă din profile (gama „util")
//  Toată logica e comună gamei — vezi js/lib/util/util.js (deduceri, coduri,
//  facturare), citită din „Calculator profile UTIL 15.09.xlsm".
// ═══════════════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { box, mm } from '../lib/comun/geo.js';
import { SUPRAPUNERI_UTIL, USI_UTIL, finisajeUtil, specUtil, bomUtil, clientPanelsUtil, facturareUtil, buildUtil } from '../lib/util/util.js';

const MODEL = 'ATENA';

// ── 1. Identitate ────────────────────────────────────────────────────────────
export const meta = {
  id:         'utilAtena',
  label:      'UTIL Atena',
  family:     'util',
  catalog:    'util',
  sketch:     'assets/util_atena.png',   // secţiunea profilului (poza din Excel)
  doorsRange: USI_UTIL,
  suprapuneri: n => SUPRAPUNERI_UTIL[n],   // fixe pe nr. de uşi, mereu şină dublă
  // lăţime max 5800 = şina (bară de 5,8 m); înălţime max 2788 = uşă de 2750:
  // profilul mâner e bară de 5,5 m şi se facturează o bară pe uşă (2 bucăţi)
  limits:     { width: [500, 5800], height: [500, 2788] },
  finishes:   finisajeUtil(MODEL),
};

// ── 2. Spec ──────────────────────────────────────────────────────────────────
export const spec = state => specUtil(MODEL, state);

// ── 3. Necesar + cotele panourilor clientului ───────────────────────────────
export const bom = (state, s) => bomUtil(state, s);
export const clientPanels = (state, s) => clientPanelsUtil(state, s);
export const sticlaComanda = () => [];   // UTIL n-are sticlă (doar PAL)

// ── 4. Randare 3D ────────────────────────────────────────────────────────────
export function build(group, state, s) {
  const hex = meta.finishes.find(f => f.id === state.finish)?.hex ?? meta.finishes[0].hex;
  buildUtil(group, state, s, { THREE, box, mm, aluColor: hex });
}

// ── 5. Facturare — calculată integral în lib/util/util.js ───────────────────
export const billing = { mode: 'complet', calcul: facturareUtil };
