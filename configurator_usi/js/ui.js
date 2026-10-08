import { state }                  from './state.js';
import { systems }                 from './systems/registry.js';
import { buildConfig, currentSpec, currentBom, currentClientPanels, currentBilling } from './builder.js';
import { clamp, qtyText }          from './lib/comun/num.js';
import { finishesOf }              from './familii.js';
import { copyRows } from './lib/comun/clipboard.js';
import { geamList, geamCount, GROSIMI_CLIENT, clientGeamLabel } from './lib/comun/geam.js';
import catalog from './catalog/catalog.generated.json';
import * as oferta from './oferta.js';
import { deschideFisa } from './fisa.js';
import { suprapuneriConfort, suprapuneriEfective, areCodH, areSinaSimpla } from './lib/confort/index.js';
import { geamPermisLux } from './lib/lux/index.js';
import gameJson from './systems/game.json';
import { renderRame, syncRame, refreshRame } from './ui_rame.js';
import { activeazaCampuri } from './campuri.js';
import { LIVRARE, AGENTI, PLATI, detaliiComanda, liniaTransport, campuriLipsa, focusCamp } from './lib/comun/comanda.js';
import { stareRameGoala } from './lib/rame/rame.js';
import { renderUtil } from './ui_util.js';
import { initSugestiiClienti } from './sugestii-clienti.js';
import * as cosul from './cos.js';
import { stareUtilGoala } from './lib/util/util.js';

// Toate accesele la DOM sunt tolerante la elemente lipsă (HTML din cache vechi).
const $ = id => document.getElementById(id);
const setText = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
const virgula = n => String(n).replace('.', ',');

// Câte articole are catalogul unei familii (avertisment „catalog gol" în UI).
const catalogCount = family =>
  family != null
    ? (catalog[family]?.length ?? 0)
    : Object.values(catalog).reduce((s, r) => s + r.length, 0);

// ── Readout: specificaţie + necesar materiale + facturare ────────────────────

