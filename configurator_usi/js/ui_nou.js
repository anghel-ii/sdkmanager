import { state } from './state.js';
import { systems } from './systems/registry.js';
import { currentSpec, currentBilling } from './builder.js';
import gameJson from './systems/game.json';
import { configuratieCompleta } from './ui.js';

// ═══════════════════════════════════════════════════════════════════════════
//  INTERFAŢA NOUĂ (userul, 2026-09-24; designul din Superdesign)
//
//  NU are logică proprie de configurare: ia grupurile pe care le randează deja
//  ui.js (aceleaşi id-uri, aceleaşi handlere) şi le mută în paşi numerotaţi
//  (1 Model · 2 Culoare · 3 Dimensiuni · 4 Uşi · 5 Ofertă), cu o bară sus
//  (drumul înapoi, unde eşti, starea, CLEAR PAGE) şi bara clientului lipită jos.
//  Aşezarea (3D sus la jumătate de ecran / în dreapta pe ecran întreg) e toată
//  în css/nou.css, sub body.ui-nou (singura interfaţă, din 2026-09-25).
//
//  După fiecare recalculare, ui.js trimite evenimentul 'configurator:rebuild';
//  de aici se actualizează rezumatele paşilor, starea şi tabul rezultatelor.
// ═══════════════════════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);
const grupul = el => el?.closest('.group') ?? null;
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const buc = (n, unu, multe) => `${n} ${n === 1 ? unu : multe}`;
const vizibil = el => el && el.style.display !== 'none' && !el.hidden;

const PASI = [
  { id: 'model',   titlu: 'Model',      el: () => [$('modelSchitaWrap')] },
  { id: 'culoare', titlu: 'Culoare',    el: () => [grupul($('colorSwatches'))] },
  { id: 'dim',     titlu: 'Dimensiuni', el: () => [$('groupHeight'), $('groupWidth'), $('groupDoorsTracks'), $('groupRame'), $('groupUtil')] },
  { id: 'usi',     titlu: 'Uşi',        el: () => [$('groupUsi')] },
  // mai multe produse pe o ofertă (js/cos.js) — opţional: fără număr, nu e niciodată „pasul următor"
  { id: 'cos',     titlu: 'Produse în ofertă', el: () => [$('groupCos')], optional: true },
  // datele clientului — pas propriu (userul, 2026-10-05), nu bară lipită jos
  { id: 'client',  titlu: 'Client',     el: () => [$('groupClient')] },
  { id: 'oferta',  titlu: 'Rezultat',   el: () => [] },
];
const TABURI = [['spec', 'Specificaţie'], ['roBom', 'Necesar'], ['roClient', 'Client'], ['roBilling', 'Facturare']];
let tabActiv = 'roBilling';

