import produse from './catalog/amanunt.json';
import * as manager from './manager.js';
import { cautator, debitare } from './amanunt-calcul.js';
import { initSugestiiClienti } from './sugestii-clienti.js';
import { LIVRARE, AGENTI, PLATI, plataText, liniaTransport } from './lib/comun/comanda.js';
import { copyRows } from './lib/comun/clipboard.js';
import { qtyText } from './lib/comun/num.js';

// ═══════════════════════════════════════════════════════════════════════════
//  OFERTĂ CU AMĂNUNTUL (amanunt.html) — sertare, mânere, accesorii: produsele
//  de vânzare din exportul NeoManager (scripts/amanunt.mjs → js/catalog/amanunt.json).
//  Colegul scrie denumirea (sau codul), alege din sugestii şi pune cantitatea;
//  se salvează la manager ca orice ofertă (sistem 'amanunt', fără gol / uşi),
//  cu liniile de facturare gata de lipit în NeoManager.
// ═══════════════════════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const virgula = n => String(n).replace('.', ',');
const cauta = cautator(produse);
const peDenumire = new Map(produse.map(p => [p.denumire, p]));

// rândurile ofertei: { cod, denumire, um, cantitate, bara?, debitare? } — cod null
// cât timp textul nu e (încă) un produs din listă. Pe ecran mai e mereu un rând gol
// la coadă. Produsele vândute la bară (`bara` = lungimea în mm, din denumire) au şi
// DEBITARE: bucăţile clientului [{ l, buc }] → cantitatea = nr. de bare.
let linii = [];
// Lăţimea pânzei de tăiere, în mm — se pierde la fiecare tăietură. 0 = nu se ţine cont.
const TAIERE_MM = 0;
const deb = l => (l?.bara ? debitare(l.debitare, l.bara, TAIERE_MM) : null);
const cantitate = l => deb(l)?.nr ?? l.cantitate;
const textDebitare = l => {
  const d = deb(l);
  return d ? `${(l.debitare ?? []).filter(p => +p.l > 0 && +p.buc > 0).map(p => `${p.buc} × ${p.l} mm`).join(', ')} → ${d.nr} ${d.nr === 1 ? 'bară' : 'bare'} de ${l.bara} mm` : null;
};
// livrare / plată / agent — aceeaşi formă ca state.comanda din configurator
const comanda = { livrare: null, agent: null, plata: null };
let ofertaEditata = null;   // ?oferta=<id> — se salvează peste ea
let numarEditat = '';
let modFisa = null;         // ?fisa=<id> — doar tipar: { numar }

// ── Ce se facturează ────────────────────────────────────────────────────────

function facturare() {
  const lines = [], errors = [];
  linii.forEach((l, i) => {
    if (!l.cod && !String(l.denumire).trim()) return;
    const d = deb(l);
    if (!l.cod) errors.push(`Rândul ${i + 1}: alege produsul din listă („${l.denumire}" nu e în NeoManager).`);
    else if (d?.preaLungi.length) errors.push(`Rândul ${i + 1}: bucata de ${d.preaLungi.join(' / ')} mm e mai lungă decât bara de ${l.bara} mm.`);
    else if (!(cantitate(l) > 0)) errors.push(`Rândul ${i + 1}: completează cantitatea.`);
    else lines.push({ cod: l.cod, denumire: l.denumire, um: l.um, cantitate: cantitate(l) });
  });
  // transportul — ca la toate gamele, când marfa nu e ridicată personal
  // (la fişă liniile sunt cele îngheţate la salvare, cu transportul deja în ele)
  const transport = modFisa ? null : liniaTransport({ comanda });
  if (transport && lines.length) lines.push({ ...transport });
  if (!lines.length && !errors.length) errors.push('Adaugă cel puţin un produs.');
  return { lines, errors, transport: lines.length ? transport : null };
}

// ── Tabelul de produse ──────────────────────────────────────────────────────

