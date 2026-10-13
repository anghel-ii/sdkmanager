import { stareOferta } from './manager.js';

// ═══════════════════════════════════════════════════════════════════════════
//  CIORNE (userul, 2026-10-13) — oferta începută şi nesalvată. La plecarea din
//  pagină pe bara de sus (Comenzi, Ofertă nouă, Taskuri, …) întrebăm:
//  „Salvează ca ciornă" / „Renunţă la ea" / „Rămâi aici". Ciornele stau DOAR în
//  browserul ăsta (localStorage, nu pleacă la server) şi cel mult 48 de ore; se reiau
//  din pagina principală, cu „Continuă ciorna" lângă butoanele gamelor
//  (→ /configurator/?ciorna=<id>). Ciorna = coşul (cos.js) + ecranul paginii.
//  F5 / închiderea tabului: browserul arată doar întrebarea lui („Părăseşti site-ul?").
// ═══════════════════════════════════════════════════════════════════════════

const CHEIE = 'ciornaEcran';
// ciornele: [{ id, uid, gama, titlu, la (ms), date: { cos, ecran } }] — aceeaşi cheie o citeşte
// pagina principală a managerului (web/manager/index.html), doar pe ale contului logat (uid)
const LISTA = 'ciorne', VIATA_MS = 48 * 3600e3, MAX = 10;
export function toate() {
  try { return JSON.parse(localStorage.getItem(LISTA) || '[]').filter(c => Date.now() - c.la < VIATA_MS); } catch { return []; }
}
const sterge = id => { try { localStorage.setItem(LISTA, JSON.stringify(toate().filter(c => c.id !== id))); } catch { /* fără */ } };
let voita = false;   // plecare cerută de pagină (salvare, alt produs din coş) — fără întrebare
let baza = null;     // ce era pe ecran la pornire: oferta deschisă / ciorna reluată, neatinse, nu se întreabă
let p = null;        // { cos, ecran, client, areContinut, titlu, gama } — de la pagină

export const pleaca = () => { voita = true; };
const semnatura = () => JSON.stringify([p.ecran(), p.client()]);

// ceva început şi neatins de la salvare? (cos.modificat vine de pe paginile de dinainte, prin coş)
export const modificata = () => !!p && stareOferta().stare === 'logat' && p.areContinut()
  && (!!p.cos.modificat || semnatura() !== baza);

// ?ciorna=<id> → { cos, gama } (ecranul aşteaptă în sessionStorage pagina gamei) sau { eroare }
export function reia(id) {
  const c = toate().find(x => x.id === id);
  if (!c) return { eroare: 'Ciorna nu mai există — ciornele se şterg după 48 de ore.' };
  try { sessionStorage.setItem(CHEIE, JSON.stringify(c.date.ecran)); } catch { /* fără ecran */ }
  return { cos: { ...c.date.cos, ciornaId: c.id, modificat: false }, gama: c.gama };
}
// ecranul ciornei reluate — o singură dată, apoi null
export function ecranReluat() {
  try { const e = sessionStorage.getItem(CHEIE); sessionStorage.removeItem(CHEIE); return e ? JSON.parse(e) : null; } catch { return null; }
}

// oferta s-a salvat de-adevăratelea: ciorna din care venea nu mai trebuie
export function gata() {
  voita = true;
  if (p?.cos.ciornaId) sterge(p.cos.ciornaId);
}

function salveaza() {
  const id = p.cos.ciornaId ?? String(Date.now());
  const c = { id, uid: stareOferta().utilizator?.id, gama: p.gama(), titlu: p.titlu(), la: Date.now(),
              date: { cos: { ...p.cos, ...p.client(), modificat: false, ciornaId: undefined }, ecran: p.ecran() } };
  try {
    localStorage.setItem(LISTA, JSON.stringify([c, ...toate().filter(x => x.id !== id)].slice(0, MAX)));
    return true;
  } catch {
    alert('Ciorna nu s-a putut păstra (memoria browserului e plină sau blocată). Rămâi pe pagină şi salvează oferta.');
    return false;
  }
}

// „Salvează ca ciornă" | „Renunţă la ea" | „Rămâi aici" (şi Esc) → 'ciorna' | 'renunta' | ''
function intreaba() {
  return new Promise(raspuns => {
    const d = document.createElement('dialog');
    d.className = 'dialog-plata dialog-ciorna';
    d.innerHTML = `<form method="dialog">
      <h3>Oferta nu e salvată</h3>
      <p class="dim mic">O păstrezi ca ciornă pe calculatorul ăsta? O reiei din pagina principală, cu „Continuă ciorna" —
        stă acolo 48 de ore.</p>
      <div class="dialog-butoane">
        <button value="" class="fisa-print">Rămâi aici</button>
        <button value="renunta" class="fisa-print">Renunţă la ea</button>
        <button value="ciorna" class="oferta-confirma">Salvează ca ciornă</button>
      </div></form>`;
    d.addEventListener('close', () => { d.remove(); raspuns(d.returnValue); });
    document.body.append(d);
    d.showModal();
    d.querySelector('.oferta-confirma').focus();
  });
}

export function init(pagina) {
  p = pagina;
  baza = semnatura();
  // plecarea din bara comună (bara.js): întâi întrebarea, apoi acelaşi clic, lăsat să treacă
  document.addEventListener('click', async e => {
    const el = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest('#bara a[href], #bara button') : null);
    if (!el || voita || !modificata()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const r = await intreaba();
    if (!r || (r === 'ciorna' && !salveaza())) return;
    if (r === 'renunta' && p.cos.ciornaId) sterge(p.cos.ciornaId);   // renunţi la oferta reluată → şi la ciorna ei
    voita = true;
    el.click();
  }, true);
  addEventListener('beforeunload', e => { if (!voita && modificata()) e.preventDefault(); });
}
