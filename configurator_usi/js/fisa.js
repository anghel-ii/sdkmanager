import { state } from './state.js';
import { acumRo } from './ora.js';
import { systems } from './systems/registry.js';
import { currentSpec, currentBom, currentBilling, currentClientPanels } from './builder.js';
import { finishesOf, familia } from './familii.js';
import { findGeam } from './lib/comun/geam.js';
import { suprapuneriEfective, PROFIL_H_3D } from './lib/confort/index.js';
import { ASAMBLARE, FARA_GAURIRE, MODELE_MANER, cotaGauri, schiteRame } from './lib/rame/rame.js';

// Rame pe care le asamblăm NOI şi au mâner: mânerul îl montăm tot noi — scris chiar în rândul
// „Asamblare" de pe faţa fişei: „NOI ASAMBLAM CU MANER L 40" (userul, 2026-10-21).
function asamblareRame(rame) {
  const text = ASAMBLARE.find(a => a[0] === rame.asamblare)?.[1] ?? '—';
  if (rame.asamblare !== 'noi') return text;
  const modele = new Set((rame.maner?.randuri ?? [])
    .filter(rd => +rd.lungime > 0 && +rd.buc > 0).map(rd => rd.model ?? rame.maner.model).filter(Boolean));
  return modele.size ? `${text} CU MANER ${[...modele].map(m => MODELE_MANER.find(([v]) => v === m)?.[1] ?? m).join(' + ')}` : text;
}
import { detaliiComanda, plataText, numarText } from './lib/comun/comanda.js';
import { stareOferta } from './manager.js';
import JsBarcode from 'jsbarcode';
import { arataPrevizualizare } from './previzualizare.js';
import { alerta } from './intrebari.js';

// ═══════════════════════════════════════════════════════════════════════════
//  FIŞĂ ATELIER — imprimabilă, pt. echipa care debitează/asamblează
//
//  Se scrie într-un CADRU ASCUNS din pagină (document.write) cu CSS de print
//  dedicat (fundal alb, text negru — tema întunecată a aplicaţiei ar irosi
//  cerneală şi ar arăta prost pe hârtie), apoi se deschide direct dialogul de
//  print. Nicio librărie de PDF: din dialog se alege „Salvează ca PDF" —
//  acelaşi principiu ca la foaia de comandă, păstrează proiectul fără
//  dependenţe noi de build.
//
//  Funcţionează ORICÂND — inclusiv configuratorul deschis de pe disc, fără
//  server. Nu ţine cont de starea ofertei (js/oferta.js).
//
//  Două pagini: faţa (cote, sticlă/PAL, necesar — pt. atelier) şi spatele
//  (facturarea — pt. birou/NeoManager — şi, la uşi, schiţele mari ale uşilor),
//  separate cu page-break, ca la printare faţă-verso spatele să cadă exact pe facturare.
// ═══════════════════════════════════════════════════════════════════════════