const randHtml = (l, i) => {
  const gol = i === linii.length;
  const d = deb(l);
  return `<tr data-i="${i}"${l?.bara ? ' class="cu-debitare"' : ''}>
    <td class="nr">${i + 1}</td>
    <td><input class="produs" value="${esc(l?.denumire ?? '')}" autocomplete="off" spellcheck="false"
         placeholder="${gol ? (i ? 'Încă un produs…' : 'Scrie denumirea sau codul…') : ''}"
         role="combobox" aria-controls="sugestii" aria-expanded="false" aria-autocomplete="list"></td>
    <td class="cod">${celulaCod(l)}</td>
    <td class="num"><input class="cant" type="number" min="0" step="any" inputmode="decimal"
         value="${d ? d.nr : l?.cantitate ?? ''}"${gol ? ' disabled' : ''}${d ? ' readonly title="Calculat din debitare"' : ''} aria-label="Cantitate"></td>
    <td class="um">${esc(l?.um ?? '')}</td>
    <td class="x">${gol ? '' : `<button class="sterge" type="button" aria-label="Scoate rândul ${i + 1}">✕</button>`}</td>
  </tr>${l?.bara ? debitareHtml(l, i) : ''}`;
};

// Sub produsele la bară: bucăţile (lungime × nr. bucăţi) — mereu cu o pereche goală la coadă.
const debitareHtml = (l, i) => {
  const piese = l.debitare ?? [];
  return `<tr class="debitare" data-i="${i}"><td></td><td colspan="5"><div class="deb">
    <span class="deb-titlu">Debitare <span class="dim">· bară de ${l.bara} mm</span></span>
    ${[...piese, { l: '', buc: '' }].map((p, k) => `<span class="piesa" data-k="${k}">
      <input class="deb-l" type="number" min="0" step="1" inputmode="numeric" value="${p.l}" placeholder="mm" aria-label="Lungimea bucăţii ${k + 1} (mm)">
      <span class="dim">×</span>
      <input class="deb-b" type="number" min="0" step="1" inputmode="numeric" value="${p.buc}" placeholder="buc" aria-label="Nr. de bucăţi ${k + 1}">
      ${k < piese.length ? `<button class="deb-x" type="button" aria-label="Scoate bucata ${k + 1}">✕</button>` : ''}</span>`).join('')}
    <span class="deb-rez">${rezultatHtml(l)}</span></div></td></tr>`;
};
const rezultatHtml = l => {
  const d = deb(l);
  if (!d) return '<span class="dim">scrie lungimea şi nr. de bucăţi — se calculează din câte bare ies</span>';
  if (d.preaLungi.length) return `<span class="avert">⚠ ${d.preaLungi.join(' / ')} mm nu încape într-o bară de ${l.bara} mm</span>`;
  return `→ <strong>${d.nr} ${d.nr === 1 ? 'bară' : 'bare'}</strong> <span class="dim">· ${d.bucati} buc · rest: ${d.resturi.map(r => `${r} mm`).join(', ')}</span>`;
};
const celulaCod = l => (l?.cod ? esc(l.cod) : String(l?.denumire ?? '').trim() ? '<span class="avert">alege din listă</span>' : '');

function randeaza() {
  $('randuri').innerHTML = [...linii, null].map((l, i) => randHtml(l, i)).join('') + (() => {
    const t = facturare().transport;
    return t ? `<tr class="transport"><td class="nr"></td><td>${esc(t.denumire)} — automat, livrarea nu e ridicare personală</td>
      <td class="cod">${esc(t.cod)}</td><td class="num">1</td><td class="um">${esc(t.um)}</td><td></td></tr>` : '';
  })();
  actualizeaza();
}

// totalul, erorile şi butoanele — fără să refacă tabelul (focusul rămâne unde e)
function actualizeaza() {
  const { lines, errors, transport } = facturare();
  const nr = lines.length - (transport ? 1 : 0);
  $('total').textContent = nr ? `${nr} ${nr === 1 ? 'produs' : 'produse'}` : '';
  const alteRanduri = linii.some(l => l.cod || String(l.denumire).trim());
  $('erori').innerHTML = alteRanduri ? errors.map(e => `<div class="bill-err">⚠ ${esc(e)}</div>`).join('') : '';
  for (const id of ['btnCopyCod', 'btnCopyCant']) $(id).disabled = !!errors.length;
  renderOferta();
}

