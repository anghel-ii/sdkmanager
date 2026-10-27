import gameJson from './systems/game.json';
import { copyRows } from './lib/comun/clipboard.js';
import { qtyText } from './lib/comun/num.js';
import { pleaca, gata as gataCiorna, goleste as golesteCiorna } from './ciorna.js';
import { confirma } from './intrebari.js';
import { documentulText } from './lib/comun/comanda.js';

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
//          client: { nume, telefon, adresa }, ofertaNr, comanda: { livrare, plata, incasare, agent },
//          ofertaEditata: id | null, numar, adaugaLa: { id, numar } | null }
//  adaugaLa = „Adaugă la comandă" din manager: produsele se ADAUGĂ la o comandă în lucru.
//  comandaEditata = „Modifică comanda" (o comandă în lucru sau care aşteaptă plata, nu o ofertă):
//                   { facturata: nr. facturii | null, plata: true dacă aşteaptă plata, facturare: { cod: cantitate } la deschidere,
//                     ofertaNr: nr. documentului din NeoManager la deschidere }.
//  ciornaId = ciorna reluată (ciorna.js); modificat = ceva nesalvat pe paginile de dinainte.
// ═══════════════════════════════════════════════════════════════════════════

const CHEIE = 'cosOferta';
const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const gol = () => ({ pozitii: [], curent: null, client: {}, ofertaNr: '', comanda: {}, ofertaEditata: null, numar: null, adaugaLa: null,
             comandaEditata: null, ciornaId: null, modificat: false });
export const activ = () => new URLSearchParams(location.search).has('cos');
export function citeste() {
  if (!activ()) return gol();
  try { return { ...gol(), ...JSON.parse(sessionStorage.getItem(CHEIE)) }; } catch { return gol(); }
}
export function scrie(cos) { try { sessionStorage.setItem(CHEIE, JSON.stringify(cos)); } catch { /* fără coş */ } }
export function goleste() { try { sessionStorage.removeItem(CHEIE); } catch { /* nimic */ } }

// „Goleşte pagina" (după confirmare): produsul de pe ecran iese şi din coş — altfel, deschis din
// coş (?poz=k), reîncărcarea l-ar aduce înapoi. Fără alte produse (şi fără ofertă modificată /
// comandă la care se adaugă) se goleşte tot, cu client cu tot. Pagina se redeschide fără ?poz.
export function golesteEcranul(cos) {
  if (cos.curent != null) cos.pozitii.splice(cos.curent, 1);
  cos.curent = null;
  golesteCiorna();   // după scoatere: „modificat" = mai sunt alte produse nesalvate
  if (!cos.pozitii.length && !cos.ofertaEditata && !cos.adaugaLa) Object.assign(cos, gol());
  if (activ()) scrie(cos);
  const u = new URL(location.href);
  u.searchParams.delete('poz');
  u.hash = '';
  if (u.href === location.href) location.reload(); else location.replace(u.href);
}

// „Adaugă la comandă" din manager (?adauga=<id>): un coş nou, legat de comanda în lucru —
// clientul şi livrarea sunt ale ei (pt. fişă), produsele de aici i se adaugă la salvare.
// `incarca` = incarcaOferta din manager.js. Întoarce { eroare } sau pleacă pe pagina gamei.
export async function dinAdauga(id, incarca, gama) {
  const o = await incarca(id);
  if (o.eroare) return { eroare: o.eroare };
  const c = o.comanda;
  if (c.tip !== 'comanda' || c.finalizat_la) return { eroare: `${c.oferta_nr || c.numar} nu e o comandă în lucru — nu i se mai adaugă produse.` };
  scrie({ ...gol(), adaugaLa: { id: c.id, numar: c.oferta_nr || c.numar },
          client: { nume: c.client_nume, telefon: c.client_telefon ?? '', adresa: c.client_adresa ?? '' },
          ofertaNr: c.oferta_nr ?? '', comanda: { livrare: c.livrare, plata: c.plata, incasare: c.incasare, agent: c.agent } });
  location.replace(url(gama));
  return {};
}

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
    comanda: { livrare: o.comanda.livrare ?? null, plata: o.comanda.plata ?? null, incasare: o.comanda.incasare ?? null,
               agent: o.comanda.agent ?? null },
    ofertaEditata: o.comanda.id, numar: o.comanda.oferta_nr || o.comanda.numar,
    comandaEditata: o.comanda.tip === 'comanda' || o.comanda.tip === 'plata'
      ? { facturata: o.comanda.factura_nr ?? null, plata: o.comanda.tip === 'plata', facturare: cantitatiFacturare(o.pozitii),
          ofertaNr: o.comanda.oferta_nr ?? '' } : null };
}