export function initNou() {
  document.body.classList.add('ui-nou');
  const app = $('app'), sidebar = $('sidebar'), stage = $('stage');

  // ── bara de sus ──
  const bara = document.createElement('header');
  bara.id = 'nouBara';
  bara.innerHTML = `
    <span class="nou-cale" id="nouCale"></span>`;
  app.prepend(bara);
  // servit de manager: bara comună a managerului (/bara.js), cu „unde eşti" lângă linkuri;
  // altfel (Cloudflare, de pe disc) bara proprie, cu drumul înapoi
  if (window.puneBara) { bara.querySelector('#nouCale').classList.add('bara-context'); window.puneBara(bara); }
  else {
    const acasa = $('linkAcasa');          // renderOferta îi pune adresa şi vizibilitatea
    if (acasa) { acasa.textContent = '← Manager'; bara.prepend(acasa); }
  }

  // ── banda de acţiuni, lipită sus în coloana paşilor: starea, Goleşte pagina şi
  //    butoanele de salvare / fişă (mutate din bara clientului), mesajele dedesubt ──
  const actiuni = document.createElement('div');
  actiuni.id = 'nouActiuni';
  actiuni.innerHTML = `<div class="nou-banda"><button type="button" class="nou-stare" id="nouStare" hidden></button></div>
    <div class="nou-mesaje"></div>`;
  const banda = actiuni.querySelector('.nou-banda');
  const clear = $('btnClear');
  if (clear) banda.appendChild(clear);
  const butoane = document.querySelector('#groupClient .client-butoane');
  if (butoane) banda.appendChild(butoane);
  for (const id of ['ofertaUI', 'ofertaMesaj']) { const el = $(id); if (el) actiuni.querySelector('.nou-mesaje').appendChild(el); }
  // câmpurile clientului cu eticheta deasupra (până acum doar placeholder)
  for (const [id, text] of [['clientNume', 'Nume client'], ['clientTelefon', 'Telefon'], ['clientAdresa', 'Adresă'],
    ['comandaLivrare', 'Mod de livrare'], ['comandaPlata', 'Metodă de plată'], ['comandaAgent', 'Agent'], ['ofertaNr', 'Număr ofertă']]) {
    const el = $(id);
    if (!el) continue;
    const l = document.createElement('label');
    l.className = 'nou-camp';
    l.innerHTML = `<span>${text}</span>`;
    // meniul căutabil (campuri.js) stă imediat după <select>-ul ascuns — merge cu el
    const cautabil = el.nextElementSibling?.classList.contains('cautabil') ? el.nextElementSibling : null;
    el.before(l);
    l.append(el, ...(cautabil ? [cautabil] : []));
  }
  actiuni.querySelector('#nouStare').addEventListener('click', () => { deschide('oferta'); arataTab('roBilling'); });

  // ── cotele pe 3D + „Ascunde 3D" (doar la jumătate de ecran) ──
  const cote = document.createElement('div');
  cote.id = 'nouCote';
  stage.appendChild(cote);
  const ascunde = document.createElement('button');
  ascunde.type = 'button';
  ascunde.id = 'nouAscunde';
  ascunde.textContent = 'Ascunde 3D';
  ascunde.addEventListener('click', () => {
    const da = document.body.classList.toggle('nou-3d-ascuns');
    ascunde.textContent = da ? 'Arată 3D' : 'Ascunde 3D';
  });
  stage.appendChild(ascunde);

  // ── paşii: grupurile existente, mutate (nu copiate) ──
  const cont = document.createElement('div');
  cont.id = 'nouPasi';
  sidebar.insertBefore(cont, document.querySelector('.brand')?.nextSibling ?? sidebar.firstChild);
  sidebar.insertBefore(actiuni, cont);
  PASI.forEach((p, i) => {
    const s = document.createElement('section');
    s.className = 'pas' + (p.optional ? ' optional' : '');
    s.dataset.pas = p.id;
    s.innerHTML = `
      <div class="pas-cap">
        <span class="pas-nr">${i + 1}</span><span class="pas-titlu">${p.titlu}</span>
        <span class="pas-rez"></span>
      </div>
      <div class="pas-corp"></div>`;
    const corp = s.querySelector('.pas-corp');
    p.el().filter(Boolean).forEach(el => corp.appendChild(el));
    cont.appendChild(s);
  });

  // pasul 5: rezultatele pe taburi (se citesc, nu se editează)
  const corp5 = cont.querySelector('[data-pas="oferta"] .pas-corp');
  corp5.innerHTML = `<div class="segmented nou-taburi">${TABURI.map(([id, t]) =>
    `<button type="button" data-tab="${id}">${t}</button>`).join('')}</div>`;
  const spec = grupul($('roSummary'));
  if (spec) spec.id = 'spec';
  for (const [id] of TABURI) { const el = $(id); if (el) { el.classList.add('nou-panou'); corp5.appendChild(el); } }
  corp5.querySelectorAll('.nou-taburi button').forEach(b => b.addEventListener('click', () => arataTab(b.dataset.tab)));
  document.querySelector('#sidebar > hr.sep')?.remove();

  document.addEventListener('configurator:rebuild', actualizeaza);
  $('groupClient')?.addEventListener('input', actualizeaza);   // pasul Client se bifează la nume
  // la orice re-randare a barei (carduri, opţiuni avansate, rame): câmpuri în loc
  // de steppere şi texte fără prescurtări. Idempotent, deci nu se ciclează.
  const curata = () => { inlocuiesteSteppere(sidebar); scrieIntreg(sidebar); };
  new MutationObserver(curata).observe(sidebar, { childList: true, subtree: true });
  curata();
  actualizeaza();
}

// ── Câmpuri numerice în loc de steppere (− n +) ──
// Câmpul NU are logică proprie: la schimbare apasă butoanele −/+ ale stepperului
// (ascuns) până ajunge la valoarea scrisă — aceleaşi limite şi aceeaşi
// recalculare ca în interfaţa clasică. Stepperul se poate re-randa după fiecare
// apăsare (cardurile), de-aia îl căutăm din nou de fiecare dată după o cheie.
const cheieStepper = st => st.closest('#groupDoors') ? '#groupDoors .stepper'
  : st.dataset.camp != null ? `.stepper[data-door="${st.dataset.door}"][data-camp="${st.dataset.camp}"]`
  : `.stepper.mini[data-door="${st.dataset.door}"]:not(.av-aplicate-nr)`;