const rand = el => +el.closest('tr').dataset.i;
const focus = (i, cls) => {
  const el = $('randuri').querySelector(`tr[data-i="${i}"] .${cls}`);
  if (!el) return;
  el.focus();
  if (cls === 'cant') el.select(); else el.setSelectionRange(el.value.length, el.value.length);
};

function alege(i, p) {
  linii[i] = { cod: p.cod, denumire: p.denumire, um: p.um, cantitate: linii[i]?.cantitate || 1,
               ...(p.bara && { bara: p.bara, debitare: linii[i]?.debitare ?? [] }) };
  ascundeSugestii();
  randeaza();
  focus(i, 'cant');
}

$('randuri').addEventListener('input', e => {
  const i = rand(e.target);
  if (e.target.classList.contains('produs')) {
    const text = e.target.value;
    const nou = i === linii.length;
    // textul identic cu un produs = ales; altfel rândul n-are încă produs
    const p = peDenumire.get(text);
    const { bara, debitare: piese, ...rest } = linii[i] ?? { cantitate: null };
    linii[i] = { ...rest, denumire: text, cod: p?.cod ?? null, um: p?.um ?? '', ...(p?.bara && { bara: p.bara, debitare: piese ?? [] }) };
    if (!!bara !== !!p?.bara) { randeaza(); focus(i, 'produs'); arataSugestii(i); return; }   // apare / dispare debitarea
    if (nou) { randeaza(); focus(i, 'produs'); }   // apare rândul gol următor
    else {
      const tr = e.target.closest('tr');
      tr.querySelector('.cod').innerHTML = celulaCod(linii[i]);
      tr.querySelector('.um').textContent = linii[i].um;
      actualizeaza();
    }
    arataSugestii(i);
  } else if (e.target.classList.contains('cant')) {
    linii[i].cantitate = parseFloat(String(e.target.value).replace(',', '.')) || 0;
    actualizeaza();
  } else if (e.target.matches('.deb-l, .deb-b')) {
    const k = +e.target.closest('.piesa').dataset.k, piese = linii[i].debitare;
    const camp = e.target.classList.contains('deb-l') ? 'l' : 'buc';
    if (k === piese.length) {   // perechea goală de la coadă devine bucată → apare alta goală
      piese.push({ l: '', buc: '', [camp]: e.target.value });
      randeaza();
      return focusPe(`tr.debitare[data-i="${i}"] .piesa[data-k="${k}"] .deb-${camp === 'l' ? 'l' : 'b'}`);
    }
    piese[k][camp] = e.target.value;
    // fără să refacă tabelul: doar cantitatea (nr. de bare) şi rezultatul
    const d = deb(linii[i]);
    $('randuri').querySelector(`tr[data-i="${i}"] .cant`).value = d ? d.nr : linii[i].cantitate ?? '';
    $('randuri').querySelector(`tr[data-i="${i}"] .cant`).readOnly = !!d;
    e.target.closest('.deb').querySelector('.deb-rez').innerHTML = rezultatHtml(linii[i]);
    actualizeaza();
  }
});
const focusPe = sel => {
  const el = $('randuri').querySelector(sel);
  if (!el) return;
  el.focus();
  if (el.type === 'number') el.select(); else el.setSelectionRange(el.value.length, el.value.length);
};
$('randuri').addEventListener('click', e => {
  const b = e.target.closest('button.sterge');
  if (b) { linii.splice(rand(b), 1); randeaza(); focus(linii.length, 'produs'); }
  const x = e.target.closest('button.deb-x');
  if (x) {
    const i = rand(x);
    linii[i].debitare.splice(+x.closest('.piesa').dataset.k, 1);
    randeaza();
    focusPe(`tr.debitare[data-i="${i}"] .piesa[data-k="${linii[i].debitare.length}"] .deb-l`);
  }
});
$('randuri').addEventListener('focusin', e => { if (e.target.classList.contains('produs')) arataSugestii(rand(e.target)); });
// la ieşirea din câmp — dar nu când rândul s-a refăcut şi focusul e tot într-un câmp de produs
$('randuri').addEventListener('focusout', e => {
  if (e.target.classList.contains('produs'))
    setTimeout(() => { if (!document.activeElement?.classList.contains('produs')) ascundeSugestii(); }, 120);
});
$('randuri').addEventListener('keydown', e => {
  if (e.target.classList.contains('produs')) tasteSugestii(e, rand(e.target));
  else if (e.key !== 'Enter') return;
  // Enter: cantitate → produsul următor (sau debitarea, la bare); lungime → bucăţi; bucăţi → lungimea următoare
  else if (e.target.classList.contains('cant')) {
    e.preventDefault();
    const i = rand(e.target);
    if (linii[i]?.bara) focusPe(`tr.debitare[data-i="${i}"] .piesa[data-k="${linii[i].debitare.length}"] .deb-l`); else focus(i + 1, 'produs');
  } else if (e.target.classList.contains('deb-l')) {
    // lungime goală + Enter = gata cu debitarea → produsul următor
    e.preventDefault();
    if (e.target.value) e.target.closest('.piesa').querySelector('.deb-b').focus(); else focus(rand(e.target) + 1, 'produs');
  }
  else if (e.target.classList.contains('deb-b')) {
    e.preventDefault();
    const i = rand(e.target), urm = e.target.closest('.piesa').nextElementSibling;
    // pe perechea goală de la coadă: gata cu debitarea → produsul următor
    if (urm?.classList.contains('piesa')) urm.querySelector('.deb-l').focus(); else focus(i + 1, 'produs');
  }
});