function renderReadout() {
  const sys  = systems[state.system];
  const spec = currentSpec();
  setText('roModel', sys?.meta.label ?? state.system ?? '');

  const sum = $('roSummary');
  if (sum) {
    sum.innerHTML = (spec?.summary ?? [])
      .map(r => `<div class="row"><span>${r.label}</span><span>${r.value}</span></div>`)
      .join('');
  }

  const bom = $('roBom');
  if (bom) {
    const rows = currentBom();
    bom.innerHTML = rows.length === 0 ? '' : `
      <div class="bom-title">NECESAR MATERIALE</div>
      <table>
        <thead><tr><th>Cod</th><th>Reper</th><th class="num">Cant.</th><th>Debitare</th></tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td class="code">${esc(r.code)}</td>
              <td>${esc(r.label)}</td>
              <td class="num">${r.qty} ${r.unit}</td>
              <td class="num">${r.cut ?? '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  renderClientPanels();
  renderBilling();
}

// Necesarul clientului — listă separată de necesarul nostru: nimic de
// împachetat sau de facturat aici, doar cotele de care are nevoie ca să-şi
// comande panourile. Fără coloana „Cod" — nu sunt articole de-ale noastre.
function renderClientPanels() {
  const box = $('roClient');
  if (!box) return;

  const rows = currentClientPanels();
  box.innerHTML = rows.length === 0 ? '' : `
    <div class="bom-title">NECESAR CLIENT — ȘI LE PROCURĂ SINGUR</div>
    <table>
      <thead><tr><th>Reper</th><th class="num">Cant.</th><th>Debitare</th></tr></thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${r.label}</td>
            <td class="num">${r.qty} ${r.unit}</td>
            <td class="num">${r.cut ?? '—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="bill-hint">Nu intră nici în colet, nici în factură — sunt cotele
      după care clientul îşi comandă panourile.</div>`;
}

function renderBilling() {
  const box = $('roBilling');
  if (!box) return;

  const f = currentBilling();
  const { errors, mode } = f;
  // ofertă cu mai multe produse (js/cos.js): tabelul are facturarea pe TOATĂ oferta —
  // produsele din coş + cel de pe ecran, comasate (aşa se lipeşte în NeoManager)
  const altele = cos.pozitii.filter((_, k) => k !== cos.curent);
  const toataOferta = altele.length > 0;
  // în ordinea ofertei: produsul de pe ecran la locul lui din coş (sau la coadă, dacă e nou)
  const lista = cos.pozitii.map((x, k) => (k === cos.curent ? null : x));
  const peEcran = state.system ? { pozitie: { linii: { facturare: f.lines } } } : null;
  if (cos.curent != null) lista[cos.curent] = peEcran; else if (peEcran) lista.push(peEcran);
  const lines = toataOferta
    ? cosul.facturareComasata(cosul.transportOData(lista.filter(Boolean), liniaTransport(state)))
    : f.lines;
  const meta = systems[state.system]?.meta;
  const family = meta?.catalog ?? meta?.family;   // vezi nota din billing.js
  const catGol = [
    catalogCount(family) === 0
      ? `Catalog gol pentru familia <code>${family}</code> — populează <code>js/catalog/${family}.seed.sql</code> și rulează <code>npm run catalog</code>.`
      : null,
    geamCount() === 0
      ? `Catalog geam/oglindă gol — populează <code>js/catalog/geam.seed.sql</code> și rulează <code>npm run catalog</code>.`
      : null,
  ].filter(Boolean).map(m => `<div class="bill-err">${m}</div>`).join('');

  const tabel = lines.length ? `
    <table>
      <thead><tr><th>Cod</th><th>Denumire</th><th class="num">Cant.</th></tr></thead>
      <tbody>${lines.map(l => `<tr>
        <td class="code">${esc(l.cod)}</td>
        <td>${esc(l.denumire ?? '—')}</td>
        <td class="num">${virgula(l.cantitate)}${l.um && l.um !== 'buc' ? ' ' + l.um : ''}</td>
      </tr>`).join('')}</tbody>
    </table>` : '';

  const erori = errors.map(e => `<div class="bill-err">⚠ ${e}</div>`).join('');
  const disabled = (errors.length || !lines.length) ? ' disabled' : '';

  box.innerHTML = `
    <div class="bom-title">FACTURARE — NEOMANAGER${toataOferta ? ` · toată oferta (${altele.length + (state.system ? 1 : 0)} produse)` : ''}${mode ? ` <span class="bill-mode">${mode}</span>` : ''}</div>
    ${tabel}${catGol}${erori}
    <div class="bill-copy-buttons">
      <button id="btnCopyCod" class="btn-copy"${disabled}>Copiază coduri</button>
      <button id="btnCopyCant" class="btn-copy"${disabled}>Copiază cantități</button>
    </div>
    <div class="bill-hint">Paste pe coloană: selectezi celula de start din coloana „Cod" din
      NeoManager, dai paste cu „Copiază coduri" — apoi celula de start din „Cantitate",
      paste cu „Copiază cantități". O singură coloană per paste, fără TAB-uri.</div>`;

  // zecimale cu PUNCT + întotdeauna o zecimală (1 → "1.0") — acelaşi „fel" de
  // valoare numerică pe toate liniile.
  const flash = (btn, txt) => {
    const original = btn.textContent;
    btn.textContent = txt;
    setTimeout(() => { btn.textContent = original; }, 1400);
  };

  const btnCod = $('btnCopyCod');
  if (btnCod && !disabled) {
    btnCod.addEventListener('click', () => {
      copyRows(lines.map(l => [l.cod])).then(ok => flash(btnCod, ok ? '✓ copiat' : '⚠ eroare'));
    });
  }

  const btnCant = $('btnCopyCant');
  if (btnCant && !disabled) {
    btnCant.addEventListener('click', () => {
      copyRows(lines.map(l => [qtyText(l.cantitate)])).then(ok => flash(btnCant, ok ? '✓ copiat' : '⚠ eroare'));
    });
  }
}

// ── Schiţă ──────────────────────────────────────────────────────────────────

function updateSketch() {
  const sys     = systems[state.system];
  const groupEl = $('groupSchita');
  const imgEl   = $('schitaImg');
  if (sys?.meta?.sketch && imgEl && groupEl) {
    imgEl.src = sys.meta.sketch;
    groupEl.style.display = '';
  } else if (groupEl) {
    groupEl.style.display = 'none';
  }
}

// ── Finisaj (culori per sistem) ─────────────────────────────────────────────

function renderFinishes() {
  const box = $('colorSwatches');
  if (!box) return;

  // Fără model ales încă (ecranul iniţial la Confort) — nicio culoare de
  // arătat, fiindcă lista de finisaje depinde de model.
  const sys = systems[state.system];
  if (!sys) { box.innerHTML = ''; return; }

  const list = finishesOf(sys.meta);
  // Corectăm doar dacă exista deja o culoare (ex. schimbare de model, unde
  // vechea culoare nu mai e validă) — dacă e explicit goală (`null`, ecranul
  // iniţial la Confort), o lăsăm goală: userul trebuie s-o aleagă singur.
  if (state.finish != null && !list.some(f => f.id === state.finish)) state.finish = list[0].id;

  box.innerHTML = '';

  // `button`, nu `div` — se poate ajunge la el şi din tastatură.
  list.forEach(f => {
    const sw = document.createElement('button');
    sw.type      = 'button';
    sw.className = 'swatch' + (f.id === state.finish ? ' active' : '');
    sw.innerHTML = `<span class="pastila" style="background:${f.hex}"></span>` +
                   `<span class="nume">${f.label}</span>`;
    sw.addEventListener('click', () => {
      state.finish = f.id;
      renderFinishes();
      syncDoors();     // culoarea poate strânge nr. de uşi (Cupru la Standard)
      applyLimits();   // unele finisaje au limite proprii (ex. CUPRU la Confort)
      renderDoorsUI(); // AURIU/CUPRU n-au şină simplă → poate forţa 2 uşi / şină dublă
      renderWheels();  // la Confort, culoarea e una din condiţiile care arată cardurile de uşă
      rebuild();
    });
    box.appendChild(sw);
  });
}

// ── Geam / oglindă (catalog comun, nu depinde de sistem) — ales PER UŞĂ,
// randat ca <select> în cardul fiecărei uşi din renderWheels().
//
// La uşile asamblate de CLIENT nu alegi un model din catalog: geamul nu circulă
// prin noi (nici livrat, nici adus), clientul şi-l procură singur. Alegi doar
// GROSIMEA, fiindcă de ea depinde codul de garnitură pe care i-l trimitem.

// `grosimi` — LUX are garnitură doar pt. 4 mm, deci acolo doar 4 mm (sticlă şi oglindă)
function grosimeOptionsHtml(selected, grosimi = GROSIMI_CLIENT) {
  return grosimi.map(g =>
    `<option value="${g}"${g === selected ? ' selected' : ''}>${clientGeamLabel(g)}</option>`).join('');
}

// `permis(g)` — ce modele are voie gama (LUX: doar 4 mm, prin care nu se vede)
function geamOptionsHtml(selectedCod, permis = null) {
  const list = [...geamList()].filter(g => !permis || permis(g)).sort((a, b) =>
    a.oglinda - b.oglinda || a.grosime - b.grosime || a.denumire.localeCompare(b.denumire));
  const geamuri = list.filter(g => !g.oglinda);
  const oglinzi = list.filter(g => g.oglinda);
  const opt = g => `<option value="${g.cod}"${g.cod === selectedCod ? ' selected' : ''}>${g.denumire}</option>`;

  // Placeholder doar când chiar nu e ales nimic (`selectedCod == null`,
  // cazul Confort — vezi syncDoors); la Suspendată selectedCod e mereu un
  // cod real, deci rândul ăsta nu apare deloc acolo — zero schimbare vizuală.
  const placeholder = selectedCod == null ? `<option value="" selected disabled>Alege geam</option>` : '';

  return placeholder +
         (geamuri.length ? `<optgroup label="GEAM">${geamuri.map(opt).join('')}</optgroup>` : '') +
         (oglinzi.length ? `<optgroup label="OGLINDĂ">${oglinzi.map(opt).join('')}</optgroup>` : '');
}

// ── Role + montaj (per uşă) ──────────────────────────────────────────────────
// Role: o intrare per uşă { left, right } ∈ 'simpla' | 'amortizor'. Implicit
// „simplă"; se pot alege independent stânga şi dreapta (vin la set de 2, dar
// se pot vinde şi 1/2 set).
// Montaj: 'noi' | 'client' — cine asamblează uşa aia. Determină ce apare în
// necesar (rolă/şurub/geam/garnitură/perie intră în colet DOAR la 'client') şi
// facturarea manoperei (doar la 'noi').

// Redimensionează state.panels[i] la divisions[i]+1 intrări ('sticla' implicit
// pentru cele noi), păstrând alegerile existente pe poziţiile care rămân.
//
// La sistemele fără PAL (`meta.pal` lipsă — uşile suspendate A-F) forţăm tot pe
// 'sticla': altfel un panou pus pe PAL la un Confort supravieţuia schimbării de
// sistem, invizibil (chipurile nu se randează), şi scotea geamul din facturare.
function syncPanels(i, pal) {
  const count = (state.divisions[i] ?? 0) + 1;
  const arr = state.panels[i] ?? [];
  while (arr.length < count) arr.push('sticla');
  arr.length = count;
  state.panels[i] = pal ? arr : arr.map(() => 'sticla');

  // Opţiuni avansate (Confort) — la schimbarea nr. de panouri se resetează
  // complet (înălţimea „panoului 2" nu mai înseamnă nimic după ce s-a adăugat/
  // scos o divizare). Profilul H rămâne doar între două PAL-uri.
  const bare = count - 1;
  if (state.hPanouri[i]?.length !== count) state.hPanouri[i] = Array(count).fill(null);
  if (state.divProfil[i]?.length !== bare) state.divProfil[i] = Array(bare).fill('confort');
  const mats = state.panels[i];
  state.divProfil[i] = state.divProfil[i].map((pr, k) =>
    pr === 'H' && mats[k] === 'pal' && mats[k + 1] === 'pal' ? 'H' : 'confort');
}

function syncDoors() {
  const meta = systems[state.system]?.meta;
  // La Confort, 0 e o valoare validă („nimic ales încă", vezi selectSystem)
  // — NU se clampează spre minimul din doorsRange, altfel stepperul ar sări
  // singur pe 1 la orice schimbare de model (exact bug-ul raportat de user,
  // 2026-09-17). La restul familiilor (nr. de uşi fix pe model) neschimbat.
  const range = doorsRangeOf(meta);
  const n = range
    ? (state.doors > 0 ? clamp(state.doors, range[0], range[1]) : 0)
    : (meta ? (meta.doors ?? 1) : 0);   // fără model ales (ecran gol Confort): 0 uşi, nu 1
  state.doors = n;

  const wheels = state.wheels ?? [];
  while (wheels.length < n) wheels.push({ left: 'simpla', right: 'simpla' });
  wheels.length = n;
  state.wheels = wheels;

  const assembly = state.assembly ?? [];
  // implicit asamblează clientul, la toate gamele (userul, 2026-09-28; UTIL era deja aşa)
  while (assembly.length < n) assembly.push('client');
  assembly.length = n;
  state.assembly = assembly;

  const divisions = state.divisions ?? [];
  while (divisions.length < n) divisions.push(0);
  divisions.length = n;
  state.divisions = divisions;

  // Geamul NU se preselectează (dropdown-ul pornește pe „Alege geam" — vezi
  // geamOptionsHtml): userul alege explicit un model (Confort 2026-09-17,
  // suspendate 2026-09-21).
  const geamDefault = null;
  const geam = state.geam ?? [];
  while (geam.length < n) geam.push(geamDefault);
  geam.length = n;
  state.geam = geam;

  const geamClient = state.geamClient ?? [];
  while (geamClient.length < n) geamClient.push(GROSIMI_CLIENT[0]);
  geamClient.length = n;
  state.geamClient = geamClient;

  state.hPanouri  = (state.hPanouri ?? []).slice(0, n);
  state.divProfil = (state.divProfil ?? []).slice(0, n);

  const panels = state.panels ?? [];
  while (panels.length < n) panels.push([]);
  panels.length = n;
  state.panels = panels;
  const pal = !!meta?.pal;
  for (let i = 0; i < n; i++) syncPanels(i, pal);

  // Amortizare — doar Confort; la restul rămâne 'fara' oricum nefolosit (nu
  // se randează, nu apare în necesar).
  const amortizare = state.amortizare ?? [];
  while (amortizare.length < n) amortizare.push({ left: 'fara', right: 'fara' });
  amortizare.length = n;
  state.amortizare = amortizare;

  // LUX: mânerul aplicat — implicit fără (ofertele de dinainte nu-l au)
  const manerAplicat = state.manerAplicat ?? [];
  while (manerAplicat.length < n) manerAplicat.push('fara');
  manerAplicat.length = n;
  state.manerAplicat = manerAplicat;

  // Divizări APLICATE (Confort, opţiuni avansate) — benzi lipite pe PAL/sticlă,
  // nu separă panouri. lăţime: 'fara' | '10' | '20'; parte: 'fata' | 'spate' | 'ambele'.
  const divAplicate = state.divAplicate ?? [];
  while (divAplicate.length < n) divAplicate.push({ latime: 'fara', parte: 'fata', verticale: 0, orizontale: 0 });
  divAplicate.length = n;
  state.divAplicate = divAplicate;
}

// Cardul unei uşi: Uşa+Montaj / Divizări (doar numărul — tipul Confort/H a fost
// scos din UI) / Sticlă / Panouri / apoi Role LA SUSPENDATA sau Amortizări LA
// CONFORT (roţile Confort sunt fixe — vezi lib/confort/confort.js → confortWheelRows —
// deci selectorul vechi de Role nu mai avea sens acolo, rămas doar unde chiar
// contează, familia "suspendata").
// Re-randat integral la orice schimbare care poate ascunde/arăta un rând
// (nr. de divizări → nr. de panouri; material panou → apare/dispare Sticlă).
// Opţiuni avansate (doar Confort) — ce carduri au panoul deschis. Ţinut în UI,
// nu în `state`: e doar o preferinţă de afişare, nu intră în ofertă.
const avansatDeschis = new Set();

// Panoul avansat al uşii i, de SUS în JOS (ca chip-urile): panou, [bară H], panou…
// Indicii din date rămân de JOS în SUS (k = panou, b = bara dintre k şi k+1).
// Valorile automate (placeholder) şi eroarea le completează refreshAvansat()
// din spec-ul curent, după rebuild.
function avansatHtml(i) {
  const mats  = state.panels[i];
  const panes = mats.length;
  const rows  = [];
  // Divizarea H nu există la toate culorile (ex. AURIU) — atunci nu o oferim.
  const util = systems[state.system]?.meta.family === 'util';   // divizările sunt deja H
  const hDisponibil = !util && areCodH(systems[state.system]?.meta.catalog, state.finish);
  for (let k = panes - 1; panes > 1 && k >= 0; k--) {
    const fix = state.hPanouri[i]?.[k];
    rows.push(`
      <div class="av-rand av-panou">
        <span class="av-eticheta">Panou ${panes - k}${util ? '' : ` · ${mats[k] === 'pal' ? 'PAL' : 'Sticlă'}`}</span>
        <input type="number" class="av-inaltime" id="av-h-${i}-${k}" data-door="${i}" data-panou="${k}"
               step="1" min="1" value="${Number.isFinite(fix) ? fix : ''}" placeholder="auto">
        <span class="av-unit">mm</span>
      </div>`);
    if (k === 0) continue;
    const b = k - 1;
    if (!(mats[b] === 'pal' && mats[b + 1] === 'pal' && hDisponibil)) continue;
    const profil = state.divProfil[i]?.[b] ?? 'confort';
    rows.push(`
      <div class="av-rand av-bara">
        <div class="segmented mini av-profil" data-door="${i}" data-bara="${b}">
          <button data-v="confort"${profil === 'confort' ? ' class="active"' : ''}>Confort</button>
          <button data-v="H"${profil === 'H' ? ' class="active"' : ''}>H</button>
        </div>
      </div>`);
  }

  const da  = state.divAplicate[i];
  const seg = (camp, optiuni) => `
        <div class="segmented mini av-aplicate" data-door="${i}" data-camp="${camp}">
          ${optiuni.map(([v, text]) => `<button data-v="${v}"${da[camp] === v ? ' class="active"' : ''}>${text}</button>`).join('')}
        </div>`;
  const stepper = (camp, eticheta) => `
        <div class="av-rand">
          <span class="av-eticheta">${eticheta}</span>
          <div class="stepper mini av-aplicate-nr" data-door="${i}" data-camp="${camp}">
            <button data-dir="-1">−</button>
            <div class="n">${da[camp]}</div>
            <button data-dir="1">+</button>
          </div>
        </div>`;

  return `
    <div class="door-avansat">
      <div class="av-stanga">
        ${panes > 1 ? `
        <div class="av-nota">Înălţimea de debitare a panoului. Gol = automat (împart egal restul).</div>
        ${rows.join('')}
        <div class="av-eroare" id="av-err-${i}"></div>` : '<div class="av-nota">Fără divizări.</div>'}
      </div>
      <div class="av-dreapta">
        <div class="av-nota">Divizări aplicate</div>
        ${seg('latime', [['fara', 'Fără'], ['10', '10mm'], ['20', '20mm']])}
        ${util ? '' : seg('parte', [['fata', 'Faţă'], ['spate', 'Spate'], ['ambele', 'Faţă şi spate']])}
        ${stepper('verticale', 'Verticale')}
        ${stepper('orizontale', 'Orizontale')}
      </div>
    </div>`;
}

function refreshAvansat() {
  const panels = currentSpec()?.glass?.panels;
  for (const i of avansatDeschis) {

    const p = panels?.[i];
    if (!p?.heights) continue;
    p.heights.forEach((h, k) => {
      const el = $(`av-h-${i}-${k}`);
      if (el) el.placeholder = `auto ${Math.round(h)}`;
    });
    setText(`av-err-${i}`, p.eroare ? `⚠ ${p.eroare}` : '');
  }
}

// ── Uşi identice / diferite (userul, 2026-10-05) ────────────────────────────
// Identice (implicit): un singur card; ce alegi pe el se copiază la toate uşile.
// Diferite: câte un card pe uşă, pornind de la ce era ales pe cardul comun.
// Ofertele de dinainte (fără alegerea salvată în config): identice doar dacă
// uşile chiar sunt la fel — altfel nu le stricăm.
const PER_USA = ['divisions', 'wheels', 'assembly', 'geam', 'geamClient', 'hPanouri', 'divProfil', 'panels', 'amortizare', 'divAplicate', 'manerAplicat'];
const toateLaFel = () => PER_USA.every(k => (state[k] ?? []).every(x => JSON.stringify(x) === JSON.stringify(state[k][0])));
const usiIdentice = () => (state.usiIdentice ??= toateLaFel());
function aliniazaUsile() {
  if (state.doors < 2 || !usiIdentice()) return;
  for (const k of PER_USA) {
    if (Array.isArray(state[k])) for (let i = 1; i < state[k].length; i++) state[k][i] = structuredClone(state[k][0]);
  }
}

function renderWheels() {
  const box = $('wheelsUI');
  const groupUsi = $('groupUsi');
  if (!box) return;
  syncDoors();
  aliniazaUsile();   // uşile noi (nr. de uşi crescut) iau opţiunile cardului comun

  // Tipul de divizor Confort/H e specific familiei Confort — uşile suspendate
  // (A-F) au un singur tip (H), deci nu arătăm alegerea (n-are sens un selector
  // cu o singură opţiune). Panourile PAL se declară per sistem (`meta.pal`).
  const meta      = systems[state.system]?.meta;
  // Gama rame n-are carduri de uşă — are panoul ei de rânduri (ui_rame.js).
  if (meta?.rame || currentGama() === 'rame') {
    box.innerHTML = '';
    if (groupUsi) groupUsi.style.display = 'none';
    return;
  }
  const isConfort = meta?.family === 'confort';
  // LUX: cardul ca la Confort (amortizări 35 / 60 kg, PAL sau sticlă), fără rândul Role
  const isLux     = meta?.family === 'lux';
  // UTIL: panourile sunt ale clientului — cardul are doar divizări (profil H) şi
  // opţiunile avansate (înălţimi de panou, divizări aplicate), ca la Confort.
  const isUtil    = meta?.family === 'util';
  const hasPal    = !!meta?.pal;
  // LUX: mânerul aplicat — doar în culorile care îl au (nu auriu, nu cupru)
  const areManerAplicat = isLux && (catalog[meta.catalog] ?? []).some(a => a.tip === 'maner aplicat' && a.finisaj === state.finish);
  // UTIL are o singură amortizare (35 kg, cod 341); Confort 35 şi 60 kg
  const claseAmortizare = isUtil ? ['fara', '35kg'] : ['fara', '35kg', '60kg'];

  // Niciun card de uşă „implicit" — rămân ascunse cât timp nu s-au ales TOATE
  // din: model, culoare, cote (H+L, vezi latimeAtinsa/inaltimeAtinsa) şi — doar
  // la sistemele cu nr. de uşi ales (Confort) — nr. de uşi. `!meta` = ecranul
  // iniţial gol (niciun model ales). Confort 2026-09-17, suspendate 2026-09-21.
  const carduriGata = configuratieCompleta();
  if (!carduriGata) {
    box.innerHTML = '';
    if (groupUsi) groupUsi.style.display = 'none';
    return;
  }
  if (groupUsi) groupUsi.style.display = '';

  // Uşi identice / diferite — doar la mai multe uşi (înlocuieşte „Cine asamblează toate uşile")
  const mai = state.wheels.length > 1, identice = mai && usiIdentice();
  const comutator = mai ? `
    <div class="door-row toate-usi">
      <div class="segmented mini" data-usi-identice="1">
        <button data-v="1"${identice ? ' class="active"' : ''}>Uşi identice</button>
        <button data-v="0"${identice ? '' : ' class="active"'}>Uşi diferite</button>
      </div>
      ${identice ? `<span class="toate-usi-nota">un singur card pentru toate cele ${state.wheels.length} uşi</span>` : ''}
    </div>` : '';

  box.innerHTML = comutator + state.wheels.map((w, i) => {
    if (identice && i > 0) return '';   // uşi identice: doar cardul comun (al uşii 1)
    const panels   = state.panels[i];
    const hasGlass = panels.some(mat => mat !== 'pal');
    const client   = state.assembly[i] === 'client';

    const areAvansat = true;   // opţiuni avansate la ambele familii
    const deschis    = areAvansat && avansatDeschis.has(i);

    return `
    <div class="door-card${areAvansat ? ' cu-avansat' : ''}">
      <!-- coloana stângă: restul câmpurilor -->
      <div class="door-fields-col">
        <div class="door-row">
          <span class="door-row-label">${identice ? 'Toate uşile' : `Uşa ${i + 1}`}</span>
          <div class="segmented mini" data-door="${i}" data-assembly="1">
            <button data-v="noi"${state.assembly[i] === 'noi' ? ' class="active"' : ''}>Noi</button>
            <button data-v="client"${state.assembly[i] === 'client' ? ' class="active"' : ''}>Client</button>
          </div>
        </div>

        <div class="door-row">
          <span class="door-row-label">Div.</span>
          <div class="stepper mini" data-door="${i}">
            <button data-dir="-1">−</button>
            <div class="n">${state.divisions[i]}</div>
            <button data-dir="1">+</button>
          </div>
        </div>

        ${isUtil ? '' : `<div class="door-row">
          <span class="door-row-label">Sticlă</span>
          <select class="geam-select" data-door="${i}" data-client="${client ? 1 : 0}"${hasGlass ? '' : ' disabled'}>${
            !hasGlass ? '<option>Fără geam — numai PAL</option>'
              : client ? grosimeOptionsHtml(state.geamClient[i], isLux ? [4] : undefined)
                       : geamOptionsHtml(state.geam[i], isLux ? geamPermisLux : null)
          }</select>
        </div>`}

        ${!isConfort && !isUtil && !isLux ? `
        <div class="door-row door-row-role">
          <span class="door-row-label">Role</span>
          <!-- ca amortizările de la Confort: Stânga/Dreapta deasupra, butoane
               Simplă/Amortizare (userul, 2026-09-21) -->
          <div class="amortizare-grup">
            ${[['left', 'Stânga'], ['right', 'Dreapta']].map(([parte, eticheta]) => `
            <div class="amortizare-parte">
              <span class="amortizare-parte-label">${eticheta}</span>
              <div class="segmented mini" data-door="${i}" data-side="${parte}">
                <button data-v="simpla"${w[parte] === 'simpla' ? ' class="active"' : ''}>Simplă</button>
                <button data-v="amortizor"${w[parte] === 'amortizor' ? ' class="active"' : ''}>Amortizare</button>
              </div>
            </div>`).join('')}
          </div>
        </div>` : ''}

        ${isConfort || isUtil || isLux ? `
        <div class="door-row door-row-amortizare">
          <span class="door-row-label">Amortizări</span>
          <div class="amortizare-grup">
            <div class="amortizare-parte">
              <span class="amortizare-parte-label">Stânga</span>
              <div class="segmented mini" data-door="${i}" data-amortizare="left">
                ${claseAmortizare.map(v => `<button data-v="${v}"${
                  (state.amortizare[i]?.left ?? 'fara') === v ? ' class="active"' : ''
                }>${v === 'fara' ? 'Fără' : v}</button>`).join('')}
              </div>
            </div>
            <div class="amortizare-parte">
              <span class="amortizare-parte-label">Dreapta</span>
              <div class="segmented mini" data-door="${i}" data-amortizare="right">
                ${claseAmortizare.map(v => `<button data-v="${v}"${
                  (state.amortizare[i]?.right ?? 'fara') === v ? ' class="active"' : ''
                }>${v === 'fara' ? 'Fără' : v}</button>`).join('')}
              </div>
            </div>
          </div>
        </div>` : ''}

        ${areManerAplicat ? `
        <div class="door-row">
          <span class="door-row-label">Mâner aplicat</span>
          <div class="segmented mini" data-door="${i}" data-maner-aplicat="1">
            ${[['fara', 'Fără'], ['stanga', 'Stânga'], ['dreapta', 'Dreapta'], ['ambele', 'Stânga şi dreapta']].map(([v, t]) =>
              `<button data-v="${v}"${(state.manerAplicat?.[i] ?? 'fara') === v ? ' class="active"' : ''}>${t}</button>`).join('')}
          </div>
        </div>` : ''}

        ${areAvansat ? `
        <div class="door-row">
          <button class="btn-avansat${deschis ? ' active' : ''}" data-door="${i}">
            ${deschis ? '▾' : '▸'} Opţiuni avansate</button>
        </div>` : ''}
      </div>

      ${hasPal ? `
      <!-- coloana dreaptă: panourile, în ordinea din uşa reală (primul chip =
           panoul de SUS). În state.panels[i], indicele 0 e panoul de JOS — aşa
           le construieşte randarea (buildDoor urcă de la innerBot), deci aici
           întoarcem doar AFIŞAREA, nu şi datele: data-panel rămâne indicele
           adevărat. -->
      <div class="door-panels-col">
        ${panels.map((mat, j) => ({ mat, j })).reverse().map(({ mat, j }) => `
          <button class="panel-chip ${mat}" data-door="${i}" data-panel="${j}">${mat === 'pal' ? (isConfort || isLux ? 'PAL' : 'PAL 10mm') : 'St'}</button>`).join('')}
      </div>` : ''}

      ${deschis ? avansatHtml(i) : ''}
    </div>`;
  }).join('');

  box.querySelectorAll('.btn-avansat').forEach(btn => {
    btn.addEventListener('click', () => {
      const door = +btn.dataset.door;
      if (avansatDeschis.has(door)) avansatDeschis.delete(door);
      else                          avansatDeschis.add(door);
      renderWheels();
    });
  });

  // Înălţime de panou — gol / nevalid = înapoi pe automat.
  box.querySelectorAll('input.av-inaltime').forEach(inp => {
    inp.addEventListener('change', () => {
      const door = +inp.dataset.door, panou = +inp.dataset.panou;
      const val  = parseInt(inp.value, 10);
      state.hPanouri[door][panou] = val > 0 ? val : null;
      renderWheels();
      rebuild();
    });
  });

  box.querySelectorAll('.av-aplicate').forEach(seg => {
    const door = +seg.dataset.door, camp = seg.dataset.camp;
    seg.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.divAplicate[door][camp] = btn.dataset.v;
        seg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
        rebuild();
      });
    });
  });

  box.querySelectorAll('.av-aplicate-nr').forEach(st => {
    const door = +st.dataset.door, camp = st.dataset.camp;
    st.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const da = state.divAplicate[door];
        da[camp] = clamp(da[camp] + (+btn.dataset.dir), 0, 20);
        st.querySelector('.n').textContent = da[camp];
        rebuild();
      });
    });
  });

  box.querySelectorAll('.av-profil').forEach(seg => {
    const door = +seg.dataset.door, bara = +seg.dataset.bara;
    seg.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.divProfil[door][bara] = btn.dataset.v;
        renderWheels();
        rebuild();
      });
    });
  });

  box.querySelectorAll('select.geam-select').forEach(sel => {
    const door = +sel.dataset.door;
    sel.addEventListener('change', () => {
      if (sel.dataset.client === '1') state.geamClient[door] = +sel.value;
      else                            state.geam[door] = sel.value;
      rebuild();
    });
  });

  // nr. de divizări schimbă şi nr. de panouri (şi poate ascunde/arăta rândul
  // Sticlă) → re-randăm tot cardul, nu doar cifra.
  box.querySelectorAll('.stepper.mini[data-door]:not(.av-aplicate-nr)').forEach(st => {
    const door = +st.dataset.door;
    st.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.divisions[door] = clamp(state.divisions[door] + (+btn.dataset.dir), 0, 8);
        syncPanels(door, hasPal);
        renderWheels();
        rebuild();
      });
    });
  });

  // material per panou (sticlă ↔ PAL) — poate ascunde/arăta rândul Sticlă
  box.querySelectorAll('.panel-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const door = +chip.dataset.door, j = +chip.dataset.panel;
      state.panels[door][j] = state.panels[door][j] === 'pal' ? 'sticla' : 'pal';
      renderWheels();
      rebuild();
    });
  });

  // montajul schimbă ce oferă selectul de sticlă (model din catalog la 'noi',
  // doar grosimea la 'client') → re-randăm tot cardul, nu doar clasa activă.
  box.querySelectorAll('.segmented.mini[data-assembly]').forEach(seg => {
    const door = +seg.dataset.door;
    seg.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.assembly[door] = btn.dataset.v;
        renderWheels();
        rebuild();
      });
    });
  });

  box.querySelectorAll('[data-usi-identice] button').forEach(btn => {
    btn.addEventListener('click', () => {
      const da = btn.dataset.v === '1';
      if (da === usiIdentice()) return;
      // înapoi la identice: celelalte uşi iau opţiunile uşii 1 — întrebăm dacă diferă
      if (da && !toateLaFel() && !confirm('Toate uşile iau opţiunile uşii 1. Continui?')) return;
      state.usiIdentice = da;
      renderWheels();
      rebuild();
    });
  });

  box.querySelectorAll('.segmented.mini[data-side]').forEach(seg => {
    const door = +seg.dataset.door, side = seg.dataset.side;
    seg.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.wheels[door][side] = btn.dataset.v;
        seg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
        rebuild();
      });
    });
  });

  box.querySelectorAll('[data-maner-aplicat]').forEach(seg => {
    const door = +seg.dataset.door;
    seg.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
      state.manerAplicat[door] = btn.dataset.v;
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
      rebuild();
    }));
  });

  box.querySelectorAll('.segmented.mini[data-amortizare]').forEach(seg => {
    const door = +seg.dataset.door, parte = seg.dataset.amortizare;
    seg.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.amortizare[door][parte] = btn.dataset.v;
        seg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
        rebuild();
      });
    });
  });

  refreshAvansat();
}

