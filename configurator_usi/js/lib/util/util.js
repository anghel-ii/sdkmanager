import catalog from '../../catalog/catalog.generated.json';

// ═══════════════════════════════════════════════════════════════════════════
//  UTIL — uşi culisante din profile (Atena, Roma, Soft), gama „util".
//  Totul de aici e citit din „Calculator profile UTIL 15.09.xlsm" (2026-09-24):
//  foaia UTIL (formule), foaia ascunsă Sheet1 (coduri, deduceri, tabelul de
//  suprapuneri) şi macro-ul de pe foaie (Soft doar în Aluminiu/Şampanie).
//
//  Noi vindem profilele + accesoriile; panoul (doar PAL 18, la toate modelele) şi-l
//  procură clientul — îi dăm doar cotele. Divizările H, înălţimile panourilor şi
//  divizările aplicate sunt pe uşă; orizontalele U — comutator comun; amortizările de mână.
// ═══════════════════════════════════════════════════════════════════════════

// ── Modele (Sheet1 I10:P12) — deduceri în mm ────────────────────────────────
//   adaos     lăţimea uşii = (L gol + adaos × nr. suprapuneri − 5) / nr. uşi
//   panouH    panoul 18 = înălţimea uşii + panouH (lăţimea: uşa − 6 la toate)
//   orizontal orizontala U / divizarea H = trunchiat(lăţimea uşii + orizontal)
export const MODELE_UTIL = {
  ATENA: { adaos: 32, panouH: -2, orizontal: -33 },
  ROMA:  { adaos: 29, panouH:  0, orizontal: -48 },
  SOFT:  { adaos: 19, panouH: -2, orizontal: -33 },
};
const SCADERE_H_USA = 38;
const SCADERE_L_PANOU = 6;

// Nr. de suprapuneri după nr. de uşi (Sheet1 L1:M6). Mereu şină dublă.
export const SUPRAPUNERI_UTIL = { 2: 1, 3: 2, 4: 2, 5: 4, 6: 4, 7: 5 };
export const USI_UTIL = [2, 7];

// ── Culori (validarea din UTIL!D1 + macro-ul: Soft doar Aluminiu/Şampanie) ──
const CULORI = {
  'ALUMINIU':  { label: 'Aluminiu',  hex: '#c4c8ca' },
  'SAMPANIE':  { label: 'Șampanie',  hex: '#cabb92' },
  'ALB MAT':   { label: 'Alb mat',   hex: '#eceeef' },
  'NEGRU MAT': { label: 'Negru periat', hex: '#2a2a2c' },   // aşa în NeoManager (codurile 330–335)
};
export const finisajeUtil = model =>
  (model === 'SOFT' ? ['ALUMINIU', 'SAMPANIE'] : Object.keys(CULORI))
    .map(id => ({ id, ...CULORI[id] }));

// Opţiunea comună tuturor uşilor: profilul orizontal U (comutatorul din bara
// laterală). Pe UŞĂ, în aceleaşi câmpuri ca la Confort: montajul (state.assembly,
// implicit 'client'), amortizările stânga/dreapta (state.amortizare: 'fara' |
// '35kg'), divizările H, înălţimile panourilor şi divizările aplicate.
export const ORIZONTALE_U = [['fara', 'Fără'], ['sus', 'Sus'], ['jos', 'Jos'], ['ambele', 'Sus şi jos']];
const U_PE_USA = { fara: 0, sus: 1, jos: 1, ambele: 2 };
export const stareUtilGoala = () => ({ orizontale: 'ambele' });

// ── Catalog ─────────────────────────────────────────────────────────────────
const articole = catalog.util ?? [];
const gaseste = (tip, finisaj = null) =>
  articole.find(a => a.tip === tip && (a.finisaj == null || a.finisaj === finisaj)) ?? null;

// Rotunjiri — întâi se taie zgomotul de virgulă mobilă sub 1e-6, altfel
// 2,5000000001 ml ar urca la 3.
const curat = x => Math.round(x * 1e6) / 1e6;
const ceilHalf = x => Math.ceil(curat(x) / 0.5) * 0.5;

