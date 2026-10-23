// ═══════════════════════════════════════════════════════════════════════════
//  TEST DE REFERINŢĂ — tot ce iese din configurator, pe o grilă de configuraţii
//
//  Pentru fiecare sistem × culoare × cotă × variantă (montaj, PAL, divizări,
//  opţiuni avansate) calculează exact ce ajunge la client şi în atelier:
//    F  facturare NeoManager (cod, cantitate, um)   — ce se lipeşte în NeoManager
//    N  necesar atelier (cod, cantitate, debitare)
//    C  necesar client (cote de panouri)
//    S  sticla de comandat la furnizor
//    E  erori (facturare + panouri)
//  şi compară cu test/referinta.json. Orice diferenţă = s-a schimbat un cod sau
//  o cantitate — trebuie să fie intenţionat.
//
//  Verifică şi integritatea liniilor de facturare (vezi `integritate`).
//
//  Importă DOAR prin builder.js / state.js / registry.js — nimic din lib/ —
//  ca să rămână valabil oricum s-ar reorganiza bibliotecile familiilor.
//
//  Rulare: npm test            (compară)
//          npm test -- --actualizeaza   (rescrie referinţa, după o schimbare voită)
// ═══════════════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import fs from 'node:fs';
import { state } from '../js/state.js';
import { systems } from '../js/systems/registry.js';
import { initBuilder, buildConfig, currentSpec, currentBom, currentBilling,
         currentClientPanels, currentSticla, finishesOf } from '../js/builder.js';
import { cotaGauri, randGol, geamPermisRame } from '../js/lib/rame/rame.js';
import { geamPermisLux } from '../js/lib/lux/index.js';
import catalog from '../js/catalog/catalog.generated.json';

const FISIER = new URL('./referinta.json', import.meta.url);
const actualizeaza = process.argv.includes('--actualizeaza');

initBuilder(new THREE.Group(), { target: { set() {} } });

// ── Starea unei configuraţii (ce face ui.js → syncDoors, fără DOM) ─────────
const GEAM_4_FLOAT   = 'GG004';    // geam float 4mm
// rame 831/841/842: doar 4 mm şlefuit / securizat (userul, 2026-10-20)
const GEAM_4_SLEFUIT = 'HD008', OGLINDA_SLEFUITA = 'HD002';
const GEAM_SATINAT_4 = 'GG009';    // geam satinat alb 4mm (LUX)
const OGLINDA  = (catalog.geam ?? []).find(g => g.oglinda)?.cod;
const PERUSA   = (n, f) => Array.from({ length: n }, (_, i) => f(i));

function reseteaza() {
  for (const k of Object.keys(state)) delete state[k];
}

function stareUsi(sys, { W, H, finish, doors, tracks, varianta }) {
  reseteaza();
  const m = sys.meta;
  const n = m.doorsRange ? doors : (m.doors ?? 1);
  const pal = !!m.pal;
  // LUX: doar geam prin care nu se vede (satinat, lacobel, oglindă — userul, 2026-10-08)
  const GEAM_4 = m.family === 'lux' ? GEAM_SATINAT_4 : GEAM_4_FLOAT;
  Object.assign(state, { system: m.id, width: W, height: H, finish, doors: n, tracks });

  // A = totul „noi", sticlă, 1 divizare, geam 4mm
  // B = totul „client", PAL jos (dacă modelul are PAL), geam client 8mm, role amortizor
  // C = amestec: 2 divizări, PAL-PAL-sticlă, profil H, înălţime fixată, divizări
  //     aplicate, amortizare, oglindă, montaj alternat
  const V = {
    A: i => ({ asm: 'noi', div: 1, panels: ['sticla', 'sticla'], geam: GEAM_4, gc: 4,
               wheel: { left: 'simpla', right: 'simpla' } }),
    B: i => ({ asm: 'client', div: 1, panels: [pal ? 'pal' : 'sticla', 'sticla'], geam: GEAM_4, gc: 8,
               wheel: { left: 'amortizor', right: 'simpla' } }),
    X: i => ({ asm: 'noi', div: 1, panels: ['sticla', 'sticla'], hPanouri: [5000, null], geam: GEAM_4, gc: 4,
               wheel: { left: 'simpla', right: 'simpla' } }),
    D: i => ({ asm: 'noi', div: 0, panels: ['sticla'], geam: GEAM_4, gc: 4,
               wheel: { left: 'simpla', right: 'simpla' } }),
    C: i => ({ asm: i % 2 ? 'client' : 'noi', div: 2,
               panels: pal ? ['pal', 'pal', 'sticla'] : ['sticla', 'sticla', 'sticla'],
               divProfil: ['H', 'confort'], hPanouri: [600, null, null],
               geam: OGLINDA, gc: 4, wheel: { left: 'amortizor', right: 'amortizor' },
               amort: { left: '35kg', right: '60kg' },
               aplicate: { latime: '20', parte: 'ambele', verticale: 1, orizontale: 2 } }),
  }[varianta];

  const u = PERUSA(n, V);
  state.assembly    = u.map(x => x.asm);
  state.divisions   = u.map(x => x.div);
  state.panels      = u.map(x => [...x.panels]);
  state.hPanouri    = u.map(x => x.hPanouri ? [...x.hPanouri] : Array(x.div + 1).fill(null));
  state.divProfil   = u.map(x => x.divProfil ? [...x.divProfil] : Array(x.div).fill('confort'));
  state.geam        = u.map(x => x.geam);
  state.geamClient  = u.map(x => x.gc);
  state.wheels      = u.map(x => ({ ...x.wheel }));
  state.amortizare  = u.map(x => ({ ...(x.amort ?? { left: 'fara', right: 'fara' }) }));
  state.divAplicate = u.map(x => ({ ...(x.aplicate ?? { latime: 'fara', parte: 'fata', verticale: 0, orizontale: 0 }) }));
  // LUX: mânerul aplicat (celelalte game nu-l citesc) — în varianta C, pe rând stânga / ambele / dreapta
  state.manerAplicat = u.map((_, i) => (varianta === 'C' ? ['stanga', 'ambele', 'dreapta'][i % 3] : 'fara'));
}

