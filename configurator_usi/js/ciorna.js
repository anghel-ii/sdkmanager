import { stareOferta } from './manager.js';

// ═══════════════════════════════════════════════════════════════════════════
//  CIORNE (userul, 2026-10-13) — oferta începută şi nesalvată se păstrează SINGURĂ
//  ca ciornă când pleci din pagină (bara de sus, înapoi, F5, închiderea tabului) —
//  fără întrebări; doar „Goleşte pagina" întreabă (şi aruncă ciorna). Ciornele stau
//  DOAR în browserul ăsta (localStorage, nu pleacă la server) şi cel mult 48 de ore;
//  se reiau din pagina principală, din dreapta plăcii gamei („Ofertă nouă")
//  (→ /configurator/?ciorna=<id>). Ciorna = coşul (cos.js) + ecranul paginii.
// ═══════════════════════════════════════════════════════════════════════════

const CHEIE = 'ciornaEcran';
// ciornele: [{ id, uid, gama, titlu, client, la (ms), date: { cos, ecran } }] — aceeaşi cheie o citeşte
// pagina principală a managerului (web/manager/index.html), doar pe ale contului logat (uid)
const LISTA = 'ciorne', VIATA_MS = 48 * 3600e3, MAX = 10;
export function toate() {
  try { return JSON.parse(localStorage.getItem(LISTA) || '[]').filter(c => Date.now() - c.la < VIATA_MS); } catch { return []; }
}
const sterge = id => { try { localStorage.setItem(LISTA, JSON.stringify(toate().filter(c => c.id !== id))); } catch { /* fără */ } };
let voita = false;   // plecare cerută de pagină (salvare, alt produs din coş, Goleşte) — fără ciornă
let baza = null;     // ce era pe ecran la ultima păstrare / la pornire (oferta deschisă, ciorna reluată, neatinse)
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

// „Goleşte pagina" (după confirmare): ce era pe ecran se aruncă, cu tot cu ciorna lui. Produsele
// rămase în coş (alte pagini ale ofertei) rămân nesalvate → la plecare devin o ciornă nouă.
export function goleste() {
  voita = true;
  if (!p) return;
  if (p.cos.ciornaId) sterge(p.cos.ciornaId);
  p.cos.ciornaId = null;
  p.cos.modificat = p.cos.pozitii.length > 0;
}

// la plecare — fără alert/confirm (pagina se închide); memoria plină = fără ciornă
function salveaza() {
  const id = p.cos.ciornaId ?? String(Date.now());
  const c = { id, uid: stareOferta().utilizator?.id, gama: p.gama(), titlu: p.titlu(), client: p.client().client?.nume?.trim(), la: Date.now(),
              date: { cos: { ...p.cos, ...p.client(), modificat: false, ciornaId: undefined }, ecran: p.ecran() } };
  try { localStorage.setItem(LISTA, JSON.stringify([c, ...toate().filter(x => x.id !== id)].slice(0, MAX))); } catch { return; }
  // înapoi pe pagină (butonul Înapoi al browserului) = aceeaşi ciornă, actualizată, nu una nouă
  p.cos.ciornaId = id;
  p.cos.modificat = false;
  baza = semnatura();
}

export function init(pagina) {
  p = pagina;
  baza = semnatura();
  addEventListener('pagehide', () => { if (!voita && modificata()) salveaza(); });
  addEventListener('pageshow', e => { if (e.persisted) voita = false; });   // revenit cu Înapoi: lucrul continuă
}
