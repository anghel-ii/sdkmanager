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
import { suprapuneriConfort, areCodH, areSinaSimpla } from './lib/confort/index.js';
import gameJson from './systems/game.json';
import { renderRame, syncRame, refreshRame } from './ui_rame.js';
import { stareRameGoala } from './lib/rame/rame.js';

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

  const { lines, errors, mode } = currentBilling();
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
    <div class="bom-title">FACTURARE — NEOMANAGER${mode ? ` <span class="bill-mode">${mode}</span>` : ''}</div>
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

function grosimeOptionsHtml(selected) {
  return GROSIMI_CLIENT.map(g =>
    `<option value="${g}"${g === selected ? ' selected' : ''}>${clientGeamLabel(g)}</option>`).join('');
}

function geamOptionsHtml(selectedCod) {
  const list = [...geamList()].sort((a, b) =>
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
  const n = meta?.doorsRange
    ? (state.doors > 0 ? clamp(state.doors, meta.doorsRange[0], meta.doorsRange[1]) : 0)
    : (meta ? (meta.doors ?? 1) : 0);   // fără model ales (ecran gol Confort): 0 uşi, nu 1
  state.doors = n;

  const wheels = state.wheels ?? [];
  while (wheels.length < n) wheels.push({ left: 'simpla', right: 'simpla' });
  wheels.length = n;
  state.wheels = wheels;

  const assembly = state.assembly ?? [];
  while (assembly.length < n) assembly.push('noi');
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
  const hDisponibil = areCodH(systems[state.system]?.meta.catalog, state.finish);
  for (let k = panes - 1; panes > 1 && k >= 0; k--) {
    const fix = state.hPanouri[i]?.[k];
    rows.push(`
      <div class="av-rand av-panou">
        <span class="av-eticheta">Panou ${panes - k} · ${mats[k] === 'pal' ? 'PAL' : 'Sticlă'}</span>
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
        ${seg('parte', [['fata', 'Faţă'], ['spate', 'Spate'], ['ambele', 'Faţă şi spate']])}
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

function renderWheels() {
  const box = $('wheelsUI');
  const groupUsi = $('groupUsi');
  if (!box) return;
  syncDoors();

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
  const hasPal    = !!meta?.pal;

  // Niciun card de uşă „implicit" — rămân ascunse cât timp nu s-au ales TOATE
  // din: model, culoare, cote (H+L, vezi latimeAtinsa/inaltimeAtinsa) şi — doar
  // la sistemele cu nr. de uşi ales (Confort) — nr. de uşi. `!meta` = ecranul
  // iniţial gol (niciun model ales). Confort 2026-09-17, suspendate 2026-09-21.
  const carduriGata = !!meta && !!state.finish && latimeAtinsa && inaltimeAtinsa &&
    (!meta.doorsRange || state.doors > 0);
  if (!carduriGata) {
    box.innerHTML = '';
    if (groupUsi) groupUsi.style.display = 'none';
    return;
  }
  if (groupUsi) groupUsi.style.display = '';

  box.innerHTML = state.wheels.map((w, i) => {
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
          <span class="door-row-label">Uşa ${i + 1}</span>
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

        <div class="door-row">
          <span class="door-row-label">Sticlă</span>
          <select class="geam-select" data-door="${i}" data-client="${client ? 1 : 0}"${hasGlass ? '' : ' disabled'}>${
            !hasGlass ? '<option>Fără geam — numai PAL</option>'
              : client ? grosimeOptionsHtml(state.geamClient[i])
                       : geamOptionsHtml(state.geam[i])
          }</select>
        </div>

        ${!isConfort ? `
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

        ${isConfort ? `
        <div class="door-row door-row-amortizare">
          <span class="door-row-label">Amortizări</span>
          <div class="amortizare-grup">
            <div class="amortizare-parte">
              <span class="amortizare-parte-label">Stânga</span>
              <div class="segmented mini" data-door="${i}" data-amortizare="left">
                ${['fara', '35kg', '60kg'].map(v => `<button data-v="${v}"${
                  (state.amortizare[i]?.left ?? 'fara') === v ? ' class="active"' : ''
                }>${v === 'fara' ? 'Fără' : v}</button>`).join('')}
              </div>
            </div>
            <div class="amortizare-parte">
              <span class="amortizare-parte-label">Dreapta</span>
              <div class="segmented mini" data-door="${i}" data-amortizare="right">
                ${['fara', '35kg', '60kg'].map(v => `<button data-v="${v}"${
                  (state.amortizare[i]?.right ?? 'fara') === v ? ' class="active"' : ''
                }>${v === 'fara' ? 'Fără' : v}</button>`).join('')}
              </div>
            </div>
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
          <button class="panel-chip ${mat}" data-door="${i}" data-panel="${j}">${mat === 'pal' ? (isConfort ? 'PAL' : 'PAL 10mm') : 'St'}</button>`).join('')}
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
  const [lo, hi] = systems[state.system]?.meta.doorsRange ?? [1, 7];
  state.doors = clamp(n, faraSinaSimpla() ? Math.max(lo, 2) : lo, hi);
  syncDoors();
  renderDoorsUI();
  renderWheels();
  rebuild();
}

// ── Limite de gol (per model) ───────────────────────────────────────────────

function applyLimits() {
  const meta = systems[state.system]?.meta;
  const lim  = meta?.limits;
  if (!lim) return;

  // Unele finisaje au limite mai strânse decât restul (ex. CUPRU la Confort,
  // lăţime max 3500 în loc de 5800) — meta.limitsFinisaj suprascrie doar ce
  // diferă, restul vine din meta.limits.
  const suprascriere = meta.limitsFinisaj?.[state.finish];
  const [wMin, wMax] = suprascriere?.width  ?? lim.width;
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

function rebuild() { buildConfig(); refreshAvansat(); refreshRame(); renderReadout(); renderOferta(); }

// Gama rame: în locul cotelor de gol / nr. de uşi / cardurilor de uşă apare
// panoul de rânduri (js/ui_rame.js) — după ce s-a ales modelul.
function aplicaGama() {
  const eRame = currentGama() === 'rame';
  for (const id of ['groupHeight', 'groupWidth']) { const el = $(id); if (el) el.style.display = eRame ? 'none' : ''; }
  const grup = $('groupRame');
  const areModel = !!systems[state.system]?.meta.rame;
  if (grup) grup.style.display = eRame && areModel ? '' : 'none';
  if (eRame && areModel) { syncRame(); renderRame($('rameUI'), { rebuild, geamOptionsHtml }); }
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
  if (!servit || modFisa) { box.innerHTML = ''; btn.style.display = 'none'; return; }

  if (stare === 'nelogat') {
    btn.style.display = 'none';
    box.innerHTML = `<div class="oferta-hint">Autentifică-te ca să poţi salva oferte.
      <a href="/login?redirect=${encodeURIComponent(location.pathname + location.search)}">Intră în cont</a></div>`;
    return;
  }

  // Ce anume se trimite — arătat înainte de salvare, ca să nu fie surprize.
  const p = oferta.pozitieCurenta();
  box.innerHTML = `
    <div class="oferta-cine dim mic">${esc(utilizator.nume)}</div>
    ${p.eroare
      ? `<div class="oferta-msg eroare">${esc(p.eroare)}</div>`
      : `<div class="oferta-sumar">
           <strong>${esc(p.pozitie.eticheta)}</strong>
           <div class="dim mic">${p.pozitie.latime}×${p.pozitie.inaltime} mm ·
             ${esc(p.pozitie.finisaj)} · ${systems[state.system]?.meta.rame
               ? `${currentSpec()?.nrRame ?? 0} rame`
               : `${p.pozitie.nrUsi} ${p.pozitie.nrUsi === 1 ? 'uşă' : 'uşi'}`}</div>
         </div>`}`;
  btn.style.display = '';
  btn.disabled = !!p.eroare;
}

function mesajOferta(html, fel) {
  const el = $('ofertaMesaj');
  if (el) el.innerHTML = `<div class="oferta-msg ${fel}">${html}</div>`;
}

async function trimiteOferta() {
  const btn = $('btnConfirma');
  btn.disabled = true;
  btn.textContent = 'Se salvează…';

  // Un singur câmp de contact (adresă SAU telefon) — merge în coloana de
  // telefon a comenzii; managerul îl afişează ca „Telefon / adresă".
  const r = await oferta.confirma({
    id:         ofertaEditata,
    nume:       $('clientNume').value,
    telefon:    $('clientContact').value,
    email:      '',
    observatii: '',
  });

  btn.disabled = false;
  btn.textContent = ofertaEditata ? 'Salvează modificările' : 'Salvează oferta';

  if (r.eroare) return mesajOferta(esc(r.eroare), 'eroare');

  // Câmpurile NU se mai golesc: aceleaşi date servesc şi la fişa de atelier,
  // care se printează de obicei imediat după. CLEAR PAGE resetează tot.
  ofertaSalvata = { comanda: r.comanda, stare: JSON.stringify(state) };
  mesajOferta(`${ofertaEditata ? 'Ofertă actualizată' : 'Ofertă salvată'}: <strong>${esc(r.comanda.numar)}</strong> ·
    <a href="/comenzi#comanda/${r.comanda.id}">vezi în manager</a>
    <div class="dim mic">Fişa printată acum are şi codul de bare.</div>`, 'ok');
}

// Ultima ofertă salvată + configuraţia de atunci. Fişa primeşte codurile de
// bare DOAR dacă configuraţia n-a mai fost schimbată de la salvare — altfel
// codurile ar fi ale altei comenzi decât ce e desenat pe fişă.
let ofertaSalvata = null;
// id-ul ofertei deschise din manager cu „Modifică oferta" (?oferta=<id>) — la
// salvare se actualizează ea, nu se creează una nouă.
let ofertaEditata = null;
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
  // Pagina principală a managerului trimite `?gama=suspendata|confort|rame`;
  // „Modifică oferta" din manager trimite `?oferta=<id>`.
  const params = new URLSearchParams(location.search);
  const gama = gamaDupaId(params.get('gama'));
  gamaActiva = gama?.id ?? null;

  // Oferta salvată: configuraţia ei ÎNLOCUIEŞTE starea implicită, înainte de
  // primul render — tot UI-ul de mai jos o citeşte din `state`.
  let eroareIncarcare = null;
  if (params.get('oferta')) {
    const o = await oferta.incarcaOferta(params.get('oferta'));
    const cfg = o.pozitii?.[0]?.config;
    if (o.eroare || !cfg) eroareIncarcare = o.eroare || 'Oferta n-are configuraţie.';
    else if (o.comanda.tip !== 'oferta') eroareIncarcare = `${o.comanda.numar_comanda || o.comanda.numar} a fost acceptată — nu se mai modifică.`;
    else {
      Object.assign(state, structuredClone(cfg));
      gamaActiva = systems[state.system]?.meta.family ?? null;
      ofertaEditata = o.comanda.id;
      ofertaSalvata = { comanda: { id: o.comanda.id, numar: o.comanda.numar,
        coduri: (o.coduri ?? []).map(cod_bare => ({ cod_bare })) }, stare: null };
      $('clientNume').value    = o.comanda.client_nume ?? '';
      $('clientContact').value = o.comanda.client_telefon ?? '';
      const btn = $('btnConfirma');
      if (btn) btn.textContent = 'Salvează modificările';
    }
  }

  // Fişa unei comenzi (butonul „Fişă" din manager): configuraţia salvată +
  // listele îngheţate la salvare; fişa se deschide singură la final.
  if (params.get('fisa')) {
    const o = await oferta.incarcaOferta(params.get('fisa'));
    const poz = o.pozitii?.[0];
    if (o.eroare || !poz?.config) eroareIncarcare = o.eroare || 'Comanda n-are configuraţie.';
    else {
      Object.assign(state, structuredClone(poz.config));
      gamaActiva = systems[state.system]?.meta.family ?? null;
      $('clientNume').value    = o.comanda.client_nume ?? '';
      $('clientContact').value = o.comanda.client_telefon ?? '';
      modFisa = {
        numar:  o.comanda.numar_comanda || o.comanda.numar,
        client: o.comanda.client_nume ?? '',
        bom: (poz.linii?.necesar ?? []).map(l =>
          ({ code: l.cod, label: l.denumire, qty: l.cantitate, unit: l.um, cut: l.debitare })),
        factura: { mode: null, errors: [], lines: (poz.linii?.facturare ?? []).map(l =>
          ({ cod: l.cod, denumire: l.denumire, um: l.um, cantitate: l.cantitate })) },
      };
    }
  }

  // Ecran gol la ORICE gamă cerută (suspendate din 2026-09-21): niciun model,
  // nicio culoare, cotele goale. Fără ?gama= (dist/ deschis direct) rămâne
  // comportamentul vechi — modelul implicit din state.js.
  if (gama) {
    state.system = null;
    state.finish = null;
    state.doors  = 0;
    latimeAtinsa = false;
    inaltimeAtinsa = false;
  }
  if (gama?.id === 'rame') state.rame = stareRameGoala();

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
    inaltimeAtinsa = true;
    e.target.value = state.height;
    renderWheels();   // la Confort, cota e una din condiţiile care arată cardurile de uşă
    rebuild();
  });
  $('widthInput').addEventListener('change', e => {
    const lim = systems[state.system]?.meta.limits?.width;
    const val = parseInt(e.target.value, 10);
    state.width = lim ? clamp(val || lim[0], lim[0], lim[1]) : (Number.isFinite(val) ? val : state.width);
    latimeAtinsa = true;
    e.target.value = state.width;
    renderWheels();
    rebuild();
  });

  $('btnFisa')?.addEventListener('click', () => modFisa
    ? deschideFisa(modFisa.client, { numar: modFisa.numar }, modFisa)
    : deschideFisa($('clientNume')?.value, ofertaPtFisa()));
  $('btnConfirma')?.addEventListener('click', trimiteOferta);
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

  if (ofertaEditata) {
    // configuraţia de acum = cea salvată → fişa primeşte codul de bare
    ofertaSalvata.stare = JSON.stringify(state);
    mesajOferta(`Modifici oferta <strong>${esc(ofertaSalvata.comanda.numar)}</strong>.`, 'ok');
  }
  if (eroareIncarcare) mesajOferta(esc(eroareIncarcare), 'eroare');
  if (modFisa) {
    mesajOferta(`Fişa comenzii <strong>${esc(modFisa.numar)}</strong> — deschisă doar pentru printare; de aici nu se salvează nimic.`, 'ok');
    deschideFisa(modFisa.client, { numar: modFisa.numar }, modFisa);
  }

  // asincron: decide dacă panoul de ofertă are unde să trimită
  oferta.initOferta(renderOferta);
}