// Facturarea comasată a produselor, ca { cod: cantitate } — cu ea se vede dacă oferta trimisă clientului
// (la „Aşteaptă plata") mai e aceeaşi: s-a schimbat un cod sau o cantitate → numărul ei nu mai e valabil.
export function cantitatiFacturare(pozitii) {
  const t = {};
  for (const p of pozitii) for (const l of p.linii?.facturare ?? []) if (l.cod) t[l.cod] = Math.round(((t[l.cod] ?? 0) + +l.cantitate) * 1000) / 1000;
  return t;
}
// rândurile schimbate faţă de facturarea de la deschidere: „• COD: 2 → 3" (gol = aceeaşi)
export function diferenteFacturare(vechi, nou) {
  return [...new Set([...Object.keys(vechi), ...Object.keys(nou)])].filter(cod => vechi[cod] !== nou[cod])
    .map(cod => `• ${cod}: ${vechi[cod] == null ? 'nou' : String(vechi[cod])} → ${nou[cod] == null ? 'scos' : String(nou[cod])}`);
}

// „Modifică comanda" (userul, 2026-10-23) — comanda e deja în lucru: un singur buton, iar la salvare
// se printează din nou doar fişele produselor schimbate (serverul le spune în `r.pozitii`).
// La fel o comandă care aşteaptă plata (userul, 2026-10-27) — fără fişe de printat (încă nu s-au printat).
export const textModificaComanda = cos => (cos.comandaEditata?.plata ? 'Salvează modificările' : 'Salvează modificările şi printează');
export const titluModificaComanda = cos => (cos.comandaEditata?.plata ? 'Comanda rămâne la „Aşteaptă plata"'
  : 'Comanda rămâne în lucru; se printează din nou doar fişele produselor schimbate');
export const mesajModificaComanda = cos => (cos.comandaEditata?.plata
  ? `Modifici comanda <strong>${esc(cos.numar ?? '')}</strong> (aşteaptă plata). Dacă schimbi codurile sau cantităţile,
  numărul ${esc(documentulText(cos.comanda?.plata))} nu mai e valabil — îl refaci în NeoManager.`
  : `Modifici comanda <strong>${esc(cos.numar ?? '')}</strong> (în lucru) — la salvare se printează din nou
  doar fişele produselor schimbate.${cos.comandaEditata?.facturata ? ` <strong>E facturată (${esc(cos.comandaEditata.facturata)})</strong>.`
    : ` Dacă schimbi codurile sau cantităţile, numărul ${esc(documentulText(cos.comanda?.plata))} nu mai e valabil — îl refaci în NeoManager.`}`);