function stareRame(sys, { finish, varianta, randuri }) {
  reseteaza();
  Object.assign(state, { system: sys.meta.id, width: 1200, height: 2100, finish, doors: 1, tracks: 1,
    divisions: [0], panels: [['sticla']], assembly: ['noi'], geam: [null], geamClient: [4],
    wheels: [{ left: 'simpla', right: 'simpla' }], hPanouri: [[null]], divProfil: [[]],
    amortizare: [{ left: 'fara', right: 'fara' }],
    divAplicate: [{ latime: 'fara', parte: 'fata', verticale: 0, orizontale: 0 }] });
  const grup820 = ['rama820', 'rama822', 'rama824'].includes(sys.meta.id);
  state.rame = {
    randuri: randuri.map(([h, l, buc, gauri]) => ({ h, l, buc, gauri })),
    // mânerul: la „noi" modelul PE RÂND (L 32 + Neo, două coduri), la „oglinda"
    // formatul vechi (un cod pe toată secţiunea — ofertele salvate înainte)
    maner: grup820 && varianta !== 'client'
      ? varianta === 'oglinda' ? { profil: '771', randuri: [{ lungime: 1200, buc: 2 }, { lungime: 800, buc: 3 }] }
                               : { randuri: [{ model: 'L32', lungime: 1200, buc: 2 }, { model: 'Neo', lungime: 800, buc: 3 }] }
      : { randuri: [{ model: null, lungime: null, buc: 1 }] },
    asamblare: varianta === 'client' ? 'client' : 'noi',
    geam: grup820 ? (varianta === 'oglinda' ? OGLINDA : GEAM_4_FLOAT) : varianta === 'oglinda' ? OGLINDA_SLEFUITA : GEAM_4_SLEFUIT,
    gaurire: varianta === 'fara-gaurire' ? 'Fara gaurire' : grup820 ? '100 mm sus/jos si la mijloc' : 'Gaurire Standard',
    balama: varianta === 'fara-gaurire' ? null : grup820 ? (varianta === 'client' ? 'Fara balamale de la noi' : sys.meta.id === 'rama820' ? '71B3550 NICHEL' : '9072524') : null,
    placuta: varianta === 'fara-gaurire' ? null : grup820 ? (varianta === 'client' ? 'Fara placute de la noi' : sys.meta.id === 'rama820' ? '173H7100 NICHEL' : '9071576') : null,
    manson: varianta !== 'client',
    ral: '', vopsitCant: varianta === 'oglinda' ? 2 : 0,
    livrare: varianta === 'client' ? 'Ridicare personala' : 'Curier ramburs',
    agent: 'Birou', plata: 'fiscala',
  };
}

// ── Ce iese dintr-o configuraţie, ca linii de text comparabile ──────────────
const q = v => (typeof v === 'number' ? String(v) : String(v ?? ''));

function rezultat() {
  buildConfig();
  const spec = currentSpec();
  const f = currentBilling();
  return [
    ...f.lines.map(l => `F ${l.cod} | ${q(l.cantitate)} ${l.um ?? ''}`),
    ...currentBom().map(r => `N ${r.code} | ${q(r.qty)} ${r.unit ?? ''} | ${r.cut ?? ''}`),
    ...currentClientPanels().map(r => `C ${r.label} | ${q(r.qty)} | ${r.cut ?? ''}`),
    ...currentSticla().map(s => `S ${s.cod} | ${s.h}x${s.l} | ${s.buc}`),
    ...f.errors.map(e => `E ${e}`),
    ...(spec?.glass?.panels ?? []).filter(p => p.eroare).map((p, i) => `E panouri: ${p.eroare}`),
  ];
}

// ── Integritatea liniilor de facturare NeoManager ───────────────────────────
// Ce se lipeşte în NeoManager trebuie să fie curat, indiferent de configuraţie:
//   • cod real (nu gol, nu „⚠", nu placeholder)
//   • cantitate număr finit > 0, cu cel mult 2 zecimale ŞI fără zgomot de
//     virgulă mobilă (1.1 nu 1.1100000000000001, şi nu 1.11 când aria e 1.1)
//   • un cod căutat în catalog chiar există în catalogul familiei
const TOATE_CODURILE = new Set(Object.values(catalog).flat().map(a => String(a.cod)));
const probleme = [];
const coduriFixe = new Map();   // coduri facturate care NU vin din catalog → sistemele care le folosesc