// ── Sugestiile (lista de sub câmp) ──────────────────────────────────────────

const lista = $('sugestii');
let sug = { i: -1, gasite: [], activ: 0 };

function arataSugestii(i) {
  const input = $('randuri').querySelector(`tr[data-i="${i}"] .produs`);
  const q = input?.value ?? '';
  if (!input || !q.trim() || linii[i]?.cod) return ascundeSugestii();
  sug = { i, gasite: cauta(q), activ: 0 };
  lista.innerHTML = sug.gasite.length ? sug.gasite.map((p, k) =>
    `<li role="option" id="sug-${k}" data-k="${k}" aria-selected="${k === 0}">${esc(p.denumire)}
       <span class="sub">${esc(p.cod)} · ${esc(p.um)} · ${esc(p.grupa)}</span></li>`).join('')
    : `<li class="nimic">Niciun produs nu se potriveşte cu „${esc(q.trim())}"</li>`;
  lista.hidden = false;
  lista.scrollTop = 0;
  pozitioneaza();
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-activedescendant', sug.gasite.length ? 'sug-0' : '');
}
// lista stă sub câmp; încape în fereastră (mai scurtă, sau deasupra câmpului dacă jos nu e loc)
function pozitioneaza() {
  const input = $('randuri').querySelector(`tr[data-i="${sug.i}"] .produs`);
  if (lista.hidden || !input) return;
  const r = input.getBoundingClientRect();
  const jos = innerHeight - r.bottom - 12, sus = r.top - 12;
  const peSus = jos < 200 && sus > jos;
  Object.assign(lista.style, {
    left: `${r.left}px`, width: `${Math.max(r.width, Math.min(420, innerWidth - r.left - 12))}px`,
    maxHeight: `${Math.min(340, peSus ? sus : jos)}px`,
    top: peSus ? '' : `${r.bottom + 4}px`, bottom: peSus ? `${innerHeight - r.top + 4}px` : '',
  });
}
function marcheaza(k) {
  sug.activ = k;
  lista.querySelectorAll('li[data-k]').forEach(li => li.setAttribute('aria-selected', String(+li.dataset.k === k)));
  $('randuri').querySelector(`tr[data-i="${sug.i}"] .produs`)?.setAttribute('aria-activedescendant', `sug-${k}`);
}
function ascundeSugestii() {
  lista.hidden = true;
  $('randuri').querySelectorAll('.produs[aria-expanded="true"]').forEach(x => x.setAttribute('aria-expanded', 'false'));
}
function tasteSugestii(e, i) {
  if (lista.hidden || sug.i !== i || !sug.gasite.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    marcheaza((sug.activ + (e.key === 'ArrowDown' ? 1 : -1) + sug.gasite.length) % sug.gasite.length);
    lista.querySelector(`#sug-${sug.activ}`)?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    if (e.key === 'Enter' || e.target.value.trim()) { e.preventDefault(); alege(i, sug.gasite[sug.activ]); }
  } else if (e.key === 'Escape') ascundeSugestii();
}
// Orice apăsare în listă (şi pe bara ei de scroll) lasă focusul în câmp — altfel
// câmpul îl pierde şi lista se închide. Produsul se alege la ridicarea degetului,
// ca o tragere de scroll să nu aleagă din greşeală.
lista.addEventListener('mousedown', e => e.preventDefault());
lista.addEventListener('click', e => {
  const li = e.target.closest('li[data-k]');
  if (li) alege(sug.i, sug.gasite[+li.dataset.k]);
});
// mouse-ul peste un rând îl face cel ales (un singur rând evidenţiat, nu două)
lista.addEventListener('mousemove', e => {
  const li = e.target.closest('li[data-k]');
  if (li && +li.dataset.k !== sug.activ) marcheaza(+li.dataset.k);
});
// scroll-ul paginii mută lista odată cu câmpul; scroll-ul DIN listă nu o atinge
window.addEventListener('scroll', e => { if (e.target !== lista) pozitioneaza(); }, true);
window.addEventListener('resize', pozitioneaza);