// ── Nr. uşi + piste (doar sisteme cu meta.doorsRange — Confort) ───────────

// Nr. de suprapuneri — înlocuieşte vechiul selector Şină Simplă/Dublă.
// ALEGERE REALĂ doar la 2 uşi (0 = şină simplă/tracks=1, valoarea confirmată
// din OVERLAPS_2TRACK = şină dublă/tracks=2 — vezi suprapuneriConfort în
// lib/confort/confort.js). La 1 uşă şi la 3+ uşi NU există variantă cu şină simplă —
// userul a confirmat explicit ("nu am şi cu mai mult de 2 uşi şi 0
// suprapuneri") — deci acolo valoarea se PUNE AUTOMAT (tracks forţat),
// afişată doar informativ, cu un singur buton nefuncţional.
function renderDoorsUI() {
  const meta = systems[state.system]?.meta;
  const groupDoorsTracks = $('groupDoorsTracks');
  const variable = !!meta?.doorsRange;

  if (groupDoorsTracks) groupDoorsTracks.style.display = variable ? '' : 'none';
  if (!variable) return;

  setText('doorsVal', state.doors);

  const tracksBox = $('tracksToggle');
  if (!tracksBox) return;

  // AURIU / CUPRU: nu există şină simplă — o uşă singură nu se poate face,
  // se trece automat pe 2 uşi (setDoors re-randează tot).
  if (faraSinaSimpla() && state.doors === 1) { setDoors(2); return; }

  // Gamele cu suprapuneri fixe pe nr. de uşi (UTIL): mereu şină dublă, valoarea
  // doar afişată (— cât timp nu e ales nr. de uşi).
  if (meta.suprapuneri) {
    state.tracks = 2;
    tracksBox.innerHTML = `<button class="active" disabled>${meta.suprapuneri(state.doors) ?? '—'}</button>`;
    return;
  }

  const dublu = suprapuneriConfort(state.doors);

  if (state.doors === 2 && !faraSinaSimpla()) {
    tracksBox.innerHTML = [0, dublu].map(v =>
      `<button data-v="${v}"${(v === 0 ? 1 : 2) === state.tracks ? ' class="active"' : ''}>${v}</button>`).join('');

    tracksBox.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.tracks = +btn.dataset.v === 0 ? 1 : 2;
        renderDoorsUI();
        rebuild();
      });
    });
    return;
  }

  // 1 uşă sau 3+ uşi: fără şină simplă — se pune automat, un singur buton,
  // needitabil.
  // (şi 2 uşi la culorile fără şină simplă — acolo doar şină dublă)
  state.tracks = state.doors === 1 ? 1 : 2;
  const valoare = state.doors === 1 ? 0 : dublu;
  tracksBox.innerHTML = `<button class="active" disabled>${valoare}</button>`;
}

