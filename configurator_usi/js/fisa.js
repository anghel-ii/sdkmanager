import { state } from './state.js';
import { systems } from './systems/registry.js';
import { currentSpec, currentBom, currentBilling, currentClientPanels } from './builder.js';
import { finishesOf, familia } from './familii.js';
import { findGeam } from './lib/comun/geam.js';
import { suprapuneriEfective, PROFIL_H_3D } from './lib/confort/index.js';
import { ASAMBLARE, FARA_GAURIRE, cotaGauri, MARGINE_GAURA_MM } from './lib/rame/rame.js';
import { detaliiComanda, plataText } from './lib/comun/comanda.js';
import JsBarcode from 'jsbarcode';

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
//  Două pagini: faţa (schiţă/cote/necesar — pt. atelier) şi spatele (tabelul
//  de facturare — pt. birou/NeoManager), separate cu page-break, ca la
//  printare faţă-verso spatele să cadă exact pe facturare.
// ═══════════════════════════════════════════════════════════════════════════

const esc = t => String(t ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const virgula = n => String(n).replace('.', ',');   // aceeaşi convenţie ca-n manager

// data de pe fişă — acelaşi format ca în manager: zz/ll/aaaa hh:mm
const acum = () => {
  const d = new Date(), z = n => String(n).padStart(2, '0');
  return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()} ${z(d.getHours())}:${z(d.getMinutes())}`;
};

const amortizareLabel = v => (v === 'fara' || !v ? 'Fără' : v);

// Modelul de geam ales, per uşă — denumirea din catalog la uşile asamblate de
// NOI; la 'client', geamul nu circulă prin noi, contează doar grosimea
// declarată (vezi lib/<familie>/geam.js → glassPerDoor).
function geamModelLabel(i) {
  if (state.assembly?.[i] === 'client') return `Client (${state.geamClient?.[i] ?? 4}mm)`;
  const g = findGeam(state.geam?.[i]);
  return g ? g.denumire : (state.geam?.[i] ?? '—');
}

// ── Desenele uşilor (doar Confort) — înlocuiesc tabelul de asamblare ───────
// Cerut explicit (2026-09-18): alb-negru (tuşul color e scump), cât mai mari,
// aproape lipite, fără să iasă din proporţiile reale; pe fiecare panou doar
// PAL/OGL şi cota (înălţime × lăţime), scrise cât mai mare; deasupra NOI /
// CLIENTUL; dedesubt modelul de geam, amortizările şi divizările aplicate
// (acestea NU se mai desenează). SVG în mm reali: viewBox = uşa (+ o margine
// în dreapta doar dacă are bară H, pt. eticheta „H").
const PARTE_TEXT = { fata: 'faţă', spate: 'spate', ambele: 'faţă + spate' };

function desenUsa(sys, spec, i, margH = 0) {
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
  const el = [];

  el.push(`<rect x="${linie / 2}" y="${linie / 2}" width="${W - linie}" height="${H - linie}" fill="none" stroke="#000" stroke-width="${linie * 2}"/>`);
  let y = jos;
  p.heights.forEach((_, k) => {
    const h = hDesen(k);
    const pal = p.mats[k] === 'pal';
    const latime = Math.round(pal ? spec.glass.palW : spec.glass.glassW);
    el.push(`<rect x="${mont}" y="${Y(y + h)}" width="${innerW}" height="${h}" fill="none" stroke="#000" stroke-width="${linie}"/>`);
    const font = Math.min(innerW * 0.15, h * 0.26);
    const cx = mont + innerW / 2, cy = Y(y + h / 2);
    el.push(`<text x="${cx}" y="${cy - font * 0.15}" font-size="${font}" font-weight="700" text-anchor="middle">${pal ? 'PAL' : 'OGL'}</text>`);
    el.push(`<text x="${cx}" y="${cy + font * 0.95}" font-size="${font * 0.8}" text-anchor="middle">${Math.round(p.heights[k])}×${latime}</text>`);
    y += h;
    if (k < p.heights.length - 1) {
      const s = slot(k);
      if (p.profil[k] === 'H') {
        const c = y + s / 2;
        el.push(`<line x1="${mont}" y1="${Y(c)}" x2="${W - mont}" y2="${Y(c)}" stroke="#000" stroke-width="${PROFIL_H_3D.fata}"/>`);
        el.push(`<text x="${W + 18}" y="${Y(c) + 30}" font-size="90" font-weight="700">H</text>`);
      }
      y += s;
    }
  });

  return {
    svg: `<svg viewBox="0 0 ${W + marg} ${H}">${el.join('')}</svg>`,
    raport: (W + marg) / H,
  };
}

const rolaLabel = v => (v === 'amortizor' ? 'amortizor' : 'simplă');

function textSubDesen(sys, i) {
  const a  = state.amortizare?.[i] ?? {};
  const w  = state.wheels?.[i] ?? {};
  const da = state.divAplicate?.[i];
  const areSticla = (state.panels?.[i] ?? []).some(m => m !== 'pal');
  const randuri = [
    ['Geam', areSticla ? geamModelLabel(i) : '—'],
    // Confort: amortizări; suspendate: rolele alese pe fiecare parte
    sys.meta.family === 'confort'
      ? ['Amortizare', `St ${amortizareLabel(a.left)} · Dr ${amortizareLabel(a.right)}`]
      : ['Role', `St ${rolaLabel(w.left)} · Dr ${rolaLabel(w.right)}`],
    ...(da && da.latime !== 'fara'
      ? [['Aplicate', `${da.latime}mm ${PARTE_TEXT[da.parte] ?? da.parte} · ${da.verticale ?? 0} vert. × ${da.orizontale ?? 0} oriz. / panou`]]
      : []),
  ];
  return randuri.map(([e, v]) => `<div class="sub-rand"><span class="sub-et">${e}:</span> ${esc(v)}</div>`).join('');
}

function blocDesene(sys, spec) {
  const n = spec.door.count || 0;
  if (!n) return '';
  const margH = (spec.glass?.panels ?? []).some(p => p.profil?.includes('H')) ? 110 : 0;
  const coloane = Array.from({ length: n }, (_, i) => {
    const { svg, raport } = desenUsa(sys, spec, i, margH);
    const cine = state.assembly?.[i] === 'client' ? 'CLIENTUL ASAMBLEAZĂ' : 'NOI ASAMBLĂM';
    return `
      <div class="usa-col" style="--r:${raport.toFixed(4)}">
        <div class="usa-cap"><span class="usa-nr">Uşa ${i + 1}</span> <span class="usa-cine">${cine}</span></div>
        ${svg}
        <div class="usa-sub">${textSubDesen(sys, i)}</div>
      </div>`;
  }).join('');
  return `<div class="desene" style="--n:${n}">${coloane}</div>`;
}

// Tabel de dimensiuni EXACTE, pt. spatele fişei — aceeaşi structură transpusă
// (coloană per uşă, rând per nivel de panou, sus→jos), cu celule care arată
// direct cota de debitare, nu doar materialul: "P-876x765" (PAL) sau
// "O-1989x876" (sticlă) — înălţime×lăţime, fără spaţii, fără "mm".
function tabelDimensiuniPanouri(spec) {
  const n = spec.door.count || 0;
  if (!n) return '';

  // Fiecare panou cu înălţimea LUI — la Confort pot diferi în aceeaşi uşă
  // (înălţimi introduse în opţiuni avansate).
  const stivePanouri = Array.from({ length: n }, (_, i) => {
    const p    = spec.glass?.panels?.[i];
    const mats = state.panels?.[i] ?? [];
    const hs   = p?.heights ?? mats.map(() => p?.paneH ?? 0);
    return mats.map((mat, k) => ({ mat, h: Math.round(hs[k] ?? 0) })).reverse();   // sus→jos
  });
  const maxPanouri = Math.max(1, ...stivePanouri.map(s => s.length));

  const glassW = Math.round(spec.glass?.glassW ?? 0);
  const palW   = Math.round(spec.glass?.palW ?? glassW);
  const antetUsi = Array.from({ length: n }, (_, i) => `<th>Uşa ${i + 1}</th>`).join('');

  const randuriPanouri = Array.from({ length: maxPanouri }, (_, nivel) => {
    const celule = stivePanouri.map(stiva => {
      const panou = stiva[nivel];
      if (!panou) return '<td>—</td>';
      const latime = panou.mat === 'pal' ? palW : glassW;
      const cod    = panou.mat === 'pal' ? 'P' : 'O';
      return `<td>${cod}-${panou.h}x${latime}</td>`;
    }).join('');
    return `<tr><td class="eticheta-rand">Panou ${nivel + 1}</td>${celule}</tr>`;
  }).join('');

  return `
    <table class="usi-transpus">
      <thead><tr><th></th>${antetUsi}</tr></thead>
      <tbody>${randuriPanouri}</tbody>
    </table>`;
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
  // în dreapta tabelului ramelor: etapele din atelier + semnătura colegului
  const semnaturi = `
    <table class="deb-semnaturi">
      <thead><tr><th>Operaţie</th><th>Semnătură</th></tr></thead>
      <tbody>${['Debitare', 'Gaurire', 'Garnitura', 'Asamblare', 'Coletare']
        .map(op => `<tr><td class="deb-et">${op}</td><td></td></tr>`).join('')}</tbody>
    </table>`;
  return `<div class="debitare-rame">
    <div class="deb-sus">${rame}${semnaturi}</div>
    ${e842
      ? sectiune('842', randuri('VERTICALA 842', vert)) +
        sectiune('841', randuri('VERTICALA 841', vert) + randuri('ORIZONTALA 841', oriz))
      : sectiune(spec.model, randuri(`VERTICALA ${spec.model}`, vert) + randuri(`ORIZONTALA ${spec.model}`, oriz))}
  </div>`;
}

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
  if (spec.m.grup !== '820' || !rame.gaurire || rame.gaurire === FARA_GAURIRE || !spec.pline.length) return '';
  // cu mai multe mărimi, desenele se micşorează ca versoul să rămână pe o foaie:
  // câte 3 pe rând, iar înălţimea scade cu nr. de rânduri (până la 45 mm)
  const n = spec.pline.length, col = Math.min(n, 3), randuri = Math.ceil(n / col);
  const marime = { lat: (192 - 8 * (col - 1)) / col, inalt: Math.max(45, Math.min(95, 125 / randuri - 16)) };
  const desene = spec.pline.map(x => {
    const cote = cotaGauri(x.h, x.gauri, rame.gaurire);
    const nota = cote?.length
      ? `Găuri, de sus: <b>${cote.map(virgula1).join(' · ')}</b> mm`
      : `${x.gauri ? `${x.gauri} găuri — ` : ''}cotele: după schiţa clientului<div class="gaur-mana"></div>`;
    return `<div class="gaur-desen">
      <div class="gaur-cap">Rândul ${x.i + 1} · <b>${x.h} × ${x.l} mm</b> · ${x.buc} buc${cote?.length ? ` · ${cote.length} găuri / ramă` : ''}</div>
      ${desenGaurire(x, spec.m.fata, cote, marime)}
      <div class="gaur-nota">${nota}</div>
    </div>`;
  }).join('');
  return `<div class="schite-gaurire">
    <h2>Schiţă găurire — ${esc(rame.gaurire)}${rame.balama ? ` · balama ${esc(rame.balama)}` : ''}${rame.placuta ? ` · plăcuţă ${esc(rame.placuta)}` : ''}</h2>
    <div class="gaur-legenda">Cote în mm, la centrul găurii, măsurate de la marginea de SUS a ramei; găurile pe profilul
      balamalelor (desenat în stânga). Prima şi ultima gaură la ${MARGINE_GAURA_MM} mm de margini. Linia punctată = faţa profilului.</div>
    <div class="gaur-lista">${desene}</div>
  </div>`;
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
export function deschideFisa(client, oferta = null, salvate = null) {
  const sys  = systems[state.system];
  const spec = currentSpec();
  if (!sys || !spec) { alert('Configuraţia nu e gata.'); return; }

  const bom           = salvate?.bom ?? currentBom();
  const panouriClient = salvate?.panouriClient ?? currentClientPanels();
  // telefonul şi adresa: din câmpurile clientului (fişa din manager le primeşte completate)
  const telefon = document.getElementById('clientTelefon')?.value.trim() ?? '';
  const adresa  = document.getElementById('clientAdresa')?.value.trim() ?? '';
  const factura = salvate?.factura ?? currentBilling();
  // cale absolută — fereastra nouă porneşte de la about:blank, o cale
  // relativă la sketch (ex. 'assets/verona.jpeg') nu s-ar rezolva acolo
  const sketch  = sys.meta.sketch ? new URL(sys.meta.sketch, location.href).href : null;

  const finisajLabel = finishesOf(sys.meta).find(f => f.id === state.finish)?.label ?? state.finish;

  // Eticheta modelului fără prefixul de gamă ("Confort Verona" → "Verona") —
  // cerută DOAR pt. Confort deocamdată; familia "suspendata" rămâne cu
  // eticheta întreagă, de discutat separat.
  const modelScurt = sys.meta.family === 'confort'
    ? sys.meta.label.replace(/^Confort\s+/i, '')
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
    ['Asamblare',         ASAMBLARE.find(a => a[0] === rame.asamblare)?.[1] ?? '—'],
    ['Geam / oglindă',    rame.asamblare === 'noi' ? (findGeam(rame.geam)?.denumire ?? '—') : 'al clientului'],
    ['Cote găurire',      rame.gaurire ?? '—'],
    ['Vopsire cod RAL',   rame.ral || null],
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
  // Desene în loc de tabelul de asamblare, necesarul de sticlă/PAL pe spate,
  // fără margini, câmpuri de atelier — Confort 2026-09-18, suspendate 2026-09-21.

  const nrNoi    = (state.assembly ?? []).filter(a => a === 'noi').length;
  const nrClient = (state.assembly ?? []).filter(a => a === 'client').length;
  // detaliile comenzii (toate gamele) — livrare / metodă de plată / agent
  const det = detaliiComanda(state);
  const detalii = tabelMic([['Mod de livrare', det.livrare ?? '—'], ['Metodă de plată', plataText(det.plata) ?? '—'], ['Agent', det.agent ?? '—']]);
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

  // Rame — pe spate, sus: 3 rubrici de observaţii scrise de mână (2026-09-21)
  const observatiiRame = `
    <table class="obs-rame">
      <thead><tr>${['Detalii geam/oglinda', 'Detalii facturare', 'Detalii livrare'].map(t => `<th>${t}</th>`).join('')}</tr></thead>
      <tbody><tr><td></td><td></td><td></td></tr></tbody>
    </table>`;

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

  /* tabelul transpus de uşi — o coloană per uşă, până la 7 la Confort, deci
     celule înguste şi text mai mic ca să încapă pe lăţimea A4 */
  table.usi-transpus { font-size: 10px; table-layout: fixed; }
  table.usi-transpus th, table.usi-transpus td {
    padding: 4px 3px; text-align: center;
    /* text lung (ex. modelul de geam) se împachetează pe mai multe rânduri
       în celulă, nu se taie şi nu iese din pagină */
    overflow-wrap: break-word; word-break: break-word;
  }
  table.usi-transpus td.eticheta-rand, table.usi-transpus th:first-child {
    text-align: left; color: #555; width: 78px;
  }

  /* lăţimea utilă A4 şi pe ecran, ca măsurătoarea pt. modul compact să
     corespundă cu ce iese la print */
  .fata { width: 182mm; }

  /* desenele uşilor (Confort) — alb-negru, cât mai mari, aproape lipite,
     fără să iasă din proporţii: lăţimea = înălţimea maximă × raportul real
     al uşii, dar niciodată mai mult decât partea ei din lăţimea paginii */
  .desene { --hmax: 118mm; display: flex; justify-content: center; gap: 2mm; margin-top: 10px; }
  body.nivel-3 .desene { margin-top: 6px; }
  /* coloana e cel puţin 40mm (cât încape pe pagină), ca textul de sub desen
     să nu se rupă pe multe rânduri când desenul e mic; desenul are lăţimea lui */
  .usa-col { flex: 0 0 auto; width: max(calc(var(--hmax) * var(--r)), 40mm);
             max-width: calc((198mm - (var(--n) - 1) * 2mm) / var(--n)); min-width: 0; }
  .usa-col svg { width: calc(var(--hmax) * var(--r)); max-width: 100%; height: auto; display: block;
                 margin: 0 auto; font-family: Arial, sans-serif; }
  .usa-cap { text-align: center; margin-bottom: 2px; line-height: 1.15; }
  .usa-nr { display: block; font-size: 10px; color: #555; }
  .usa-cine { display: block; font-size: 15px; font-weight: 700; letter-spacing: .02em; line-height: 1.1; }
  .usa-sub { font-size: 10.5px; line-height: 1.3; margin-top: 3px; overflow-wrap: break-word; }
  .sub-et { color: #555; }
  body.nivel-1 .usa-sub { font-size: 9px; line-height: 1.15; margin-top: 1px; }
  body.nivel-1 .sub-et { display: none; }
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
  table.deb-semnaturi { flex: 0 0 54mm; width: 54mm; margin-top: 0; font-size: 13px; }
  table.deb-semnaturi td, table.deb-semnaturi th { padding: 1.2mm 2.5mm; height: 8mm; }
  table.deb-semnaturi td:first-child { width: 24mm; }
  table.deb-rame td, table.deb-rame th { white-space: nowrap; }
  table.obs-rame { margin-top: 0; margin-bottom: 4mm; }
  table.obs-rame { table-layout: fixed; }
  table.obs-rame th { font-size: 13px; background: #eee; }
  table.obs-rame td { height: 60mm; }
  /* codul de bare al comenzii — bandă îngustă deasupra capului de pagină,
     aliniată la dreapta; restul feţei rămâne aşezat exact ca înainte */
  .bara-cod { display: flex; justify-content: flex-end; align-items: center; gap: 4mm; margin: -2mm 0 2mm; }
  .numar-oferta { font-size: 15px; font-weight: 700; font-family: monospace; letter-spacing: .03em; }

  /* schiţa de găurire pt. CNC (verso, rame) */
  .schite-gaurire h2 { margin-top: 0; }
  .gaur-legenda { font-size: 10.5px; color: #444; margin-bottom: 3mm; }
  .gaur-lista { display: flex; flex-wrap: wrap; gap: 4mm 8mm; align-items: flex-start; margin-bottom: 4mm; }
  /* lăţimea = a desenului; titlul şi nota se rup pe rânduri, nu lăţesc coloana */
  .gaur-desen { break-inside: avoid; width: min-content; }
  .gaur-cap, .gaur-nota { min-width: 40mm; }
  .gaur-cap { font-size: 12px; margin-bottom: 1mm; }
  .gaur-desen svg { display: block; font-family: 'Segoe UI', Arial, sans-serif; }
  .gaur-nota { font-size: 12px; margin-top: 1mm; }
  .gaur-mana { height: 14mm; border-bottom: 1px solid #999; }
  /* cu schiţa de găurire pe verso, rubricile de observaţii sunt mai joase */
  .schite-gaurire + table.obs-rame td { height: 22mm; }
  .obs-camp { flex: 1; min-height: 12mm; border: 1.5px solid #000; border-radius: 2mm; padding: 1.5mm 2.5mm; }
  .obs-et { font-size: 14px; font-weight: 700; letter-spacing: .05em; }

</style></head>
<body>

  <div class="fata">
  ${oferta ? `<div class="bara-cod"><span class="numar-oferta">${esc(oferta.numar)}</span>${blocCod(oferta)}</div>` : ''}
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
      ${detalii}
      ${montaj}
    </div>
  </div>

  ${util ? tabel(['PAL (clientul)', 'Dimensiuni', 'Cant.'], panouriClient.map(r =>
        `<tr><td>${esc(r.label)}</td><td>${esc(r.cut)}</td><td class="num">${r.qty} buc</td></tr>`))
    : rame ? debitareRame(spec) : blocDesene(sys, spec)}

  <div class="jos">${necesarHtml}${eRame ? '' : campuriAtelier}</div>

  </div>

  <div class="spate">
    <div class="antet-mic"><strong>${esc(modelScurt)} — ${esc(finisajLabel)}</strong>${oferta ? ` · <strong>${esc(oferta.numar)}</strong>` : ''}
      ${client ? ` · ${esc(client)}` : ''} · ${acum()}</div>

    ${rame ? schiteGaurire(spec, rame) + observatiiRame : ''}
    ${rame || util ? '' : tabelDimensiuniPanouri(spec)}

    ${tabel(['Cod', 'Denumire', 'Cant.'],
        factura.lines.map(l => `<tr><td>${esc(l.cod)}</td><td>${esc(l.denumire ?? '—')}</td>
          <td class="num">${virgula(l.cantitate)}${l.um && l.um !== 'buc' ? ' ' + esc(l.um) : ''}</td></tr>`))}

    ${factura.errors.length ? factura.errors.map(e => `<div class="eroare">⚠ ${esc(e)}</div>`).join('') : ''}
    ${!factura.lines.length && !factura.errors.length
        ? '<div class="nota">Nicio linie de facturare pt. configuraţia asta.</div>' : ''}

    ${necesarSP}
  </div>

<script>
  // După ce se încarcă schiţa (altfel nu i se ştie înălţimea):
  //  1. schiţa se micşorează/măreşte ca cele două coloane din cap să se
  //     termine la aceeaşi înălţime (desenele pornesc de la o linie dreaptă);
  //  2. dacă faţa nu încape pe o foaie A4 (necesarul ar trece pe pagina 2 şi
  //     ar strica printul faţă-verso), se compactează în trepte, doar cât e
  //     nevoie: 1 = text compact + rânduri mai joase; 2, 3 = desene mai mici;
  //     (înainte de toate, secţiunea de montaj e limitată la 18% din foaie)
  //  3. faţa se întinde pe toată foaia — câmpurile de atelier umplu restul.
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
    // Secţiunea de montaj (titluri + desene + text) — max. 18% din înălţimea
    // foii (userul, 2026-09-21; înainte 30%). Se măsoară şi se micşorează desenele cât e
    // nevoie (de 2 ori: textul de sub desene se poate reaşeza la altă lăţime).
    var desene = document.querySelector('.desene');
    var hmax = 118;
    function setH(v) { hmax = Math.max(20, v); desene.style.setProperty('--hmax', hmax + 'mm'); }
    if (desene) {
      var lim = (297 * 0.18 - 1) * PX;   // 18% din foaie, 1mm rezervă pt. rotunjiri
      // se porneşte de la înălţimea DESENATĂ (poate fi deja mai mică decât hmax,
      // când lăţimea coloanei e cea care limitează), nu de la hmax
      for (var k = 0; k < 6 && desene.offsetHeight > lim; k++) {
        var svgEl = desene.querySelector('svg');
        if (!svgEl) break;
        var svgH = svgEl.getBoundingClientRect().height / PX;
        setH(svgH - (desene.offsetHeight - lim) / PX);
      }
    }
    aliniaza();
    for (var n = 1; n <= 3 && fata.offsetHeight > util; n++) {
      document.body.classList.add('nivel-' + n);
      if (n >= 2 && desene) setH(hmax * 0.85);   // treptele 2-3: desene şi mai mici
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

    // Verso (rame): schiţele de găurire se micşorează în trepte de 10% până încape
    // totul pe o foaie — altfel ce rămâne trece pe o a treia pagină şi strică
    // printul faţă-verso. Cel mult ~50% din mărime, să rămână cotele lizibile.
    var spate = document.querySelector('.spate'), schite = document.querySelectorAll('.gaur-desen svg');
    if (spate && schite.length) {
      for (var t = 0; t < 6 && spate.offsetHeight > 297 * PX * 0.98; t++) {
        schite.forEach(function (sv) {
          sv.style.width = (parseFloat(sv.style.width) * 0.9).toFixed(1) + 'mm';
          sv.style.height = (parseFloat(sv.style.height) * 0.9).toFixed(1) + 'mm';
        });
      }
    }
  });
</script>
<script>
  // Dialogul de print porneşte singur, după ce fişa s-a aşezat (scriptul de
  // încadrare de mai sus rulează tot la 'load', înregistrat înaintea ăstuia).
  window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 150); });
</script>
</body></html>`;

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
