import { state } from './state.js';
import { systems } from './systems/registry.js';
import { currentSpec } from './builder.js';
import {
  MODELE_RAME, ASAMBLARE, GAURIRE_820, GAURIRE_831,
  BALAMALE, PLACUTE, FARA_BALAMALE, FARA_PLACUTE, FARA_GAURIRE, DOUA_GAURI, BARA_MANER_MM, MODELE_MANER, codManer,
  stareRameGoala, randGol, randManerGol,
} from './lib/rame/rame.js';

// ═══════════════════════════════════════════════════════════════════════════
//  UI RAME — panoul din bara laterală pt. gama „rame" (în locul cotelor de gol,
//  nr. de uşi şi cardurilor de uşă). În ordinea în care se completează (userul,
//  2026-09-25): cine asamblează, geam/oglindă, cote de găurire → rândurile de
//  rame (H × L × buc × găuri) → mânerul (modelul, în culoarea ramei, + rânduri
//  lungime × buc) → balama/plăcuţă sau manşon, vopsire. Rândurile noi apar
//  singure când începi să-l completezi pe ultimul. Livrarea, agentul şi
//  facturarea sunt ale comenzii — lângă datele clientului, la toate gamele.
//  Selectările pornesc pe „Alege…" — facturarea rămâne blocată până sunt alese.
// ═══════════════════════════════════════════════════════════════════════════