// ── Copiere pentru NeoManager (pe coloană, ca în configurator) ──────────────

const flash = (btn, txt) => { const o = btn.textContent; btn.textContent = txt; setTimeout(() => { btn.textContent = o; }, 1400); };
$('btnCopyCod').addEventListener('click', e =>
  copyRows(facturare().lines.map(l => [l.cod])).then(ok => flash(e.target, ok ? '✓ copiat' : '⚠ eroare')));
$('btnCopyCant').addEventListener('click', e =>
  copyRows(facturare().lines.map(l => [qtyText(l.cantitate)])).then(ok => flash(e.target, ok ? '✓ copiat' : '⚠ eroare')));

// ── Client: livrare / plată / agent ─────────────────────────────────────────

for (const [id, valori, alege] of [['comandaLivrare', LIVRARE, 'Mod de livrare'],
                                   ['comandaPlata', PLATI, 'Metodă de plată'], ['comandaAgent', AGENTI, 'Agent']]) {
  const sel = $(id);
  sel.innerHTML = `<option value="" selected disabled>${alege}</option>` + valori.map(v => {
    const [cod, text] = Array.isArray(v) ? v : [v, v];
    return `<option value="${esc(cod)}">${esc(text)}</option>`;
  }).join('');
  // livrarea schimbă linia de transport → tabelul se reface
  sel.addEventListener('change', () => { comanda[sel.dataset.c] = sel.value; randeaza(); });
}
$('plataMod').innerHTML = `<option value="" selected disabled>Alege…</option>` +
  PLATI.map(([cod, text]) => `<option value="${cod}">${esc(text)}</option>`).join('');
initSugestiiClienti(agent => { $('comandaAgent').value = agent; comanda.agent = agent; });

// ── Salvare la manager (aceiaşi paşi ca în configurator) ────────────────────

function pozitie() {
  const f = facturare();
  if (f.errors.length) return { eroare: f.errors[0] };
  return { pozitie: {
    sistem: 'amanunt', eticheta: 'Ofertă cu amănuntul', finisaj: '',
    latime: 0, inaltime: 0, nrUsi: 1,
    config: { system: 'amanunt', amanunt: linii.filter(l => l.cod), comanda: { ...comanda } },
    // necesarul = produsele cu debitare (lungimile de tăiat), pt. depozit şi fişă
    linii: { facturare: f.lines, client: [], sticla: [], necesar: linii.filter(l => l.cod && deb(l)).map(l =>
      ({ cod: l.cod, denumire: l.denumire, um: l.um, cantitate: cantitate(l), debitare: textDebitare(l) })) },
  } };
}

const mesaj = (html, fel) => { $('ofertaMesaj').innerHTML = `<div class="oferta-msg ${fel}">${html}</div>`; };
const BUTOANE = ['btnConfirma', 'btnComanda', 'btnPlata'];
const TEXT = { btnConfirma: () => (ofertaEditata ? 'Salvează modificările' : 'Salvează oferta'),
               btnComanda: () => 'Salvează comanda', btnPlata: () => 'Aşteaptă plata' };

