import produse from './catalog/amanunt.json';
import * as manager from './manager.js';
import * as cosul from './cos.js';
import { cautator, laBara, arie, rotunjeste, textMod, sePoatePeJumatate } from './amanunt-calcul.js';
import { initSugestiiClienti } from './sugestii-clienti.js';
import { LIVRARE, AGENTI, PLATI, INCASARI, plataText, incasareText, numarText, detaliiDinManager, dinAcceptare, liniaTransport, campuriLipsa, focusCamp, etichetaNumar, marcheazaDeCompletat, opritDePlata } from './lib/comun/comanda.js';
import { copyRows } from './lib/comun/clipboard.js';
import { qtyText } from './lib/comun/num.js';
import { dataRo } from './ora.js';
import { activeazaCampuri } from './campuri.js';
import * as ciorna from './ciorna.js';
import { arataPrevizualizare } from './previzualizare.js';
import { confirma } from './intrebari.js';

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
// Modul de facturare al produsului (`fact`, din „Toata baza de date" — userul, 2026-10-22): bucăţi
// întregi, întreg sau jumătate, lungime + 15 %, trepte după lungime, multiplu, arie — amanunt-calcul.js.
const PE_COD = new Map(produse.map(p => [p.cod, p]));
const mod = l => PE_COD.get(l?.cod)?.fact;
// rândul are bucăţi de completat sub el: la bară (lungime × buc) sau geamul la mp (H × L × buc)
const cuBucati = l => !!(l?.bara || mod(l)?.arie);
// Produsele vândute şi pe jumătate de bară — pe rând, „Dă bara întreagă" (l.intreaga): clientul ia
// şi restul barei → bare întregi (userul, 2026-10-14).
const PE_JUMATATE = new Set(produse.filter(sePoatePeJumatate).map(p => p.cod));
const deb = l => (l?.bara ? laBara(mod(l), l.debitare, l.bara, TAIERE_MM, l.intreaga) : mod(l)?.arie ? arie(l.debitare) : null);
// la fişă: cantităţile îngheţate la salvare, aşa cum au fost
const cantitate = l => (modFisa ? l.cantitate : deb(l)?.nr ?? rotunjeste(mod(l), l.cantitate));
const textDebitare = l => {
  const d = deb(l);
  if (!d) return null;
  const peArie = mod(l)?.arie;
  const piese = (l.debitare ?? []).filter(p => +p.l > 0 && +p.buc > 0 && (!peArie || +p.h > 0));
  if (peArie) return `${piese.map(p => `${p.buc} × ${p.h} × ${p.l} mm`).join(', ')} → ${virgula(d.nr)} mp`;
  return `${piese.map(p => `${p.buc} × ${p.l} mm`).join(', ')} → ${virgula(d.nr)} ${d.nr === 1 ? 'bară' : 'bare'} de ${l.bara} mm${l.intreaga ? ' (ia şi restul barei)' : ''}`;
};
// UM-ul şi, dedesubt, cum se facturează produsul (nimic la bucăţile întregi)
const umHtml = l => {
  const t = l?.cod ? textMod(mod(l), cantitate(l)) : '';
  return `${esc(l?.um ?? '')}${t ? `<div class="regula">${esc(t)}</div>` : ''}`;
};
// livrare / plată / agent — aceeaşi formă ca state.comanda din configurator
const comanda = { livrare: null, agent: null, plata: null, incasare: null };
// coşul ofertei (js/cos.js): produsele deja adăugate + oferta deschisă din manager, dacă e
const cos = cosul.citeste();
let modFisa = null;         // ?fisa=<id>&poz=<k> — doar tipar: { numar, debitare }

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
  return `<tr data-i="${i}"${cuBucati(l) ? ' class="cu-debitare"' : ''}>
    <td class="nr">${i + 1}</td>
    <td><input class="produs" value="${esc(l?.denumire ?? '')}" autocomplete="off" spellcheck="false"
         placeholder="${gol ? (i ? 'Încă un produs…' : 'Scrie denumirea sau codul…') : ''}"
         role="combobox" aria-controls="sugestii" aria-expanded="false" aria-autocomplete="list"></td>
    <td class="cod">${celulaCod(l)}</td>
    <td class="num"><input class="cant" type="number" min="0" step="any" inputmode="decimal"
         value="${d ? d.nr : l?.cantitate || ''}"${gol ? ' disabled' : ''}${d ? ' readonly title="Calculat din debitare"' : ''} aria-label="Cantitate"></td>
    <td class="um">${umHtml(l)}</td>
    <td class="x">${gol ? '' : `<button class="sterge" type="button" aria-label="Scoate rândul ${i + 1}">✕</button>`}</td>
  </tr>${cuBucati(l) ? debitareHtml(l, i) : ''}`;
};