const esc = t => String(t ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const virgula = n => String(n).replace('.', ',');   // aceeaşi convenţie ca-n manager

// data de pe fişă — acelaşi format ca în manager: zz/ll/aaaa hh:mm, ora exactă a României (js/ora.js)
const acum = acumRo;

const amortizareLabel = v => (v === 'fara' || !v ? 'Fără' : v);

// Modelul de geam ales, per uşă — denumirea din catalog la uşile asamblate de
// NOI; la 'client', geamul nu circulă prin noi, contează doar grosimea
// declarată (vezi lib/<familie>/geam.js → glassPerDoor).
function geamModelLabel(i) {
  if (state.assembly?.[i] === 'client') return `Client (${state.geamClient?.[i] ?? 4}mm)`;
  const g = findGeam(state.geam?.[i]);
  return g ? g.denumire : (state.geam?.[i] ?? '—');
}

// ── Schiţele uşilor — pe VERSO, sub facturare, cât încap (userul, 2026-10-08: pe faţă
// erau înghesuite; acolo stă acum tabelul Sticlă / PAL). Alb-negru (tuşul color e
// scump), la scară: cotele uşii (L sus, H în stânga), pe fiecare panou PAL/OGL şi
// cota de debitare, divizările aplicate ca linii întrerupte (legenda sub desen);
// deasupra NOI / CLIENTUL, dedesubt geamul, amortizările, mânerul aplicat.
// SVG în mm reali (+ marginile cotelor şi, la bară H, eticheta „H" în dreapta).
const PARTE_TEXT = { fata: 'faţă', spate: 'spate', ambele: 'faţă + spate' };

// Cotele de gabarit ale uşii: L deasupra, H în stânga → { el, st, sus } (marginile lor)
function coteUsa(W, H, linie) {
  const f = Math.max(W, H) * 0.04, d = f * 1.5, tic = f * 0.35;
  const l = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="${linie * 0.6}"/>`;
  const xH = -d - f * 0.3;
  return {
    el: [l(0, -d, W, -d), l(0, -d - tic, 0, -d + tic), l(W, -d - tic, W, -d + tic),
      `<text x="${W / 2}" y="${-d - f * 0.3}" font-size="${f}" font-weight="700" text-anchor="middle">L ${Math.round(W)}</text>`,
      l(-d, 0, -d, H), l(-d - tic, 0, -d + tic, 0), l(-d - tic, H, -d + tic, H),
      `<text x="${xH}" y="${H / 2}" font-size="${f}" font-weight="700" text-anchor="middle" transform="rotate(-90 ${xH} ${H / 2})">H ${Math.round(H)}</text>`],
    st: d + f * 1.4, sus: d + f * 1.4,
  };
}

// Divizare aplicată = linie întreruptă, groasă cât banda (10 / 20 mm), ca s-o deosebeşti
// de profile (linii pline). Pe un panou, ca în 3D: verticalele pe toată înălţimea lui,
// orizontalele la distanţe egale.
const stilAplicata = (latime, linie) =>
  `stroke="#000" stroke-width="${Math.max(+latime, linie)}" stroke-dasharray="${linie * 5} ${linie * 3}"`;
function liniiAplicate(da, x, y, w, h, linie) {
  if (!da || da.latime === 'fara') return [];
  const V = da.verticale ?? 0, O = da.orizontale ?? 0, st = stilAplicata(da.latime, linie), el = [];
  for (let j = 1; j <= V; j++) { const xj = x + w * j / (V + 1); el.push(`<line x1="${xj}" y1="${y}" x2="${xj}" y2="${y + h}" ${st}/>`); }
  for (let k = 1; k <= O; k++) { const yk = y + h * k / (O + 1); el.push(`<line x1="${x}" y1="${yk}" x2="${x + w}" y2="${yk}" ${st}/>`); }
  return el;
}
// textul de pe panou, cu contur alb — rămâne citibil peste liniile aplicatelor
const textPanou = (x, y, font, t, bold = false) =>
  `<text x="${x}" y="${y}" font-size="${font}"${bold ? ' font-weight="700"' : ''} text-anchor="middle"
    paint-order="stroke" stroke="#fff" stroke-width="${font * 0.22}" stroke-linejoin="round">${t}</text>`;

// Pe ce parte are uşa amortizare — doar la uşile asamblate DE NOI (userul, 2026-10-02):
// Confort / UTIL = amortizările alese pe uşă; suspendate = rola cu amortizor.
function amortizareUsa(sys, i) {
  if (state.assembly?.[i] !== 'noi') return { st: false, dr: false };
  if (sys.meta.family === 'suspendata') {
    const w = state.wheels?.[i] ?? {};
    return { st: w.left === 'amortizor', dr: w.right === 'amortizor' };
  }
  const a = state.amortizare?.[i] ?? {};
  const are = v => !!v && v !== 'fara';
  return { st: are(a.left), dr: are(a.right) };
}

// Amortizarea pe desenul uşii: un pătrăţel cu X sus, în colţul părţii respective.
// `mont` / `sus` = lăţimea profilului vertical / de sus (semnul stă în dreptul lor).
function semneAmortizare(amort, W, H, mont, sus, linie) {
  const latura = Math.min(W, H) * 0.16, dist = mont * 0.5 + latura * 0.12, y0 = sus * 0.5 + latura * 0.15;
  const el = [];
  for (const [are, x0] of [[amort.st, dist], [amort.dr, W - dist - latura]]) {
    if (!are) continue;
    el.push(`<rect x="${x0}" y="${y0}" width="${latura}" height="${latura}" fill="#fff" stroke="#000" stroke-width="${linie * 1.5}"/>`,
      `<line x1="${x0}" y1="${y0}" x2="${x0 + latura}" y2="${y0 + latura}" stroke="#000" stroke-width="${linie * 1.5}"/>`,
      `<line x1="${x0 + latura}" y1="${y0}" x2="${x0}" y2="${y0 + latura}" stroke="#000" stroke-width="${linie * 1.5}"/>`);
  }
  return el;
}

// UTIL: desenul unei uşi asamblate de noi (userul, 2026-10-02 — „doar dacă montăm noi"):
// conturul, profilele mâner pe laturi, orizontalele U, panourile de PAL cu cotele lor
// (de jos în sus, ca în spec) şi divizările H dintre ele, plus semnul de amortizare.
const INALT_U_DESEN = 20, GROS_H_DESEN = 12;
function desenUtil(sys, spec, i) {
  const p = spec.glass.panels[i];
  const W = Math.round(spec.doorW), H = spec.doorH, mont = spec.m.adaos;
  const o = state.util?.orizontale ?? 'ambele';
  const sus = spec.uPeUsa && o !== 'jos' ? INALT_U_DESEN : 0, jos = spec.uPeUsa && o !== 'sus' ? INALT_U_DESEN : 0;
  const linie = Math.max(W, H) * 0.004;
  const cote = coteUsa(W, H, linie);
  const el = [...cote.el, `<rect x="${linie / 2}" y="${linie / 2}" width="${W - linie}" height="${H - linie}" fill="none" stroke="#000" stroke-width="${linie * 2}"/>`];
  const total = p.heights.reduce((a, h) => a + h, 0) || 1;
  const loc = H - sus - jos - p.divisions * GROS_H_DESEN;
  let y = H - jos;   // SVG: y în jos; panourile urcă de jos
  p.heights.forEach((h, k) => {
    const hp = loc * h / total;
    y -= hp;
    el.push(`<rect x="${mont}" y="${y}" width="${W - 2 * mont}" height="${hp}" fill="none" stroke="#000" stroke-width="${linie}"/>`,
      ...liniiAplicate(state.divAplicate?.[i], mont, y, W - 2 * mont, hp, linie));
    const font = Math.min((W - 2 * mont) * 0.15, hp * 0.26), cx = W / 2, cy = y + hp / 2;
    el.push(textPanou(cx, cy - font * 0.15, font, 'PAL', true),
      textPanou(cx, cy + font * 0.95, font * 0.8, `${Math.round(h)}×${Math.round(spec.panouL)}`));
    if (k < p.heights.length - 1) {
      y -= GROS_H_DESEN;
      el.push(`<line x1="${mont}" y1="${y + GROS_H_DESEN / 2}" x2="${W - mont}" y2="${y + GROS_H_DESEN / 2}" stroke="#000" stroke-width="${GROS_H_DESEN}"/>`);
    }
  });
  el.push(...semneAmortizare(amortizareUsa(sys, i), W, H, mont, sus, linie));
  const vbW = W + cote.st, vbH = H + cote.sus;
  return { svg: `<svg viewBox="${-cote.st} ${-cote.sus} ${vbW} ${vbH}">${el.join('')}</svg>`, raport: vbW / vbH };
}

function desenUsa(sys, spec, i, margH = 0) {
  const amort = amortizareUsa(sys, i);
  const p = spec.glass?.panels?.[i];
  if (!p?.heights) return { svg: '', raport: 0.5 };
  const W = spec.door.w, H = spec.door.h;
  const pr = sys.profiles;
  const mont = pr.montant.w, sus = pr.traversaSus.w, jos = pr.traversaJos.w;
  const innerW = W - 2 * mont;
  const slot = k => (p.profil[k] === 'H' ? PROFIL_H_3D.slot : pr.divizare.w);
  let sloturi = 0;
  for (let k = 0; k < p.profil.length; k++) sloturi += slot(k);
  const sumaH = p.heights.reduce((a, h) => a + h, 0) || 1;
  const hDesen = k => (H - sus - jos - sloturi) * p.heights[k] / sumaH;
  const Y = y => H - y;   // SVG are y în jos, uşa urcă de jos
  // Margine în dreapta pt. eticheta „H" — ACEEAŞI la toate uşile (primită de
  // la blocDesene), altfel uşile cu H ar ieşi mai mici în desen.
  const marg = margH;
  const linie = Math.max(W, H) * 0.004;
  const cote = coteUsa(W, H, linie);
  const el = [...cote.el];

  el.push(`<rect x="${linie / 2}" y="${linie / 2}" width="${W - linie}" height="${H - linie}" fill="none" stroke="#000" stroke-width="${linie * 2}"/>`);
  let y = jos;
  p.heights.forEach((_, k) => {
    const h = hDesen(k);
    const pal = p.mats[k] === 'pal';
    const latime = Math.round(pal ? spec.glass.palW : spec.glass.glassW);
    el.push(`<rect x="${mont}" y="${Y(y + h)}" width="${innerW}" height="${h}" fill="none" stroke="#000" stroke-width="${linie}"/>`,
      ...liniiAplicate(state.divAplicate?.[i], mont, Y(y + h), innerW, h, linie));
    const font = Math.min(innerW * 0.15, h * 0.26);
    const cx = mont + innerW / 2, cy = Y(y + h / 2);
    el.push(textPanou(cx, cy - font * 0.15, font, pal ? 'PAL' : 'OGL', true),
      textPanou(cx, cy + font * 0.95, font * 0.8, `${Math.round(p.heights[k])}×${latime}`));
    y += h;
    if (k < p.heights.length - 1) {
      const s = slot(k);
      if (p.profil[k] === 'H') {
        const c = y + s / 2;
        el.push(`<line x1="${mont}" y1="${Y(c)}" x2="${W - mont}" y2="${Y(c)}" stroke="#000" stroke-width="${PROFIL_H_3D.fata}"/>`);
        el.push(`<text x="${W + 18}" y="${Y(c) + 30}" font-size="90" font-weight="700">H</text>`);
      }
      // LUX: intermediarul ramei (sticlă–sticlă) are mereu o aplicată de 10 mm pe faţă — întreruptă
      // pe fond alb, altfel se pierde în chenarele panourilor de lângă
      if (p.profil[k] === 'R') {
        const yc = Y(y + s / 2), bara = st => `<line x1="${mont}" y1="${yc}" x2="${W - mont}" y2="${yc}" ${st}/>`;
        el.push(bara(`stroke="#fff" stroke-width="${s + linie * 2}"`), bara(stilAplicata(10, linie * 1.5)));
      }
      y += s;
    }
  });

  // desenat ultimul, peste geam
  el.push(...semneAmortizare(amort, W, H, mont, sus, linie));

  const vbW = W + cote.st + marg, vbH = H + cote.sus;
  return {
    svg: `<svg viewBox="${-cote.st} ${-cote.sus} ${vbW} ${vbH}">${el.join('')}</svg>`,
    raport: vbW / vbH,
  };
}

const rolaLabel = v => (v === 'amortizor' ? 'amortizor' : 'simplă');

function textSubDesen(sys, spec, i) {
  const a  = state.amortizare?.[i] ?? {};
  const w  = state.wheels?.[i] ?? {};
  const da = state.divAplicate?.[i];
  const areSticla = (state.panels?.[i] ?? []).some(m => m !== 'pal');
  const randuri = [
    ...(sys.meta.family === 'util' ? [] : [['Geam', areSticla ? geamModelLabel(i) : '—']]),
    // Confort / UTIL: amortizări; suspendate: rolele alese pe fiecare parte
    sys.meta.family !== 'suspendata'
      ? ['Amortizare', `St ${amortizareLabel(a.left)} · Dr ${amortizareLabel(a.right)}`]
      : ['Role', `St ${rolaLabel(w.left)} · Dr ${rolaLabel(w.right)}`],
    // LUX: mânerul aplicat
    ...(state.manerAplicat?.[i] && state.manerAplicat[i] !== 'fara'
      ? [['Mâner aplicat', { stanga: 'stânga', dreapta: 'dreapta', ambele: 'stânga şi dreapta' }[state.manerAplicat[i]]]] : []),
  ];
  // legenda liniilor întrerupte: aplicatele alese + (LUX) cea de 10 mm de pe intermediari
  const mostra = '<svg class="mostra" viewBox="0 0 24 4"><line x1="0" y1="2" x2="24" y2="2" stroke="#000" stroke-width="2.4" stroke-dasharray="5 3"/></svg>';
  const aplicate = [
    ...(da && da.latime !== 'fara'
      ? [`${da.latime} mm ${PARTE_TEXT[da.parte] ?? da.parte} · ${da.verticale ?? 0} vert. × ${da.orizontale ?? 0} oriz. / panou`] : []),
    ...((spec.glass?.panels?.[i]?.profil ?? []).includes('R') ? ['10 mm faţă pe intermediar'] : []),
  ];
  return randuri.map(([e, v]) => `<div class="sub-rand"><span class="sub-et">${e}:</span> ${esc(v)}</div>`).join('')
    + aplicate.map(t => `<div class="sub-rand">${mostra} <span class="sub-et">Aplicată:</span> ${esc(t)}</div>`).join('');
}

// `usi` = ce uşi se desenează (indicii lor; implicit toate), `desen(i)` = desenul uneia
function blocDesene(sys, spec, usi = [...Array(spec.door.count || 0).keys()], desen = null) {
  if (!usi.length) return '';
  const margH = (spec.glass?.panels ?? []).some(p => p.profil?.includes('H')) ? 110 : 0;
  // uşile identice (acelaşi desen, cine asamblează, aceleaşi detalii) — o singură schiţă,
  // cu nr. uşilor şi bucăţile deasupra (userul, 2026-10-08)
  const grupuri = new Map();
  for (const i of usi) {
    const { svg, raport } = desen ? desen(i) : desenUsa(sys, spec, i, margH);
    const cine = state.assembly?.[i] === 'client' ? 'CLIENTUL ASAMBLEAZĂ' : 'NOI ASAMBLĂM';
    const sub = textSubDesen(sys, spec, i);
    const cheie = cine + svg + sub;
    if (grupuri.has(cheie)) grupuri.get(cheie).usi.push(i + 1);
    else grupuri.set(cheie, { usi: [i + 1], svg, raport, cine, sub });
  }
  const coloane = [...grupuri.values()].map(g => `
      <div class="usa-col" style="--r:${g.raport.toFixed(4)}">
        <div class="usa-cap"><span class="usa-nr">${g.usi.length > 1 ? `Uşile ${g.usi.join(', ')} — <b>${g.usi.length} buc</b>` : `Uşa ${g.usi[0]}`}</span>
          <span class="usa-cine">${g.cine}</span></div>
        ${g.svg}
        <div class="usa-sub">${g.sub}</div>
      </div>`).join('');
  return `<div class="desene" style="--n:${Math.min(grupuri.size, 4)}">${coloane}</div>`;   // max. 4 pe rând — mai puţin înghesuite
}

// Sub schiţe: ce înseamnă X-ul din colţ şi periile uşilor (userul, 2026-10-08).
// Peria laterală — la fiecare uşă, pe ambele laturi (2 × înălţimea uşii, la toate gamele).
// Peria spate — doar unde se facturează (Verona / Atrani, LUX, UTIL): o bucată cât uşa la
// fiecare suprapunere, pe uşile din FAŢĂ, pe marginea care se suprapune; care uşi stau în
// faţă nu se ştie dinainte (montajul e liber).
const ICON_AMORTIZARE = '<svg class="ic" viewBox="0 0 10 10"><rect x=".5" y=".5" width="9" height="9" fill="#fff" stroke="#000"/><path d="M.5 .5l9 9M9.5 .5l-9 9" stroke="#000"/></svg>';
function notaSchite(sys, spec, factura) {
  const usi = [...Array(spec.door?.count ?? spec.n ?? 0).keys()];
  const H = spec.door?.h ?? spec.doorH;
  const supr = sys.meta.family === 'util' ? spec.supr
    : sys.meta.family === 'lux' ? familia(sys).suprapuneriLux(usi.length)
    : sys.meta.doorsRange ? suprapuneriEfective(state.doors, sys.meta.suprapuneriObligatorii ? 2 : state.tracks) : 0;
  const perieSpate = supr > 0 && factura.lines.some(l => /perie spate/i.test(l.denumire ?? ''));
  const randuri = [
    ...(usi.some(i => { const a = amortizareUsa(sys, i); return a.st || a.dr; })
      ? [`${ICON_AMORTIZARE} <b>Amortizare</b> — pe partea marcată (sus, în colţ)`] : []),
    `<b>Perie laterală</b> — la fiecare uşă, stânga + dreapta (${usi.length * 2} buc × ${Math.round(H)} mm)`,
    ...(perieSpate ? [`<b>Perie spate</b> — ${supr} buc × ${Math.round(H)} mm, pe uşile din faţă, pe marginea care se suprapune`] : []),
  ];
  return `<div class="nota-schite">${randuri.map(r => `<div>${r}</div>`).join('')}</div>`;
}

// ── Debitare rame — toate laturile din profilul modelului; EXCEPŢIE 842: doar
// O verticală / ramă e profil 842, cealaltă verticală şi cele 2 orizontale se
// taie din profil 841 (userul, 2026-09-21).
// Cotele = exact cotele ramei (tăiere la 45°, ca la toate ramele — nu se scrie).
// Două secţiuni, fiecare cu schiţa profilului în miniatură în stânga.
function debitareRame(spec) {
  const grupeaza = (cheie, fact) => {
    const m = new Map();
    for (const x of spec.pline) m.set(x[cheie], (m.get(x[cheie]) ?? 0) + fact * x.buc);
    return [...m].sort((a, b) => b[0] - a[0]);
  };
  const e842 = spec.model === '842';
  const vert = grupeaza('h', e842 ? 1 : 2), oriz = grupeaza('l', 2);
  if (!vert.length) return '';
  const img = model => new URL(`assets/rama_${model}.jpeg`, location.href).href;
  const randuri = (et, lista) => lista.map(([mm, buc]) =>
    `<tr><td class="deb-et">${et}</td><td class="deb-mm">${mm} mm</td><td class="deb-buc">${buc} buc</td><td class="bifa"></td></tr>`).join('');
  const sectiune = (model, corp) => `
    <div class="deb-sectiune">
      <img class="deb-schita" src="${img(model)}" alt="Profil ${model}">
      <table class="deb-tabel"><tbody>${corp}</tbody></table>
    </div>`;
  // găurile de balama (820/822/824) — înainte erau pe desene
  const cuGauri = spec.m.grup === '820';
  // deasupra: ramele comenzii, câte una pe rând, cu cotele sticlei alături
  const rame = `
    <table class="deb-rame">
      <thead><tr><th>Rândul</th><th>Ramă H × L</th><th>Bucăţi</th>${cuGauri ? '<th>Găuri</th>' : ''}<th>Sticlă H × L</th><th>✓</th></tr></thead>
      <tbody>${spec.pline.map(x => `<tr><td>${x.i + 1}</td><td class="deb-mm">${x.h} × ${x.l} mm</td>
        <td class="deb-buc">${x.buc} buc</td>${cuGauri ? `<td class="deb-buc">${x.gauri}</td>` : ''}
        <td class="deb-mm">${x.geamH} × ${x.geamL} mm</td><td class="bifa"></td></tr>`).join('')}</tbody>
    </table>`;
  return `<div class="debitare-rame">
    <div class="deb-sus">${rame}</div>
    ${e842
      ? sectiune('842', randuri('VERTICALA 842', vert)) +
        sectiune('841', randuri('VERTICALA 841', vert) + randuri('ORIZONTALA 841', oriz))
      : sectiune(spec.model, randuri(`VERTICALA ${spec.model}`, vert) + randuri(`ORIZONTALA ${spec.model}`, oriz))}
  </div>`;
}

// Rame: etapele din atelier + semnătura colegului — în capul fişei, în dreapta,
// sub client (userul, 2026-10-02: „vine mai sus"; înainte stătea lângă tabelul ramelor).
// Pe orizontală — operaţiile pe un rând, semnăturile dedesubt — ca să nu lungească capul.
const OPERATII_RAME = ['Debitare', 'Gaurire', 'Garnitura', 'Asamblare', 'Coletare'];
const semnaturiRame = () => `
    <table class="deb-semnaturi">
      <thead><tr>${OPERATII_RAME.map(op => `<th>${op}</th>`).join('')}</tr></thead>
      <tbody><tr>${OPERATII_RAME.map(() => '<td></td>').join('')}</tr></tbody>
    </table>`;

// ── Schiţa de găurire pt. CNC — pe verso, la rame (userul, 2026-10-02) ──────
// Câte un desen tehnic pe fiecare rând de rame (o mărime): conturul ramei la
// scară, faţa profilului, găurile de balama pe latura balamalelor şi cotele lor —
// lanţ de cote din stânga (de SUS în jos, la centrul găurii), H şi L de gabarit.
// Toate ramele de pe un rând sunt identice → un desen, cu nr. de bucăţi.
const virgula1 = n => virgula(Math.round(n * 10) / 10);
function desenGaurire(x, fata, cote, { inalt = 105, lat = 120 } = {}) {
  const H = x.h, L = x.l;
  // k = unităţi SVG (mm de ramă) pe un mm tipărit: desenul are max. `inalt` mm înălţime şi
  // `lat` mm lăţime pe foaie, cu loc de cote (stânga 18 mm, dreapta 9, sus 9, jos 2)
  const k = Math.max(H / (inalt - 11), L / (lat - 27));
  const st = 18 * k, dr = 9 * k, sus = 9 * k, jos = 2 * k;
  const fnt = 3.1 * k, gros = 0.5 * k, sub = 0.18 * k;
  const el = [];
  const linie = (x1, y1, x2, y2, w = sub, extra = '') =>
    el.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="${w}"${extra}/>`);
  const textV = (x0, y0, t, bold = false) => el.push(`<text x="${x0}" y="${y0}" font-size="${fnt}" text-anchor="middle"
    ${bold ? 'font-weight="700"' : ''} transform="rotate(-90 ${x0} ${y0})">${t}</text>`);
  // conturul ramei + faţa profilului (geamul începe de acolo)
  el.push(`<rect x="0" y="0" width="${L}" height="${H}" fill="none" stroke="#000" stroke-width="${gros}"/>`);
  if (fata * 2 < Math.min(H, L)) el.push(`<rect x="${fata}" y="${fata}" width="${L - 2 * fata}" height="${H - 2 * fata}"
    fill="none" stroke="#000" stroke-width="${sub}" stroke-dasharray="${2 * k} ${1.2 * k}"/>`);
  // H şi L de gabarit
  const xH = L + 5 * k, yL = -5 * k, tic = 1.5 * k;
  linie(xH, 0, xH, H); linie(xH - tic, 0, xH + tic, 0); linie(xH - tic, H, xH + tic, H);
  textV(xH - 1.2 * k, H / 2, `H ${virgula1(H)}`, true);
  linie(0, yL, L, yL); linie(0, yL - tic, 0, yL + tic); linie(L, yL - tic, L, yL + tic);
  el.push(`<text x="${L / 2}" y="${yL - 1.2 * k}" font-size="${fnt}" font-weight="700" text-anchor="middle">L ${virgula1(L)}</text>`);
  // găurile, pe profilul din stânga (latura balamalelor), cu lanţul de cote alături
  if (cote?.length) {
    const xc = fata / 2, xLant = -7 * k, r = 1.6 * k;
    const opriri = [0, ...cote, H];
    linie(xLant, 0, xLant, H);
    opriri.forEach(y => linie(xLant - tic, y, xLant + tic, y));
    cote.forEach(y => {
      linie(xLant + tic, y, xc - r * 1.4, y, sub * 0.8, ` stroke-dasharray="${0.8 * k} ${0.8 * k}"`);
      el.push(`<circle cx="${xc}" cy="${y}" r="${r}" fill="#fff" stroke="#000" stroke-width="${gros * 0.8}"/>`);
      linie(xc - r * 1.6, y, xc + r * 1.6, y, sub); linie(xc, y - r * 1.6, xc, y + r * 1.6, sub);
    });
    for (let j = 1; j < opriri.length; j++) {
      const t = virgula1(opriri[j] - opriri[j - 1]), y = (opriri[j - 1] + opriri[j]) / 2;
      // cotă scurtă pe foaie (sub ~9 mm): cifra culcată nu încape între linii → orizontală, în stânga
      if ((opriri[j] - opriri[j - 1]) / k < 9) {
        el.push(`<text x="${xLant - 2 * k}" y="${y + fnt * 0.35}" font-size="${fnt}" text-anchor="end">${t}</text>`);
      } else textV(xLant - 1.2 * k, y, t);
    }
  }
  const vbW = L + st + dr, vbH = H + sus + jos;
  return `<svg viewBox="${-st} ${-sus} ${vbW} ${vbH}" style="width:${(vbW / k).toFixed(1)}mm; height:${(vbH / k).toFixed(1)}mm">${el.join('')}</svg>`;
}