function integritate(cheie, sys) {
  const { lines } = currentBilling();
  for (const l of lines) {
    if (!TOATE_CODURILE.has(String(l.cod))) {
      if (!coduriFixe.has(l.cod)) coduriFixe.set(l.cod, new Set());
      coduriFixe.get(l.cod).add(sys.meta.family);
    }
    const c = l.cantitate;
    if (!l.cod || /^⚠|LIPS/.test(String(l.cod)))                  probleme.push(`${cheie}: cod invalid „${l.cod}"`);
    if (!Number.isFinite(c) || !(c > 0))                            probleme.push(`${cheie}: ${l.cod} cantitate ${c}`);
    else if (Math.round(c * 100) / 100 !== c || String(c).length > String(Math.round(c * 100) / 100).length)
                                                                    probleme.push(`${cheie}: ${l.cod} cantitate cu zgomot ${c}`);
  }
  // Cote greşite de panouri → facturarea trebuie blocată (altfel s-ar putea
  // copia în NeoManager / salva o ofertă cu geam şi cote greşite)
  if ((currentSpec()?.glass?.panels ?? []).some(p => p.eroare) && !currentBilling().errors.length)
    probleme.push(`${cheie}: panouri cu cote greşite, dar facturarea nu e blocată`);

  // Geamul facturat în mp = aria EXACTĂ a panourilor de sticlă ale uşilor
  // asamblate de noi, rotunjită în sus la 0,01 — nici mai puţin (pierdere),
  // nici 0,01 în plus din zgomotul de virgulă mobilă (1100×1000 → 1.1, nu 1.11).
  // Folia (283, la oglinzi) = aria / 25 × 1.15, rotunjită la fel.
  const a = ariaExacta(currentSpec());
  const geamCod = state.rame ? state.rame.geam : state.geam.find((g, i) => state.assembly[i] !== 'client');
  if (a > 0 && geamCod) {
    const linie = lines.find(l => l.cod === geamCod);
    if (linie?.cantitate !== ceilCorect(a)) probleme.push(`${cheie}: geam ${geamCod} facturat ${linie?.cantitate}, aria exactă ${+a.toFixed(6)} → ${ceilCorect(a)}`);
    const folie = lines.find(l => l.cod === '283');
    if (folie && folie.cantitate !== ceilCorect(a / 25 * 1.15)) probleme.push(`${cheie}: folie 283 facturată ${folie.cantitate}, trebuie ${ceilCorect(a / 25 * 1.15)}`);
  }
}

// rotunjire în sus la 0,01 care ignoră zgomotul de virgulă mobilă sub 1e-6
const ceilCorect = x => Math.ceil(Math.round(x * 1e6) / 1e4 - 1e-9) / 100;

// Aria (mp) a sticlei facturate: panourile de sticlă ale uşilor „noi" (rame:
// toate ramele, dacă asamblăm noi). Calculată aici, independent de lib/.
function ariaExacta(spec) {
  if (!spec) return 0;
  if (state.rame) return state.rame.asamblare === 'noi' ? spec.ariaGeam : 0;
  if (state.util) return 0;   // UTIL: sticla (Roma) o ia clientul
  const g = spec.glass;
  if (!g) return 0;
  let a = 0;
  g.panels.forEach((p, i) => {
    if (state.assembly[i] === 'client') return;
    const hs = p.heights ?? Array(p.divisions + 1).fill(p.paneH);
    hs.forEach((h, k) => {
      const mat = p.mats?.[k] ?? state.panels[i][k];
      if (mat !== 'pal' && h > 0) a += (g.glassW / 1000) * (h / 1000);
    });
  });
  return a;
}

// ── Grila ────────────────────────────────────────────────────────────────────
const rezultate = {};
let nrCazuri = 0;