// Şina se facturează ca fracţiune de bară, după lungime (UTIL!D31: 0,35 / 0,52 / 0,69 / 1).
const SINA_TREPTE = [[2000, 0.35], [3000, 0.52], [4000, 0.69], [5800, 1]];
const fractieSina = L => SINA_TREPTE.find(([max]) => L <= max)?.[1] ?? null;
// Orizontalele U şi divizările H: jumătăţi de bară de 5800 (UTIL!D39: ROUNDUP(total / 2900) × 0,5).
const JUMATATE_BARA_MM = 2900;

const intreg = v => Math.max(0, Math.round(+v || 0));

// Excel (notele de sub cote): panoul are formula cu ambele orizontale U; „fără
// profile orizontale U se adaugă 2 mm" şi „pt. fiecare profil de divizare H se
// scade 1 mm din înălţime". Cu un singur U (doar sus / doar jos): +1 mm
// (confirmat de user, 2026-09-24).
const DEDUCERE_H = 1;

// Înălţimile panourilor unei uşi, de JOS în SUS (ca la Confort): cele fixate de
// user rămân, cele automate împart egal ce rămâne din stivă.
function panouriUsa(stiva, panes, fixe) {
  const eFix = k => Number.isFinite(fixe?.[k]) && fixe[k] > 0;
  const idx = [...Array(panes).keys()];
  const sumaFixe = idx.reduce((a, k) => a + (eFix(k) ? fixe[k] : 0), 0);
  const libere = idx.filter(k => !eFix(k)).length;
  const hLiber = libere ? (stiva - sumaFixe) / libere : 0;
  let eroare = null;
  if (libere && !(hLiber > 0)) {
    eroare = `panourile introduse depăşesc uşa — mai rămân ${Math.round(stiva - sumaFixe)} mm pt. ${libere} panou(ri)`;
  } else if (!libere && Math.abs(stiva - sumaFixe) >= 0.5) {
    eroare = `suma panourilor e ${Math.round(sumaFixe)} mm, trebuie ${Math.round(stiva)} mm (diferenţă ${Math.round(sumaFixe) - Math.round(stiva)} mm)`;
  }
  // Panourile automate sunt EGALE între ele (userul) şi în milimetri întregi,
  // tăiaţi în jos (1179,5 → 1179 — ca TRUNC din Excel la orizontale): se pot
  // debita, nu ies mai mari decât încape, iar diferenţa de 1–2 mm dată de
  // orizontalul U se vede (rotunjirea la afişare o ascundea).
  const auto = Math.floor(hLiber);
  return { heights: idx.map(k => Math.max(0, eFix(k) ? fixe[k] : auto)), stiva, eroare };
}

// ── Spec ────────────────────────────────────────────────────────────────────
export function specUtil(model, state) {
  const m = MODELE_UTIL[model];
  const u = { ...stareUtilGoala(), ...(state.util ?? {}) };
  const n = Math.min(USI_UTIL[1], Math.max(USI_UTIL[0], state.doors || USI_UTIL[0]));
  const supr = SUPRAPUNERI_UTIL[n];
  const H = state.height, L = state.width;

  const doorH = H - SCADERE_H_USA;
  const doorW = (L + m.adaos * supr - 5) / n;          // exact; afişat rotunjit (format „0" în Excel)
  const uPeUsa = U_PE_USA[u.orizontale] ?? 2;
  const panouH = doorH + m.panouH + (2 - uPeUsa);       // panoul întreg, fără divizări
  const panouL = doorW - SCADERE_L_PANOU;
  const lungOrizontal = Math.trunc(doorW + m.orizontal);

  // Panourile fiecărei uşi (aceeaşi formă ca spec.glass la Confort — o citesc
  // opţiunile avansate din UI şi blocarea facturării la cote greşite).
  const panels = Array.from({ length: n }, (_, i) => {
    const divisions = intreg(state.divisions?.[i]);
    return { divisions, panes: divisions + 1,
             ...panouriUsa(panouH - divisions * DEDUCERE_H, divisions + 1, state.hPanouri?.[i]) };
  });

  const usi = [...Array(n).keys()];
  const nrU = n * uPeUsa, nrH = panels.reduce((a, p) => a + p.divisions, 0);
  // amortizări: o bucată pe fiecare parte aleasă (2 buc = 1 set, codul 341)
  const nrAmort = usi.reduce((a, i) => a + ['left', 'right'].filter(p => state.amortizare?.[i]?.[p] === '35kg').length, 0);
  const nrNoi = usi.filter(i => state.assembly?.[i] === 'noi').length;   // uşi asamblate de noi → manoperă

  const erori = [];
  if (!CULORI[state.finish]) erori.push('alege culoarea');
  if (!(state.doors >= USI_UTIL[0])) erori.push('alege nr. de uşi');
  if (fractieSina(L) == null) erori.push(`lăţimea golului ${L} mm depăşeşte 5800 mm (nu există şină)`);

  const r = Math.round;
  return {
    model, m, n, supr, doorH, doorW, panouH, panouL, lungOrizontal, uPeUsa, nrU, nrH, nrAmort, nrNoi, erori,
    glass: { panels },
    opening: { w: L, h: H },
    door:    { w: r(doorW), h: doorH, count: n },
    summary: [
      { label: 'Nr. uşi / suprapuneri', value: `${n} / ${supr}` },
      { label: 'Uşă (H × L)',           value: `${doorH} × ${r(doorW)} mm` },
      { label: 'PAL 18 (fără divizări)', value: `${r(panouH)} × ${r(panouL)} mm` },
      { label: 'Orizontală U / div. H', value: `${lungOrizontal} mm` },
    ],
  };
}