// înainte de salvare: o comandă facturată — modificările nu sunt pe factură. Altfel, la orice comandă modificată
// (aşteaptă plata sau în lucru — userul, 2026-10-27) cu alte coduri / cantităţi: numărul documentului din NeoManager
// (ofertă / proformă …) nu mai e valabil — se reface documentul acolo şi se cere numărul lui nou, diferit de cel vechi.
// Numărul unei facturi / al unui bon nu se schimbă de aici (biroul — doar cu aprobarea conducerii): avertisment, iar
// numărul se schimbă din pagina comenzii.
// `pozitii` = cele care se salvează, `ofertaNr` = numărul scris acum în pagină, `plata` = metoda de facturare de acum.
// → { ofertaNr } cu care se salvează, sau null (renunţă).
const NUMAR_FISCAL = ['fiscala', 'bon', 'avans'];
export async function confirmaModificarea(cos, pozitii, ofertaNr, plata) {
  const e = cos.comandaEditata;
  if (e?.facturata) {
    return await confirma(`Comanda ${cos.numar} e deja facturată (${e.facturata}). Modificările NU apar pe factura asta — o corectezi în NeoManager.\n\nSalvezi modificările?`,
      'Salvez') ? { ofertaNr } : null;
  }
  const dif = e ? diferenteFacturare(e.facturare ?? {}, cantitatiFacturare(pozitii)) : [];
  // fără schimbări de coduri / cantităţi, sau numărul e deja altul (scris în pagină) — se salvează aşa
  if (!dif.length || (ofertaNr && ofertaNr !== e.ofertaNr)) return { ofertaNr };
  const al = documentulText(plata);
  const schimbat = `Ai schimbat codurile sau cantităţile:\n\n${dif.slice(0, 12).join('\n')}${dif.length > 12 ? `\n… şi încă ${dif.length - 12}` : ''}
\nNumărul ${al}${e.ofertaNr ? ` ${e.ofertaNr}` : ''} nu mai e valabil — refă documentul în NeoManager`;
  if (NUMAR_FISCAL.includes(plata)) {
    return await confirma(`${schimbat}, apoi schimbă-i numărul din pagina comenzii (e document fiscal — cu aprobarea conducerii).\n\nSalvezi modificările?`,
      'Salvez') ? { ofertaNr } : null;
  }
  const text = `${schimbat} şi scrie aici numărul nou.`;
  const nou = window.cereValoare ? await window.cereValoare(text, { trimite: 'Salvează cu numărul nou', valoare: e.ofertaNr ?? '', loc: 'numărul nou din NeoManager' })
    : prompt(text, e.ofertaNr ?? '')?.trim() || null;
  return nou && nou !== e.ofertaNr ? { ofertaNr: nou } : null;
}
// după salvare: sticla comandată care nu mai e în comandă, fişele de printat din nou, apoi pagina comenzii
export async function dupaModificare(id, r, buton) {
  gataCiorna();   // salvată de-adevăratelea: fără ciornă, coşul s-a terminat
  goleste();
  if (r.sticlaRamasa?.length) {
    await window.alerta(`Sticla asta era deja comandată şi nu mai e în comandă — anunţă furnizorul:\n\n${r.sticlaRamasa
      .map(l => `• ${l.denumire}${l.debitare ? ` (${l.debitare})` : ''} × ${l.cantitate}`).join('\n')}`);
  }
  if (r.pozitii?.length) {
    if (await window.Fise.printeazaToate(id, r.pozitii, buton)) await window.Fise.noteaza(id, r.pozitii);
    else await window.alerta('Modificările s-au salvat, dar fişa produselor schimbate nu s-a printat.\n\nO printezi din manager, cu „Printează fişa nouă".');
  }
  location.href = '/#comanda/' + id;
}

// Rândurile cardului restrâns al unui produs din coş: model, culoare, dimensiuni
// (+ nr. de uşi / suprapuneri, unde e cazul — le dă configuratorul prin `detalii`).
export function detaliiImplicite(p) {
  if (p.sistem === 'amanunt') return [['Produse', descriere(p).split(' · ')[1]]];
  const r = [['Model', p.eticheta], ['Culoare', p.finisaj]];
  if (/^rama/.test(p.sistem)) r.push(['Rame', p.nrUsi]);
  else r.push(['Dimensiuni', `${p.inaltime} × ${p.latime} mm`]);
  return r;
}

