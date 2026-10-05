// ═══════════════════════════════════════════════════════════════════════════
//  CÂMPURILE DIN BARA LATERALĂ — două ajutoare de tastatură (userul, 2026-09-23)
//
//  1. Enter = câmpul următor: aplică valoarea (ca Tab) şi mută cursorul pe
//     următorul câmp de completat (cote, meniuri, rânduri de rame, client).
//     Butoanele nu intră în drum — Enter nu salvează nimic din greşeală.
//  2. Meniurile lungi (≥ PRAG opţiuni: geam / oglindă, balamale, plăcuţe,
//     mânere, agenţi…) devin căutabile: scrii „gri" şi rămân doar opţiunile
//     care se potrivesc, cele mai potrivite primele.
//
//  Meniul original (<select>) rămâne în pagină, ascuns, şi e în continuare
//  sursa valorii: alegerea din căutare îi pune valoarea şi declanşează
//  `change` pe el, deci logica existentă (ui.js, ui_rame.js) nu se schimbă.
//  Meniurile se re-randează des (innerHTML) — un MutationObserver le
//  îmbunătăţeşte pe cele noi.
// ═══════════════════════════════════════════════════════════════════════════

const PRAG = 8;   // de la atâtea opţiuni în sus, meniul devine căutabil

// meniurile căutabile din pagină: caseta lor + lista plutitoare + închiderea
const cautabile = new Set();

// fără diacritice, litere mici — „Sticlă" şi „sticla" sunt acelaşi lucru
const normal = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Cât de bine se potriveşte `text` cu `cautare`: null = deloc. Toate cuvintele
// căutate trebuie să apară (în orice ordine); scor mai mare = mai potrivit:
// cuvânt întreg > început de cuvânt > în interiorul unui cuvânt, apoi cât de
// devreme apare, apoi textele mai scurte.
// în catalog nu apare „sticlă" — toate sunt „Geam …" / „Oglinda …"
const SINONIME = { sticla: 'geam' };

export function potrivire(text, cautare) {
  const t = normal(text);
  const cuvinte = normal(cautare).split(/\s+/).filter(Boolean).map(c => SINONIME[c] ?? c);
  let scor = 0;
  for (const c of cuvinte) {
    const i = t.indexOf(c);
    if (i < 0) return null;
    const inceput = i === 0 || /[^a-z0-9]/.test(t[i - 1]);
    const intreg = inceput && !/[a-z0-9]/.test(t[i + c.length] ?? '');
    scor += intreg ? 30 : inceput ? 20 : 5;
    scor -= i / 100;
  }
  return scor - t.length / 1000;
}

