import gameJson from './systems/game.json';
import { copyRows } from './lib/comun/clipboard.js';
import { qtyText } from './lib/comun/num.js';

// ═══════════════════════════════════════════════════════════════════════════
//  COŞUL OFERTEI — o ofertă poate avea mai multe produse (userul, 2026-10-01):
//  ex. rame + Confort + 4 sertare. Fiecare produs = o POZIŢIE (configuraţia ei,
//  fişa ei de atelier), facturarea se comasează pe toată oferta.
//
//  Produsul de pe ecran se configurează ca până acum; „Adaugă la ofertă → <gamă>"
//  îl pune în coş şi deschide gama următoare. Coşul stă în sessionStorage (doar
//  tabul ăsta) şi se foloseşte doar cu ?cos=1 în adresă — „Ofertă nouă" din
//  manager porneşte mereu de la zero. Îl folosesc ambele pagini: configuratorul
//  de uşi (index.html) şi oferta cu amănuntul (amanunt.html).
//
//  cos = { pozitii: [{ gama, pozitie }], curent: indexul de pe ecran | null (produs nou),
//          client: { nume, telefon, adresa }, ofertaNr, comanda: { livrare, plata, agent },
//          ofertaEditata: id | null, numar }
// ═══════════════════════════════════════════════════════════════════════════

const CHEIE = 'cosOferta';
const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const gol = () => ({ pozitii: [], curent: null, client: {}, ofertaNr: '', comanda: {}, ofertaEditata: null, numar: null });
export const activ = () => new URLSearchParams(location.search).has('cos');
export function citeste() {
  if (!activ()) return gol();
  try { return { ...gol(), ...JSON.parse(sessionStorage.getItem(CHEIE)) }; } catch { return gol(); }
}
export function scrie(cos) { try { sessionStorage.setItem(CHEIE, JSON.stringify(cos)); } catch { /* fără coş */ } }
export function goleste() { try { sessionStorage.removeItem(CHEIE); } catch { /* nimic */ } }

// adresa paginii unei game, în coş (`poz` = produsul din coş de deschis pe ecran)
export const url = (gama, extra = {}) => gama === 'amanunt'
  ? `amanunt.html?${new URLSearchParams({ cos: 1, ...extra })}`
  : `./?${new URLSearchParams({ gama, cos: 1, ...extra })}`;

// Toate produsele de trimis: cele din coş + cel de pe ecran (la locul lui, dacă
// e unul deschis din coş). `curenta` = { gama, pozitie } | { eroare } | null (neînceput).
export function toate(cos, curenta) {
  if (curenta?.eroare) return { eroare: curenta.eroare };
  const lista = cos.pozitii.map(x => x);
  if (curenta) {
    if (cos.curent != null && cos.curent < lista.length) lista[cos.curent] = curenta; else lista.push(curenta);
  }
  return lista.length ? { pozitii: lista } : { eroare: 'Configurează cel puţin un produs.' };
}

// Facturarea pentru NeoManager pe toată oferta: liniile cu acelaşi cod se adună
// (la fel ca în manager — facturareTotala). Transportul e o dată pe comandă, nu pe produs.
export const O_DATA_PE_COMANDA = new Set(['CHLTTRMANIP']);
export function facturareComasata(pozitii) {
  const pe = new Map();
  for (const { pozitie } of pozitii) {
    for (const l of pozitie.linii.facturare) {
      const e = pe.get(l.cod) ?? { cod: l.cod, denumire: l.denumire, um: l.um, cantitate: 0 };
      e.cantitate = O_DATA_PE_COMANDA.has(l.cod) ? Math.max(e.cantitate, l.cantitate)
        : Math.round((e.cantitate + l.cantitate) * 100) / 100;
      pe.set(l.cod, e);
    }
  }
  return [...pe.values()];
}