// Culori fără şină simplă (AURIU, CUPRU): uşile se pot face doar pe şină dublă,
// deci minim 2 uşi şi fără opţiunea „0 suprapuneri".
// (Plus sistemele cu `meta.suprapuneriObligatorii` — Suspendată Standard: uşile
// merg mereu cu suprapuneri, nu există varianta „0".)
const faraSinaSimpla = () => {
  const meta = systems[state.system]?.meta;
  if (meta?.suprapuneriObligatorii) return true;
  return meta?.family === 'confort' && !!state.finish && !areSinaSimpla(meta.catalog, state.finish);
};

function setDoors(n) {
  const [lo, hi] = doorsRangeOf(systems[state.system]?.meta) ?? [1, 7];
  state.doors = clamp(n, faraSinaSimpla() ? Math.max(lo, 2) : lo, hi);
  syncDoors();
  applyLimits();   // lăţimea max poate depinde de nr. de uşi (limitsFinisaj.widthUsi)
  renderDoorsUI();
  renderWheels();
  rebuild();
}

// Nr. de uşi permis — o culoare îl poate strânge (limitsFinisaj.doors, ex. Cupru la Standard).
const doorsRangeOf = meta => meta?.limitsFinisaj?.[state.finish]?.doors ?? meta?.doorsRange;