for (const sys of Object.values(systems)) {
  const m = sys.meta;
  const culori = finishesOf(m).map(f => f.id);

  if (m.rame) {
    const seturi = {
      mici:  [[500, 400, 2, 3], [1100, 450, 1, 4]],
      mari:  [[1250, 610, 1, 4], [2600, 700, 3, 5]],
      peste: [[3100, 1300, 1, 2]],   // peste mărimea maximă → eroare
    };
    for (const finish of culori) for (const varianta of ['noi', 'client', 'oglinda', 'fara-gaurire']) for (const [nume, randuri] of Object.entries(seturi)) {
      const cheie = `${m.id} | ${finish} | ${varianta} | ${nume}`;
      stareRame(sys, { finish, varianta, randuri });
      rezultate[cheie] = rezultat();
      integritate(cheie, sys);
      nrCazuri++;
    }
    continue;
  }

  // UTIL: cote, nr. de uşi, comutatorul de orizontale U, amortizări şi — pe uşă —
  // divizări H, înălţimi fixate şi divizări aplicate. Lăţimile trec prin pragurile şinei.
  if (m.family === 'util') {
    const V = {
      simplu: i => ({ oriz: 'ambele', div: 0 }),
      fara:   i => ({ oriz: 'fara', div: 0, asm: 'noi' }),
      sus:    i => ({ oriz: 'sus', div: 1, am: { left: '35kg', right: 'fara' } }),
      mixt:   i => ({ oriz: 'jos', div: i % 3, fixe: i % 3 === 2 ? [600, null, null] : null,
                      asm: i % 2 ? 'noi' : 'client', am: { left: '35kg', right: i % 2 ? '35kg' : 'fara' },
                      aplicate: i % 2 ? { latime: '10', parte: 'fata', verticale: 1, orizontale: 2 }
                                      : { latime: '20', parte: 'fata', verticale: 0, orizontale: 1 } }),
      gresit: i => ({ oriz: 'ambele', div: 1, fixe: [5000, null] }),   // panou mai înalt decât uşa
    };
    for (const finish of culori) for (let doors = 2; doors <= 7; doors++)
      for (const [W, H] of [[500, 500], [2000, 2100], [2001, 2100], [4000, 2600], [5800, 2788]])
        for (const [nume, f] of Object.entries(V)) {
          if (nume === 'gresit' && W !== 2000) continue;
          const cheie = `${m.id} | ${finish} | ${W}x${H} | ${doors}u | ${nume}`;
          const u = PERUSA(doors, f);
          reseteaza();
          Object.assign(state, { system: m.id, width: W, height: H, finish, doors, tracks: 2, geam: [],
            assembly: u.map(x => x.asm ?? 'client'),
            amortizare: u.map(x => ({ ...(x.am ?? { left: 'fara', right: 'fara' }) })),
            divisions: u.map(x => x.div),
            hPanouri: u.map(x => x.fixe ? [...x.fixe] : Array(x.div + 1).fill(null)),
            divAplicate: u.map(x => ({ ...(x.aplicate ?? { latime: 'fara', parte: 'fata', verticale: 0, orizontale: 0 }) })),
            util: { orizontale: u[0].oriz } });
          rezultate[cheie] = rezultat();
          integritate(cheie, sys);
          nrCazuri++;
        }
    continue;
  }

  const lim = m.limits;
  const intre = ([a, b], x) => Math.min(b, Math.max(a, x));
  const usiTracks = m.doorsRange ? [[1, 1], [2, 1], [3, 2], [5, 2]] : [[m.doors ?? 1, 2]];

  for (const [doors, tracks] of usiTracks) {
    // cota „tipică": ~900 mm pe uşă la Confort (altfel uşi de 200 mm, fără cod)
    const Wtipic = intre(lim.width, m.doorsRange ? doors * 900 + 200 : 1100);
    const Htipic = intre(lim.height, 2100);
    const cote = [[lim.width[0], lim.height[0]], [lim.width[1], lim.height[1]], [Wtipic, Htipic]];

    for (const finish of culori) for (const [W, H] of cote) for (const varianta of ['A', 'B', 'C']) {
      const cheie = `${m.id} | ${finish} | ${W}x${H} | ${doors}u/${tracks}s | ${varianta}`;
      stareUsi(sys, { W, H, finish, doors, tracks, varianta });
      rezultate[cheie] = rezultat();
      integritate(cheie, sys);
      nrCazuri++;
    }

    // baleiere fină a lăţimii (pas 10 mm, prima culoare) — prinde rotunjirile
    // care greşesc doar la anumite cote
    for (let W = Wtipic - 150; W <= Wtipic + 150; W += 10) {
      if (W < lim.width[0] || W > lim.width[1]) continue;
      const cheie = `${m.id} | ${culori[0]} | ${W}x${Htipic} | ${doors}u/${tracks}s | A`;
      if (rezultate[cheie]) continue;
      stareUsi(sys, { W, H: Htipic, finish: culori[0], doors, tracks, varianta: 'A' });
      rezultate[cheie] = rezultat();
      integritate(cheie, sys);
      nrCazuri++;
    }
  }
}

// Cote alese ca aria geamului să fie EXACT un număr cu 2 zecimale — acolo
// greşea rotunjirea în sus (1100×1000 → 1,11 în loc de 1,1). Varianta D = un
// singur panou de sticlă, fără divizare.
//   Suspendată A  987×2227 → sticlă 1000 × 2200 mm = 2,2 mp (dădea 2,21)
//   Confort Verona 1048×2297, 1 uşă, şină simplă → 500 × 2200 mm = 1,1 mp (dădea 1,11)
// Varianta X = un panou fixat la 5000 mm, mai înalt decât uşa → eroare de panouri.
for (const [id, W, H, doors, tracks, varianta] of [
  ['suspendataA', 987, 2227, 1, 2, 'D'], ['confortVerona', 1048, 2297, 1, 1, 'D'],
  ['suspendataA', 1200, 2100, 1, 2, 'X'], ['confortVerona', 1800, 2100, 2, 2, 'X'],
]) {
  const sys = systems[id];
  const finish = finishesOf(sys.meta)[0].id;
  const cheie = `${id} | ${finish} | ${W}x${H} | ${doors}u/${tracks}s | ${varianta}`;
  stareUsi(sys, { W, H, finish, doors, tracks, varianta });
  rezultate[cheie] = rezultat();
  integritate(cheie, sys);
  nrCazuri++;
}