// Transportul e o dată pe comandă şi depinde de livrarea COMENZII, nu de cea de când
// s-a configurat fiecare produs: se scoate de pe toate şi se pune o singură dată, pe primul.
// `transport` = linia de transport (liniaTransport) sau null (ridicare personală).
export function transportOData(lista, transport) {
  return lista.map((x, k) => ({ ...x, pozitie: { ...x.pozitie, linii: { ...x.pozitie.linii,
    facturare: [...x.pozitie.linii.facturare.filter(l => !O_DATA_PE_COMANDA.has(l.cod)),
                ...(k === 0 && transport ? [{ ...transport }] : [])] } } }));
}

// „Ramă 820 · 6 rame", „Confort Gamma · 2100 × 1800 mm · Negru periat · 2 uşi", „Ofertă cu amănuntul · 3 produse"
export function descriere(p) {
  if (p.sistem === 'amanunt') {
    const n = p.linii.facturare.filter(l => l.cod !== 'CHLTTRMANIP').length;
    return `${p.eticheta} · ${n} ${n === 1 ? 'produs' : 'produse'}`;
  }
  if (/^rama/.test(p.sistem)) return `${p.eticheta} · ${p.finisaj} · ${p.nrUsi} ${p.nrUsi === 1 ? 'ramă' : 'rame'}`;
  return `${p.eticheta} · ${p.inaltime} × ${p.latime} mm · ${p.finisaj} · ${p.nrUsi} ${p.nrUsi === 1 ? 'uşă' : 'uşi'}`;
}

// O poziţie aşa cum vine de la manager (GET /api/comenzi/:id) → forma trimisă la salvare.
const linieCurata = l => ({ cod: l.cod, denumire: l.denumire, um: l.um, cantitate: l.cantitate,
                            ...(l.debitare != null && { debitare: l.debitare }) });
export const dinManager = p => ({
  sistem: p.sistem, eticheta: p.eticheta, finisaj: p.finisaj, latime: p.latime, inaltime: p.inaltime, nrUsi: p.nr_usi,
  config: p.config,
  linii: Object.fromEntries(['facturare', 'necesar', 'client', 'sticla'].map(k => [k, (p.linii?.[k] ?? []).map(linieCurata)])),
});

// Coşul unei oferte deschise din manager („Modifică oferta"): toate produsele ei.
// `gamaDin(p)` = gama poziţiei (o ştie doar configuratorul de uşi, din registry).
export function dinOferta(o, gamaDin) {
  return { ...gol(),
    pozitii: o.pozitii.map(p => ({ gama: gamaDin(p), pozitie: dinManager(p) })),
    client: { nume: o.comanda.client_nume ?? '', telefon: o.comanda.client_telefon ?? '', adresa: o.comanda.client_adresa ?? '' },
    ofertaNr: o.comanda.oferta_nr ?? '',
    comanda: { livrare: o.comanda.livrare ?? null, plata: o.comanda.plata ?? null, agent: o.comanda.agent ?? null },
    ofertaEditata: o.comanda.id, numar: o.comanda.oferta_nr || o.comanda.numar };
}