// Doar la 820 / 822 / 824 cu găuri de balama. Fără schiţă la „Fara gaurire" (să nu-l
// încurce pe omul de la CNC) şi la 831 / 841 / 842 „Gaurire Standard" — acolo profilul
// are un singur fel de gaură, îl ştie din vedere (userul, 2026-10-02).
function schiteGaurire(spec, rame) {
  if (spec.m.grup !== '820' || rame.gaurire === FARA_GAURIRE || !spec.pline.length) return '';
  if (!rame.gaurire && !spec.pline.some(x => x.cote?.length)) return '';   // nici regulă, nici cote scrise
  // Grilă cu căsuţe egale (userul, 2026-10-12: „să se vadă schiţele frumos"): câte 3 pe rând,
  // desenele pornesc mari, iar scriptul de la load le micşorează cât trebuie ca versoul să
  // încapă pe o foaie (căutare prin înjumătăţire, nu în trepte fixe).
  const n = spec.pline.length, col = Math.min(n, 3), randuri = Math.ceil(n / col);
  const marime = { lat: (196 - 6 * (col - 1)) / col - 6, inalt: [140, 105, 80][Math.min(randuri, 3) - 1] };
  const deUnde = (x, de) => x.cote.filter(c => c.de === de).map(c => virgula1(c.v)).join(', ');
  const desene = spec.pline.map(x => {
    // desenul, cu rândul, mărimea, bucăţile şi — la cotele scrise — de unde se măsoară fiecare
    const sus = x.cote?.length ? deUnde(x, 'sus') : '', jos = x.cote?.length ? deUnde(x, 'jos') : '';
    return `<div class="gaur-desen">
      <div class="gaur-cap"><span class="gaur-rand">Rândul ${x.i + 1}</span> <b>${x.h} × ${x.l} mm</b> · ${x.buc} buc</div>
      ${sus || jos ? `<div class="gaur-cote">${sus ? `de sus: <b>${sus}</b>` : ''}${sus && jos ? ' · ' : ''}${jos ? `de jos: <b>${jos}</b>` : ''}</div>` : ''}
      ${desenGaurire(x, spec.m.fata, cotaGauri(x.h, x.gauri, rame.gaurire, x.cote), marime)}
    </div>`;
  }).join('');
  return `<div class="schite-gaurire"><div class="gaur-lista" style="grid-template-columns: repeat(${col}, 1fr)">${desene}</div></div>`;
}