// ── Limite de gol (per model) ───────────────────────────────────────────────

function applyLimits() {
  const meta = systems[state.system]?.meta;
  const lim  = meta?.limits;
  if (!lim) return;

  // Unele finisaje au limite mai strânse decât restul (ex. CUPRU la Confort,
  // lăţime max 3500 în loc de 5800) — meta.limitsFinisaj suprascrie doar ce
  // diferă, restul vine din meta.limits.
  const suprascriere = meta.limitsFinisaj?.[state.finish];
  const [wMin, wMax] = suprascriere?.widthUsi?.[state.doors] ?? suprascriere?.width ?? lim.width;
  const [hMin, hMax] = suprascriere?.height ?? lim.height;

  state.width  = clamp(state.width,  wMin, wMax);
  state.height = clamp(state.height, hMin, hMax);

  const wIn = $('widthInput'), hIn = $('heightInput');
  // Neatins încă (ecran gol Confort) → câmpul rămâne gol în UI, deşi
  // state.width/height tocmai au fost clampate mai sus (rămân valide pt. 3D).
  if (wIn) { wIn.min = wMin; wIn.max = wMax; wIn.value = latimeAtinsa   ? state.width  : ''; }
  if (hIn) { hIn.min = hMin; hIn.max = hMax; hIn.value = inaltimeAtinsa ? state.height : ''; }
  setText('widthHint',  `${wMin}–${wMax}`);
  setText('heightHint', `${hMin}–${hMax}`);
}

// ── Rebuild ─────────────────────────────────────────────────────────────────

function rebuild() {
  aliniazaUsile();   // uşi identice: ce s-a schimbat pe cardul comun ajunge la toate uşile
  buildConfig(); refreshAvansat(); refreshRame(); renderReadout(); renderOferta();
  document.dispatchEvent(new Event('configurator:rebuild'));   // interfaţa nouă (ui_nou.js) îşi actualizează paşii
}

// Gama rame: în locul cotelor de gol / nr. de uşi / cardurilor de uşă apare
// panoul de rânduri (js/ui_rame.js) — după ce s-a ales modelul.
function aplicaGama() {
  const eRame = currentGama() === 'rame';
  for (const id of ['groupHeight', 'groupWidth']) { const el = $(id); if (el) el.style.display = eRame ? 'none' : ''; }
  const grup = $('groupRame');
  const areModel = !!systems[state.system]?.meta.rame;
  if (grup) grup.style.display = eRame && areModel ? '' : 'none';
  if (eRame && areModel) { syncRame(); renderRame($('rameUI'), { rebuild, geamOptionsHtml }); }

  const eUtil = systems[state.system]?.meta.family === 'util';
  const grupUtil = $('groupUtil');
  if (grupUtil) grupUtil.style.display = eUtil ? '' : 'none';
  if (eUtil) renderUtil($('utilUI'), { rebuild });
}

// ── Detaliile comenzii (livrare / metodă de plată / agent) — la toate gamele ─
// Pornesc pe „Alege…"; la rame sunt obligatorii (blochează facturarea, ca în
// formularul Excel), la celelalte game doar se trec pe ofertă şi pe fişă.
function initDetaliiComanda() {
  const det = detaliiComanda(state);   // ofertele vechi de rame le aveau în state.rame
  state.comanda = { ...det };
  // lista: valori simple sau perechi [cod, text] (metodele de plată)
  for (const [id, lista, alege] of [['comandaLivrare', LIVRARE, 'Mod de livrare'],
                                    ['comandaPlata', PLATI, 'Metodă de plată'], ['comandaAgent', AGENTI, 'Agent']]) {
    const sel = $(id);
    if (!sel) continue;
    const ales = state.comanda[sel.dataset.c];
    sel.innerHTML = `<option value=""${ales ? '' : ' selected'} disabled>${alege}</option>` +
      lista.map(v => { const [cod, text] = Array.isArray(v) ? v : [v, v];
        return `<option value="${esc(cod)}"${cod === ales ? ' selected' : ''}>${esc(text)}</option>`; }).join('');
    sel.addEventListener('change', () => { state.comanda[sel.dataset.c] = sel.value; rebuild(); });
  }
}

