import { stareOferta } from './manager.js';

// ═══════════════════════════════════════════════════════════════════════════
//  CIORNE (userul, 2026-10-13) — oferta începută şi nesalvată. La plecarea din
//  pagină pe bara de sus (Comenzi, Ofertă nouă, Taskuri, …) întrebăm:
//  „Salvează ca ciornă" / „Renunţă la ea" / „Rămâi aici". Ciorna stă la manager
//  (server/ciorne.js), pe contul omului; o reia din pagina principală („Ciornele
//  mele" → /configurator/?ciorna=<id>). Ciorna = coşul (cos.js) + ecranul paginii.
//  F5 / închiderea tabului: browserul arată doar întrebarea lui („Părăseşti site-ul?").
// ═══════════════════════════════════════════════════════════════════════════

const CHEIE = 'ciornaEcran';
let voita = false;   // plecare cerută de pagină (salvare, alt produs din coş) — fără întrebare
let baza = null;     // ce era pe ecran la pornire: oferta deschisă / ciorna reluată, neatinse, nu se întreabă
let p = null;        // { pagina, cos, ecran, client, areContinut, titlu, gama } — de la pagină

export const pleaca = () => { voita = true; };
const semnatura = () => JSON.stringify([p.ecran(), p.client()]);

// ceva început şi neatins de la salvare? (cos.modificat vine de pe paginile de dinainte, prin coş)
export const modificata = () => !!p && stareOferta().stare === 'logat' && p.areContinut()
  && (!!p.cos.modificat || semnatura() !== baza);

// ?ciorna=<id> → { cos, gama } (ecranul aşteaptă în sessionStorage pagina gamei) sau { eroare }
export async function reia(id) {
  try {
    const r = await fetch('/api/ciorne/' + encodeURIComponent(id), { headers: { Accept: 'application/json' } });
    if (!r.ok) return { eroare: r.status === 401 ? 'Autentifică-te ca să reiei ciorna.' : 'Ciorna nu (mai) există.' };
    const { ciorna } = await r.json();
    sessionStorage.setItem(CHEIE, JSON.stringify(ciorna.date.ecran));
    return { cos: { ...ciorna.date.cos, ciornaId: ciorna.id, modificat: false }, gama: ciorna.gama };
  } catch {
    return { eroare: 'Managerul nu răspunde.' };
  }
}
// ecranul ciornei reluate — o singură dată, apoi null
export function ecranReluat() {
  try { const e = sessionStorage.getItem(CHEIE); sessionStorage.removeItem(CHEIE); return e ? JSON.parse(e) : null; } catch { return null; }
}

// oferta s-a salvat de-adevăratelea: ciorna din care venea nu mai trebuie
export function gata() {
  voita = true;
  if (p?.cos.ciornaId) fetch('/api/ciorne/' + p.cos.ciornaId, { method: 'DELETE', keepalive: true }).catch(() => {});
}

async function salveaza() {
  try {
    const r = await fetch('/api/ciorne', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      id: p.cos.ciornaId, pagina: p.pagina, gama: p.gama(), titlu: p.titlu(),
      date: { cos: { ...p.cos, ...p.client(), modificat: false, ciornaId: undefined }, ecran: p.ecran() } }) });
    if (r.ok) return true;
  } catch { /* mai jos */ }
  alert('Ciorna nu s-a putut salva (managerul nu răspunde). Rămâi pe pagină şi mai încearcă.');
  return false;
}

// „Salvează ca ciornă" | „Renunţă la ea" | „Rămâi aici" (şi Esc) → 'ciorna' | 'renunta' | ''
function intreaba() {
  return new Promise(raspuns => {
    const d = document.createElement('dialog');
    d.className = 'dialog-plata dialog-ciorna';
    d.innerHTML = `<form method="dialog">
      <h3>Oferta nu e salvată</h3>
      <p class="dim mic">O păstrezi ca ciornă? O găseşti apoi în pagina principală, la „Ciornele mele".</p>
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
    if (!r || (r === 'ciorna' && !(await salveaza()))) return;
    voita = true;
    el.click();
  }, true);
  addEventListener('beforeunload', e => { if (!voita && modificata()) e.preventDefault(); });
}