// Sub produsele la bară: bucăţile (lungime × nr. bucăţi) — mereu cu o pereche goală la coadă.
// La geamul vândut la mp: înălţime × lăţime × nr. bucăţi.
const debitareHtml = (l, i) => {
  const piese = l.debitare ?? [], peArie = !!mod(l)?.arie;
  return `<tr class="debitare" data-i="${i}"><td></td><td colspan="5"><div class="deb">
    <span class="deb-titlu">${peArie ? 'Arie <span class="dim">· înălţime × lăţime × bucăţi</span>' : `Debitare <span class="dim">· bară de ${l.bara} mm</span>`}</span>
    ${PE_JUMATATE.has(l.cod) ? `<button class="deb-intreaga${l.intreaga ? ' activ' : ''}" type="button" aria-pressed="${!!l.intreaga}"
      title="Clientul ia şi restul barei — se facturează bare întregi, nu jumătăţi">${l.intreaga ? '✓ Bara întreagă' : 'Dă bara întreagă'}</button>` : ''}
    ${[...piese, { l: '', buc: '' }].map((p, k) => piesaHtml(p, k, k < piese.length, peArie)).join('')}
    <span class="deb-rez">${rezultatHtml(l)}</span></div></td></tr>`;
};
const butonX = k => `<button class="deb-x" type="button" aria-label="Scoate bucata ${k + 1}">✕</button>`;
const piesaHtml = (p, k, cuX, cuH = false) => `<span class="piesa" data-k="${k}">
      ${cuH ? `<input class="deb-h" type="number" min="0" step="1" inputmode="numeric" value="${p.h || ''}" placeholder="H mm" aria-label="Înălţimea bucăţii ${k + 1} (mm)">
      <span class="dim">×</span>` : ''}
      <input class="deb-l" type="number" min="0" step="1" inputmode="numeric" value="${p.l || ''}" placeholder="${cuH ? 'L mm' : 'mm'}" aria-label="${cuH ? 'Lăţimea' : 'Lungimea'} bucăţii ${k + 1} (mm)">
      <span class="dim">×</span>
      <input class="deb-b" type="number" min="0" step="1" inputmode="numeric" value="${p.buc || ''}" placeholder="buc" aria-label="Nr. de bucăţi ${k + 1}">
      ${cuX ? butonX(k) : ''}</span>`;
const rezultatHtml = l => {
  const d = deb(l), f = mod(l);
  if (!d) return `<span class="dim">${f?.arie ? 'scrie înălţimea, lăţimea şi nr. de bucăţi — se calculează aria'
    : 'scrie lungimea şi nr. de bucăţi — se calculează din câte bare ies'}</span>`;
  if (d.preaLungi.length) return `<span class="avert">⚠ ${d.preaLungi.join(' / ')} mm nu încape într-o bară de ${l.bara} mm</span>`;
  if (f?.arie) return `→ <strong>${virgula(d.nr)} mp</strong> <span class="dim">· ${d.bucati} buc</span>`;
  if (f?.procent) return `→ <strong>${virgula(d.nr)} ${d.nr === 1 ? 'bară' : 'bare'}</strong> <span class="dim">· ${d.bucati} buc · ${d.total} mm + ${Math.round((f.procent - 1) * 100)} %, în sus la jumătate</span>`;
  if (f?.trepte) return `→ <strong>${virgula(d.nr)} ${d.nr === 1 ? 'bară' : 'bare'}</strong> <span class="dim">· ${d.bucati} buc, fiecare după lungimea ei</span>`;
  return `→ <strong>${virgula(d.nr)} ${d.nr === 1 ? 'bară' : 'bare'}</strong> <span class="dim">· ${d.bucati} buc · rest: ${d.resturi.map(r => `${r} mm`).join(', ')}</span>`;
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
  for (const id of ['btnCopyCod', 'btnCopyCant']) {
    $(id).disabled = alteRanduri ? !!errors.length : !altele();   // pagina goală, dar coşul are produse → se copiază ele
    $(id).textContent = `Copiază ${id === 'btnCopyCod' ? 'coduri' : 'cantităţi'}${altele() ? ' (toată oferta)' : ''}`;
  }
  card?.actualizeaza();
  renderOferta();
  pasi();
}

// paşii, ca în configurator: ✓ pe cei gata, albastru pe primul neterminat; starea pe cardul de jos
function pasi() {
  const { errors } = facturare();
  const lipsa = $('ofertaNr').style.display !== 'none' ? campuriLipsa() : [];
  marcheazaDeCompletat(campuriLipsa().map(x => $(x.id)));   // câmpurile obligatorii goale, colorate
  const gata = { produse: !errors.length,
                 client: !lipsa.some(x => ['clientNume', 'comandaLivrare', 'comandaAgent'].includes(x.id)) };
  let curent = null;
  document.querySelectorAll('.pas[data-pas]').forEach(s => {
    const id = s.dataset.pas;
    if (!(id in gata)) return;
    s.classList.toggle('gata', gata[id]);
    s.querySelector('.pas-nr').textContent = gata[id] ? '✓' : id === 'produse' ? '1' : '2';
    s.classList.remove('curent');
    if (!curent && !gata[id]) { curent = s; s.classList.add('curent'); }
  });
  const st = $('nouStare');
  st.className = 'nou-stare ' + (gata.produse && !lipsa.length ? 'ok' : '');
  st.textContent = !gata.produse ? (errors[0] === 'Adaugă cel puţin un produs.' ? 'Adaugă cel puţin un produs' : `${errors.length} ${errors.length === 1 ? 'eroare' : 'erori'}`)
    : lipsa.length ? `Mai completează: ${lipsa.map(x => x.text).join(', ')}` : 'Gata de salvat';
}
// starea se schimbă la datele clientului şi la nr. ofertei
for (const id of ['clientNume', 'clientTelefon', 'clientAdresa', 'comandaLivrare', 'comandaPlata', 'comandaIncasare', 'comandaAgent', 'ofertaNr'])
  for (const ev of ['input', 'change']) $(id).addEventListener(ev, pasi);