// ── Ofertă (coş + confirmare) ───────────────────────────────────────────────
// Panoul apare DOAR când configuratorul e servit de managerul de comenzi.
// Deschis direct de pe disc, oferta.js raportează 'fara-server' şi nu randăm
// nimic — configuratorul rămâne folosibil singur, ca până acum.

const esc = t => String(t ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function renderOferta() {
  const box   = $('ofertaUI');
  const btn   = $('btnConfirma');
  const acasa = $('linkAcasa');
  if (!box || !btn) return;

  const { stare, utilizator } = oferta.stareOferta();
  const servit = stare === 'logat' || stare === 'nelogat';

  // Gama nu se mai schimbă din configurator, deci drumul înapoi spre pagina
  // principală trebuie să fie la vedere — dar numai când există unde să te duci.
  // Pe Cloudflare Pages (fără manager) build_pages.js pune <meta name="acasa">
  // cu adresa paginii principale statice.
  const acasaStatic = document.querySelector('meta[name="acasa"]')?.content;
  if (acasa && !servit && acasaStatic) acasa.href = acasaStatic;
  if (acasa) acasa.style.display = servit || acasaStatic ? '' : 'none';

  // Câmpurile clientului şi „Printează fişa" sunt statice (index.html) şi merg
  // mereu; aici se decide doar ce ţine de ofertă: butonul de salvare şi
  // rezumatul de deasupra lui.
  const butoane = [btn, $('btnComanda'), $('btnPlata')].filter(Boolean);
  const arata = da => { for (const b of butoane) b.style.display = da ? '' : 'none'; $('ofertaNr').style.display = da ? '' : 'none'; };
  if (!servit || modFisa) { box.innerHTML = ''; arata(false); return; }

  if (stare === 'nelogat') {
    arata(false);
    box.innerHTML = `<div class="oferta-hint">Autentifică-te ca să poţi salva oferte.
      <a href="/login?redirect=${encodeURIComponent(location.pathname + location.search)}">Intră în cont</a></div>`;
    return;
  }

  // Ce anume se trimite — arătat înainte de salvare, ca să nu fie surprize.
  const p = oferta.pozitieCurenta();
  const t = cosul.toate(cos, curentaUsi());
  const altele = (t.pozitii?.length ?? cos.pozitii.length) - (state.system && !p.eroare ? 1 : 0);
  box.innerHTML = `
    <div class="oferta-cine dim mic">${esc(utilizator.nume)}</div>
    ${!state.system && cos.pozitii.length ? ''   // nimic pe ecran, dar coşul are produse — se salvează ele
      : p.eroare
      ? `<div class="oferta-msg eroare">${esc(ceLipseste() || p.eroare)}</div>`
      : `<div class="oferta-sumar">
           <strong>${esc(p.pozitie.eticheta)}</strong>
           <div class="dim mic">${p.pozitie.latime}×${p.pozitie.inaltime} mm ·
             ${esc(p.pozitie.finisaj)} · ${systems[state.system]?.meta.rame
               ? `${currentSpec()?.nrRame ?? 0} rame`
               : `${p.pozitie.nrUsi} ${p.pozitie.nrUsi === 1 ? 'uşă' : 'uşi'}`}</div>
         </div>`}
    ${altele > 0 ? `<div class="oferta-hint">+ ${altele} ${altele === 1 ? 'alt produs' : 'alte produse'} în ofertă (cardurile de sus) — se salvează împreună</div>` : ''}`;
  arata(true);
  // se salvează tot coşul + produsul de pe ecran; unul început dar neterminat blochează
  for (const b of butoane) b.disabled = !t.pozitii;
  document.dispatchEvent(new Event('configurator:oferta'));   // starea din ui_nou (butoanele s-au arătat)
}

// ── Coşul ofertei (js/cos.js): mai multe produse pe o ofertă ────────────────
let cos = cosul.citeste();
let cardCos = null;
// produsul de pe ecran: null = neînceput (nu s-a ales modelul)
function curentaUsi() {
  if (!state.system) return null;
  const p = oferta.pozitieCurenta();
  if (p.eroare) return { eroare: p.eroare };
  if (!configuratieCompleta()) return { eroare: 'configuraţia nu e completă.' };
  return { gama: systems[state.system].meta.family, pozitie: p.pozitie };
}
const clientPtCos = () => ({
  client: { nume: $('clientNume').value, telefon: $('clientTelefon').value, adresa: $('clientAdresa').value },
  ofertaNr: $('ofertaNr').value, comanda: detaliiComanda(state) });

function mesajOferta(html, fel) {
  const el = $('ofertaMesaj');
  if (el) el.innerHTML = `<div class="oferta-msg ${fel}">${html}</div>`;
}

// Plata + avansul pt. „Salvează comanda" — null dacă s-a renunţat.
function cerePlata() {
  const dlg = $('dialogPlata');
  $('formPlata').reset();
  $('plataMod').value = state.comanda?.plata ?? '';   // metoda aleasă în bara clientului
  return new Promise(gata => {
    $('plataRenunta').onclick = () => dlg.close();
    $('formPlata').onsubmit = e => { e.preventDefault(); dlg.close('ok'); };
    dlg.onclose = () => gata(dlg.returnValue === 'ok' ? { plata: $('plataMod').value, avans: $('plataAvans').value } : null);
    dlg.returnValue = '';
    dlg.showModal();
  });
}

const TEXT_BUTON = { oferta: 'Salvează oferta', comanda: 'Salvează comanda', plata: 'Aşteaptă plata' };
const textButoane = () => {
  $('btnConfirma').textContent = cos.ofertaEditata ? 'Salvează modificările' : TEXT_BUTON.oferta;
  $('btnComanda').textContent = TEXT_BUTON.comanda;
  $('btnPlata').textContent   = TEXT_BUTON.plata;
};

// unde: 'oferta' (rămâne ofertă) | 'comanda' (în lucru) | 'plata' (aşteaptă plata).
// Oferta se salvează întâi (POST / PUT), apoi, la comandă / plată, trece mai departe.
async function trimiteOferta(unde = 'oferta') {
  const ofertaNr = $('ofertaNr').value.trim();
  // obligatorii: numele, livrarea, agentul, nr. ofertei; la „Salvează comanda" şi telefonul + adresa
  const lipsa = campuriLipsa({ laAcceptare: unde === 'comanda' });
  if (lipsa.length) {
    focusCamp(lipsa[0].id);
    return mesajOferta(`Completează ${lipsa.map(x => x.text).join(', ')}.`, 'eroare');
  }
  const tot = cosul.toate(cos, curentaUsi());
  if (tot.eroare) return mesajOferta(esc(tot.eroare), 'eroare');
  const plata = unde === 'comanda' ? await cerePlata() : null;
  if (unde === 'comanda' && !plata) return;

  const butoane = ['btnConfirma', 'btnComanda', 'btnPlata'].map($);
  for (const b of butoane) b.disabled = true;
  $(unde === 'oferta' ? 'btnConfirma' : unde === 'comanda' ? 'btnComanda' : 'btnPlata').textContent = 'Se salvează…';

  // Un singur câmp de contact (adresă SAU telefon) — merge în coloana de
  // telefon a comenzii; managerul îl afişează ca „Telefon / adresă".
  const r = await oferta.confirma({
    ofertaNr,
    id:         cos.ofertaEditata,
    pozitii:    cosul.transportOData(tot.pozitii, liniaTransport(state)).map(x => x.pozitie),
    nume:       $('clientNume').value,
    telefon:    $('clientTelefon').value,
    adresa:     $('clientAdresa').value,
    detalii:    detaliiComanda(state),
    email:      '',
    observatii: '',
  });

  const gata = () => { for (const b of butoane) b.disabled = false; textButoane(); };
  if (r.eroare) { gata(); return mesajOferta(esc(r.eroare), 'eroare'); }

  // Câmpurile NU se mai golesc: aceleaşi date servesc şi la fişa de atelier,
  // care se printează de obicei imediat după. CLEAR PAGE resetează tot.
  // dacă trecerea mai departe (comandă / aşteaptă plata) eşuează, rămâi aici şi
  // butoanele lucrează pe ACEEAŞI ofertă — o nouă apăsare n-o dublează
  Object.assign(cos, clientPtCos(), { ofertaEditata: r.comanda.id, numar: ofertaNr || r.comanda.numar });
  cosul.scrie(cos);

  // după salvare: direct pe pagina comenzii din manager (userul, 2026-09-28); coşul s-a golit
  const laComanda = () => { cosul.goleste(); location.href = '/#comanda/' + r.comanda.id; };
  if (unde === 'oferta') return laComanda();

  const t = await oferta.treceIn(r.comanda.id, unde, plata ?? {});
  if (t.eroare) {
    gata();
    return mesajOferta(`Oferta <strong>${esc(ofertaNr || r.comanda.numar)}</strong> s-a salvat, dar ${unde === 'comanda'
      ? 'nu a devenit comandă' : 'nu a trecut la „Aşteaptă plata"'}: ${esc(t.eroare)}`, 'eroare');
  }
  laComanda();
}

// Ultima ofertă salvată + configuraţia de atunci. Fişa primeşte codurile de
// bare DOAR dacă configuraţia n-a mai fost schimbată de la salvare — altfel
// codurile ar fi ale altei comenzi decât ce e desenat pe fişă.
let ofertaSalvata = null;
// Fişa unei comenzi deschisă din manager (?fisa=<id>) — orice stare (ofertă,
// în lucru, finalizată): { numar, client, bom, factura } din listele salvate.
// În modul ăsta nu se salvează nimic (butonul de ofertă e ascuns).
let modFisa = null;
const ofertaPtFisa = () =>
  ofertaSalvata && ofertaSalvata.stare === JSON.stringify(state) ? ofertaSalvata.comanda : null;

// ── Init ────────────────────────────────────────────────────────────────────

// Gamele şi modelele lor vin din js/systems/game.json — SURSĂ UNICĂ, citită şi
// de pagina principală a managerului (build.js copiază fişierul în dist/).
// Un sistem nou se adaugă acolo şi în registry.js; aici nu e nimic de atins.
//
//   tabel: true  → perechi pe rând, cu antet (Deschidere Totală ↔ Parţială)
//   tabel: false → listă simplă, două modele pe rând

const GAME = gameJson.game;
const gamaDupaId = id => GAME.find(g => g.id === id) ?? null;

// Gama cerută prin ?gama=, fixată o singură dată la initUI — necesară ca
// sursă pt. randarea listei de modele cât timp state.system e încă gol
// (ecranul iniţial la Confort, vezi initUI), fiindcă atunci familia nu se
// mai poate deduce din state.system.
let gamaActiva = null;

// Câmpurile H/L gol arată valoarea reală din `state` doar după ce userul
// le-a atins explicit — cât timp rămân `false`, applyLimits() le lasă goale
// în UI, deşi `state.width`/`state.height` păstrează un număr valid pe
// dedesubt (aşa rămâne 3D-ul construibil fără NaN). Pornesc `true` (arată
// valoarea) — devin `false` DOAR la Confort, o singură dată în initUI (ecranul
// iniţial), ca Suspendată să nu se atingă deloc (acolo rămân mereu `true`,
// comportament identic ca înainte). Schimbarea modelului NU le resetează.
let latimeAtinsa = true, inaltimeAtinsa = true;

// Configuraţia e completă când s-au ales TOATE: model, culoare, cotele (H+L
// scrise de user, nu valorile implicite din state) şi — la gamele cu nr. de uşi
// ales — nr. de uşi. Ramele n-au cote de gol: acolo contează primul rând
// completat (H, L, buc); restul îl verifică facturarea (specRame.erori). Aceeaşi regulă pt. cardurile uşilor,
// butonul de salvare şi starea din interfaţă.
export function configuratieCompleta() {
  const meta = systems[state.system]?.meta;
  if (!meta || !state.finish) return false;
  if (meta.rame) return (currentSpec()?.nrRame ?? 0) > 0;
  return latimeAtinsa && inaltimeAtinsa && (!meta.doorsRange || state.doors > 0);
}

// „Mai alege: culoarea, lăţimea." — în loc de „Configuraţia nu e gata." fără detalii
function ceLipseste() {
  const meta = systems[state.system]?.meta;
  const lipsa = [!meta && 'modelul', !state.finish && 'culoarea'];
  if (!meta?.rame && currentGama() !== 'rame') lipsa.push(!inaltimeAtinsa && 'înălţimea golului', !latimeAtinsa && 'lăţimea golului',
    meta?.doorsRange && !state.doors && 'numărul de uşi');
  const l = lipsa.filter(Boolean);
  return l.length ? `Mai alege: ${l.join(', ')}.` : '';
}

// Cardul restrâns al unui produs din coş: model, culoare, dimensiuni (cos.js) +
// nr. de uşi şi suprapuneri la gamele unde se aleg (Confort, UTIL).
function detaliiProdus(p) {
  const r = cosul.detaliiImplicite(p);
  const meta = systems[p.sistem]?.meta, c = p.config ?? {};
  if (meta?.doorsRange) r.push(['Uşi', p.nrUsi], ['Suprapuneri', meta.suprapuneri
    ? meta.suprapuneri(c.doors) : suprapuneriEfective(c.doors, meta.suprapuneriObligatorii ? 2 : c.tracks)]);
  return r;
}

const currentGama = () => systems[state.system]?.meta.family ?? gamaActiva;

// Aplică un sistem nou şi reface toate panourile care depind de el.
function selectSystem(id) {
  state.system = id;

  // NU resetăm aici cotele / nr. de uşi: ecranul gol de la Confort se pune o
  // singură dată, în initUI. Ce a introdus userul (chiar şi înainte să aleagă
  // modelul) trebuie să rămână la schimbarea modelului — resetul de aici le
  // ştergea şi cardurile de uşă nu mai apăreau deloc (bug, 2026-09-17).

  applyLimits();
  renderFinishes();
  syncDoors();
  renderDoorsUI();
  renderWheels();
  updateSketch();
  aplicaGama();
  rebuild();
}

function renderModelList() {
  const sysContainer = $('systemType');
  if (!sysContainer) return;

  const g = gamaDupaId(currentGama());
  if (!g) { sysContainer.innerHTML = ''; return; }

  // Selectorul de gamă nu mai există — eticheta e singurul loc care spune
  // în ce gamă lucrezi.
  setText('modelLabel', `MODEL — ${g.label.toUpperCase()}`);

  // Gamele "solo" (fără tabel Totală/Parţială — azi doar Confort) stau lângă
  // schiţă, toate modelele într-o singură coloană — cerut explicit; gamele
  // cu tabel (Suspendată) rămân stivuite vertical, neschimbate.
  $('modelSchitaWrap')?.classList.toggle('langa-schita', !g.tabel);

  // Câmpurile de cotă (ÎNĂLŢIME/LĂŢIME/NR. UŞI/SUPRAPUNERI) mai compacte,
  // etichetă pe acelaşi rând — la toate gamele (suspendate din 2026-09-21).
  $('sidebar')?.classList.add('cote-compact');

  const cell = m => `<button data-v="${m.id}"${m.id === state.system ? ' class="active"' : ''}>${m.label}</button>`;

  // Acelaşi markup de tabel (.model-table) în ambele cazuri, ca butoanele să
  // arate identic — diferă doar cum sunt grupate rândurile.
  const rowsHtml = g.tabel
    // un model singur pe rând (ex. Configurație Standard) ocupă ambele coloane
    ? g.modele.map(pereche => `<tr>${pereche.map(m =>
        `<td${pereche.length === 1 ? ' colspan="2"' : ''}>${cell(m)}</td>`).join('')}</tr>`).join('')
    : g.modele.map(m => `<tr><td>${cell(m)}</td></tr>`).join('');

  const head = g.coloane
    ? `<thead><tr>${g.coloane.map(c => `<th>${c}</th>`).join('')}</tr></thead>`
    : '';

  sysContainer.innerHTML = `<table class="model-table">${head}<tbody>${rowsHtml}</tbody></table>`;

  sysContainer.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      sysContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectSystem(btn.dataset.v);
    });
  });
}