// Livrare prin curier → transportul pe factură, la orice gamă (nu doar la rame)
for (const [id, W, H, doors, tracks] of [['confortVerona', 1800, 2100, 2, 2], ['suspendataA', 1200, 2100, 1, 2], ['utilAtena', 2000, 2100, 2, 2]]) {
  const sys = systems[id];
  const finish = finishesOf(sys.meta)[0].id;
  const cheie = `${id} | ${finish} | ${W}x${H} | ${doors}u/${tracks}s | A | curier`;
  stareUsi(sys, { W, H, finish, doors, tracks, varianta: 'A' });
  state.comanda = { livrare: 'Curier ramburs', agent: 'Birou', plata: 'fiscala' };
  rezultate[cheie] = rezultat();
  integritate(cheie, sys);
  nrCazuri++;
}

// Peria laterală: pe ORICE uşă asamblată de client, şi pe cea numai din PAL — necesarul = facturarea
// (userul, 2026-10-15: Verona 3 uşi, a treia doar PAL → necesar 10,5 m, facturare 15,5 m)
for (const [id, doors, cod] of [['confortVerona', 3, '274'], ['luxVent', 3, '164'], ['suspendataA', 1, '274']]) {
  const sys = systems[id], lim = sys.meta.limits;
  const intre = ([a, b], x) => Math.min(b, Math.max(a, x));
  stareUsi(sys, { W: intre(lim.width, doors * 900 + 200), H: intre(lim.height, 2100), finish: finishesOf(sys.meta)[0].id,
    doors, tracks: 2, varianta: 'B' });
  const u = doors - 1;   // ultima uşă: un singur panou, PAL
  state.divisions[u] = 0; state.panels[u] = ['pal']; state.hPanouri[u] = [null]; state.divProfil[u] = [];
  buildConfig();
  const n = currentBom().find(r => r.code === cod)?.qty, f = currentBilling().lines.find(l => l.cod === cod)?.cantitate;
  if (!(n > 0 && n === f)) { console.error(`✗ ${id}: peria ${cod} — necesar ${n}, facturare ${f}`); process.exit(1); }
}

// Suspendate — lăţimea golului (userul, 2026-10-15): minimul = cel mai mic gol la care uşa are ≥ 601 mm (cel mai mic
// cod) şi toate codurile există (cu divizare — bara sub 601 ia DIV-ul de 601-700); cu 1 mm mai puţin nu mai merge. Maximul = cel mai mare gol cu şina
// ≤ 5800 mm, cât e bara (Cupru 3500); acolo uşa poate rămâne fără cod — eroarea o văd colegii.
// Aceeaşi ordine ca limiteGol din ui.js.
for (const sys of Object.values(systems).filter(s => s.meta.family === 'suspendata')) {
  const m = sys.meta;
  for (const finish of finishesOf(m).map(f => f.id)) {
    const s = m.limitsFinisaj?.[finish], [d0, d1] = s?.doors ?? m.doorsRange ?? [m.doors, m.doors];
    for (let doors = d0; doors <= d1; doors++) {
      const [wMin, wMax] = s?.widthUsi?.[doors] ?? m.limits.widthUsi?.[doors] ?? s?.width ?? m.limits.width;
      const merge = W => {
        stareUsi(sys, { W, H: 2100, finish, doors, tracks: 2, varianta: 'A' });
        buildConfig();
        return currentSpec().door.w >= 601 && !currentBilling().errors.some(e => /cod/i.test(e));
      };
      const bara = finish === 'CUPRU' ? 3500 : 5800;
      const sina = W => { stareUsi(sys, { W, H: 2100, finish, doors, tracks: 2, varianta: 'D' }); return sys.spec(state).rail.length; };
      if (!merge(wMin) || merge(wMin - 1) || sina(wMax) > bara || sina(wMax + 1) <= bara) {
        console.error(`✗ ${m.id} ${finish} ${doors} uşi: gol ${wMin}–${wMax} — merge la ${wMin - 1}? ${merge(wMin - 1)}, la ${wMin}? ${merge(wMin)}; şina la ${wMax}: ${sina(wMax)}, la ${wMax + 1}: ${sina(wMax + 1)}`);
        process.exit(1);
      }
    }
  }
}