// ── Necesar atelier (UTIL!A16:H27) ──────────────────────────────────────────
// Profilul mâner: 2 pe uşă (stânga + dreapta) — aşa se socoteşte şi peria
// laterală în Excel (înălţimea uşii × 2 × nr. uşi).
const line = (code, label, qty, unit, cut) => ({ code, label, qty, unit, cut });

export function bomUtil(state, s) {
  const f = state.finish;
  const cod = (tip, fin = f) => gaseste(tip, fin)?.cod ?? '⚠ LIPSĂ COD';
  const den = (tip, rezerva, fin = f) => gaseste(tip, fin)?.denumire ?? rezerva;
  const rows = [
    line(cod('sina superioara'), den('sina superioara', 'SINA DUBLA SUPERIOARA'), 1, 'buc', `${s.opening.w} mm`),
    line(cod('sina inferioara'), den('sina inferioara', 'SINA DUBLA INFERIOARA'), 1, 'buc', `${s.opening.w} mm`),
    line(cod(`maner vertical ${s.model}`), den(`maner vertical ${s.model}`, 'PROFIL MANER VERTICAL'), 2 * s.n, 'buc', `${s.doorH} mm`),
  ];
  if (s.nrU) rows.push(line(cod('orizontal U'), den('orizontal U', 'ORIZONTALE JOS/SUS TIP "U"'), s.nrU, 'buc', `${s.lungOrizontal} mm`));
  if (s.nrH) rows.push(line(cod('divizare H'), den('divizare H', 'PROFIL DIVIZARE TIP "H"'), s.nrH, 'buc', `${s.lungOrizontal} mm`));
  const acc = (tip, qty, unit) => { if (qty > 0) rows.push(line(cod(tip, null), den(tip, tip, null), qty, unit, null)); };
  acc('rotile inferioare', 2 * s.n, 'buc');
  acc('rotile superioare', 2 * s.n, 'buc');
  acc('perie laterala', ceilHalf(s.doorH * 2 / 1000 * s.n), 'ml');
  acc('perie spate', ceilHalf(s.doorH * s.supr / 1000), 'ml');
  acc('opritor', s.n, 'buc');
  acc('amortizare', s.nrAmort, 'buc');
  for (const latime of ['10', '20']) {
    const { nr, preaLungi } = bareAplicate(s, state, latime);
    if (nr) rows.push(line(cod(`divizare aplicata ${latime}`), den(`divizare aplicata ${latime}`, `Divizare aplicata ${latime}`), nr, 'bară', null));
    [...new Set(preaLungi)].forEach(L => rows.push(line('⚠', `Divizare aplicată ${latime}mm: o bucată de ${L} mm e mai lungă decât bara de ${BARA_APLICATA_MM} mm`, '', '')));
  }
  return rows;
}