// ── Cardul „Adaugă la ofertă" ───────────────────────────────────────────────
// `curenta()` = produsul de pe ecran (vezi toate); `client()` = câmpurile de
// client + detaliile, de dus mai departe în coş la schimbarea paginii.
export function initCard(el, cos, { curenta, client, gamaEcran, transport, facturareInCard = true }) {
  if (!el) return { actualizeaza: () => {} };
  const mesaj = t => { el.querySelector('.cos-msg').innerHTML = t ? `<div class="oferta-msg eroare">${esc(t)}</div>` : ''; };

  // produsul de pe ecran intră în coş (dacă e început) — înainte de orice plecare din pagină
  const pune = () => {
    const c = curenta();
    if (c?.eroare) { mesaj(`Produsul de pe ecran nu e gata: ${c.eroare} Termină-l sau goleşte-l („Goleşte pagina") înainte să treci la altul.`); return false; }
    if (c) { if (cos.curent != null) cos.pozitii[cos.curent] = c; else cos.pozitii.push(c); }
    cos.curent = null;
    Object.assign(cos, client());
    scrie(cos);
    return true;
  };

  function actualizeaza() {
    const c = curenta();
    const t = toate(cos, c && !c.eroare ? c : null);
    const facturare = t.pozitii ? facturareComasata(transportOData(t.pozitii, transport())) : [];
    const randuri = cos.pozitii.map((x, k) => k === cos.curent
      ? `<li class="acum"><span>${esc(descriere(c && !c.eroare ? c.pozitie : x.pozitie))}</span><span class="dim mic">se modifică acum, pe ecran</span></li>`
      : `<li><span>${esc(descriere(x.pozitie))}</span>
           <button type="button" class="mic" data-modifica="${k}">Modifică</button>
           <button type="button" class="mic" data-scoate="${k}" aria-label="Scoate produsul ${k + 1} din ofertă">✕</button></li>`);
    if (cos.curent == null) randuri.push(`<li class="acum"><span>${c && !c.eroare ? esc(descriere(c.pozitie))
      : esc(gameJson.game.find(g => g.id === gamaEcran())?.label ?? 'Produsul de pe ecran')}</span>
      <span class="dim mic">${c ? (c.eroare ? 'în lucru, pe ecran' : 'pe ecran — intră în ofertă la salvare') : 'neînceput'}</span></li>`);
    el.innerHTML = `
      <ol class="cos-lista">${randuri.join('')}</ol>
      <div class="cos-game"><span class="dim mic">Adaugă:</span>${gameJson.game.map(g =>
        `<button type="button" class="mic" data-gama="${esc(g.id)}">+ ${esc(g.label)}</button>`).join('')}</div>
      ${facturareInCard && t.pozitii?.length > 1 ? `<div class="cos-fact"><span class="dim mic">Facturare comasată, toată oferta: ${facturare.length} linii</span>
        <button type="button" class="mic" data-copiaza="cod">Copiază coduri</button>
        <button type="button" class="mic" data-copiaza="cant">Copiază cantităţi</button></div>` : ''}
      <div class="cos-msg"></div>`;
    el.querySelectorAll('[data-gama]').forEach(b => b.addEventListener('click', () => {
      if (pune()) location.href = url(b.dataset.gama);
    }));
    el.querySelectorAll('[data-modifica]').forEach(b => b.addEventListener('click', () => {
      const k = +b.dataset.modifica;
      const gama = cos.pozitii[k].gama;
      if (pune()) location.href = url(gama, { poz: k });
    }));
    el.querySelectorAll('[data-scoate]').forEach(b => b.addEventListener('click', () => {
      const k = +b.dataset.scoate;
      if (!confirm(`Scoţi din ofertă: ${descriere(cos.pozitii[k].pozitie)}?`)) return;
      cos.pozitii.splice(k, 1);
      if (cos.curent != null && cos.curent > k) cos.curent--;
      scrie(cos);
      // adresa ţine indexul produsului de pe ecran — se mută odată cu el
      if (new URLSearchParams(location.search).has('poz')) {
        const p = new URLSearchParams(location.search);
        if (cos.curent == null) p.delete('poz'); else p.set('poz', cos.curent);
        history.replaceState(null, '', `${location.pathname}?${p}`);
      }
      actualizeaza();
      el.dispatchEvent(new CustomEvent('cos:schimbat', { bubbles: true }));
    }));
    el.querySelectorAll('[data-copiaza]').forEach(b => b.addEventListener('click', () => {
      const r = facturare.map(l => [b.dataset.copiaza === 'cod' ? l.cod : qtyText(l.cantitate)]);
      copyRows(r).then(ok => { const o = b.textContent; b.textContent = ok ? '✓ copiat' : '⚠ eroare'; setTimeout(() => { b.textContent = o; }, 1400); });
    }));
  }
  actualizeaza();
  return { actualizeaza };
}