const valoare = st => parseInt(st?.querySelector('.n')?.textContent, 10);

function inlocuiesteSteppere(radacina) {
  radacina.querySelectorAll('.stepper:not([data-nou])').forEach(st => {
    st.dataset.nou = '1';
    const inp = document.createElement('input');
    inp.type = 'number'; inp.min = '0'; inp.step = '1'; inp.inputMode = 'numeric';
    inp.className = 'nou-nr';
    inp.value = valoare(st);
    const cheie = cheieStepper(st);
    inp.addEventListener('change', () => seteazaStepper(cheie, parseInt(inp.value, 10)));
    st.after(inp);
  });
  // valorile schimbate din altă parte (ex. culoarea forţează nr. de uşi)
  radacina.querySelectorAll('.stepper[data-nou] + .nou-nr').forEach(inp => {
    if (document.activeElement !== inp) inp.value = valoare(inp.previousElementSibling);
  });
}

function seteazaStepper(cheie, tinta) {
  if (!Number.isFinite(tinta)) return;
  for (let k = 0; k < 60; k++) {
    const st = document.querySelector(cheie), v = valoare(st);
    if (!st || v === tinta) break;
    st.querySelector(v < tinta ? 'button:last-of-type' : 'button:first-of-type').click();
    if (valoare(document.querySelector(cheie)) === v) break;   // limita stepperului
  }
  const st = document.querySelector(cheie), inp = st?.nextElementSibling;
  if (inp?.classList.contains('nou-nr')) inp.value = valoare(st);
}

// ── Fără prescurtări ──
const INTREG = {
  'NR. UŞI': 'NUMĂR DE UŞI', 'Div.': 'Divizări', 'Cant.': 'Cantitate', 'Buc': 'Bucăţi', 'St': 'Sticlă',
  'H (mm)': 'Înălţime (mm)', 'L (mm)': 'Lăţime (mm)', 'Manoperă vopsit (cant.)': 'Manoperă vopsit (cantitate)',
};
function scrieIntreg(radacina) {
  radacina.querySelectorAll('th, td, span, div, button').forEach(el => {
    if (el.children.length || !el.firstChild) return;
    const t = el.textContent.trim();
    if (INTREG[t] && INTREG[t] !== t) el.textContent = INTREG[t];
    else if (/ H max \d/.test(t)) el.textContent = t.replace(' H max ', ' înălţime max ').replace(' L max ', ' lăţime max ');
  });
}