// Goleşte pagina — ca în configurator: produsul de pe ecran de la zero (coşul rămâne)
// cu produse deja puse, întâi o întrebare — butonul e lângă „Salvează" şi şterge tot ce nu e salvat
$('btnClear').addEventListener('click', async () => {
  if (linii.some(l => l?.cod) && !(await confirma('Goleşti pagina? Produsele puse aici şi nesalvate se pierd.', 'Goleşte'))) return;
  cosul.golesteEcranul(cos);
});

const rand = el => +el.closest('tr').dataset.i;
const focus = (i, cls) => {
  const el = $('randuri').querySelector(`tr[data-i="${i}"] .${cls}`);
  if (!el) return;
  el.focus();
  if (cls === 'cant') el.select(); else el.setSelectionRange(el.value.length, el.value.length);
};

function alege(i, p) {
  linii[i] = { cod: p.cod, denumire: p.denumire, um: p.um, cantitate: rotunjeste(p.fact, linii[i]?.cantitate || 1),
               ...(cuBucati(p) && { ...(p.bara && { bara: p.bara }), debitare: linii[i]?.debitare ?? [] }) };
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
    const inainte = cuBucati(linii[i]);
    const { bara, debitare: piese, ...rest } = linii[i] ?? { cantitate: null };
    linii[i] = { ...rest, denumire: text, cod: p?.cod ?? null, um: p?.um ?? '',
                 ...(cuBucati(p) && { ...(p.bara && { bara: p.bara }), debitare: piese ?? [] }) };
    if (inainte !== cuBucati(linii[i])) { randeaza(); focus(i, 'produs'); arataSugestii(i); return; }   // apare / dispare debitarea
    if (nou) { randeaza(); focus(i, 'produs'); }   // apare rândul gol următor
    else {
      const tr = e.target.closest('tr');
      tr.querySelector('.cod').innerHTML = celulaCod(linii[i]);
      tr.querySelector('.um').innerHTML = umHtml(linii[i]);
      actualizeaza();
    }
    arataSugestii(i);
  } else if (e.target.classList.contains('cant')) {
    if (faraMinus(e.target)) return;
    linii[i].cantitate = parseFloat(String(e.target.value).replace(',', '.')) || 0;
    e.target.closest('tr').querySelector('.um').innerHTML = umHtml(linii[i]);
    actualizeaza();
  } else if (e.target.matches('.deb-h, .deb-l, .deb-b')) {
    if (faraMinus(e.target)) return;
    const k = +e.target.closest('.piesa').dataset.k, piese = linii[i].debitare;
    const camp = e.target.classList.contains('deb-h') ? 'h' : e.target.classList.contains('deb-l') ? 'l' : 'buc';
    // perechea goală de la coadă devine bucată → după ea apare alta goală. Fără să
    // refacă tabelul: refăcut, câmpul s-ar fi refocusat cu cifra selectată şi a doua
    // tastă ar fi înlocuit-o („345" → „45").
    if (k === piese.length) {
      piese.push({ l: '', buc: '' });
      const piesa = e.target.closest('.piesa');
      piesa.insertAdjacentHTML('beforeend', butonX(k));
      piesa.insertAdjacentHTML('afterend', piesaHtml({ l: '', buc: '' }, k + 1, false, !!mod(linii[i])?.arie));
    }
    piese[k][camp] = e.target.value;
    // fără să refacă tabelul: doar cantitatea (nr. de bare) şi rezultatul
    const d = deb(linii[i]);
    $('randuri').querySelector(`tr[data-i="${i}"] .cant`).value = d ? d.nr : linii[i].cantitate ?? '';
    $('randuri').querySelector(`tr[data-i="${i}"] .cant`).readOnly = !!d;
    $('randuri').querySelector(`tr[data-i="${i}"] .um`).innerHTML = umHtml(linii[i]);
    e.target.closest('.deb').querySelector('.deb-rez').innerHTML = rezultatHtml(linii[i]);
    actualizeaza();
  }
});
// La ieşirea din câmp, cantitatea scrisă devine cea facturată (userul, 2026-10-22: „dacă e setat 1
// să nu putem pune la cantitate 1,5") — ca să nu se vadă una şi să se factureze alta.
$('randuri').addEventListener('change', e => {
  if (!e.target.classList.contains('cant')) return;
  const l = linii[rand(e.target)];
  if (!l?.cod || deb(l)) return;
  const q = cantitate(l);
  if (q !== l.cantitate) { l.cantitate = q; e.target.value = q || ''; actualizeaza(); }
});
// Cantităţi / lungimi negative nu există (testarea ca începător, 2026-10-13: „-3" trecea,
// cu doar „1 eroare" fără loc) — câmpul se goleşte şi spunem de ce.
function faraMinus(camp) {
  if (!(parseFloat(String(camp.value).replace(',', '.')) < 0)) return false;
  camp.value = '';
  camp.dispatchEvent(new Event('input', { bubbles: true }));
  mesaj('Cantităţile şi lungimile nu pot fi negative — scrie un număr pozitiv.', 'eroare');
  return true;
}
const focusPe = sel => {
  const el = $('randuri').querySelector(sel);
  if (!el) return;
  el.focus();
  if (el.type === 'number') el.select(); else el.setSelectionRange(el.value.length, el.value.length);
};
$('randuri').addEventListener('click', e => {
  const b = e.target.closest('button.sterge');
  if (b) { linii.splice(rand(b), 1); randeaza(); focus(linii.length, 'produs'); }
  const bi = e.target.closest('button.deb-intreaga');
  if (bi) { const i = rand(bi); linii[i].intreaga = !linii[i].intreaga; randeaza(); }
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
    if (cuBucati(linii[i])) focusPe(`tr.debitare[data-i="${i}"] .piesa[data-k="${linii[i].debitare.length}"] input`); else focus(i + 1, 'produs');
  } else if (e.target.classList.contains('deb-h')) {
    // înălţime goală + Enter = gata cu bucăţile → produsul următor
    e.preventDefault();
    if (e.target.value) e.target.closest('.piesa').querySelector('.deb-l').focus(); else focus(rand(e.target) + 1, 'produs');
  } else if (e.target.classList.contains('deb-l')) {
    // lungime goală + Enter = gata cu debitarea → produsul următor
    e.preventDefault();
    if (e.target.value) e.target.closest('.piesa').querySelector('.deb-b').focus(); else focus(rand(e.target) + 1, 'produs');
  }
  else if (e.target.classList.contains('deb-b')) {
    e.preventDefault();
    const i = rand(e.target), urm = e.target.closest('.piesa').nextElementSibling;
    // pe perechea goală de la coadă: gata cu debitarea → produsul următor
    if (urm?.classList.contains('piesa')) urm.querySelector('input').focus(); else focus(i + 1, 'produs');
  }
});
// Enter pe rândul de produs gol (fără sugestii) = gata cu produsele → numele clientului
$('randuri').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.defaultPrevented || !e.target.classList.contains('produs') || e.target.value.trim()) return;
  e.preventDefault();
  $('clientNume').focus();
});
// în rest (client, livrare, plată, agent, nr. ofertă), Enter = câmpul următor — ca în configurator
activeazaCampuri(document.querySelector('main'), { cuCautabile: false });

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
// ofertă cu mai multe produse (ex. Confort + amănunt): se copiază facturarea pe TOATĂ oferta,
// comasată — ca tabelul de facturare din configurator; singur pe ofertă, doar rândurile de aici
const altele = () => !modFisa && cos.pozitii.some((_, k) => k !== cos.curent);
const deCopiat = () => (altele()
  ? cosul.facturareComasata(cosul.transportOData(cosul.toate(cos, curenta()).pozitii ?? [], liniaTransport({ comanda })))
  : facturare().lines);