// Rame (userul, 2026-09-25): „100 mm de margini sus/jos" = mereu 2 găuri pe ramă,
// oricât scrie pe rând; mânerul se aşază pe bare de 3000 mm (2 × 1400 = o bară).
{
  const sys = systems.rama820;
  state.system = sys.meta.id;
  stareRame(sys, { finish: 'ALUMINIU', varianta: 'noi', randuri: [[600, 400, 3, 5]] });
  state.rame.gaurire = '100 mm de margini sus/jos';
  state.rame.maner = { randuri: [{ model: 'L32', lungime: 1400, buc: 2 }] };
  buildConfig();
  const s = currentSpec();
  const verifica = (ok, mesaj) => { if (!ok) { console.error('✗ rame: ' + mesaj); process.exit(1); } };
  verifica(s.nrGauri === 6, `sus/jos: aştept 3 rame × 2 găuri = 6, am ${s.nrGauri}`);
  verifica(s.manere[0]?.bare === 1, `mâner 2 × 1400 mm: aştept 1 bară de 3000, am ${s.manere[0]?.bare}`);
  // schiţa de găurire (verso): cotele de sus, la centrul găurii
  const c = (h, n, g) => JSON.stringify(cotaGauri(h, n, g));
  verifica(c(600, 2, '100 mm de margini sus/jos') === '[100,500]', `cote sus/jos 600: ${c(600, 2, '100 mm de margini sus/jos')}`);
  verifica(c(2000, 3, '100 mm sus/jos si la mijloc') === '[100,1000,1900]', `cote la mijloc: ${c(2000, 3, '100 mm sus/jos si la mijloc')}`);
  verifica(c(1999, 4, '100 mm sus/jos si impartite egal') === '[100,699.7,1299.3,1899]', `cote egale: ${c(1999, 4, '100 mm sus/jos si impartite egal')}`);
  verifica(c(800, 3, 'vezi schita pe spate') === 'null' && c(800, 2, 'Fara gaurire') === '[]', 'schiţa clientului / fără găurire');
  console.log('✓ rame: 2 găuri la „sus/jos", bare de mâner de 3000 mm, cotele schiţei de găurire');
}

// Cote pe fiecare ramă (userul, 2026-10-12): găurile = cotele scrise sub rând, de sus sau de jos;
// bucăţile pornesc de la 0 — H şi L fără bucăţi e o eroare, nu o ramă ignorată în tăcere.
{
  const sys = systems.rama822;
  state.system = sys.meta.id;
  stareRame(sys, { finish: 'ALUMINIU', varianta: 'noi', randuri: [[1000, 400, 2, 0], [800, 400, 1, 0]] });
  state.rame.gaurire = 'Cote pe fiecare rama';
  state.rame.randuri[0].cote = [{ v: 100, de: 'sus' }, { v: 150, de: 'jos' }, { v: null, de: 'sus' }];
  state.rame.randuri[1].cote = [{ v: 120, de: 'jos' }];
  buildConfig();
  let s = currentSpec();
  const verifica = (ok, mesaj) => { if (!ok) { console.error('✗ rame, cote pe ramă: ' + mesaj); process.exit(1); } };
  verifica(s.nrGauri === 2 * 2 + 1, `aştept 2 rame × 2 cote + 1 ramă × 1 cotă = 5 găuri, am ${s.nrGauri}`);
  const cote = JSON.stringify(cotaGauri(1000, 2, 'Cote pe fiecare rama', s.pline[0].cote));
  verifica(cote === '[100,850]', `100 de sus + 150 de jos pe H 1000 → [100,850], am ${cote}`);
  verifica(!s.erori.some(e => /cot|bucăţi/.test(e)), s.erori.join('; '));
  state.rame.randuri[1].cote = [];
  state.rame.randuri.push({ h: 500, l: 300, buc: 0, cote: [] });
  buildConfig();
  s = currentSpec();
  verifica(s.erori.some(e => /rândul 2: completează cotele/.test(e)), `rând fără cote: ${s.erori.join('; ')}`);
  verifica(s.erori.some(e => /rândul 3: completează nr\. de bucăţi/.test(e)), `rând fără bucăţi: ${s.erori.join('; ')}`);
  verifica(randGol().buc == null && randGol().gauri == null, 'rândul nou porneşte cu câmpurile goale');
  // câmpurile de cote sunt sub rânduri la ORICE regulă: rândul cu cote are găurile lui, cel fără — regula din listă
  state.rame.randuri = [{ h: 1000, l: 400, buc: 1, cote: [{ v: 100, de: 'sus' }, { v: 200, de: 'jos' }, { v: 500, de: 'sus' }] },
                        { h: 800, l: 400, buc: 2, cote: [] }];
  state.rame.gaurire = '100 mm de margini sus/jos';
  buildConfig(); s = currentSpec();
  verifica(s.nrGauri === 3 + 2 * 2, `rând cu 3 cote + 2 rame la sus/jos: aştept 7 găuri, am ${s.nrGauri}`);
  verifica(JSON.stringify(cotaGauri(1000, 3, '100 mm de margini sus/jos', s.pline[0].cote)) === '[100,500,800]', 'cotele bat regula din listă');
  state.rame.randuri[1].cote = [{ v: 150, de: 'sus' }];
  state.rame.gaurire = null;
  buildConfig(); s = currentSpec();
  verifica(!s.erori.some(e => /alege cotele/.test(e)), `toate rândurile au cote → regula din listă nu mai e cerută: ${s.erori.join('; ')}`);
  state.rame.gaurire = 'Fara gaurire';
  buildConfig(); s = currentSpec();
  verifica(s.nrGauri === 0, `„Fara gaurire" ignoră cotele: am ${s.nrGauri}`);
  console.log('✓ rame: cote pe fiecare ramă (de sus / de jos = nr. de găuri, peste regula din listă), câmpurile pornesc goale');
}