// Schiţele încărcate (poze / pagini de PDF) stau în locul celor desenate, pe verso, cu tabelele sub ele
// (userul, 2026-10-23: fişa rămâne de 2 pagini). Pornesc mari; scriptul de la load le micşorează cât
// trebuie ca versoul să încapă pe o foaie.
function schiteIncarcate(lista) {
  const col = lista.length <= 1 ? 1 : lista.length <= 4 ? 2 : 3;
  return `<div class="schite-gaurire"><div class="gaur-lista" style="grid-template-columns: repeat(${col}, 1fr)">${
    lista.map((s, k) => `<div class="gaur-desen gaur-poza"><img src="${s}" alt="Schiţa de găurire ${k + 1}"></div>`).join('')}</div></div>`;
}

// ── Codul de bare al comenzii (Code128) — UNUL pe comandă, oricâte uşi / rame
// (userul, 2026-09-22), cum l-a creat managerul la salvarea ofertei
// (`oferta.coduri[0]`). Se scanează în atelier la fiecare operaţie (pagina
// scanare-atelier.pages.dev → manager/server/scanare.js). SVG vectorial,
// generat aici (JsBarcode, împachetat la build) — fără reţea.
function svgCod(cod) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, cod, { format: 'CODE128', height: 50, width: 2, margin: 0, fontSize: 16, textMargin: 2 });
  const w = svg.getAttribute('width'), h = svg.getAttribute('height');
  svg.setAttribute('viewBox', `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
  svg.removeAttribute('width'); svg.removeAttribute('height');
  // lăţimea după nr. de module (2px/modul) → ~0,33 mm/modul la print, citibil
  // de camera telefonului oricât de lung e codul
  svg.setAttribute('style', `width:${(parseFloat(w) / 2 * 0.33).toFixed(1)}mm; height:auto; display:block`);
  return svg.outerHTML;
}

const blocCod = oferta => oferta?.coduri?.[0]
  ? `<div class="cod-bare">${svgCod(oferta.coduri[0].cod_bare)}</div>` : '';

function tabel(coloane, randuriHtml, clasa = '') {
  if (!randuriHtml.length) return '';
  return `
    <table class="${clasa}">
      <thead><tr>${coloane.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${randuriHtml.join('')}</tbody>
    </table>`;
}

// Tăbliţă compactă „etichetă | valoare", fără antet — pt. cele 4 casete din
// capul de pagină (cote, necesar sticlă/PAL, client/dată, montaj Noi/Client).
// Rândurile cu valoare null/undefined se omit (ex. „Nr. suprapuneri" doar la
// Confort).
function tabelMic(randuri, clasa = '') {
  const vizibile = randuri.filter(([, v]) => v != null);
  if (!vizibile.length) return '';
  return `<table class="mic ${clasa}"><tbody>
    ${vizibile.map(([label, val]) => `<tr><td>${esc(label)}</td><td class="num">${esc(val)}</td></tr>`).join('')}
  </tbody></table>`;
}

// Necesarul de sticlă/PAL — totaluri rapide, cu COTA DE DEBITARE (înălţime×
// lăţime mm, nu aria) şi CINE se ocupă de piesa aia. Absoarbe ce arăta
// înainte tabelul separat "Necesar client": PAL e mereu al clientului (nu
// circulă prin noi, indiferent cine asamblează uşa), sticla e a lui DOAR la
// uşile asamblate de CLIENT — la 'noi', sticla o vindem/montăm noi (apare şi
// pe spatele de facturare, cu codul ei).
// Panourile pot avea înălţimi diferite (divizări / înălţimi introduse) → grupăm pe (cotă, cine).
function necesarSticlaPal(sys, spec) {
  const grupeazaSticla = () => {
    const m = new Map();
    for (const g of familia(sys).glassPerDoor(spec, state)) {
      const cine = g.client ? 'Client' : 'Noi';
      for (const h of g.glassHs) {
        if (h <= 0) continue;
        const cota = `${Math.round(h)} × ${Math.round(g.glassW)} mm`;
        const cheie = `${cota}|${cine}`;
        const e = m.get(cheie) ?? { cota, cine, buc: 0 };
        e.buc += 1;
        m.set(cheie, e);
      }
    }
    return [...m.values()];
  };

  const grupeazaPal = () => {
    const m = new Map();
    for (const g of familia(sys).glassPerDoor(spec, state)) {
      for (const h of g.palHs) {
        if (h <= 0) continue;
        const cota = `${Math.round(h)} × ${Math.round(g.palW)} mm`;
        const e = m.get(cota) ?? { cota, cine: 'Client', buc: 0 };   // PAL: mereu client
        e.buc += 1;
        m.set(cota, e);
      }
    }
    return [...m.values()];
  };

  const randuri = [
    ...grupeazaSticla().map(({ cota, cine, buc }) => ['Sticlă', cota, `${buc} buc`, cine]),
    ...(sys.meta.pal ? grupeazaPal().map(({ cota, cine, buc }) => ['PAL', cota, `${buc} buc`, cine]) : []),
  ];
  return randuri.map(([mat, cota, cant, cine]) =>
    `<tr><td>${esc(mat)}</td><td>${esc(cota)}</td><td class="num">${esc(cant)}</td><td>${esc(cine)}</td></tr>`);
}

// `oferta` = ultima ofertă salvată pt. configuraţia de pe ecran (sau null) — dă
// numărul ofertei şi codurile de bare.
// `salvate` = { bom, factura } — listele SALVATE ale unei comenzi (fişa deschisă
// din manager, ?fisa=<id>): necesarul şi facturarea se tipăresc exact cum au
// fost îngheţate la salvare, nu recalculate cu catalogul de azi. Desenele şi
// cotele vin tot din configuraţia salvată.
// `vezi` (userul, 2026-10-21): doar previzualizare în aplicaţie, fără print — „Vezi fişa"; altfel dialogul
// de print, iar după el (afterprint) managerul primeşte {tip:'fisa-tiparita'} (vezi /fise.js).
export function deschideFisa(client, oferta = null, salvate = null, { vezi = false } = {}) {
  const sys  = systems[state.system];
  const spec = currentSpec();
  if (!sys || !spec) { alerta('Configuraţia nu e gata.'); return; }

  const bom           = salvate?.bom ?? currentBom();
  const panouriClient = salvate?.panouriClient ?? currentClientPanels();
  // telefonul şi adresa: din câmpurile clientului (fişa din manager le primeşte completate)
  const telefon = document.getElementById('clientTelefon')?.value.trim() ?? '';
  const adresa  = document.getElementById('clientAdresa')?.value.trim() ?? '';
  const factura = salvate?.factura ?? currentBilling();
  // nr. ofertei (scris de mână) — rând în tabelul cu livrarea / plata / agentul, la toate gamele (userul, 2026-10-08)
  const nrOferta = document.getElementById('ofertaNr')?.value.trim() || oferta?.numar || '—';
  // …cu eticheta documentului după metoda de plată: Număr ofertă / proformă / factură / bon (userul, 2026-10-22)
  // (fişa unei comenzi din manager: după plata de la salvare — vezi etNumar în ui.js)
  const etNumar = oferta?.etNumar ?? numarText(detaliiComanda(state).plata);
  // cine a configurat — atelierul ştie pe cine întreabă (userul, 2026-10-22; sus în dreapta, lângă nr. ofertei —
  // 2026-10-26, nu în tabel): la fişa unei comenzi cel care a
  // făcut oferta (din manager), altfel cel conectat acum
  const configurat = (oferta && 'configurat' in oferta ? oferta.configurat : stareOferta().utilizator?.nume) || '—';
  // observaţiile produsului (pasul „Observaţii" din configurator) — pe faţă, sub cap, la toate gamele
  const obsText = String(state.observatii ?? '').trim();
  // cale absolută — fereastra nouă porneşte de la about:blank, o cale
  // relativă la sketch (ex. 'assets/verona.jpeg') nu s-ar rezolva acolo
  const sketch  = sys.meta.sketch ? new URL(sys.meta.sketch, location.href).href : null;

  const finisajLabel = finishesOf(sys.meta).find(f => f.id === state.finish)?.label ?? state.finish;

  // Eticheta modelului fără prefixul de gamă ("Confort Verona" → "Verona") —
  // cerută DOAR pt. Confort deocamdată; familia "suspendata" rămâne cu
  // eticheta întreagă, de discutat separat.
  const modelScurt = sys.meta.family === 'confort' || sys.meta.family === 'lux'
    ? sys.meta.label.replace(/^(Confort|Lux)\s+/i, '')
    : sys.meta.label;

  // Capul de pagină — stânga: model/cote/necesar sticlă-PAL; dreapta:
  // schiţă/client-dată/montaj Noi-Client. Cam o treime din pagină.
  const rame = sys.meta.rame ? (state.rame ?? {}) : null;
  // UTIL: profile vândute la bucată, panourile le pune clientul — fără desene
  // de uşă şi fără cote de panouri pe spate; cotele panoului stau sus, ca în Excel.
  const util = sys.meta.family === 'util';
  const cote = util ? tabelMic([
    ['H gol',                `${spec.opening.h} mm`],
    ['L gol',                `${spec.opening.w} mm`],
    ['Nr. uşi',               spec.n],
    ['Nr. suprapuneri',       spec.supr],
    ['Înălţime uşă',         `${spec.doorH} mm`],
    ['Lăţime uşă',           `${Math.round(spec.doorW)} mm`],
    ['Orizontal U',          { fara: 'fără', sus: 'sus', jos: 'jos', ambele: 'sus şi jos' }[state.util?.orizontale] ?? '—'],
    ['PAL 18 (fără div.)',   `${Math.round(spec.panouH)} × ${Math.round(spec.panouL)} mm`],
  ], 'cote') : rame ? tabelMic([
    ['Nr. rame',          spec.nrRame],
    ['Asamblare',         asamblareRame(rame)],
    ['Geam / oglindă',    rame.asamblare === 'noi' ? (findGeam(rame.geam)?.denumire ?? '—') : 'al clientului'],
    ['Cote găurire',      rame.gaurire ?? '—'],
    ['Vopsire cod RAL',   rame.ral || null],
    // detaliile comenzii — la rame în acelaşi tabel (userul, 2026-10-02), ca fişa să fie mai compactă
    ['Mod de livrare',    detaliiComanda(state).livrare ?? '—'],
    ['Metodă de plată',   plataText(detaliiComanda(state).plata) ?? '—'],
    ['Agent',             detaliiComanda(state).agent ?? '—'],
    [etNumar,             nrOferta],
  ], 'cote') : tabelMic([
    ['H gol',                `${spec.opening.h} mm`],
    ['L gol',                `${spec.opening.w} mm`],
    ['Nr. uşi',               spec.door.count],
    ['Nr. suprapuneri',      sys.meta.doorsRange ? suprapuneriEfective(state.doors, sys.meta.suprapuneriObligatorii ? 2 : state.tracks) : null],
    ['Înălţime finală uşă',  `${spec.door.h} mm`],
    ['Lăţime finală uşă',    `${spec.door.w} mm`],
  ], 'cote');

  const necesarSP = util ? '' : rame
    ? tabel(['Geam / oglindă', 'Dimensiuni', 'Cant.', 'Cine'], spec.pline.map(x =>
        `<tr><td>${rame.asamblare === 'noi' ? esc(findGeam(rame.geam)?.cod ?? '—') : 'Client'}</td><td>${x.geamH} × ${x.geamL} mm</td>
         <td class="num">${x.buc} buc</td><td>${rame.asamblare === 'noi' ? 'Noi' : 'Client'}</td></tr>`))
    : tabel(['Sticlă / PAL', 'Dimensiuni', 'Cant.', 'Cine'], necesarSticlaPal(sys, spec));
  // Uşile: pe faţă tabelul Sticlă / PAL (unde erau schiţele), schiţele pe verso — 2026-10-08.
  const schite = rame ? '' : util
    ? blocDesene(sys, spec, [...Array(spec.n).keys()].filter(i => state.assembly?.[i] === 'noi'), i => desenUtil(sys, spec, i))
    : blocDesene(sys, spec);

  const nrNoi    = (state.assembly ?? []).filter(a => a === 'noi').length;
  const nrClient = (state.assembly ?? []).filter(a => a === 'client').length;
  // detaliile comenzii (toate gamele) — livrare / metodă de plată / agent
  const det = detaliiComanda(state);
  const detalii = tabelMic([['Mod de livrare', det.livrare ?? '—'], ['Metodă de plată', plataText(det.plata) ?? '—'], ['Agent', det.agent ?? '—'],
    [etNumar, nrOferta]]);
  const montaj = util ? tabelMic([
    ['Asamblăm noi',        `${nrNoi} uşi`],
    ['Asamblează clientul', `${nrClient} uşi`],
    ['Orizontale U', `${spec.nrU} buc`],
    ['Divizări H',   `${spec.nrH} buc`],
    ['Amortizări',   `${spec.nrAmort} buc`],
  ]) : rame ? '' : tabelMic([
    ['Asamblăm noi',        `${nrNoi} uşi`],
    ['Asamblează clientul', `${nrClient} uşi`],
  ]);

  // 842: ramele nu mai apar ca rânduri în tabel — se văd în secţiunile de
  // debitare 842/841 de deasupra; în tabel rămân accesoriile (+ geamul).
  // Rame: tabel ramelor + debitare în loc de desene; în tabelul de accesorii
  // nu mai apar ramele şi geamul (sunt sus); fără câmpurile de atelier (2026-09-21).
  const eRame = !!rame;
  // (+ la 842 nici geamul: cotele lui sunt în tabelul ramelor de sus)
  const coduriRame = new Set(eRame ? [...spec.pline.map(x => x.cod ?? '⚠ LIPSĂ COD'), findGeam(rame.geam)?.cod ?? '⚠ ALEGE GEAM'] : []);
  // Confort / suspendate / UTIL: la Reper fără „cod 200" / „Cod 203.212" — codul
  // e deja în prima coloană (userul, 2026-09-28). Doar tokenuri cu cifre:
  // „fără cod pentru…" rămâne. Ramele rămân neschimbate.
  const reper = !rame
    ? t => String(t ?? '').replace(/\s*\bcod\s+(?=\S*\d)[\w.\-\/]+/gi, '').trim()
    : t => t;
  const necesarHtml = tabel(['Cod', 'Reper', 'Debitare', 'Cant.', '✓'],
      bom.filter(r => !coduriRame.has(r.code)).map(r => `<tr><td>${esc(r.code)}</td><td>${esc(reper(r.label))}</td>
        <td>${esc(r.cut ?? '—')}</td><td class="num">${r.qty} ${esc(r.unit)}</td>
        <td class="bifa"></td></tr>`),
      'necesar-materiale' + (rame ? ' rame' : '') + (eRame ? ' plin' : '')
        + (rame ? '' : ' mare'));
  // În loc de „Observaţii", 4 câmpuri mari pt. etapele din atelier,
  // cât mai înalte (se întind până la baza foii) — cerute de user.
  const campuriAtelier = `
  <div class="observatii campuri">
    ${['DEBITARE', 'GAURIRE', 'ASAMBLARE', 'COLETARE'].map(c =>
      `<div class="obs-camp"><div class="obs-et">${c}</div></div>`).join('')}
  </div>`;

  // Rame — 3 rubrici de observaţii scrise de mână (2026-09-21); pe FAŢĂ, jos, umplu
  // restul foii (userul, 2026-10-02 — înainte erau pe verso)
  // „Detalii facturare" porneşte cu metoda de plată şi numărul documentului (userul, 2026-10-22)
  const plataRame = plataText(detaliiComanda(state).plata);
  const facturareRame = [plataRame, nrOferta !== '—' && `${etNumar.replace(/^Număr/, 'nr.')} ${nrOferta}`].filter(Boolean).join(' · ');
  const observatiiRame = `
  <div class="obs-rame">
    ${[['Detalii geam/oglinda'], ['Detalii facturare', facturareRame], ['Detalii livrare']].map(([c, text]) =>
      `<div class="obs-camp"><div class="obs-et">${c}</div>${text ? `<div class="obs-scris">${esc(text)}</div>` : ''}</div>`).join('')}
  </div>`;

  const html = `<!DOCTYPE html>
<html lang="ro"><head><meta charset="UTF-8">
<title>Fişă atelier — ${esc(sys.meta.label)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; font-size: 12px; line-height: 1.4; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 13px; margin: 18px 0 6px; border-bottom: 1px solid #999; padding-bottom: 3px; }
  h3 { font-size: 11px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: .03em; color: #555; }

  /* Cap de pagină — două coloane, cam o treime din foaie */
  .cap { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; margin-bottom: 16px; }
  .cap .stanga > * + *, .cap .dreapta > * + * { margin-top: 10px; }

  .model-linie {
    font-size: 24px; font-weight: 700; text-transform: uppercase;
    text-decoration: underline; letter-spacing: .02em;
  }

  .schita { text-align: center; }
  .schita img { max-height: 140px; }

  /* nume client — vizibil de la distanţă, nu înghesuit într-un tabel mic */
  .client-linie { font-size: 22px; font-weight: 700; }
  .client-linie .eticheta {
    display: block; font-size: 10px; font-weight: 400; text-transform: uppercase;
    letter-spacing: .04em; color: #888; margin-bottom: 1px;
  }
  .data-mica { font-size: 11px; color: #555; }

  /* fără titluri deasupra tabelelor → spaţiere directă între ele, ca să nu
     rămână lipite unul de altul */
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 14px; }
  th, td { border: 1px solid #bbb; padding: 4px 6px; text-align: left; }
  th { background: #eee; }
  td.num, th.num { text-align: right; }
  /* tabelele mici din capul de pagină îşi iau spaţierea din .cap .stanga/
     .dreapta > * + *, nu din regula generică de mai sus (ar dubla golul) */
  table.mic { margin-top: 0; }

  /* necesar materiale — mai îngust (cerut explicit), plus coloana de bifat
     de mână la ridicarea/folosirea fiecărui articol */
  table.necesar-materiale { width: auto; max-width: 66%; }
  table.necesar-materiale td:nth-child(3), table.necesar-materiale td:nth-child(4) { white-space: nowrap; }
  table.necesar-materiale th:last-child,
  table.necesar-materiale td.bifa { width: 26px; text-align: center; }
  table.mic td:first-child { color: #555; width: 55%; }
  table.mic td.num { font-weight: 600; }

  /* lăţimea utilă A4 şi pe ecran, ca măsurătoarea pt. modul compact să
     corespundă cu ce iese la print */
  .fata { width: 182mm; }

  /* schiţele uşilor (verso) — alb-negru, cât mai mari, fără să iasă din proporţii:
     lăţimea = înălţimea maximă × raportul real al uşii, dar niciodată mai mult decât
     partea ei din lăţimea paginii; max. 4 pe rând (--n = coloanele unui rând) */
  .desene { --hmax: 118mm; display: flex; flex-wrap: wrap; justify-content: center; gap: 5mm 4mm; margin-top: 6mm; }
  /* coloana e cel puţin 40mm (cât încape pe pagină), ca textul de sub desen
     să nu se rupă pe multe rânduri când desenul e mic; desenul are lăţimea lui */
  .usa-col { flex: 0 0 auto; width: max(calc(var(--hmax) * var(--r)), 40mm);
             max-width: calc((198mm - (var(--n) - 1) * 4mm) / var(--n)); min-width: 0; }
  .usa-col > svg { width: calc(var(--hmax) * var(--r)); max-width: 100%; height: auto; display: block;
                 margin: 0 auto; font-family: Arial, sans-serif; }
  .usa-cap { text-align: center; margin-bottom: 2px; line-height: 1.15; }
  .usa-nr { display: block; font-size: 10px; color: #555; }
  .usa-nr b { color: #000; font-size: 13px; }
  .usa-cine { display: block; font-size: 15px; font-weight: 700; letter-spacing: .02em; line-height: 1.1; }
  .usa-sub { font-size: 10.5px; line-height: 1.3; margin-top: 3px; overflow-wrap: break-word; }
  .sub-et { color: #555; }
  .mostra { width: 7mm; height: 1.2mm; vertical-align: middle; }
  .nota-schite { margin-top: 4mm; font-size: 12px; line-height: 1.6; border-top: 1px solid #999; padding-top: 2mm; }
  .nota-schite .ic { width: 3.6mm; height: 3.6mm; vertical-align: -0.6mm; }
  body.nivel-1 table.necesar-materiale td { padding: 2px 5px; }
  body.nivel-3 .cap { margin-bottom: 8px; }
  body.nivel-3 table.cote { font-size: 11px; }
  body.nivel-3 table.cote td.num { font-size: 13px; }
  body.nivel-3 table.cote td { padding: 2px 6px; }

  /* tabelul de cote (H/L gol, uşă, suprapuneri) — text mai mare, cifrele şi
     mai mult, cerut explicit pt. citire rapidă în atelier */
  table.cote { font-size: 13px; }
  table.cote td.num { font-size: 16px; font-weight: 700; }

  .nota { font-size: 10.5px; color: #555; margin: 2px 0 6px; font-style: italic; }
  .eroare { font-size: 10.5px; color: #a33; margin: 2px 0; }
  .jos { display: flex; gap: 14px; align-items: flex-start; }
  .jos table.necesar-materiale { max-width: none; flex: 0 1 auto; }
  .jos .observatii { flex: 1; min-width: 45mm; }
  .jos .observatii h2 { margin-top: 14px; }

  /* spatele foii — tabelul de facturare, pt. birou/NeoManager. La print
     faţă-verso, ruptura de pagină pune asta exact pe spatele foii din faţă. */
  .spate { page-break-before: always; break-before: page; }
  .spate .antet-mic { font-size: 13px; color: #555; margin-bottom: 14px; }
  .spate .antet-mic strong { color: #1a1a1a; }

  /* Fără margini de pagină (Chrome nu mai are unde pune antetul şi
     subsolul lui — data, URL-ul, nr. paginii), doar 6mm de siguranţă pt.
     imprimantă; faţa se întinde pe toată foaia, iar câmpurile de atelier
     umplu tot ce rămâne sub necesar. */
  body { margin: 0; }
  .fata { width: 210mm; padding: 6mm; }
  .fata.intinde { min-height: 296mm; display: flex; flex-direction: column; }
  .fata.intinde .jos { flex: 1; }
  .spate { padding: 6mm; }
  /* necesar 75% din lăţime, câmpurile de atelier 25% (userul, 2026-09-21) */
  .jos { align-items: stretch; gap: 3mm; }
  .jos table.necesar-materiale { align-self: flex-start; flex: 0 0 calc(75% - 1.5mm); width: calc(75% - 1.5mm); }
  .jos .observatii.campuri { display: flex; flex-direction: column; gap: 2.5mm; flex: 0 0 calc(25% - 1.5mm); min-width: 0; margin-top: 14px; }
  table.necesar-materiale.fix20 { table-layout: fixed; font-size: var(--font); }
  table.necesar-materiale.fix20 th, table.necesar-materiale.fix20 td {
    height: var(--rand); padding: 0 1.5mm; line-height: 1.1;
    white-space: nowrap; overflow: hidden;
  }
  table.necesar-materiale.fix20 th:nth-child(1) { width: 11%; }
  table.necesar-materiale.fix20 th:nth-child(3) { width: 15%; }
  table.necesar-materiale.fix20 th:nth-child(4) { width: 13%; }
  table.necesar-materiale.fix20 th:nth-child(5) { width: 6%; }
  /* Confort / suspendate / UTIL (clasa „mare"): reper, cote şi cantităţi mari, să
     se vadă din atelier — necesarul ia 85% din lăţime, câmpurile de atelier se
     îngustează la 15% (userul, 2026-09-28) */
  .jos table.necesar-materiale.mare { flex-basis: calc(85% - 1.5mm); width: calc(85% - 1.5mm); }
  .jos table.necesar-materiale.mare + .observatii.campuri { flex-basis: calc(15% - 1.5mm); }
  .jos table.necesar-materiale.mare + .observatii.campuri .obs-et { font-size: 12px; letter-spacing: 0; }
  table.necesar-materiale.fix20.mare th:nth-child(1) { width: 7%; }
  table.necesar-materiale.fix20.mare th:nth-child(3) { width: 19%; }
  table.necesar-materiale.fix20.mare th:nth-child(4) { width: 12%; }
  table.necesar-materiale.fix20.mare th:nth-child(5) { width: 4%; }
  table.necesar-materiale.fix20.mare td:nth-child(3) { font-size: calc(var(--font) * 1.35); font-weight: 700; }
  table.necesar-materiale.fix20.mare td:nth-child(2) { font-size: calc(var(--font) * 1.25); }
  table.necesar-materiale.fix20.mare td:nth-child(4) { font-size: calc(var(--font) * 1.35); font-weight: 700; }
  /* rame: denumirile accesoriilor sunt lungi (verbatim din formular) — se
     împachetează pe rânduri în loc să se micşoreze până nu se mai citesc */
  table.necesar-materiale.fix20.rame td:nth-child(1), table.necesar-materiale.fix20.rame td:nth-child(2) {
    white-space: normal; height: auto; min-height: var(--rand); padding: 1mm 1.5mm; }
  /* debitare rame — schiţa profilului în stânga, rândurile de tăiat în dreapta */
  .debitare-rame { display: flex; flex-direction: column; gap: 3mm; margin-top: 4mm; }
  .deb-sectiune { display: flex; align-items: center; gap: 4mm; border: 1.5px solid #000; border-radius: 2mm; padding: 2mm 3mm; }
  .deb-schita { width: 30mm; height: auto; flex: 0 0 auto; }
  table.deb-tabel { margin-top: 0; width: auto; flex: 1; font-size: 15px; }
  table.deb-tabel td { padding: 1.2mm 3mm; }
  table.deb-tabel .deb-et { font-weight: 700; letter-spacing: .02em; }
  table.deb-tabel .deb-mm { font-size: 17px; font-weight: 700; text-align: right; white-space: nowrap; }
  table.deb-tabel .deb-buc { text-align: right; white-space: nowrap; }
  table.deb-tabel .bifa { width: 8mm; }
  /* rame: fără câmpurile de atelier — tabelul de accesorii ia toată lăţimea */
  .jos table.necesar-materiale.plin { flex: 1 1 100%; width: 100%; }
  table.necesar-materiale.rame { font-size: 12px; }
  table.deb-rame { margin-top: 0; font-size: 14px; }
  table.deb-rame td, table.deb-rame th { padding: 1.2mm 3mm; }
  table.deb-rame .deb-mm { font-size: 16px; font-weight: 700; white-space: nowrap; }
  table.deb-rame .bifa { width: 8mm; }
  .deb-sus { display: flex; gap: 3mm; align-items: flex-start; }
  .deb-sus table.deb-rame { flex: 1; width: auto; }
  table.deb-semnaturi { width: 100%; table-layout: fixed; font-size: 12px; }
  table.deb-semnaturi th { padding: 1mm; text-align: center; background: #eee; }
  table.deb-semnaturi td { height: 13mm; }
  table.deb-rame td, table.deb-rame th { white-space: nowrap; }
  /* codul de bare al comenzii — bandă îngustă deasupra capului de pagină,
     aliniată la dreapta; restul feţei rămâne aşezat exact ca înainte */
  .bara-cod { display: flex; justify-content: flex-end; align-items: center; gap: 4mm; margin: -2mm 0 2mm; }
  .numar-oferta { font-size: 15px; font-weight: 700; font-family: monospace; letter-spacing: .03em; }
  .bara-cod .configurat { font-size: 13px; }

  /* schiţa de găurire pt. CNC (verso, rame) */
  .gaur-lista { display: grid; gap: 3mm; margin-bottom: 4mm; }
  .gaur-desen { break-inside: avoid; border: 0.3mm solid #bbb; border-radius: 2mm; padding: 2mm 3mm 3mm;
                display: flex; flex-direction: column; align-items: center; min-width: 0; }
  .gaur-cap { font-size: 13px; align-self: stretch; }
  .gaur-rand { color: #666; font-size: 11px; margin-right: 1mm; }
  .gaur-cote { font-size: 11.5px; align-self: stretch; margin-top: 0.5mm; }
  .gaur-desen svg { display: block; margin-top: 2mm; font-family: 'Segoe UI', Arial, sans-serif; }
  .gaur-poza { padding: 2mm; }
  .gaur-poza img { display: block; width: 100%; height: auto; max-height: 230mm; object-fit: contain; }
  /* rame: rubricile de observaţii — un rând de 3 căsuţe care umple restul feţei */
  .obs-rame { display: flex; gap: 3mm; min-height: 25mm; margin-top: 3mm; }
  .obs-rame .obs-camp { flex: 1; }
  .fata.intinde .obs-rame { flex: 1; }
  .fata.intinde .jos:has(+ .obs-rame) { flex: 0 0 auto; }
  .obs-camp { flex: 1; min-height: 12mm; border: 1.5px solid #000; border-radius: 2mm; padding: 1.5mm 2.5mm; }
  .obs-et { font-size: 14px; font-weight: 700; letter-spacing: .05em; }
  .obs-scris { font-size: 13px; margin-top: 1mm; }
  .obs-text { border: 1.5px solid #000; border-radius: 2mm; padding: 2mm 3mm; margin: 0 0 3mm;
              font-size: 13px; line-height: 1.35; white-space: pre-wrap; overflow-wrap: break-word; }

</style></head>
<body>

  <div class="fata">
  ${oferta || configurat !== '—' ? `<div class="bara-cod">${configurat !== '—' ? `<span class="configurat">Configurat de <b>${esc(configurat)}</b></span>` : ''}${
    oferta ? `<span class="numar-oferta">${esc(oferta.numar)}</span>${blocCod(oferta)}` : ''}</div>` : ''}
  <div class="cap">
    <div class="stanga">
      <div class="model-linie">${esc(modelScurt)} — ${esc(finisajLabel)}</div>

      ${cote}
    </div>
    <div class="dreapta">
      ${sketch ? `<div class="schita"><img src="${esc(sketch)}" alt="Schiţă"></div>` : ''}
      <div class="client-linie">
        <span class="eticheta">Client</span>${esc(client || '—')}
      </div>
      ${telefon || adresa ? `<div class="data-mica">${[telefon && `Tel. ${esc(telefon)}`, adresa && esc(adresa)].filter(Boolean).join(' · ')}</div>` : ''}
      <div class="data-mica">Data: ${acum()}</div>
      ${rame ? semnaturiRame() : detalii}
      ${montaj}
    </div>
  </div>

  ${obsText ? `<div class="obs-text"><b>Observaţii:</b> ${esc(obsText)}</div>` : ''}

  ${util ? tabel(['Clientul ia', 'Dimensiuni', 'Cant.'], panouriClient.map(r =>
        `<tr><td>${esc(r.label)}</td><td>${esc(r.cut)}</td><td class="num">${r.qty} buc</td></tr>`))
    : rame ? debitareRame(spec) : necesarSP}

  <div class="jos">${necesarHtml}${eRame ? '' : campuriAtelier}</div>
  ${eRame ? observatiiRame : ''}

  </div>

  <div class="spate">
    <!-- la rame versoul începe direct cu schiţa de găurire, fără antet (userul, 2026-10-02) -->
    ${rame ? '' : `<div class="antet-mic"><strong>${esc(modelScurt)} — ${esc(finisajLabel)}</strong>${oferta ? ` · <strong>${esc(oferta.numar)}</strong>` : ''}
      ${client ? ` · ${esc(client)}` : ''} · ${acum()}</div>`}

    ${!rame ? '' : schiteRame(rame).length && spec.m?.grup === '820' ? schiteIncarcate(schiteRame(rame)) : schiteGaurire(spec, rame)}

    ${tabel(['Cod', 'Denumire', 'Cant.'],
        factura.lines.map(l => `<tr><td>${esc(l.cod)}</td><td>${esc(l.denumire ?? '—')}</td>
          <td class="num">${virgula(l.cantitate)}${l.um && l.um !== 'buc' ? ' ' + esc(l.um) : ''}</td></tr>`))}

    ${factura.errors.length ? factura.errors.map(e => `<div class="eroare">⚠ ${esc(e)}</div>`).join('') : ''}
    ${!factura.lines.length && !factura.errors.length
        ? '<div class="nota">Nicio linie de facturare pt. configuraţia asta.</div>' : ''}

    ${rame ? necesarSP : schite + notaSchite(sys, spec, factura)}
  </div>


<script>
  // După ce se încarcă schiţa (altfel nu i se ştie înălţimea):
  //  1. schiţa se micşorează/măreşte ca cele două coloane din cap să se
  //     termine la aceeaşi înălţime;
  //  2. dacă faţa nu încape pe o foaie A4 (necesarul ar trece pe pagina 2 şi
  //     ar strica printul faţă-verso), se compactează în trepte, doar cât e nevoie;
  //  3. faţa se întinde pe toată foaia — câmpurile de atelier umplu restul;
  //  4. verso: schiţele uşilor umplu ce rămâne sub facturare, fără să treacă pe a 3-a foaie.
  window.addEventListener('load', function () {
    function aliniaza() {
      var st = document.querySelector('.cap .stanga'), dr = document.querySelector('.cap .dreapta');
      var img = document.querySelector('.cap .schita img');
      if (!st || !dr || !img) return;
      var h = img.offsetHeight - (dr.offsetHeight - st.offsetHeight);
      img.style.maxHeight = Math.max(40, Math.min(170, h)) + 'px';
    }
    var fata = document.querySelector('.fata');
    var PX = 96 / 25.4;                       // px CSS pe mm
    var util = 296 * PX * 0.98;
    aliniaza();
    for (var n = 1; n <= 3 && fata.offsetHeight > util; n++) {
      document.body.classList.add('nivel-' + n);
      aliniaza();
    }
    fata.classList.add('intinde');

    // Necesarul: înălţimea de rând aleasă ca 20 de rânduri (maximul posibil la
    // Confort) + antetul să încapă FIX până la baza foii, iar scrisul cât mai
    // mare. Fontul porneşte de la ~62% din înălţimea rândului; o celulă cu
    // text prea lung (ex. denumirile lungi de la divizările aplicate) îşi
    // micşorează doar ea fontul, nu tot tabelul (userul, 2026-09-21).
    // La rame tabelul de accesorii rămâne la mărimea lui normală — nu se întinde
    // până la baza foii (userul, 2026-09-21: „de ce e aşa mare?").
    var tab = document.querySelector('.jos table.necesar-materiale:not(.rame)');
    if (tab) {
      var jos = fata.getBoundingClientRect().bottom - 6 * PX;   // padding-ul foii
      // 20 de rânduri + antet (la rame pot fi mai multe — atunci toate)
      var nr = Math.max(21, tab.rows.length);
      var rand = Math.floor((jos - tab.getBoundingClientRect().top - 4) / nr * 0.98 * 10) / 10;
      tab.style.setProperty('--rand', rand + 'px');
      tab.style.setProperty('--font', (rand * 0.62).toFixed(1) + 'px');
      tab.classList.add('fix20');
      // rândurile care se împachetează (rame) pot împinge tabelul peste foaie
      for (var q = 0; q < 15 && tab.getBoundingClientRect().bottom > jos + 1; q++) {
        rand = Math.floor(rand * 0.92 * 10) / 10;
        tab.style.setProperty('--rand', rand + 'px');
        tab.style.setProperty('--font', (rand * 0.62).toFixed(1) + 'px');
      }
      tab.querySelectorAll('td, th').forEach(function (c) {
        var f = parseFloat(getComputedStyle(c).fontSize);
        while (c.scrollWidth > c.clientWidth + 1 && f > 7) { f -= 0.5; c.style.fontSize = f + 'px'; }
      });
    }

    // Verso (uşi): schiţele cât mai mari, dar versoul pe o singură foaie — cea mai mare
    // --hmax care încape, prin înjumătăţire (la mărimi mari coloanele se pot muta pe alt
    // rând, deci nu se poate calcula direct din cât depăşeşte).
    var desene = document.querySelector('.spate .desene');
    if (desene) {
      var foaie = 297 * PX * 0.98, sp = document.querySelector('.spate');
      var setH = function (v) { desene.style.setProperty('--hmax', v + 'mm'); };
      var lo = 25, hi = 250;
      setH(hi);
      if (sp.offsetHeight > foaie) {
        for (var k = 0; k < 12; k++) {
          var mij = (lo + hi) / 2;
          setH(mij);
          if (sp.offsetHeight > foaie) hi = mij; else lo = mij;
        }
        setH(lo);
      }
    }

    // Verso (rame): schiţele de găurire pornesc mari şi se micşorează — prin înjumătăţire,
    // cel mai mare factor cu care încape tot pe o foaie (altfel ce rămâne trece pe o a treia
    // pagină şi strică printul faţă-verso). Cel mult la jumătate, să rămână cotele lizibile.
    var spate = document.querySelector('.spate'), schite = document.querySelectorAll('.gaur-desen svg');
    var foaieSpate = 297 * PX * 0.98;
    // cât ocupă conţinutul versoului (nu cutia lui — în previzualizare are oricum o foaie întreagă)
    var ocupa = function () {
      var sus = spate.getBoundingClientRect().top, jos = sus;
      Array.prototype.forEach.call(spate.children, function (c) { jos = Math.max(jos, c.getBoundingClientRect().bottom); });
      return jos - sus + 6 * PX;   // + marginea de jos (padding 6 mm)
    };
    if (spate && schite.length && ocupa() > foaieSpate) {
      var mari = Array.prototype.map.call(schite, function (sv) { return [parseFloat(sv.style.width), parseFloat(sv.style.height)]; });
      // cifrele cotelor nu se micşorează odată cu desenul (pe hârtie rămân ~2,4 mm, nu 1,5)
      var scara = function (f) {
        schite.forEach(function (sv, i) {
          sv.style.width = (mari[i][0] * f).toFixed(1) + 'mm';
          sv.style.height = (mari[i][1] * f).toFixed(1) + 'mm';
          sv.querySelectorAll('text').forEach(function (tx) {
            tx.dataset.fs = tx.dataset.fs || tx.getAttribute('font-size');
            tx.setAttribute('font-size', (tx.dataset.fs * Math.min(1.6, Math.max(1, 0.78 / f))).toFixed(2));
          });
        });
      };
      var fMin = 0.5, fMax = 1;
      for (var t = 0; t < 10; t++) { var f = (fMin + fMax) / 2; scara(f); if (ocupa() > foaieSpate) fMax = f; else fMin = f; }
      scara(fMin);
    }
    // schiţele încărcate (poze / PDF): la fel, cea mai mare înălţime cu care versoul încape pe o foaie
    var poze = document.querySelectorAll('.gaur-poza img');
    if (spate && poze.length && ocupa() > foaieSpate) {
      var inalt = function (mm) { poze.forEach(function (im) { im.style.maxHeight = mm + 'mm'; }); };
      var hMin = 40, hMax = 230;
      for (var u = 0; u < 12; u++) { var h = (hMin + hMax) / 2; inalt(h); if (ocupa() > foaieSpate) hMax = h; else hMin = h; }
      inalt(Math.floor(hMin));
    }
  });
</script>
${vezi ? '' : `<script>
  // Dialogul de print porneşte singur, după ce fişa s-a aşezat (scriptul de
  // încadrare de mai sus rulează tot la 'load', înregistrat înaintea ăstuia).
  window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 150); });
  // s-a închis dialogul (printat sau nu) — managerul întreabă apoi „Ai printat?"
  window.addEventListener('afterprint', function () {
    try { window.top.postMessage({ tip: 'fisa-tiparita' }, location.origin); } catch (e) {}
  });
</script>`}
</body></html>`;

  if (vezi) return arataPrevizualizare(html, { titlu: `Fişa — ${sys.meta.label}`, pagini: '.fata, .spate' });

  // Fără filă nouă (cerut): fişa se scrie într-un cadru ascuns din pagina
  // curentă, de lăţimea unei foi A4 (ca măsurătorile de încadrare din fişă să
  // fie corecte), iar scriptul ei de la final deschide direct dialogul de print.
  document.getElementById('fisaCadru')?.remove();
  const cadru = document.createElement('iframe');
  cadru.id = 'fisaCadru';
  cadru.setAttribute('aria-hidden', 'true');
  cadru.style.cssText = 'position:fixed; left:-10000px; top:0; width:210mm; height:297mm; border:0;';
  document.body.appendChild(cadru);
  const doc = cadru.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
}