function renderOferta() {
  const { stare, utilizator } = manager.stareOferta();
  const servit = stare === 'logat' || stare === 'nelogat';
  $('linkAcasa').style.display = servit ? '' : 'none';
  $('cine').textContent = utilizator?.nume ?? '';
  const arata = da => { for (const id of BUTOANE) $(id).style.display = da ? '' : 'none'; $('ofertaNr').style.display = da ? '' : 'none'; };
  if (!servit || modFisa) { $('ofertaUI').innerHTML = ''; return arata(false); }
  if (stare === 'nelogat') {
    arata(false);
    $('ofertaUI').innerHTML = `<div class="oferta-hint">Autentifică-te ca să poţi salva oferte.
      <a href="/login?redirect=${encodeURIComponent(location.pathname + location.search)}">Intră în cont</a></div>`;
    return;
  }
  arata(true);
  const gata = !facturare().errors.length;
  for (const id of BUTOANE) $(id).disabled = !gata;
}

function cerePlata() {
  const dlg = $('dialogPlata');
  $('formPlata').reset();
  $('plataMod').value = comanda.plata ?? '';
  return new Promise(gata => {
    $('plataRenunta').onclick = () => dlg.close();
    $('formPlata').onsubmit = e => { e.preventDefault(); dlg.close('ok'); };
    dlg.onclose = () => gata(dlg.returnValue === 'ok' ? { plata: $('plataMod').value, avans: $('plataAvans').value } : null);
    dlg.returnValue = '';
    dlg.showModal();
  });
}

async function trimite(unde) {
  const ofertaNr = $('ofertaNr').value.trim();
  if (unde === 'oferta' && !ofertaNr) { $('ofertaNr').focus(); return mesaj('Completează nr. de ofertă.', 'eroare'); }
  if (!$('clientNume').value.trim()) { $('clientNume').focus(); return mesaj('Completează numele clientului.', 'eroare'); }
  const p = pozitie();
  if (p.eroare) return mesaj(esc(p.eroare), 'eroare');
  const plata = unde === 'comanda' ? await cerePlata() : null;
  if (unde === 'comanda' && !plata) return;

  for (const id of BUTOANE) $(id).disabled = true;
  $(unde === 'oferta' ? 'btnConfirma' : unde === 'comanda' ? 'btnComanda' : 'btnPlata').textContent = 'Se salvează…';
  const gata = () => { for (const id of BUTOANE) { $(id).disabled = false; $(id).textContent = TEXT[id](); } };

  const r = await manager.salveaza({
    ofertaNr, id: ofertaEditata, pozitie: p.pozitie,
    nume: $('clientNume').value, telefon: $('clientTelefon').value, adresa: $('clientAdresa').value,
    detalii: { ...comanda }, email: '', observatii: '',
  });
  if (r.eroare) { gata(); return mesaj(esc(r.eroare), 'eroare'); }
  ofertaEditata = r.comanda.id;   // o nouă apăsare lucrează pe ACEEAŞI ofertă
  const laComanda = () => { location.href = '/#comanda/' + r.comanda.id; };
  if (unde === 'oferta') return laComanda();
  const t = await manager.treceIn(r.comanda.id, unde, plata ?? {});
  if (t.eroare) {
    gata();
    return mesaj(`Oferta <strong>${esc(r.comanda.numar)}</strong> s-a salvat, dar ${unde === 'comanda'
      ? 'nu a devenit comandă' : 'nu a trecut la „Aşteaptă plata"'}: ${esc(t.eroare)}`, 'eroare');
  }
  laComanda();
}
$('btnConfirma').addEventListener('click', () => trimite('oferta'));
$('btnComanda').addEventListener('click', () => trimite('comanda'));
$('btnPlata').addEventListener('click', () => trimite('plata'));

// ── Tipar: lista de produse pe o foaie (şi „Fişă" din manager) ──────────────