$('btnCopyCod').addEventListener('click', e =>
  copyRows(deCopiat().map(l => [l.cod])).then(ok => flash(e.target, ok ? '✓ copiat' : '⚠ eroare')));
$('btnCopyCant').addEventListener('click', e =>
  copyRows(deCopiat().map(l => [qtyText(l.cantitate)])).then(ok => flash(e.target, ok ? '✓ copiat' : '⚠ eroare')));

// ── Client: livrare / facturare / încasare / agent ──────────────────────────

for (const [id, valori, alege] of [['comandaLivrare', LIVRARE, 'Mod de livrare'], ['comandaPlata', PLATI, 'Facturare'],
                                   ['comandaIncasare', INCASARI, 'Încasare'], ['comandaAgent', AGENTI, 'Agent']]) {
  const sel = $(id);
  sel.innerHTML = `<option value="" selected disabled>${alege}</option>` + valori.map(v => {
    const [cod, text] = Array.isArray(v) ? v : [v, v];
    return `<option value="${esc(cod)}">${esc(text)}</option>`;
  }).join('');
  // livrarea schimbă linia de transport → tabelul se reface
  sel.addEventListener('change', () => { comanda[sel.dataset.c] = sel.value; etichetaNumar(); randeaza(); });
}
$('plataMod').innerHTML = `<option value="" selected disabled>Alege…</option>` +
  PLATI.map(([cod, text]) => `<option value="${cod}">${esc(text)}</option>`).join('');
initSugestiiClienti(agent => { $('comandaAgent').value = agent; comanda.agent = agent; });

// ── Salvare la manager (aceiaşi paşi ca în configurator) ────────────────────

// Produsul de pe ecran pentru coş: null cât nu e niciun rând început.
function curenta() {
  if (!linii.some(l => l.cod || String(l.denumire).trim())) return null;
  const f = facturare();
  if (f.errors.length) return { eroare: f.errors[0] };
  return { gama: 'amanunt', pozitie: {
    sistem: 'amanunt', eticheta: 'Ofertă cu amănuntul', finisaj: '',
    latime: 0, inaltime: 0, nrUsi: 1,
    config: { system: 'amanunt', amanunt: linii.filter(l => l.cod), comanda: { ...comanda }, observatii: $('observatii').value },
    // necesarul = produsele cu debitare (lungimile de tăiat), pt. depozit şi fişă
    linii: { facturare: f.lines, client: [], sticla: [], necesar: linii.filter(l => l.cod && deb(l)).map(l =>
      ({ cod: l.cod, denumire: l.denumire, um: l.um, cantitate: cantitate(l), debitare: textDebitare(l) })) },
  } };
}