// paşii stau mereu deschişi (userul, 2026-09-25: strânsul lor încurca) — aici doar
// se derulează până la pas
function deschide(id) {
  const s = document.querySelector(`.pas[data-pas="${id}"]`);
  if (!s) return;
  s.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function arataTab(id) {
  tabActiv = id;
  for (const [t] of TABURI) {
    const el = $(t);
    if (el) el.hidden = t !== id;
  }
  document.querySelectorAll('.nou-taburi button').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
}

// ── după fiecare recalculare: rezumate, stări, cote, taburi ──
function actualizeaza() {
  const sys = systems[state.system];
  const meta = sys?.meta;
  const spec = currentSpec();
  const f = currentBilling();
  const rame = !!meta?.rame;
  const gama = gameJson.game.find(g => g.id === (meta?.family ?? new URLSearchParams(location.search).get('gama')));

  $('nouCale').innerHTML = `Ofertă nouă${gama ? ` <i>›</i> ${esc(gama.label)}` : ''}${meta ? ` <i>›</i> <b>${esc(meta.label)}</b>` : ''}`;

  // starea: erorile de facturare (blochează salvarea şi copierea) sau „gata"
  const stare = $('nouStare');
  stare.hidden = !meta;
  const n = f.errors.length;
  // cât timp lipseşte model / culoare / cote / nr. de uşi, e „incompletă" — nu
  // „gata" şi nici erori (erorile de facturare vin după, pe configuraţia întreagă)
  const inceputa = configuratieCompleta();
  const complet = inceputa && !n && f.lines.length > 0;
  stare.className = 'nou-stare ' + (!inceputa ? '' : n ? 'eroare' : complet ? 'ok' : '');
  stare.textContent = !inceputa ? 'Configuraţie incompletă'
    : n ? `${n} ${n === 1 ? 'eroare' : 'erori'}` : complet ? 'Gata de salvat' : 'Configuraţie incompletă';
  stare.title = n ? f.errors.join('\n') : '';

  // cotele pe 3D
  const cote = $('nouCote');
  cote.hidden = !spec;
  if (spec) {
    cote.textContent = rame
      ? `${buc(spec.nrRame ?? 0, 'ramă', 'rame')} · ${buc(spec.pline?.length ?? 0, 'mărime', 'mărimi')}`
      : `Uşă ${Math.round(spec.door.h)} × ${Math.round(spec.door.w)} mm · ${spec.door.count} ${spec.door.count === 1 ? 'uşă' : 'uşi'}`;
  }

  const hGol = $('heightInput')?.value, lGol = $('widthInput')?.value;
  const areUsi = !!meta?.doorsRange;
  const usiAlese = !areUsi || state.doors > 0;
  const suprap = document.querySelector('#tracksToggle button.active')?.textContent;
  const noi = (state.assembly ?? []).filter(a => a === 'noi').length;
  const swatch = document.querySelector('#colorSwatches .swatch.active');

  const gata = {
    model:   !!meta,
    culoare: !!state.finish && !!swatch,
    dim:     rame ? (spec?.nrRame ?? 0) > 0 : !!(meta && hGol && lGol && usiAlese),
    usi:     !!meta && !rame && !!hGol && !!lGol && usiAlese && vizibil($('groupUsi')) && !n,
    oferta:  !!meta && !n && complet,
    client:  !!$('clientNume')?.value.trim(),
    cos:     document.querySelectorAll('#groupCos .cos-lista li').length > 1,
  };
  const rezumat = {
    model:   meta ? `${esc(meta.label)}${meta.sketch ? ` <img src="${esc(meta.sketch)}" alt="">` : ''}` : '',
    culoare: swatch ? swatch.innerHTML : '',
    dim:     rame ? buc(spec?.nrRame ?? 0, 'ramă', 'rame') : hGol && lGol
      ? `${hGol} × ${lGol} mm${areUsi ? ` · ${state.doors} uşi${suprap ? ` · ${suprap} ${suprap === '1' ? 'suprapunere' : 'suprapuneri'}` : ''}` : ''}` : '',
    usi:     `${state.doors || (meta?.doors ?? 0)} uşi · ${noi} asamblate de noi`,
    oferta:  n ? `${n} ${n === 1 ? 'eroare' : 'erori'}` : `${f.lines.length} linii de facturare`,
    cos:     `${document.querySelectorAll('#groupCos .cos-lista li').length} produse în ofertă`,
    client:  esc([$('clientNume')?.value, $('clientTelefon')?.value].map(v => v?.trim()).filter(Boolean).join(' · ')),
  };
  if (rame) PASI[2].titlu = 'Rânduri şi opţiuni';

  let curent = null, nr = 0;
  PASI.forEach(p => {
    const s = document.querySelector(`.pas[data-pas="${p.id}"]`);
    if (!s) return;
    s.querySelector('.pas-titlu').textContent = p.titlu;
    // pasul 4 dispare la rame (n-au carduri de uşă) şi până apar cardurile
    s.hidden = p.id === 'usi' ? !vizibil($('groupUsi')) : p.id === 'oferta' ? !meta : false;
    s.classList.toggle('gata', gata[p.id]);
    // numerotare doar pe paşii vizibili şi obligatorii (fără 4 lipsă când n-are uşi)
    if (!s.hidden && !p.optional) nr++;
    s.querySelector('.pas-nr').textContent = p.optional ? '+' : gata[p.id] ? '✓' : String(nr);
    s.querySelector('.pas-rez').innerHTML = gata[p.id] || p.id === 'oferta' ? rezumat[p.id] : '';
    if (!curent && !gata[p.id] && !s.hidden && !p.optional) curent = p.id;
    s.classList.remove('curent');
  });
  if (curent) document.querySelector(`.pas[data-pas="${curent}"]`).classList.add('curent');

  // taburile: doar cele cu conţinut; dacă tabul ales s-a golit, primul cu conţinut
  const cuContinut = TABURI.filter(([id]) => ($(id)?.innerHTML.trim() ?? '') !== '').map(([id]) => id);
  document.querySelectorAll('.nou-taburi button').forEach(b => { b.hidden = !cuContinut.includes(b.dataset.tab); });
  arataTab(cuContinut.includes(tabActiv) ? tabActiv : (cuContinut.at(-1) ?? 'roBilling'));
}