// ── Divizări APLICATE — aceleaşi reguli ca la Confort (benzi lipite pe panou):
// verticalele întregi = înălţimea panoului; orizontalele tăiate în (V+1) bucăţi
// = lăţimea panoului / (V+1); „faţă şi spate" ×2. Bucăţile se aşază pe bare de
// 3 m (First Fit Decreasing), separat 10 / 20 mm, pe toată comanda.
// La UTIL benzile se pun DOAR pe faţă (userul) — alegerea faţă/spate nu există.
// Lăţimea = panoul de PAL 18.
const BARA_APLICATA_MM = 3000;

function segmenteAplicate(s, state, latime) {
  const out = [];
  s.glass.panels.forEach((p, i) => {
    const da = state.divAplicate?.[i];
    if (!da || da.latime !== latime) return;
    const V = da.verticale ?? 0, O = da.orizontale ?? 0;
    for (const h of p.heights) {
      for (let v = 0; v < V; v++) out.push(Math.round(h));
      for (let o = 0; o < O * (V + 1); o++) out.push(Math.round(s.panouL / (V + 1)));
    }
  });
  return out.filter(L => L > 0);
}

function bareAplicate(s, state, latime) {
  const bare = [], preaLungi = [];
  for (const L of segmenteAplicate(s, state, latime).sort((a, b) => b - a)) {
    if (L > BARA_APLICATA_MM) { preaLungi.push(L); continue; }
    const loc = bare.findIndex(rest => rest >= L);
    if (loc >= 0) bare[loc] -= L; else bare.push(BARA_APLICATA_MM - L);
  }
  // bucăţile mai lungi de 3 m se numără ca nr. de bare întregi din care ar ieşi
  return { nr: bare.length + preaLungi.reduce((a, L) => a + Math.ceil(L / BARA_APLICATA_MM), 0), preaLungi };
}

// Cotele panourilor de PAL 18 pe care şi le ia clientul (UTIL = doar PAL), grupate pe cotă.
export function clientPanelsUtil(state, s) {
  const m = new Map();
  for (const p of s.glass.panels) for (const h of p.heights) {
    const cut = `${Math.round(h)} × ${Math.round(s.panouL)} mm`;
    m.set(cut, (m.get(cut) ?? 0) + 1);
  }
  return [...m].map(([cut, qty]) => ({ label: 'Panou PAL 18 mm', qty, unit: 'buc', cut }));
}

// ── Facturare NeoManager (UTIL!A30:D41, în aceeaşi ordine) ─────────────────
export function facturareUtil(state, s) {
  const lines = [];
  const errors = [...s.erori];
  const add = (tip, cantitate, fin = state.finish) => {
    if (!(cantitate > 0)) return;
    const a = gaseste(tip, fin);
    if (!a) { errors.push(`lipsă cod: ${tip} ${fin ?? ''}`.trim()); return; }
    lines.push({ cod: a.cod, denumire: a.denumire, um: a.um, cantitate: curat(cantitate) });
  };
  if (errors.length) return { lines, errors };

  const sina = fractieSina(s.opening.w);
  const bareOrizontal = nr => Math.ceil(curat(s.lungOrizontal * nr / JUMATATE_BARA_MM)) * 0.5;

  add('sina superioara', sina);
  add('sina inferioara', sina);
  add(`maner vertical ${s.model}`, s.n);
  add('rotile inferioare', 2 * s.n, null);
  add('rotile superioare', 2 * s.n, null);
  add('perie laterala', ceilHalf(s.doorH * 2 / 1000 * s.n), null);
  add('opritor', s.n, null);
  add('amortizare', s.nrAmort / 2, null);
  add('orizontal U', bareOrizontal(s.nrU));
  add('divizare H', bareOrizontal(s.nrH));
  add('perie spate', ceilHalf(s.doorH * s.supr / 1000), null);
  add('divizare aplicata 10', bareAplicate(s, state, '10').nr);
  add('divizare aplicata 20', bareAplicate(s, state, '20').nr);
  add('manopera', s.nrNoi, null);   // Manopera 1 × uşile asamblate de noi
  return { lines, errors };
}