// clientul şi detaliile — duse în coş când treci la alt produs
const clientPtCos = () => ({
  client: { nume: $('clientNume').value, telefon: $('clientTelefon').value, adresa: $('clientAdresa').value },
  ofertaNr: $('ofertaNr').value, comanda: { ...comanda } });
let card = null;

const mesaj = (html, fel) => { $('ofertaMesaj').innerHTML = `<div class="oferta-msg ${fel}">${html}</div>`; };
const BUTOANE = ['btnConfirma', 'btnComanda', 'btnPlata'];
const TEXT = { btnConfirma: () => (cos.ofertaEditata ? 'Salvează modificările' : 'Salvează oferta'),
               btnComanda: () => (cos.comandaEditata ? cosul.TEXT_MODIFICA_COMANDA : 'Salvează comanda şi printează'), btnPlata: () => 'Aşteaptă plata' };

function renderOferta() {
  const { stare, utilizator } = manager.stareOferta();
  const servit = stare === 'logat' || stare === 'nelogat';
  if ($('linkAcasa')) $('linkAcasa').style.display = servit ? '' : 'none';
  $('cine').textContent = utilizator?.nume ?? '';
  // „Adaugă la comandă": comanda e deja în lucru — doar „Salvează comanda şi printează" (userul, 2026-10-22)
  // la fel „Modifică comanda": doar „Salvează modificările şi printează"
  const arata = da => { for (const id of BUTOANE) $(id).style.display = da && (cos.adaugaLa || cos.comandaEditata ? id === 'btnComanda' : true) ? '' : 'none';
                        const nr = $('ofertaNr'), eticheta = nr.closest('label.nou-camp');   // cu eticheta lui
                        nr.style.display = da && !cos.adaugaLa ? '' : 'none';
                        if (eticheta) eticheta.style.display = nr.style.display; };
  if (!servit || modFisa) { $('ofertaUI').innerHTML = ''; return arata(false); }
  if (stare === 'nelogat') {
    arata(false);
    $('ofertaUI').innerHTML = `<div class="oferta-hint">Autentifică-te ca să poţi salva oferte.
      <a href="/login?redirect=${encodeURIComponent(location.pathname + location.search)}">Intră în cont</a></div>`;
    return;
  }
  arata(true);
  $('btnConfirma').textContent = TEXT.btnConfirma();
  $('btnComanda').textContent = TEXT.btnComanda();
  $('btnComanda').dataset.titlu = cos.adaugaLa ? `Produsele se adaugă la comanda ${cos.adaugaLa.numar} (în lucru), apoi se printează fişele lor`
    : cos.comandaEditata ? 'Comanda rămâne în lucru; se printează din nou doar fişele produselor schimbate' : '';
  const t = cosul.toate(cos, curenta());
  $('ofertaUI').innerHTML = t.pozitii?.length > 1 ? `<div class="oferta-hint">${t.pozitii.length} produse în ofertă</div>` : '';
  // metoda de plată opreşte „Salvează oferta" / „Salvează comanda" (nu şi „Adaugă la comandă")
  for (const id of BUTOANE) {
    const oprit = cos.adaugaLa || cos.comandaEditata ? null : opritDePlata({ btnConfirma: 'oferta', btnComanda: 'comanda', btnPlata: 'plata' }[id], comanda.plata);
    $(id).disabled = !t.pozitii || !!oprit;
    $(id).title = oprit ?? $(id).dataset.titlu ?? '';
  }
  pasi();   // butoanele s-au arătat (servit de manager) → starea cere şi datele clientului
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
  if (cos.adaugaLa) return adaugaLaComanda();
  if (cos.comandaEditata) return modificaComanda();
  const ofertaNr = $('ofertaNr').value.trim();
  // obligatorii: numele, livrarea, agentul, nr. ofertei; la „Salvează comanda" şi telefonul + adresa
  const lipsa = campuriLipsa({ laAcceptare: unde === 'comanda' });
  if (lipsa.length) { focusCamp(lipsa[0].id); return mesaj(`Completează ${lipsa.map(x => x.text).join(', ')}.`, 'eroare'); }
  const tot = cosul.toate(cos, curenta());
  if (tot.eroare) return mesaj(esc(tot.eroare), 'eroare');
  const plata = unde === 'comanda' ? await cerePlata() : null;
  if (unde === 'comanda' && !plata) return;

  for (const id of BUTOANE) $(id).disabled = true;
  $(unde === 'oferta' ? 'btnConfirma' : unde === 'comanda' ? 'btnComanda' : 'btnPlata').textContent = 'Se salvează…';
  const gata = () => { for (const id of BUTOANE) { $(id).disabled = false; $(id).textContent = TEXT[id](); } };

  const r = await manager.salveaza({
    ofertaNr, id: cos.ofertaEditata, pozitii: cosul.transportOData(tot.pozitii, liniaTransport({ comanda })).map(x => x.pozitie),
    nume: $('clientNume').value, telefon: $('clientTelefon').value, adresa: $('clientAdresa').value,
    detalii: { ...comanda }, email: '', observatii: '',
  });
  if (r.eroare) { gata(); return mesaj(esc(r.eroare), 'eroare'); }
  // o nouă apăsare lucrează pe ACEEAŞI ofertă (coşul o ţine minte); gata → coşul se goleşte
  Object.assign(cos, clientPtCos(), { ofertaEditata: r.comanda.id, numar: ofertaNr || r.comanda.numar });
  cosul.scrie(cos);
  const laComanda = () => { ciorna.gata(); cosul.goleste(); location.href = '/#comanda/' + r.comanda.id; };
  if (unde === 'oferta') return laComanda();
  // comanda: întâi fişele (una pe produs), apoi „Ai printat?"; fără „Da" rămâne ofertă (userul, 2026-10-21)
  const nrFise = tot.pozitii.length;
  if (unde === 'comanda' && !(await window.Fise.printeazaToate(r.comanda.id, nrFise, $('btnComanda')))) {
    gata();
    return mesaj(`Oferta <strong>${esc(ofertaNr || r.comanda.numar)}</strong> s-a salvat, dar NU a devenit comandă:
      fişa nu s-a printat. O poţi accepta din manager, cu „Acceptă comanda şi printează".`, 'eroare');
  }
  const t = await manager.treceIn(r.comanda.id, unde, plata ?? {});
  if (t.eroare) {
    gata();
    return mesaj(`Oferta <strong>${esc(ofertaNr || r.comanda.numar)}</strong> s-a salvat, dar ${unde === 'comanda'
      ? 'nu a devenit comandă' : 'nu a trecut la „Aşteaptă plata"'}: ${esc(t.eroare)}`, 'eroare');
  }
  if (unde === 'comanda') await window.Fise.noteaza(r.comanda.id, nrFise);
  laComanda();
}
// „Adaugă la comandă": produsele se adaugă la comanda în lucru — fără transport şi fără datele clientului
// „Modifică comanda": ca în configurator (ui.js) — PUT, apoi doar fişele produselor schimbate
async function modificaComanda() {
  const lipsa = campuriLipsa({ laAcceptare: true });
  if (lipsa.length) { focusCamp(lipsa[0].id); return mesaj(`Completează ${lipsa.map(x => x.text).join(', ')}.`, 'eroare'); }
  const tot = cosul.toate(cos, curenta());
  if (tot.eroare) return mesaj(esc(tot.eroare), 'eroare');
  if (!(await cosul.confirmaModificarea(cos))) return;
  const b = $('btnComanda');
  b.disabled = true;
  b.textContent = 'Se salvează…';
  const r = await manager.salveaza({
    ofertaNr: $('ofertaNr').value.trim(), id: cos.ofertaEditata,
    pozitii: cosul.transportOData(tot.pozitii, liniaTransport({ comanda })).map(x => x.pozitie),
    nume: $('clientNume').value, telefon: $('clientTelefon').value, adresa: $('clientAdresa').value,
    detalii: { ...comanda }, email: '', observatii: '',
  });
  if (r.eroare) { b.disabled = false; b.textContent = TEXT.btnComanda(); return mesaj(esc(r.eroare), 'eroare'); }
  await cosul.dupaModificare(cos.ofertaEditata, r, b);
}