// ── Meniu căutabil ──────────────────────────────────────────────────────────
function faCautabil(sel) {
  const optiuni = [...sel.options].map(o => ({
    valoare: o.value, text: o.textContent.trim(), grup: o.parentElement?.label ?? '',
    placeholder: o.disabled && !o.value,
  }));
  const valide = optiuni.filter(o => !o.placeholder);
  const placeholder = optiuni.find(o => o.placeholder)?.text ?? 'Caută…';

  const cutie = document.createElement('div');
  cutie.className = 'cautabil';
  const inp = document.createElement('input');
  inp.className = 'cautabil-in';
  inp.autocomplete = 'off';
  inp.spellcheck = false;
  inp.placeholder = placeholder;
  inp.disabled = sel.disabled;
  inp.setAttribute('role', 'combobox');
  inp.setAttribute('aria-expanded', 'false');
  const lista = document.createElement('ul');
  lista.className = 'cautabil-lista';
  lista.setAttribute('role', 'listbox');
  lista.hidden = true;
  cutie.append(inp, lista);
  sel.hidden = true;
  sel.dataset.cautabil = '1';
  sel.after(cutie);
  document.body.append(lista);   // în afara barei laterale — altfel o taie derularea ei

  const textAles = () => valide.find(o => o.valoare === sel.value)?.text ?? '';
  inp.value = textAles();

  let rezultate = [], activ = 0;
  const randeaza = () => {
    lista.innerHTML = rezultate.length
      ? rezultate.map((o, k) => `<li role="option" data-k="${k}"${k === activ ? ' class="activ" aria-selected="true"' : ''}>${
          esc(o.text)}${o.grup ? ` <small>${esc(o.grup)}</small>` : ''}</li>`).join('')
      : '<li class="nimic">Nimic nu se potriveşte</li>';
    lista.querySelector('li.activ')?.scrollIntoView({ block: 'nearest' });
  };
  const filtreaza = q => {
    rezultate = !q.trim() ? valide
      : valide.map((o, i) => ({ o, i, s: potrivire(`${o.text} ${o.grup}`, q) }))
          .filter(x => x.s != null).sort((a, b) => b.s - a.s || a.i - b.i).map(x => x.o);
    activ = Math.max(0, !q.trim() ? rezultate.findIndex(o => o.valoare === sel.value) : 0);
    randeaza();
  };
  const pozitioneaza = () => {
    // în jos, sau în sus când dedesubt nu e loc (ex. agentul, în bara de jos);
    // înălţimea se strânge la spaţiul rămas, ca lista să nu iasă din ecran
    const r = inp.getBoundingClientRect();
    const MAX = 280, jos = innerHeight - r.bottom - 8, sus = r.top - 8;
    const inSus = jos < Math.min(MAX, lista.scrollHeight || MAX) && sus > jos;
    Object.assign(lista.style, {
      left: `${r.left}px`, minWidth: `${r.width}px`,
      top:    inSus ? 'auto' : `${r.bottom + 2}px`,
      bottom: inSus ? `${innerHeight - r.top + 2}px` : 'auto',
      maxHeight: `${Math.min(MAX, inSus ? sus : jos)}px`,
    });
  };
  const deschide = () => {
    if (!lista.hidden || inp.disabled) return;
    pozitioneaza();
    lista.hidden = false;
    inp.setAttribute('aria-expanded', 'true');
    inp.select();
    filtreaza('');
  };
  const inchide = () => {
    lista.hidden = true;
    inp.setAttribute('aria-expanded', 'false');
    inp.value = textAles();
  };
  const alege = o => {
    if (!o) return;
    inchide();
    if (sel.value !== o.valoare) {
      sel.value = o.valoare;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    inp.value = o.text;
  };

  inp.addEventListener('focus', deschide);
  inp.addEventListener('click', deschide);
  inp.addEventListener('input', () => { if (lista.hidden) deschide(); filtreaza(inp.value); });
  inp.addEventListener('blur', () => setTimeout(inchide, 120));
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (lista.hidden) return deschide();
      activ = (activ + (e.key === 'ArrowDown' ? 1 : -1) + rezultate.length) % Math.max(1, rezultate.length);
      randeaza();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const ramase = campuri(), i = ramase.indexOf(inp);
      if (!lista.hidden) alege(rezultate[activ]);
      mergiLa(i + 1);
    } else if (e.key === 'Escape') {
      inchide();
    }
  });
  // mousedown (nu click): alege înainte ca blur-ul să închidă lista
  lista.addEventListener('mousedown', e => {
    const li = e.target.closest('li[data-k]');
    if (!li) return;
    e.preventDefault();
    alege(rezultate[+li.dataset.k]);
  });
  cautabile.add({ cutie, lista, inchide });
}

const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ── Enter = câmpul următor ──────────────────────────────────────────────────
// Câmpurile de completat, în ordinea din pagină: casete de text / număr şi
// meniuri (cele căutabile prin caseta lor). Fără butoane.
// `bara` = unde se lucrează: coloana paşilor din configurator (#sidebar) sau
// pagina ofertei cu amănuntul (<main>).
let bara = null;
function campuri() {
  return [...bara.querySelectorAll('input, select')].filter(el =>
    !el.disabled && !el.hidden && el.offsetParent !== null &&
    !['checkbox', 'radio', 'button', 'submit', 'file', 'hidden'].includes(el.type));
}
// după o schimbare, bara se poate re-randa: mergem pe POZIŢIA următoare, recitită
function mergiLa(i) {
  setTimeout(() => {
    const el = campuri()[i];
    if (el) { el.focus(); if (el instanceof HTMLInputElement && el.type !== 'number') el.select(); }
  });
}

// `cuCautabile` = meniurile lungi devin căutabile (doar în configurator; la amănunt
// meniurile clientului rămân cum erau — acolo se cere doar Enter).
export function activeazaCampuri(radacina = document.getElementById('sidebar'), { cuCautabile = true } = {}) {
  bara = radacina;
  if (!bara) return;

  const imbunatateste = () => {
    // meniurile scoase din pagină (bara re-randată) îşi iau şi lista plutitoare
    for (const c of cautabile) if (!c.cutie.isConnected) { c.lista.remove(); cautabile.delete(c); }
    bara.querySelectorAll('select:not([data-cautabil])').forEach(sel => {
      if ([...sel.options].filter(o => o.value).length >= PRAG) faCautabil(sel);
    });
  };
  if (cuCautabile) {
    imbunatateste();
    new MutationObserver(imbunatateste).observe(bara, { childList: true, subtree: true });
  }
  // lista stă fixă pe ecran — la derularea barei sau a ferestrei se închide
  const inchideToate = () => cautabile.forEach(c => { if (!c.lista.hidden) c.inchide(); });
  bara.addEventListener('scroll', inchideToate, true);
  window.addEventListener('resize', inchideToate);

  bara.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.defaultPrevented) return;
    const el = e.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return;
    if (['checkbox', 'radio', 'button', 'submit', 'file'].includes(el.type)) return;
    e.preventDefault();
    const i = campuri().indexOf(el);
    el.blur();          // aplică valoarea (declanşează `change`, ca Tab)
    mergiLa(i + 1);
  });
}
