// ═══════════════════════════════════════════════════════════════════════════
//  RAMĂ 831 — ramă de aluminiu gata dimensionată (gama „rame")
//  Toată logica e comună gamei — vezi js/lib/rame/rame.js (coduri, mărimi standard,
//  scăderi geam, accesorii, facturare), citită din formularele Excel ale userului.
// ═══════════════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { box, mm } from '../lib/comun/geo.js';
import { finishHex } from '../lib/rame/finish.js';
import { MODELE_RAME, finisajeModel, specRame, bomRame, clientPanelsRame, facturareRame, buildRame, sticlaRame } from '../lib/rame/rame.js';

const MODEL = '831';

// ── 1. Identitate ────────────────────────────────────────────────────────────
export const meta = {
  id:       'rama831',
  label:    'Ramă 831',
  family:   'rame',
  catalog:  'rame',
  sketch:   'assets/rama_831.jpeg',   // secţiunea profilului (din folderul „schite rame")
  rame:     MODEL,            // UI-ul de rânduri (js/ui_rame.js) în loc de cote gol / uşi
  profil:   MODELE_RAME[MODEL].profil,
  finishes: finisajeModel(MODEL),
};

// ── 2. Profile — doar pt. desen (faţa ramei) ────────────────────────────────
export const profiles = { rama: { w: MODELE_RAME[MODEL].fata } };

// ── 3. Spec ──────────────────────────────────────────────────────────────────
export const spec = state => specRame(MODEL, state);

// ── 4. Necesar + cotele de geam ale clientului ──────────────────────────────
export const bom = (state, s) => bomRame(state, s);
export const clientPanels = (state, s) => clientPanelsRame(state, s);
export const sticlaComanda = (state, s) => sticlaRame(state, s);   // de comandat la furnizor

// ── 5. Randare 3D ────────────────────────────────────────────────────────────
export function build(group, state, s) {
  buildRame(group, state, s, { THREE, box, mm, aluColor: finishHex(meta, state) });
}

// ── 6. Facturare — calculată integral în lib/rame/rame.js ────────────────────────
export const billing = { mode: 'complet', calcul: facturareRame };