async function adaugaLaComanda() {
  const tot = cosul.toate(cos, curenta());
  if (tot.eroare) return mesaj(esc(tot.eroare), 'eroare');
  const b = $('btnComanda');
  b.disabled = true;
  b.textContent = 'Se adaugă…';
  const r = await manager.adaugaLaComanda(cos.adaugaLa.id, cosul.transportOData(tot.pozitii, null).map(x => x.pozitie));
  if (r.eroare) { b.disabled = false; b.textContent = TEXT.btnComanda(); return mesaj(esc(r.eroare), 'eroare'); }
  const id = cos.adaugaLa.id;
  ciorna.gata();
  cosul.goleste();
  // comanda e în lucru → fişele produselor noi se printează acum; fără „Da" rămân de printat din manager
  if (await window.Fise.printeazaToate(id, r.pozitii, b)) await window.Fise.noteaza(id, r.pozitii);
  else await window.alerta?.('Produsele s-au adăugat la comandă, dar fişa lor nu s-a printat.\n\nO printezi din manager, cu „Printează fişa nouă".');
  location.href = '/#comanda/' + id;
}
$('btnConfirma').addEventListener('click', () => trimite('oferta'));
$('btnComanda').addEventListener('click', () => trimite('comanda'));
$('btnPlata').addEventListener('click', () => trimite('plata'));

// ── Tipar: lista de produse pe o foaie (şi „Fişă" din manager) ──────────────

// textul debitării („2 × 1200 mm, 1 × 800 mm → 2 bare de 3000 mm" — textDebitare, sau cel îngheţat
// în comandă) → bucăţile, câte una pe rând în celulă, şi lungimea barei
function bucatiDebitare(text) {
  if (!text) return null;
  const [bucati, bare] = String(text).split(' → ');
  return { bucati: bucati.split(', ').filter(Boolean), bara: bare?.match(/de (\d+) mm/)?.[1] ?? null };
}

