// ═══════════════════════════════════════════════════════════════════════════
//  RECALCULARE — o configuraţie salvată (config_json din manager) → poziţia
//  completă, exact cum ar salva-o azi configuratorul („Salvează oferta"):
//  facturare NeoManager, necesar, client, sticlă.
//
//  Configuraţiile vechi n-au câmpurile adăugate între timp (PAL, amortizare,
//  benzi aplicate, geam per uşă…) — se completează cu valorile implicite ale
//  UI-ului (ca syncDoors/syncPanels din ui.js); la rame, câmpurile nealese
//  primesc prima opţiune validă. Tot ce s-a completat se raportează.
//
//  Intrare (stdin): [{ id, config }]   Ieşire (stdout): [{ id, pozitie, completat, eroare }]
//  Rulare: node test/ruleaza.js --script recalculeaza.mjs < intrare.json
// ═══════════════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import fs from 'node:fs';
import { state } from '../js/state.js';
import { systems } from '../js/systems/registry.js';
import { initBuilder, buildConfig, finishesOf } from '../js/builder.js';
import { pozitieCurenta } from '../js/oferta.js';
import { stareRameGoala, MODELE_RAME, ASAMBLARE, GAURIRE_820, GAURIRE_831, LIVRARE, AGENTI, PLATI,
         BALAMALE, PLACUTE } from '../js/lib/rame/rame.js';

initBuilder(new THREE.Group(), { target: { set() {} } });

const GEAM_IMPLICIT = 'GG004';   // geam float 4mm — implicitul vechi din state.js

function completeaza(cfg) {
  const completat = [];
  const pune = (cheie, valoare, cum) => { completat.push(`${cheie}: ${cum ?? JSON.stringify(valoare)}`); return valoare; };

  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, structuredClone(cfg));
  const sys = systems[state.system];
  if (!sys) throw new Error(`sistem necunoscut: ${state.system}`);
  const m = sys.meta;

  const culori = finishesOf(m).map(f => f.id);
  if (!culori.includes(state.finish)) state.finish = pune('finish', culori[0]);

  if (m.rame) {
    const r = state.rame = { ...stareRameGoala(), ...(state.rame ?? {}) };
    const grup820 = MODELE_RAME[m.rame].grup === '820';
    if (!r.asamblare) r.asamblare = pune('rame.asamblare', ASAMBLARE[0][0]);
    if (r.asamblare === 'noi' && !r.geam) r.geam = pune('rame.geam', GEAM_IMPLICIT);
    if (!r.gaurire) r.gaurire = pune('rame.gaurire', (grup820 ? GAURIRE_820 : GAURIRE_831)[0]);
    if (grup820 && !r.balama) r.balama = pune('rame.balama', BALAMALE[m.rame][0][0]);
    if (grup820 && !r.placuta) r.placuta = pune('rame.placuta', PLACUTE[m.rame][0][0]);
    if (!r.livrare) r.livrare = pune('rame.livrare', LIVRARE[0]);
    if (!r.agent) r.agent = pune('rame.agent', AGENTI[0]);
    if (!r.plata) r.plata = pune('rame.plata', PLATI[0][0]);
    return completat;
  }

  // uşi — ca syncDoors / syncPanels din ui.js
  const n = m.doorsRange
    ? Math.min(m.doorsRange[1], Math.max(m.doorsRange[0], state.doors || m.doorsRange[0]))
    : (m.doors ?? 1);
  if (state.doors !== n) state.doors = pune('doors', n);
  if (m.doorsRange && ![1, 2].includes(state.tracks)) state.tracks = pune('tracks', 2);
  const lista = (cheie, implicit) => {
    const a = Array.isArray(state[cheie]) ? state[cheie] : [];
    const lipsa = [];
    for (let i = 0; i < n; i++) if (a[i] == null) { a[i] = structuredClone(implicit(i)); lipsa.push(i + 1); }
    a.length = n;
    if (lipsa.length) completat.push(`${cheie}: uşa ${lipsa.join(', ')} → ${JSON.stringify(implicit(0))}`);
    state[cheie] = a;
  };
  lista('divisions',  () => 0);
  lista('assembly',   () => 'noi');
  lista('wheels',     () => ({ left: 'simpla', right: 'simpla' }));
  lista('geam',       () => GEAM_IMPLICIT);
  lista('geamClient', () => 4);
  lista('amortizare', () => ({ left: 'fara', right: 'fara' }));
  lista('divAplicate', () => ({ latime: 'fara', parte: 'fata', verticale: 0, orizontale: 0 }));
  lista('panels',     () => []);
  lista('hPanouri',   () => []);
  lista('divProfil',  () => []);
  for (let i = 0; i < n; i++) {
    const cnt = (state.divisions[i] ?? 0) + 1;
    const p = state.panels[i];
    while (p.length < cnt) p.push('sticla');
    p.length = cnt;
    if (!m.pal) state.panels[i] = p.map(() => 'sticla');
    if (state.hPanouri[i].length !== cnt) state.hPanouri[i] = Array(cnt).fill(null);
    if (state.divProfil[i].length !== cnt - 1) state.divProfil[i] = Array(cnt - 1).fill('confort');
  }
  return completat;
}

const intrare = JSON.parse(fs.readFileSync(0, 'utf8'));
const iesire = intrare.map(({ id, config }) => {
  try {
    const completat = completeaza(config);
    buildConfig();
    const p = pozitieCurenta();
    return { id, completat, eroare: p.eroare ?? null, pozitie: p.pozitie ?? null };
  } catch (e) {
    return { id, completat: [], eroare: String(e.message ?? e), pozitie: null };
  }
});
process.stdout.write(JSON.stringify(iesire));