// ── Randare 3D — şinele + uşile pe cele două piste ─────────────────────────
// Suprapunerile se pun între uşi pe piste diferite; când sunt mai puţine
// suprapuneri decât îmbinări (4, 6, 7 uşi), îmbinarea rămasă e cap la cap, în
// mijloc, între două uşi de pe aceeaşi pistă. Cotele profilelor sunt doar vizuale.
const INALT_U = 20, INALT_SINA = 40, PISTA = 45, GROS_H = 12, GROS_BANDA = 1.4;

// ── Secţiunea profilului mâner (vertical), desenată după schiţele din Excel ──
// APROXIMATIVĂ (userul, 2026-09-24: „aproximez din schiţe") — doar pt. 3D, nu
// intră în nicio cotă. Coordonate în mm: u = de la muchia uşii spre interior,
// z = adâncime (+ = faţă). Panoul de 18 mm intră în canal între z = ±9.5, pe
// ambele feţe îl ţin aripile profilului. Lăţimea profilului = adaosul de
// suprapunere al modelului (Atena 32, Roma 29, Soft 19). De înlocuit cu
// secţiunile exacte când există desenele furnizorului.
const SPATE = [[0, -13], [18, -13], [18, -9.5], [3, -9.5], [3, 9.5]];   // perete + aripa din spate
const SECTIUNI = {
  // mânerul „val": aripa din faţă se îngroaşă spre interior, cu vârf rotunjit
  ATENA: (W, S) => { S.lineTo(W, 9.5); S.lineTo(W, 14); S.quadraticCurveTo(W, 22, W - 6, 22); S.quadraticCurveTo(12, 21, 0, 13); },
  // cameră pătrată la muchie + cârlig în trepte la capătul din interior
  ROMA:  (W, S) => { S.lineTo(W, 9.5); S.lineTo(W, 22); S.lineTo(W - 4, 22); S.lineTo(W - 4, 13); S.lineTo(11, 13); S.lineTo(11, 24); S.lineTo(0, 24); },
  // bulb rotund pe gât, la capătul din interior al aripii din faţă
  SOFT:  (W, S) => {
    S.lineTo(W, 9.5); S.lineTo(W, 11.5); S.lineTo(W - 1.5, 11.5); S.lineTo(W - 1.5, 15);
    S.absarc(W - 3.25, 19, 5, -1.16, 4.3, false);
    S.lineTo(W - 5, 11.5); S.lineTo(0, 11.5);
  },
};
function profilManer(THREE, mm, model, W, H, semn) {
  // semn = +1 profilul din stânga uşii (spre dreapta intră panoul), −1 cel din dreapta
  const S = new THREE.Shape();
  const P = (u, z) => [mm(semn * u), mm(z)];
  const lineTo = S.lineTo.bind(S), q = S.quadraticCurveTo.bind(S), arc = S.absarc.bind(S);
  S.moveTo(...P(...SPATE[0]));
  SPATE.slice(1).forEach(p => lineTo(...P(...p)));
  SECTIUNI[model](W, {
    lineTo: (u, z) => lineTo(...P(u, z)),
    quadraticCurveTo: (cu, cz, u, z) => q(...P(cu, cz), ...P(u, z)),
    // oglindit, arcul se parcurge în sens invers (unghiurile se reflectă faţă de verticală)
    absarc: (cu, cz, r, a0, a1, cw) => arc(...P(cu, cz), mm(r), semn > 0 ? a0 : Math.PI - a0, semn > 0 ? a1 : Math.PI - a1, semn > 0 ? cw : !cw),
  });
  const g = new THREE.ExtrudeGeometry(S, { depth: mm(H), bevelEnabled: false, curveSegments: 10 });
  g.rotateX(Math.PI / 2);   // extrudarea (pe Z) devine verticală: de la y = 0 în jos până la −H; secţiunea ajunge în planul XZ
  return g;
}