// Stilul foii (din @media print al paginii) — şi pt. previzualizare, ca să arate la fel
const stilTipar = () => [...document.styleSheets].flatMap(sh => { try { return [...sh.cssRules]; } catch { return []; } })
  .filter(r => r.media?.mediaText === 'print').flatMap(r => [...r.cssRules])
  .filter(r => r.selectorText?.startsWith('#tipar')).map(r => r.cssText).join('\n');

// `vezi` (userul, 2026-10-21): doar previzualizare în aplicaţie, fără print — „Vezi lista"; printul (la
// acceptare, din cadrul managerului) anunţă după dialog {tip:'fisa-tiparita'} (vezi /fise.js)
function tipareste({ vezi = false } = {}) {
  const { lines } = facturare();
  // debitarea fiecărei linii: la fişă din necesarul îngheţat, altfel din rândurile de pe ecran
  const peCod = modFisa?.debitare ?? new Map(linii.filter(deb).map(l => [l.cod, textDebitare(l)]));
  const rand = (et, v) => (v ? `<tr><td>${et}</td><td>${esc(v)}</td></tr>` : '');
  $('tipar').innerHTML = `
    <div class="cap"><div><h1>Ofertă cu amănuntul</h1>${modFisa?.numar ? `<strong>${esc(modFisa.numar)}</strong>` : ''}</div>
      <div class="dreapta">${configuratDe() ? `<div>Configurat de <b>${esc(configuratDe())}</b></div>` : ''}<div>${dataRo()}</div></div></div>
    <table class="perechi">
      ${$('clientNume').value.trim() ? `<tr class="client"><td>Client</td><td>${esc($('clientNume').value.trim())}</td></tr>` : ''}${rand('Telefon', $('clientTelefon').value)}${rand('Adresă', $('clientAdresa').value)}
      ${rand('Mod de livrare', comanda.livrare)}${rand('Facturare', plataText(comanda.plata))}${rand('Încasare', incasareText(comanda.incasare))}${rand('Agent', comanda.agent)}
      ${rand(modFisa?.etNumar ?? numarText(comanda.plata), $('ofertaNr').value.trim())}${rand('Observaţii', $('observatii').value.trim())}
    </table>
    <table>
      <thead><tr class="margine"><td colspan="6"></td></tr><tr><th>#</th><th>Cod</th><th>Produs</th><th>Debitare</th><th>Cant.</th><th>✓</th></tr></thead>
      <tfoot><tr class="margine"><td colspan="6"></td></tr></tfoot>
      <tbody>${lines.map((l, k) => { const d = bucatiDebitare(peCod.get(l.cod)); return `<tr><td>${k + 1}</td><td>${esc(l.cod)}</td>
        <td class="produs">${esc(l.denumire)}</td>
        <td class="deb-col">${d ? d.bucati.map(b => `<div>${esc(b)}</div>`).join('') + (d.bara ? `<div class="bara-de">din bare de ${d.bara} mm</div>` : '') : ''}</td>
        <td class="num">${virgula(l.cantitate)} ${d?.bara ? (+l.cantitate === 1 ? 'bară' : 'bare') : esc(l.um)}</td><td class="bifa"></td></tr>`; }).join('')}</tbody>
    </table>`;
  if (vezi) {
    return arataPrevizualizare(`<!DOCTYPE html><html lang="ro"><head><meta charset="UTF-8"><link rel="stylesheet" href="/fonte.css">
      <style>body { font-family: 'Inter', sans-serif; color: #000; margin: 0; } ${stilTipar()} #tipar { padding-bottom: 10mm; }</style>
      </head><body><div id="tipar">${$('tipar').innerHTML}</div></body></html>`, { titlu: 'Lista — ofertă cu amănuntul', pagini: '#tipar' });
  }
  addEventListener('afterprint', () => { try { window.top.postMessage({ tip: 'fisa-tiparita' }, location.origin); } catch {} }, { once: true });
  window.print();
}
$('btnFisa').addEventListener('click', () => {
  tipareste({ vezi: true });
  window.noteazaVazut?.('A văzut lista (ofertă cu amănuntul)', cos.ofertaEditata ?? null);
});

// ── Pornire: produs nou, din coş (?cos=1&poz=k) sau „Fişă" din manager (?fisa=id&poz=k) ──

// cine a configurat — pe fişă, ca atelierul să ştie pe cine întreabă (userul, 2026-10-22): la fişa unei comenzi
// cel care a făcut oferta, altfel cel conectat acum
const configuratDe = () => (modFisa ? modFisa.configurat : manager.stareOferta().utilizator?.nume) ?? null;

const puneClientul = (client, ofertaNr, detalii) => {
  Object.assign(comanda, detalii);
  for (const [k, sel] of [['livrare', 'comandaLivrare'], ['plata', 'comandaPlata'], ['incasare', 'comandaIncasare'], ['agent', 'comandaAgent']]) if (comanda[k]) $(sel).value = comanda[k];
  $('clientNume').value = client.nume ?? '';
  $('clientTelefon').value = client.telefon ?? '';
  $('clientAdresa').value = client.adresa ?? '';
  $('ofertaNr').value = ofertaNr ?? '';
  etichetaNumar();
};