const esc = t => String(t ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const r = () => (state.rame ??= stareRameGoala());

// Opţiunile care nu mai există la modelul nou (ex. balamaua 820 după trecerea
// pe 822) se golesc — altfel ar rămâne o alegere invizibilă în facturare.
export function syncRame() {
  const m = MODELE_RAME[systems[state.system]?.meta.rame];
  if (!m) return;
  const x = r();
  const model = systems[state.system].meta.rame;
  if (x.gaurire && !(m.grup === '820' ? GAURIRE_820 : GAURIRE_831).includes(x.gaurire)) x.gaurire = null;
  const valid = (val, lista, fara) => val === fara || lista.some(e => e[0] === val);
  if (m.grup === '820') {
    if (x.balama && !valid(x.balama, BALAMALE[model], FARA_BALAMALE)) x.balama = null;
    if (x.placuta && !valid(x.placuta, PLACUTE[model], FARA_PLACUTE)) x.placuta = null;
  }
  // la schimbarea modelului, cotele peste maximul noului model coboară la maxim
  for (const rd of x.randuri) {
    if (rd.h != null) rd.h = limiteaza(rd.h, maxCota(m, 'h'));
    if (rd.l != null) rd.l = limiteaza(rd.l, maxCota(m, 'l'));
  }
  // ofertele vechi: mânerul era un cod (`profil`), fără model
  x.maner ??= { model: null, randuri: [randManerGol()] };
  if (!x.maner.randuri?.length) x.maner.randuri = [randManerGol()];
}

// Limitele cotelor = cea mai mare mărime din codurile modelului (userul,
// 2026-09-21: „alea is dimensiunile maxime, minim e 0"). Peste maxim nu există cod.
const maxCota = (m, c) => (c === 'h' ? m.H.at(-1) : c === 'l' ? m.L.at(-1) : Infinity);
const limiteaza = (v, max) => (Number.isFinite(v) ? Math.min(Math.max(v, 0), max) : null);

const optiuni = (lista, ales, alege) =>
  (ales == null ? `<option value="" selected disabled>${alege}</option>` : '') +
  lista.map(([v, t]) => `<option value="${esc(v)}"${v === ales ? ' selected' : ''}>${esc(t)}</option>`).join('');

const camp = (eticheta, html) => `
  <div class="rame-camp"><span class="rame-et">${eticheta}</span>${html}</div>`;

// ── Rânduri care cresc singure (rame şi mânere) ─────────────────────────────
// `lista` = array-ul de rânduri din stare, `coloane` = [câmp, max] pe rând.
// Un rând nou gol se adaugă la `input` în ultimul rând — fără re-randarea
// tabelului, ca să nu se piardă cursorul.
const golDeTot = (rd, coloane) => coloane.every(([c]) => rd[c] == null || rd[c] === '');

// coloană `[câmp, max, mic]` = câmp numeric; `[câmp, { variante }]` = butoane
// (variante = [[valoare, text, activ]], ex. modelul mânerului)
function celula(rd, [c, max, mic]) {
  if (max?.variante) return `<td><div class="segmented mini rame-seg-rand" data-c="${c}">${max.variante.map(([v, t, activ]) =>
    `<button type="button" data-v="${v}"${rd[c] === v ? ' class="active"' : ''}${activ ? '' : ' disabled title="Nu există în culoarea aleasă"'}>${t}</button>`).join('')}</div></td>`;
  return `<td><input type="number" class="rame-in${mic ? ' mic' : ''}" data-c="${c}" min="0"${
    max && Number.isFinite(max) ? ` max="${max}"` : ''} step="1" value="${rd[c] ?? ''}"></td>`;
}

function randHtml(rd, i, coloane, idCod) {
  return `<tr data-i="${i}">
    <td class="rame-nr">${i + 1}</td>
    ${coloane.map(col => celula(rd, col)).join('')}
    ${idCod ? `<td class="rame-cod" id="${idCod}${i}"></td>` : ''}
    <td><button class="rame-sterge" title="Şterge rândul">✕</button></td>
  </tr>`;
}

function tabelCrescator(tbody, { lista, coloane, gol, idCod, laSchimbare, redeseneaza }) {
  const randNou = i => {   // ai început ultimul rând → încă unul gol dedesubt
    if (i !== lista.length - 1) return;
    lista.push(gol());
    tbody.insertAdjacentHTML('beforeend', randHtml(lista.at(-1), lista.length - 1, coloane, idCod));
    leaga(tbody.lastElementChild);
  };
  const leaga = tr => {
    const i = +tr.dataset.i;
    tr.querySelectorAll('.rame-seg-rand button').forEach(b => b.addEventListener('click', () => {
      lista[i][b.parentElement.dataset.c] = b.dataset.v;
      b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      randNou(i);
      laSchimbare();
    }));
    tr.querySelectorAll('input.rame-in').forEach(inp => {
      inp.addEventListener('change', () => {
        const [, max] = coloane.find(([c]) => c === inp.dataset.c) ?? [];
        lista[i][inp.dataset.c] = limiteaza(parseInt(inp.value, 10), max ?? Infinity);
        inp.value = lista[i][inp.dataset.c] ?? '';
        laSchimbare();
      });
      inp.addEventListener('input', () => { if (inp.value !== '') randNou(i); });
    });
    tr.querySelector('.rame-sterge').addEventListener('click', () => {
      if (lista.length === 1) lista[0] = gol(); else lista.splice(i, 1);
      redeseneaza();
    });
  };
  tbody.querySelectorAll('tr').forEach(leaga);
}

// ── Panoul ───────────────────────────────────────────────────────────────────
export function renderRame(box, { rebuild, geamOptionsHtml }) {
  const meta = systems[state.system]?.meta;
  if (!box || !meta?.rame) return;
  const model = meta.rame, m = MODELE_RAME[model], x = r();
  const cu820 = m.grup === '820';
  const gaurire = cu820 ? GAURIRE_820 : GAURIRE_831;
  syncRame();
  // la coadă, mereu un rând gol (se completează ca să apară următorul)
  const faraGaurire = x.gaurire === FARA_GAURIRE;
  const cuBalama = cu820 && !faraGaurire;                        // balama / plăcuţă
  const cuGauri  = cuBalama && x.gaurire !== DOUA_GAURI;          // coloana „Găuri" (la sus/jos: mereu 2)
  const COL_RAME = [['h', m.H.at(-1)], ['l', m.L.at(-1)], ['buc', Infinity, true], ...(cuGauri ? [['gauri', Infinity, true]] : [])];
  // toate modelele de mâner la vedere; cele fără cod în culoarea aleasă — gri
  const existaInCuloare = v => !state.finish || !!codManer(v, state.finish);
  const COL_MANER = [['model', { variante: MODELE_MANER.map(([v, t]) => [v, t, existaInCuloare(v)]) }],
                     ['lungime', Infinity], ['buc', Infinity, true]];
  if (!golDeTot(x.randuri.at(-1) ?? { h: 1 }, [['h'], ['l']])) x.randuri.push(randGol());
  // ofertele vechi: modelul era pe toată secţiunea → trece pe fiecare rând
  if (x.maner.model) { x.maner.randuri.forEach(rd => { rd.model ??= x.maner.model; }); delete x.maner.model; }
  if (!golDeTot(x.maner.randuri.at(-1) ?? { lungime: 1 }, [['lungime'], ['model']])) x.maner.randuri.push(randManerGol());

  // culoarea nouă nu are modelul ales → se goleşte şi se recalculează (după
  // randare, ca facturarea să nu rămână cu modelul vechi)
  let golite = false;
  for (const rd of x.maner.randuri) if (rd.model && !existaInCuloare(rd.model)) { rd.model = null; golite = true; }
  if (golite) queueMicrotask(rebuild);

  box.innerHTML = `
    ${camp('Asamblare', `<div class="segmented mini rame-seg" data-c="asamblare">${
      ASAMBLARE.map(([v, t]) => `<button data-v="${v}"${x.asamblare === v ? ' class="active"' : ''}>${t}</button>`).join('')}</div>`)}
    ${x.asamblare === 'noi' ? camp('Geam / oglindă', `<select class="rame-sel" data-c="geam">${geamOptionsHtml(x.geam)}</select>`)
      : x.asamblare === 'client' ? camp('Geam / oglindă', `<input type="text" class="rame-text" value="Asamblează clientul · sticlă 4 mm" readonly>`) : ''}
    ${camp(cu820 ? 'Cote găurire balamale' : 'Găurire', `<select class="rame-sel" data-c="gaurire">${
      optiuni(gaurire.map(g => [g, g]), x.gaurire, 'Alege')}</select>`)}

    <div class="rame-nota">Ramă ${model} · profil ${m.profil} · înălţime max ${m.H.at(-1)} mm · lăţime max ${m.L.at(-1)} mm
      (se rotunjesc în sus la mărimea standard)</div>
    <table class="rame-tabel">
      <thead><tr><th>#</th><th>Înălţime (mm)</th><th>Lăţime (mm)</th><th>Bucăţi</th>${cuGauri ? '<th>Găuri</th>' : ''}<th>Cod ramă</th><th></th></tr></thead>
      <tbody id="rameRanduri">${x.randuri.map((rd, i) => randHtml(rd, i, COL_RAME, 'rame-cod-')).join('')}</tbody>
    </table>

    ${cu820 ? `
    <div class="rame-et rame-titlu-maner">Profil mâner</div>
    <table class="rame-tabel rame-maner">
      <thead><tr><th>#</th><th>Model</th><th>Lungime (mm)</th><th>Bucăţi</th><th></th></tr></thead>
      <tbody id="rameManer">${x.maner.randuri.map((rd, i) => randHtml(rd, i, COL_MANER, null)).join('')}</tbody>
    </table>
    <div class="rame-nota" id="rameManerBare"></div>

    ${faraGaurire ? '' : `${camp('Balama', `<select class="rame-sel" data-c="balama">${
      optiuni([[FARA_BALAMALE, FARA_BALAMALE], ...BALAMALE[model]], x.balama, 'Alege balama')}</select>`)}
    ${camp('Plăcuţă', `<select class="rame-sel" data-c="placuta">${
      optiuni([[FARA_PLACUTE, FARA_PLACUTE], ...PLACUTE[model]], x.placuta, 'Alege placuta')}</select>`)}`}` : `
    ${x.gaurire === 'Gaurire Standard' ? camp('Manşon', `<div class="segmented mini rame-seg" data-c="manson">
      <button data-v="1"${x.manson ? ' class="active"' : ''}>Cu manşon</button>
      <button data-v="0"${!x.manson ? ' class="active"' : ''}>Fara manson</button></div>`) : ''}`}

    ${camp('Vopsire cod RAL', `<input type="text" class="rame-text" data-c="ral" value="${esc(x.ral)}" placeholder="ex. 9005">`)}
    ${camp('Manoperă vopsit (cantitate)', `<input type="number" class="rame-text mic" data-c="vopsitCant" min="0" step="1" value="${x.vopsitCant || ''}" placeholder="0">`)}`;

  const redeseneaza = () => { renderRame(box, { rebuild, geamOptionsHtml }); rebuild(); refreshRame(); };
  const laSchimbare = () => { rebuild(); refreshRame(); };

  tabelCrescator(box.querySelector('#rameRanduri'),
    { lista: x.randuri, coloane: COL_RAME, gol: randGol, idCod: 'rame-cod-', laSchimbare, redeseneaza });
  const tm = box.querySelector('#rameManer');
  if (tm) tabelCrescator(tm, { lista: x.maner.randuri, coloane: COL_MANER, gol: randManerGol, idCod: null, laSchimbare, redeseneaza });

  box.querySelectorAll('.rame-seg').forEach(seg => seg.querySelectorAll('button').forEach(btn =>
    btn.addEventListener('click', () => {
      x[seg.dataset.c] = seg.dataset.c === 'manson' ? btn.dataset.v === '1' : btn.dataset.v;
      redeseneaza();
    })));
  box.querySelectorAll('select.rame-sel').forEach(sel => sel.addEventListener('change', () => {
    x[sel.dataset.c] = sel.value;
    redeseneaza();
  }));
  box.querySelectorAll('input.rame-text').forEach(inp => inp.addEventListener('change', () => {
    x[inp.dataset.c] = inp.dataset.c === 'vopsitCant' ? Math.max(0, +inp.value || 0) : inp.value.trim();
    rebuild();
  }));

  culoareRandata = state.finish;
  ultimaRandare = { box, rebuild, geamOptionsHtml };
  refreshRame();
}

// Coloana „Cod ramă" + nr. de bare de mâner, din spec-ul curent. Dacă s-a
// schimbat culoarea, alte modele de mâner sunt disponibile → panoul se refece.
let culoareRandata = null, ultimaRandare = null;
export function refreshRame() {
  const s = currentSpec();
  if (!s?.randuri) return;
  if (culoareRandata !== state.finish && ultimaRandare?.box.isConnected) {
    renderRame(ultimaRandare.box, ultimaRandare);   // îşi cheamă singur refreshRame la final
    return;
  }
  s.randuri.forEach(rd => {
    const el = document.getElementById(`rame-cod-${rd.i}`);
    if (!el) return;
    el.classList.toggle('eroare', !!rd.eroare);
    el.textContent = rd.gol ? '' : rd.cod ?? (rd.eroare ? '⚠ prea mare' : `${rd.hR}×${rd.lR}`);
    el.title = rd.eroare ?? (rd.gol ? '' : `rotunjit la ${rd.hR}×${rd.lR} · geam ${rd.geamH}×${rd.geamL}`);
  });
  const bare = document.getElementById('rameManerBare');
  const nr = (s.manere ?? []).reduce((a, e) => a + e.bare, 0);
  if (bare) bare.textContent = nr ? `${nr} ${nr === 1 ? 'bară' : 'bare'} de ${BARA_MANER_MM} mm` : '';
}