function tipareste() {
  const { lines } = facturare();
  // debitarea fiecărei linii: la fişă din necesarul îngheţat, altfel din rândurile de pe ecran
  const peCod = modFisa?.debitare ?? new Map(linii.filter(deb).map(l => [l.cod, textDebitare(l)]));
  const rand = (et, v) => (v ? `<tr><td>${et}</td><td>${esc(v)}</td></tr>` : '');
  $('tipar').innerHTML = `
    <div class="cap"><div><h1>Ofertă cu amănuntul</h1>${modFisa?.numar ? `<strong>${esc(modFisa.numar)}</strong>` : ''}</div>
      <div>${new Date().toLocaleDateString('ro-RO')}</div></div>
    <table class="perechi">
      ${rand('Client', $('clientNume').value)}${rand('Telefon', $('clientTelefon').value)}${rand('Adresă', $('clientAdresa').value)}
      ${rand('Mod de livrare', comanda.livrare)}${rand('Metodă de plată', plataText(comanda.plata))}${rand('Agent', comanda.agent)}
    </table>
    <table>
      <thead><tr><th>#</th><th>Cod</th><th>Produs</th><th>Cant.</th><th>✓</th></tr></thead>
      <tbody>${lines.map((l, k) => `<tr><td>${k + 1}</td><td>${esc(l.cod)}</td><td>${esc(l.denumire)}${peCod.get(l.cod)
        ? `<div class="deb-tipar">Debitare: ${esc(peCod.get(l.cod))}</div>` : ''}</td>
        <td class="num">${virgula(l.cantitate)} ${esc(l.um)}</td><td class="bifa"></td></tr>`).join('')}</tbody>
    </table>`;
  window.print();
}
$('btnFisa').addEventListener('click', tipareste);

// ── Pornire: ofertă nouă, „Modifică oferta" (?oferta=) sau „Fişă" (?fisa=) ──

(async () => {
  const params = new URLSearchParams(location.search);
  const id = params.get('oferta') ?? params.get('fisa');
  let eroare = null;
  if (id) {
    const o = await manager.incarcaOferta(id);
    const p = o.pozitii?.[0];
    if (o.eroare || p?.sistem !== 'amanunt') eroare = o.eroare || 'Nu e o ofertă cu amănuntul.';
    else if (params.get('oferta') && o.comanda.tip !== 'oferta') eroare = `${o.comanda.numar_comanda || o.comanda.numar} a fost acceptată — nu se mai modifică.`;
    else {
      // fişa: liniile ÎNGHEŢATE la salvare; modificarea: rândurile ofertei (transportul se pune singur)
      linii = params.get('fisa')
        ? p.linii.facturare.map(l => ({ cod: l.cod, denumire: l.denumire, um: l.um, cantitate: l.cantitate }))
        : (p.config.amanunt ?? []).map(l => ({ ...l }));
      Object.assign(comanda, p.config.comanda);
      for (const [k, sel] of [['livrare', 'comandaLivrare'], ['plata', 'comandaPlata'], ['agent', 'comandaAgent']]) if (comanda[k]) $(sel).value = comanda[k];
      $('clientNume').value = o.comanda.client_nume ?? '';
      $('clientTelefon').value = o.comanda.client_telefon ?? '';
      $('clientAdresa').value = o.comanda.client_adresa ?? '';
      $('ofertaNr').value = o.comanda.oferta_nr ?? '';
      if (params.get('oferta')) { ofertaEditata = o.comanda.id; numarEditat = o.comanda.numar; }
      else modFisa = { numar: o.comanda.numar_comanda || o.comanda.numar,
                       debitare: new Map((p.linii.necesar ?? []).filter(n => n.debitare).map(n => [n.cod, n.debitare])) };
    }
  }
  randeaza();
  await manager.initOferta(renderOferta);
  if (ofertaEditata) { $('btnConfirma').textContent = TEXT.btnConfirma(); mesaj(`Modifici oferta <strong>${esc(numarEditat)}</strong>.`, 'ok'); }
  if (eroare) mesaj(esc(eroare), 'eroare');
  if (params.get('fisa')) {
    if (modFisa) tipareste();
    // managerul încarcă pagina într-un cadru ascuns şi aşteaptă răspunsul
    if (window.parent !== window) window.parent.postMessage({ tip: 'fisa', eroare: modFisa ? null : eroare }, location.origin);
  } else focus(linii.length, 'produs');
})();