export async function initUI() {
  activeazaCampuri();   // Enter = câmpul următor; meniuri lungi căutabile
  // Pagina principală a managerului trimite `?gama=suspendata|confort|rame|util`;
  // „Modifică oferta" din manager trimite `?oferta=<id>`.
  const params = new URLSearchParams(location.search);
  // Oferta cu amănuntul are pagina ei (amanunt.html): acolo duc „Ofertă nouă",
  // produsele cu amănuntul din coş şi „Fişă" din manager pentru ele.
  if (params.get('gama') === 'amanunt') return location.replace('amanunt.html' + location.search);
  const gama = gamaDupaId(params.get('gama'));
  gamaActiva = gama?.id ?? null;

  // „Modifică oferta" din manager: toate produsele ofertei intră în coş, apoi se
  // deschide primul (pe pagina gamei lui); restul se modifică din „Adaugă la ofertă".
  let eroareIncarcare = null;
  if (params.get('oferta')) {
    const o = await oferta.incarcaOferta(params.get('oferta'));
    if (o.eroare || !o.pozitii?.length) eroareIncarcare = o.eroare || 'Oferta n-are configuraţie.';
    else if (o.comanda.tip !== 'oferta') eroareIncarcare = `${o.comanda.oferta_nr || o.comanda.numar} a fost acceptată — nu se mai modifică.`;
    else {
      cos = cosul.dinOferta(o, p => (p.sistem === 'amanunt' ? 'amanunt' : systems[p.sistem]?.meta.family));
      cosul.scrie(cos);
      return location.replace(cosul.url(cos.pozitii[0].gama, { poz: 0 }));
    }
  }

  // Un produs din coş (?cos=1&poz=k): configuraţia lui ÎNLOCUIEŞTE starea
  // implicită, înainte de primul render — tot UI-ul de mai jos o citeşte din `state`.
  if (cosul.activ() && !params.get('fisa')) {
    const k = params.has('poz') ? +params.get('poz') : null;
    const x = cos.pozitii[k];
    cos.curent = x && x.gama !== 'amanunt' ? k : null;
    if (cos.curent != null) {
      Object.assign(state, structuredClone(x.pozitie.config));
      state.usiIdentice = x.pozitie.config.usiIdentice;   // lipsă (oferte vechi) → se deduce din uşi
      gamaActiva = systems[state.system]?.meta.family ?? null;
    }
    state.comanda = { ...cos.comanda };
    $('clientNume').value    = cos.client.nume ?? '';
    $('clientTelefon').value = cos.client.telefon ?? '';
    $('clientAdresa').value  = cos.client.adresa ?? '';
    $('ofertaNr').value      = cos.ofertaNr ?? '';
    cosul.scrie(cos);
  }

  // Fişa unei comenzi (butonul „Fişă" din manager): configuraţia salvată +
  // listele îngheţate la salvare; fişa se deschide singură la final.
  if (params.get('fisa')) {
    const o = await oferta.incarcaOferta(params.get('fisa'));
    // fiecare produs al ofertei are fişa lui (?poz=k), „ca şi cum ar fi comenzi diferite"
    const k = +params.get('poz') || 0, n = o.pozitii?.length ?? 0;
    if (o.pozitii?.[k]?.sistem === 'amanunt') return location.replace('amanunt.html' + location.search);
    const poz = o.pozitii?.[k];
    if (o.eroare || !poz?.config) eroareIncarcare = o.eroare || 'Comanda n-are configuraţie.';
    else {
      Object.assign(state, structuredClone(poz.config));
      state.usiIdentice = poz.config.usiIdentice;   // lipsă (oferte vechi) → se deduce din uşi
      gamaActiva = systems[state.system]?.meta.family ?? null;
      $('clientNume').value    = o.comanda.client_nume ?? '';
      $('clientTelefon').value = o.comanda.client_telefon ?? '';
      $('clientAdresa').value  = o.comanda.client_adresa ?? '';
      $('ofertaNr').value      = o.comanda.oferta_nr || o.comanda.numar || '';   // pe fişă, lângă livrare / plată / agent
      modFisa = {
        numar:  `${o.comanda.oferta_nr || o.comanda.numar}${n > 1 ? ` · produsul ${k + 1} din ${n}` : ''}`,
        coduri: (o.coduri ?? []).map(cod_bare => ({ cod_bare })),
        client: o.comanda.client_nume ?? '',
        bom: (poz.linii?.necesar ?? []).map(l =>
          ({ code: l.cod, label: l.denumire, qty: l.cantitate, unit: l.um, cut: l.debitare })),
        panouriClient: (poz.linii?.client ?? []).map(l =>
          ({ label: l.denumire, qty: l.cantitate, unit: l.um, cut: l.debitare })),
        factura: { mode: null, errors: [], lines: (poz.linii?.facturare ?? []).map(l =>
          ({ cod: l.cod, denumire: l.denumire, um: l.um, cantitate: l.cantitate })) },
      };
    }
  }

  // Ecran gol la ORICE gamă cerută (suspendate din 2026-09-21): niciun model,
  // nicio culoare, cotele goale. Fără ?gama= (dist/ deschis direct) rămâne
  // comportamentul vechi — modelul implicit din state.js.
  if (gama && !params.get('oferta') && !params.get('fisa') && cos.curent == null) {
    state.system = null;
    state.finish = null;
    state.doors  = 0;
    latimeAtinsa = false;
    inaltimeAtinsa = false;
    if (gama.id === 'rame') state.rame = stareRameGoala();
    if (gama.id === 'util') state.util = stareUtilGoala();
  }

  renderModelList();

  // NR. UŞI (doar Confort)
  $('doorsMinus')?.addEventListener('click', () => setDoors(state.doors - 1));
  $('doorsPlus') ?.addEventListener('click', () => setDoors(state.doors + 1));

  // ÎNĂLŢIME / LĂŢIME GOL — fără model ales încă, nu există limite pe care
  // să clampăm; păstrăm doar valoarea introdusă, brută.
  $('heightInput').addEventListener('change', e => {
    const lim = systems[state.system]?.meta.limits?.height;
    const val = parseInt(e.target.value, 10);
    state.height = lim ? clamp(val || lim[0], lim[0], lim[1]) : (Number.isFinite(val) ? val : state.height);
    applyLimits();   // şi limitele culorii (meta.limitsFinisaj, ex. Cupru)
    inaltimeAtinsa = true;
    e.target.value = state.height;
    renderWheels();   // la Confort, cota e una din condiţiile care arată cardurile de uşă
    rebuild();
  });
  $('widthInput').addEventListener('change', e => {
    const lim = systems[state.system]?.meta.limits?.width;
    const val = parseInt(e.target.value, 10);
    state.width = lim ? clamp(val || lim[0], lim[0], lim[1]) : (Number.isFinite(val) ? val : state.width);
    applyLimits();   // şi limitele culorii (meta.limitsFinisaj, ex. Cupru)
    latimeAtinsa = true;
    e.target.value = state.width;
    renderWheels();
    rebuild();
  });

  $('btnFisa')?.addEventListener('click', () => modFisa
    ? deschideFisa(modFisa.client, modFisa, modFisa)
    : deschideFisa($('clientNume')?.value, ofertaPtFisa()));
  $('btnConfirma')?.addEventListener('click', () => trimiteOferta('oferta'));
  $('btnComanda')?.addEventListener('click', () => trimiteOferta('comanda'));
  $('btnPlata')?.addEventListener('click', () => trimiteOferta('plata'));
  initDetaliiComanda();
  // observaţiile produsului (în config → se salvează cu el şi ajung pe fişă)
  const obs = /** @type {HTMLTextAreaElement | null} */ ($('observatii'));
  if (obs) { obs.value = state.observatii ?? ''; obs.addEventListener('input', () => { state.observatii = obs.value; }); }
  // la alegerea unui client din listă, agentul lui trece în selectorul de agent
  initSugestiiClienti(agent => { $('comandaAgent').value = agent; state.comanda.agent = agent; rebuild(); });
  // CLEAR PAGE — configuraţie nouă de la zero: reîncărcarea paginii (cu acelaşi
  // ?gama=) readuce exact ecranul iniţial gol, fără stare rămasă pe undeva.
  $('btnClear')?.addEventListener('click', () => location.reload());

  applyLimits();
  // Ecranul iniţial gol la Confort: applyLimits() nu atinge câmpurile cât
  // timp nu e ales niciun model (iese devreme, fără meta) — le golim explicit,
  // altfel ar rămâne cu valorile brute din HTML.
  if (!state.system) {
    const wIn = $('widthInput'), hIn = $('heightInput');
    if (wIn) wIn.value = '';
    if (hIn) hIn.value = '';
  }
  renderFinishes();
  syncDoors();
  renderDoorsUI();
  renderWheels();
  updateSketch();
  aplicaGama();
  rebuild();

  if (cos.ofertaEditata) {
    $('btnConfirma').textContent = 'Salvează modificările';
    mesajOferta(`Modifici oferta <strong>${esc(cos.numar ?? '')}</strong>.`, 'ok');
  }
  // „Adaugă la ofertă" — nu şi pe fişa deschisă din manager
  if (!modFisa) {
    // facturarea comasată e în tabul Facturare, nu şi în card
    cardCos = cosul.initCard($('groupCos'), cos, { curenta: curentaUsi, client: clientPtCos, gamaEcran: currentGama,
                                                   transport: () => liniaTransport(state), facturareInCard: false,
                                                   produse: $('cosProduse'), detalii: detaliiProdus });
    document.addEventListener('cos:schimbat', renderBilling);
    document.addEventListener('configurator:rebuild', () => cardCos.actualizeaza());
    document.addEventListener('cos:schimbat', renderOferta);
  } else if ($('groupCos')) $('groupCos').hidden = true;
  if (eroareIncarcare) mesajOferta(esc(eroareIncarcare), 'eroare');
  if (modFisa) {
    mesajOferta(`Fişa comenzii <strong>${esc(modFisa.numar)}</strong> — deschisă doar pentru printare; de aici nu se salvează nimic.`, 'ok');
    deschideFisa(modFisa.client, modFisa, modFisa);
  }
  // Managerul încarcă pagina asta într-un cadru ascuns (butonul „Fişă") şi
  // aşteaptă răspunsul: fişa e gata (dialogul de print porneşte singur) sau eroare.
  if (params.get('fisa') && window.parent !== window) {
    window.parent.postMessage({ tip: 'fisa', eroare: modFisa ? null : (eroareIncarcare || 'Fişa nu s-a putut deschide.') },
      location.origin);
  }

  // asincron: decide dacă panoul de ofertă are unde să trimită
  oferta.initOferta(renderOferta);
}
