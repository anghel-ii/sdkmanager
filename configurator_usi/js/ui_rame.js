import { state } from './state.js';
import { systems } from './systems/registry.js';
import { currentSpec } from './builder.js';
import {
  MODELE_RAME, ASAMBLARE, GAURIRE_820, GAURIRE_831, LIVRARE, AGENTI, FACTURARE,
  BALAMALE, PLACUTE, MANERE, FARA_BALAMALE, FARA_PLACUTE, FARA_MANER,
  stareRameGoala, randGol,
} from './lib/rame/rame.js';

// ═══════════════════════════════════════════════════════════════════════════
//  UI RAME — panoul din bara laterală pt. gama „rame" (în locul cotelor de gol,
//  nr. de uşi şi cardurilor de uşă). Aceleaşi câmpuri ca formularul Excel:
//  rânduri H × L × buc (× găuri la 820/822/824), cine asamblează, geam,
//  cote de găurire, balama/plăcuţă sau manşon, profil mâner, vopsire RAL,
//  livrare, agent, facturare. Selectările pornesc pe „Alege…" — facturarea
//  rămâne blocată până sunt toate alese (ca macro-ul Valideaza).
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

export function renderRame(box, { rebuild, geamOptionsHtml }) {
  const meta = systems[state.system]?.meta;
  if (!box || !meta?.rame) return;
  const model = meta.rame, m = MODELE_RAME[model], x = r();
  const cu820 = m.grup === '820';
  const gaurire = cu820 ? GAURIRE_820 : GAURIRE_831;

  const randuri = x.randuri.map((rd, i) => `
    <tr>
      <td class="rame-nr">${i + 1}</td>
      <td><input type="number" class="rame-in" data-i="${i}" data-c="h" min="0" max="${m.H.at(-1)}" step="1" value="${rd.h ?? ''}" placeholder="H"></td>
      <td><input type="number" class="rame-in" data-i="${i}" data-c="l" min="0" max="${m.L.at(-1)}" step="1" value="${rd.l ?? ''}" placeholder="L"></td>
      <td><input type="number" class="rame-in mic" data-i="${i}" data-c="buc" min="0" step="1" value="${rd.buc ?? ''}"></td>
      ${cu820 ? `<td><input type="number" class="rame-in mic" data-i="${i}" data-c="gauri" min="0" step="1" value="${rd.gauri ?? 0}"></td>` : ''}
      <td class="rame-cod" id="rame-cod-${i}"></td>
      <td><button class="rame-sterge" data-i="${i}" title="Şterge rândul"${x.randuri.length === 1 ? ' disabled' : ''}>✕</button></td>
    </tr>`).join('');

  const maner = x.maner;
  const manerHtml = !cu820 ? '' : `
    ${camp('Profil mâner', `<select class="rame-sel" data-c="manerProfil">${
      optiuni([[FARA_MANER, FARA_MANER], ...MANERE.map(([c, d]) => [c, d])], maner.profil, 'Alege')}</select>`)}
    ${maner.profil !== FARA_MANER ? `
    <table class="rame-tabel rame-maner">
      <thead><tr><th>#</th><th>Lungime (mm)</th><th>Buc</th><th></th></tr></thead>
      <tbody>${maner.randuri.map((mr, i) => `
        <tr><td class="rame-nr">${i + 1}</td>
          <td><input type="number" class="rame-maner-in" data-i="${i}" data-c="lungime" min="1" value="${mr.lungime ?? ''}"></td>
          <td><input type="number" class="rame-maner-in mic" data-i="${i}" data-c="buc" min="0" value="${mr.buc ?? ''}"></td>
          <td><button class="rame-maner-sterge" data-i="${i}"${maner.randuri.length === 1 ? ' disabled' : ''}>✕</button></td></tr>`).join('')}
      </tbody>
    </table>
    <button class="rame-adauga" id="rameManerAdauga" type="button">+ Rând mâner</button>
    <div class="rame-nota" id="rameManerBare"></div>` : ''}`;

  box.innerHTML = `
    <div class="rame-nota">Ramă ${model} · profil ${m.profil} · H max ${m.H.at(-1)} mm · L max ${m.L.at(-1)} mm
      (se rotunjesc în sus la mărimea standard)</div>
    <table class="rame-tabel">
      <thead><tr><th>#</th><th>H (mm)</th><th>L (mm)</th><th>Buc</th>${cu820 ? '<th>Găuri</th>' : ''}<th>Cod ramă</th><th></th></tr></thead>
      <tbody>${randuri}</tbody>
    </table>
    <button class="rame-adauga" id="rameAdauga" type="button">+ Adaugă rând</button>

    ${camp('Asamblare', `<div class="segmented mini rame-seg" data-c="asamblare">${
      ASAMBLARE.map(([v, t]) => `<button data-v="${v}"${x.asamblare === v ? ' class="active"' : ''}>${t}</button>`).join('')}</div>`)}
    ${x.asamblare === 'noi' ? camp('Geam / oglindă', `<select class="rame-sel" data-c="geam">${geamOptionsHtml(x.geam)}</select>`) : ''}
    ${camp(cu820 ? 'Cote găurire balamale' : 'Găurire', `<select class="rame-sel" data-c="gaurire">${
      optiuni(gaurire.map(g => [g, g]), x.gaurire, 'Alege')}</select>`)}
    ${cu820 ? `
    ${camp('Balama', `<select class="rame-sel" data-c="balama">${
      optiuni([[FARA_BALAMALE, FARA_BALAMALE], ...BALAMALE[model]], x.balama, 'Alege balama')}</select>`)}
    ${camp('Plăcuţă', `<select class="rame-sel" data-c="placuta">${
      optiuni([[FARA_PLACUTE, FARA_PLACUTE], ...PLACUTE[model]], x.placuta, 'Alege placuta')}</select>`)}` : `
    ${x.gaurire === 'Gaurire Standard' ? camp('Manşon', `<div class="segmented mini rame-seg" data-c="manson">
      <button data-v="1"${x.manson ? ' class="active"' : ''}>Cu manşon</button>
      <button data-v="0"${!x.manson ? ' class="active"' : ''}>Fara manson</button></div>`) : ''}`}
    ${manerHtml}

    ${camp('Vopsire cod RAL', `<input type="text" class="rame-text" data-c="ral" value="${esc(x.ral)}" placeholder="ex. 9005">`)}
    ${camp('Manoperă vopsit (cant.)', `<input type="number" class="rame-text mic" data-c="vopsitCant" min="0" step="1" value="${x.vopsitCant || ''}" placeholder="0">`)}
    ${camp('Mod de livrare', `<select class="rame-sel" data-c="livrare">${optiuni(LIVRARE.map(v => [v, v]), x.livrare, 'Alege')}</select>`)}
    ${camp('Agent', `<select class="rame-sel" data-c="agent">${optiuni(AGENTI.map(v => [v, v]), x.agent, 'Alege')}</select>`)}
    ${camp('Facturare', `<select class="rame-sel" data-c="facturare">${optiuni(FACTURARE.map(v => [v, v]), x.facturare, 'Alege')}</select>`)}`;

  const redeseneaza = () => { renderRame(box, { rebuild, geamOptionsHtml }); rebuild(); refreshRame(); };

  // Cotele: la 'change' se actualizează doar starea + coloana de coduri,
  // fără re-randarea panoului (altfel s-ar pierde focusul la Tab).
  box.querySelectorAll('input.rame-in').forEach(inp => inp.addEventListener('change', () => {
    const v = limiteaza(parseInt(inp.value, 10), maxCota(m, inp.dataset.c));
    x.randuri[+inp.dataset.i][inp.dataset.c] = v;
    inp.value = v ?? '';
    rebuild(); refreshRame();
  }));
  box.querySelectorAll('.rame-sterge').forEach(b => b.addEventListener('click', () => {
    x.randuri.splice(+b.dataset.i, 1); redeseneaza();
  }));
  box.querySelector('#rameAdauga')?.addEventListener('click', () => { x.randuri.push(randGol()); redeseneaza(); });

  box.querySelectorAll('.rame-seg').forEach(seg => seg.querySelectorAll('button').forEach(btn =>
    btn.addEventListener('click', () => {
      x[seg.dataset.c] = seg.dataset.c === 'manson' ? btn.dataset.v === '1' : btn.dataset.v;
      redeseneaza();
    })));
  box.querySelectorAll('select.rame-sel').forEach(sel => sel.addEventListener('change', () => {
    if (sel.dataset.c === 'manerProfil') maner.profil = sel.value; else x[sel.dataset.c] = sel.value;
    redeseneaza();
  }));
  box.querySelectorAll('input.rame-text').forEach(inp => inp.addEventListener('change', () => {
    x[inp.dataset.c] = inp.dataset.c === 'vopsitCant' ? Math.max(0, +inp.value || 0) : inp.value.trim();
    rebuild();
  }));

  box.querySelectorAll('input.rame-maner-in').forEach(inp => inp.addEventListener('change', () => {
    const v = parseInt(inp.value, 10);
    maner.randuri[+inp.dataset.i][inp.dataset.c] = Number.isFinite(v) && v >= 0 ? v : null;
    rebuild(); refreshRame();
  }));
  box.querySelectorAll('.rame-maner-sterge').forEach(b => b.addEventListener('click', () => {
    maner.randuri.splice(+b.dataset.i, 1); redeseneaza();
  }));
  box.querySelector('#rameManerAdauga')?.addEventListener('click', () => {
    maner.randuri.push({ lungime: null, buc: 1 }); redeseneaza();
  });

  refreshRame();
}

// Coloana „Cod ramă" + nr. de bare de mâner, din spec-ul curent.
export function refreshRame() {
  const s = currentSpec();
  if (!s?.randuri) return;
  s.randuri.forEach(rd => {
    const el = document.getElementById(`rame-cod-${rd.i}`);
    if (!el) return;
    el.classList.toggle('eroare', !!rd.eroare);
    el.textContent = rd.gol ? '' : rd.cod ?? (rd.eroare ? '⚠ prea mare' : `${rd.hR}×${rd.lR}`);
    el.title = rd.eroare ?? (rd.gol ? '' : `rotunjit la ${rd.hR}×${rd.lR} · geam ${rd.geamH}×${rd.geamL}`);
  });
  const bare = document.getElementById('rameManerBare');
  if (bare) bare.textContent = s.bareManer ? `${s.bareManer} bare de 2500 mm` : '';
}