export function buildUtil(group, state, s, { THREE, box, mm, aluColor }) {
  const u     = { ...stareUtilGoala(), ...(state.util ?? {}) };
  const alu   = new THREE.MeshStandardMaterial({ color: aluColor, metalness: 0.65, roughness: 0.35 });
  const panou = new THREE.MeshStandardMaterial({ color: 0xd9d2c5, roughness: 0.8 });
  const L = s.opening.w, H = s.opening.h;
  const add = (m, x, y, z) => { m.position.set(mm(x), mm(y), mm(z)); group.add(m); };

  // divizări aplicate pe faţa unui panou, ca la Confort: verticalele întregi,
  // orizontalele tăiate între ele, la distanţe egale
  const benzi = (da, w, h, cx, y0, z) => {
    if (!da || da.latime === 'fara') return;
    const lat = +da.latime, V = da.verticale ?? 0, O = da.orizontale ?? 0;
    const seg = (w - V * lat) / (V + 1);
    if (seg <= 0) return;
    for (let j = 1; j <= V; j++) add(box(mm(lat), mm(h), mm(GROS_BANDA), alu, { cast: false }), cx - w / 2 + j * seg + (j - 1) * lat + lat / 2, y0 + h / 2, z);
    for (let r = 1; r <= O; r++) for (let j = 0; j <= V; j++)
      add(box(mm(seg), mm(lat), mm(GROS_BANDA), alu, { cast: false }), cx - w / 2 + j * (seg + lat) + seg / 2, y0 + h * r / (O + 1), z);
  };

  add(box(mm(L), mm(INALT_SINA), mm(2 * PISTA + 10), alu), 0, H - INALT_SINA / 2, 0);   // şina de sus
  add(box(mm(L), mm(10), mm(2 * PISTA + 10), alu), 0, 5, 0);                            // şina de jos

  const cap = s.n - 1 - s.supr;                  // îmbinări cap la cap: 0 sau 1
  const capLa = cap ? Math.floor((s.n - 1) / 2) : -1;
  let x = -L / 2, pista = 0;
  const W = s.doorW, Hu = s.doorH, y0 = (H - Hu) / 2;
  const adaos = s.m.adaos;
  for (let i = 0; i < s.n; i++) {
    const cx = x + W / 2, z = pista ? -PISTA / 2 : PISTA / 2;
    // profilele mâner cu secţiunea lor (stânga şi dreapta, oglindite)
    add(new THREE.Mesh(profilManer(THREE, mm, s.model, adaos, Hu, 1), alu), cx - W / 2, y0 + Hu, z);
    add(new THREE.Mesh(profilManer(THREE, mm, s.model, adaos, Hu, -1), alu), cx + W / 2, y0 + Hu, z);
    const Wi = s.panouL;                           // panoul intră în canalele profilelor
    const sus = s.uPeUsa && u.orizontale !== 'jos', jos = s.uPeUsa && u.orizontale !== 'sus';
    if (sus) add(box(mm(s.lungOrizontal), mm(INALT_U), mm(23), alu), cx, y0 + Hu - INALT_U / 2, z);
    if (jos) add(box(mm(s.lungOrizontal), mm(INALT_U), mm(23), alu), cx, y0 + INALT_U / 2, z);
    // panourile proporţional cu înălţimile lor, cu bara H între ele (doar vizual)
    const p = s.glass.panels[i], hs = p.heights, total = hs.reduce((a, h) => a + h, 0) || 1;
    const jos0 = y0 + (jos ? INALT_U : 0), loc = Hu - (sus ? INALT_U : 0) - (jos ? INALT_U : 0) - p.divisions * GROS_H;
    let y = jos0;
    hs.forEach((h, k) => {
      const hp = loc * h / total;
      add(box(mm(Wi), mm(hp), mm(18), panou), cx, y + hp / 2, z);
      benzi(state.divAplicate?.[i], Wi, hp, cx, y, z + 9 + GROS_BANDA / 2);
      y += hp;
      if (k < hs.length - 1) { add(box(mm(s.lungOrizontal), mm(GROS_H), mm(22), alu), cx, y + GROS_H / 2, z); y += GROS_H; }
    });
    if (i === capLa) x += W;                     // cap la cap: aceeaşi pistă
    else { x += W - adaos; pista = 1 - pista; }
  }
}