(async () => {
  const params = new URLSearchParams(location.search);
  // „Modifică oferta": coşul cu toate produsele ofertei îl face configuratorul (ştie gamele)
  if (params.get('oferta')) return location.replace(`./?oferta=${encodeURIComponent(params.get('oferta'))}`);
  let eroare = null;
  if (params.get('adauga')) {
    const r = await cosul.dinAdauga(params.get('adauga'), manager.incarcaOferta, 'amanunt');
    if (r.eroare) eroare = r.eroare; else return;
  }
  if (params.get('fisa')) {
    const o = await manager.incarcaOferta(params.get('fisa'));
    if (o.comanda) Object.assign(o.comanda, dinAcceptare(params));   // plata aleasă chiar acum, la acceptare
    const k = +params.get('poz') || 0, p = o.pozitii?.[k];
    if (o.eroare || p?.sistem !== 'amanunt') eroare = o.eroare || 'Nu e o ofertă cu amănuntul.';
    else {
      // fişa: liniile ÎNGHEŢATE la salvare
      linii = p.linii.facturare.map(l => ({ cod: l.cod, denumire: l.denumire, um: l.um, cantitate: l.cantitate }));
      puneClientul({ nume: o.comanda.client_nume, telefon: o.comanda.client_telefon, adresa: o.comanda.client_adresa },
                   o.comanda.oferta_nr, { ...p.config.comanda, ...detaliiDinManager(o.comanda) });
      $('observatii').value = p.config.observatii ?? '';
      const n = o.pozitii.length;
      modFisa = { numar: `${o.comanda.oferta_nr || o.comanda.numar}${n > 1 ? ` · produsul ${k + 1} din ${n}` : ''}`,
                  configurat: o.comanda.creat_de_nume ?? null,
                  etNumar: numarText(p.config.comanda?.plata),   // după plata de la salvare, nu cea de la acceptare
                  debitare: new Map((p.linii.necesar ?? []).filter(x => x.debitare).map(x => [x.cod, x.debitare])) };
    }
  } else if (cosul.activ()) {
    puneClientul(cos.client, cos.ofertaNr, cos.comanda);
    const k = params.has('poz') ? +params.get('poz') : null;
    cos.curent = cos.pozitii[k]?.gama === 'amanunt' ? k : null;
    if (cos.curent != null) {
      linii = (cos.pozitii[k].pozitie.config.amanunt ?? []).map(l => ({ ...l, debitare: l.debitare?.map(p => ({ ...p })) }));
      $('observatii').value = cos.pozitii[k].pozitie.config.observatii ?? '';
    }
    const ecran = ciorna.ecranReluat();   // ciorna reluată (?ciorna=<id> în configurator)
    if (ecran) { linii = ecran.linii; $('observatii').value = ecran.observatii; }
    cosul.scrie(cos);
  }
  if (!modFisa) {
    card = cosul.initCard($('cardCos'), cos, { curenta, client: () => ({ ...clientPtCos(), modificat: ciorna.modificata() }),
                                               gamaEcran: () => 'amanunt', produse: $('cosProduse'),
                                               transport: () => liniaTransport({ comanda }) });
    document.addEventListener('cos:schimbat', renderOferta);
  } else { $('cardCosSec').hidden = true; $('nouActiuni').hidden = true; }
  randeaza();
  await manager.initOferta(renderOferta);
  if (cos.comandaEditata) { $('btnComanda').textContent = TEXT.btnComanda(); mesaj(cosul.mesajModificaComanda(cos), 'ok'); }
  else if (cos.ofertaEditata) { $('btnConfirma').textContent = TEXT.btnConfirma(); mesaj(`Modifici oferta <strong>${esc(cos.numar ?? '')}</strong>.`, 'ok'); }
  if (eroare) mesaj(esc(eroare), 'eroare');
  if (!modFisa) ciorna.init({ cos, gama: () => 'amanunt', client: clientPtCos,
    ecran: () => ({ linii, observatii: $('observatii').value }),
    areContinut: () => cos.pozitii.length > 0 || linii.some(l => l?.cod || String(l?.denumire ?? '').trim()),
    titlu: () => {
      const n = cos.pozitii.length - (cos.curent != null ? 1 : 0);   // celelalte produse
      return `Ofertă cu amănuntul${n ? ` + ${n} ${n === 1 ? 'produs' : 'produse'}` : ''} · ${$('clientNume').value.trim() || 'fără client'}`;
    } });
  if (params.get('fisa')) {
    // managerul încarcă pagina într-un cadru ascuns şi aşteaptă răspunsul — ÎNAINTE de print: dialogul
    // blochează pagina, iar „s-a închis" (afterprint) ar ajunge înaintea lui „fişa e gata" şi s-ar pierde
    if (window.parent !== window) window.parent.postMessage({ tip: 'fisa', eroare: modFisa ? null : eroare }, location.origin);
    if (modFisa) tipareste({ vezi: params.get('vezi') === '1' });
  } else focus(linii.length, 'produs');
})();