// Nr. de găuri obligatoriu (0 = fără găuri) şi sticla permisă pe model (userul, 2026-10-20)
{
  const sys = systems.rama820;
  state.system = sys.meta.id;
  stareRame(sys, { finish: 'ALUMINIU', varianta: 'noi', randuri: [[1000, 400, 2, null], [800, 400, 1, 0]] });
  buildConfig();
  const s = currentSpec();
  const verifica = (ok, mesaj) => { if (!ok) { console.error('✗ rame, găuri / sticlă: ' + mesaj); process.exit(1); } };
  verifica(s.erori.some(e => /rândul 1: completează nr\. de găuri/.test(e)), `găuri goale = eroare: ${s.erori.join('; ')}`);
  verifica(!s.erori.some(e => /rândul 2: completează nr\. de găuri/.test(e)), `0 găuri e o valoare: ${s.erori.join('; ')}`);
  const geam = cod => catalog.geam.find(g => g.cod === cod);
  const p820 = geamPermisRame('820'), p841 = geamPermisRame('841');
  verifica(p820(geam('GG004')) && p820(geam('GG001')) && !catalog.geam.filter(g => g.grosime !== 4).some(p820), '820: orice 4 mm, nimic altceva');
  verifica(p841(geam('HD008')) && p841(geam('CS001')) && p841(geam('HD002')) && !p841(geam('GG004')) && !p841(geam('GG001')),
    '841: doar 4 mm şlefuit / securizat');
  // OVI015 — float 4 mm NEsecurizat (userul, 2026-10-23): „nesecurizat" nu e „securizat"
  verifica(!!geam('OVI015') && p820(geam('OVI015')) && !p841(geam('OVI015')) && !geamPermisLux(geam('OVI015')),
    'OVI015: la 820 da, la 831/841/842 nu (nesecurizat), la LUX nu (transparent)');
  console.log('✓ rame: nr. de găuri obligatoriu (0 = fără), sticla permisă pe model (820: 4 mm; 831/841/842: 4 mm şlefuit / securizat)');
}

// UTIL Roma (userul, 2026-10-12): oglindă aplicată pe PAL — în necesarul clientului,
// înălţimea panoului × lăţimea PAL − 50 mm; doar pe panourile alese, doar la Roma.
{
  const { specUtil, clientPanelsUtil } = await import('../js/lib/util/util.js');
  const st = { height: 2400, width: 3000, doors: 2, finish: Object.keys(systems.utilRoma.meta.finishes ?? {})[0],
    divisions: [0, 1], hPanouri: [[], []], util: { orizontale: 'ambele' }, oglindaUtil: [[0], [1, 5]] };
  const s = specUtil('ROMA', st);
  const ogl = clientPanelsUtil(st, s).filter(r => /Oglindă/.test(r.label));
  const L = Math.round(s.panouL - 50);
  const asteptat = [[s.glass.panels[0].heights[0], 1], [s.glass.panels[1].heights[1], 1]];
  const ok = ogl.reduce((a, r) => a + r.qty, 0) === 2 && asteptat.every(([h]) => ogl.some(r => r.cut === `${Math.round(h)} × ${L} mm`));
  if (!ok) { console.error('✗ UTIL Roma oglindă:', JSON.stringify(ogl), L); process.exit(1); }
  const atena = specUtil('ATENA', st);
  if (clientPanelsUtil(st, atena).some(r => /Oglindă/.test(r.label))) { console.error('✗ oglinda apare şi la Atena'); process.exit(1); }
  console.log('✓ UTIL Roma: oglinda aplicată pe PAL în necesarul clientului (H panou × L PAL − 50), doar pe panourile alese');
}

// Suspendată Standard (userul, 2026-10-13): mascarea şinei la alegere — fără / faţă / faţă şi spate
// = 0 / 1 / 2 profile, pe lungimea şinei (= lăţimea golului), în facturare şi în necesar.
{
  const { billingLines } = await import('../js/lib/suspendata/billing.js');
  const sys = systems.suspendataStandard;
  const doua = x => [structuredClone(x), structuredClone(x)];
  const cate = mascare => {
    const st = { ...structuredClone(state), system: sys.meta.id, finish: 'SAMPANIE LUCIOS', width: 2100, height: 2400, doors: 2, mascare,
      divisions: [0, 0], panels: doua(['sticla']), hPanouri: doua([null]), divProfil: doua([]), assembly: ['client', 'client'],
      wheels: doua({ left: 'simpla', right: 'simpla' }), amortizare: doua({ left: 'fara', right: 'fara' }), geam: ['GG004', 'GG004'], geamClient: [4, 4],
      divAplicate: doua({ latime: 'fara', parte: 'fata', verticale: 0, orizontale: 0 }) };
    const s = sys.spec(st);
    const fact = billingLines(sys, st, s).lines.filter(l => l.cod === 'M205').reduce((a, l) => a + l.cantitate, 0);
    const nec = sys.bom(st, s).filter(r => /mascare/i.test(r.label)).reduce((a, r) => a + r.qty, 0);
    return [fact, nec];
  };
  const r = [0, 1, 2].map(cate);
  if (JSON.stringify(r) !== '[[0,0],[1,1],[2,2]]') { console.error('✗ Standard mascare (facturare, necesar) pt. fără/faţă/faţă şi spate:', JSON.stringify(r)); process.exit(1); }
  console.log('✓ Suspendată Standard: mascare şină fără / faţă / faţă şi spate = 0 / 1 / 2 profile (M205 la 2100 mm Şampanie)');
}