// ── Cardul „Adaugă la ofertă" ───────────────────────────────────────────────
// `curenta()` = produsul de pe ecran (vezi toate); `client()` = câmpurile de
// client + detaliile, de dus mai departe în coş la schimbarea paginii.
// `el` = cardul cu butoanele gamelor (doar ele — userul, 2026-10-05); celelalte
// produse ale ofertei apar ca un card restrâns fiecare, în `produse` (deasupra
// paşilor produsului de pe ecran) sau, fără el, în `el`, deasupra butoanelor.
export function initCard(el, cos, { curenta, client, gamaEcran, transport, facturareInCard = true,
                                     produse = null, detalii = detaliiImplicite }) {
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
    const altele = cos.pozitii.map((x, k) => [x, k]).filter(([, k]) => k !== cos.curent);
    const nrEcran = (cos.curent ?? cos.pozitii.length) + 1;
    const carduri = altele.map(([x, k]) => `
      <div class="cos-produs">
        <div class="cos-produs-cap">
          <span class="cos-produs-nr">${k + 1}</span>
          <strong>${esc(gameJson.game.find(g => g.id === x.gama)?.label ?? x.pozitie.eticheta)}</strong>
          <span class="cos-produs-spatiu"></span>
          <button type="button" class="mic" data-modifica="${k}">Modifică</button>
          <button type="button" class="mic" data-scoate="${k}" aria-label="Scoate produsul ${k + 1} din ofertă">✕</button>
        </div>
        <dl class="cos-produs-det">${detalii(x.pozitie).filter(([, v]) => v != null && v !== '')
          .map(([e, v]) => `<div><dt>${esc(e)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      </div>`).join('');
    const sus = altele.length ? `${carduri}
      <div class="cos-ecran"><span class="cos-produs-nr">${nrEcran}</span>
        ${esc(gameJson.game.find(g => g.id === gamaEcran())?.label ?? 'Produsul de pe ecran')} — se configurează acum, mai jos</div>` : '';
    if (produse) produse.innerHTML = sus;
    el.innerHTML = `
      ${produse ? '' : sus}
      <div class="cos-game">${gameJson.game.map(g =>
        `<button type="button" data-gama="${esc(g.id)}">+ ${esc(g.label)}</button>`).join('')}</div>
      ${facturareInCard && t.pozitii?.length > 1 ? `<div class="cos-fact"><span class="dim mic">Facturare comasată, toată oferta: ${facturare.length} linii</span>
        <button type="button" class="mic" data-copiaza="cod">Copiază coduri</button>
        <button type="button" class="mic" data-copiaza="cant">Copiază cantităţi</button></div>` : ''}
      <div class="cos-msg"></div>`;
    const cutii = [el, ...(produse ? [produse] : [])];
    const toti = sel => cutii.flatMap(c => [...c.querySelectorAll(sel)]);
    toti('[data-gama]').forEach(b => b.addEventListener('click', () => {
      if (pune()) { pleaca(); location.href = url(b.dataset.gama); }
    }));
    toti('[data-modifica]').forEach(b => b.addEventListener('click', () => {
      const k = +b.dataset.modifica;
      const gama = cos.pozitii[k].gama;
      if (pune()) { pleaca(); location.href = url(gama, { poz: k }); }
    }));
    toti('[data-scoate]').forEach(b => b.addEventListener('click', async () => {
      const k = +b.dataset.scoate;
      if (!(await confirma(`Scoţi din ofertă: ${descriere(cos.pozitii[k].pozitie)}?`, 'Scoate'))) return;
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
    toti('[data-copiaza]').forEach(b => b.addEventListener('click', () => {
      const r = facturare.map(l => [b.dataset.copiaza === 'cod' ? l.cod : qtyText(l.cantitate)]);
      copyRows(r).then(ok => { const o = b.textContent; b.textContent = ok ? '✓ copiat' : '⚠ eroare'; setTimeout(() => { b.textContent = o; }, 1400); });
    }));
  }
  actualizeaza();
  return { actualizeaza };
}