// ── Graniţele dintre familii ────────────────────────────────────────────────
// Codul unei familii (lib/<familie>/ + systems/<prefix>_*.js) importă doar din
// folderul ei, din lib/comun/, din catalog şi din three — niciodată din altă
// familie. lib/comun/ nu importă din nicio familie. Aşa o schimbare la Confort
// nu poate atinge suspendatele sau ramele, şi invers.
const JS = new URL('../js/', import.meta.url);
const FAMILII = { suspendata: 'suspendata_', confort: 'confort_', rame: 'rama_', util: 'util_', lux: 'lux_' };
const incalcari = [];

function verificaImporturi(fisier, permise) {
  const src = fs.readFileSync(new URL(fisier, JS), 'utf8');
  for (const [, spec] of src.matchAll(/^\s*(?:import|export)\b[^'"]*?from\s+['"]([^'"]+)['"]/gm)) {
    if (!spec.startsWith('.')) continue;                         // three, jsbarcode
    const tinta = new URL(spec, new URL(fisier, JS)).href.slice(JS.href.length);
    if (!permise.some(p => tinta.startsWith(p))) incalcari.push(`${fisier} → ${tinta}`);
  }
}

for (const [fam, prefix] of Object.entries(FAMILII)) {
  const permise = [`lib/${fam}/`, 'lib/comun/', 'catalog/'];
  for (const f of fs.readdirSync(new URL(`lib/${fam}/`, JS))) verificaImporturi(`lib/${fam}/${f}`, permise);
  for (const f of fs.readdirSync(new URL('systems/', JS)).filter(f => f.startsWith(prefix))) verificaImporturi(`systems/${f}`, permise);
}
for (const f of fs.readdirSync(new URL('lib/comun/', JS))) verificaImporturi(`lib/comun/${f}`, ['lib/comun/', 'catalog/']);

// ── Comparare / actualizare ─────────────────────────────────────────────────
let cazut = false;

if (incalcari.length) {
  cazut = true;
  console.log(`✗ graniţe între familii: ${incalcari.length} importuri interzise`);
  for (const x of incalcari) console.log(`    ${x}`);
} else {
  console.log('✓ graniţe între familii: suspendata / confort / rame / util / lux nu importă una din alta');
}

if (actualizeaza || !fs.existsSync(FISIER)) {
  fs.writeFileSync(FISIER, JSON.stringify(rezultate, null, 1) + '\n');
  console.log(`Referinţă scrisă: ${nrCazuri} configuraţii → test/referinta.json`);
} else {
  const ref = JSON.parse(fs.readFileSync(FISIER, 'utf8'));
  const chei = new Set([...Object.keys(ref), ...Object.keys(rezultate)]);
  const diferite = [];
  for (const k of chei) {
    const a = ref[k], b = rezultate[k];
    if (!a || !b) { diferite.push({ k, lipsa: !a ? 'nou' : 'dispărut' }); continue; }
    const sa = new Set(a), sb = new Set(b);
    const minus = a.filter(x => !sb.has(x)), plus = b.filter(x => !sa.has(x));
    if (minus.length || plus.length || a.length !== b.length) diferite.push({ k, minus, plus });
  }
  if (diferite.length) {
    cazut = true;
    console.log(`✗ ${diferite.length} din ${chei.size} configuraţii diferă de referinţă:`);
    for (const d of diferite.slice(0, 15)) {
      console.log(`  ${d.k}${d.lipsa ? ` — ${d.lipsa}` : ''}`);
      for (const x of d.minus ?? []) console.log(`      - ${x}`);
      for (const x of d.plus ?? [])  console.log(`      + ${x}`);
    }
    if (diferite.length > 15) console.log(`  … şi încă ${diferite.length - 15}`);
  } else {
    console.log(`✓ ${nrCazuri} configuraţii identice cu referinţa`);
  }
}

// statistici utile: câte configuraţii au erori (arătate userului în UI)
const cuErori = Object.entries(rezultate).filter(([, r]) => r.some(x => x.startsWith('E '))).length;
console.log(`  (${cuErori} configuraţii au erori afişate în UI — incluse în referinţă)`);

if (probleme.length) {
  cazut = true;
  const tipuri = {};
  for (const p of probleme) { const t = p.split(': ').slice(1).join(': ').replace(/[\d.]+/g, '#'); tipuri[t] = (tipuri[t] ?? 0) + 1; }
  console.log(`✗ integritate facturare: ${probleme.length} probleme`);
  for (const p of probleme.slice(0, 10)) console.log(`    ${p}`);
  console.log('  pe tipuri:', tipuri);
} else {
  console.log('✓ integritate facturare: toate liniile au cod real şi cantităţi curate');
}

// Codurile scrise direct în program (nu în catalog) — de confruntat cu NeoManager
if (process.argv.includes('--coduri-fixe')) {
  console.log('Coduri facturate care nu vin din catalog:');
  for (const [cod, fam] of [...coduriFixe].sort()) console.log(`  ${cod}  (${[...fam].join(', ')})`);
}

process.exit(cazut ? 1 : 0);
