import catalog from '../../catalog/catalog.generated.json';

// ── Finisaje (culori profil) ─────────────────────────────────────────────────
// `id` = string-ul EXACT folosit în coloana `finisaj` din catalog.
// Un sistem cu alt set îl declară direct în `meta.finishes`.

export const FINISAJE_STANDARD = [
  { id: 'ALUMINIU',        label: 'Aluminiu',        hex: '#c4c8ca' },
  { id: 'NEGRU MAT',       label: 'Negru mat',       hex: '#2a2a2c' },
  { id: 'SAMPANIE LUCIOS', label: 'Șampanie lucios', hex: '#cabb92' },
  { id: 'AURIU PERIAT',    label: 'Auriu periat',    hex: '#b89a4e' },
  { id: 'CUPRU',           label: 'Cupru',           hex: '#a05a3c' },
];

// Confort — coduri de finisaj din catalogul propriu (js/catalog/confort*.seed.sql),
// diferite de cele „standard" (ALB în loc de nimic, NEGRU/SAMPANIE/AURIU fără
// sufix). ALB nu există la familia suspendata.
// LUX — culorile din „Calculator profile LUX 2025.xlsx" / NeoManager; CROM există doar aici.
// Breda auriu periat nu există (nici foaie în Excel, nici coduri) — catalogul o ascunde.
export const FINISAJE_LUX = [
  { id: 'ALUMINIU', label: 'Aluminiu',        hex: '#c4c8ca' },
  { id: 'SAMPANIE', label: 'Şampanie lucios', hex: '#d3c49a' },
  { id: 'CROM',     label: 'Crom lucios',     hex: '#dfe3e6' },
  { id: 'ALB',      label: 'Alb mat',         hex: '#eceeef' },
  { id: 'NEGRU',    label: 'Negru mat',       hex: '#2a2a2c' },
  { id: 'AURIU',    label: 'Auriu periat',    hex: '#b89a4e' },
  { id: 'CUPRU',    label: 'Cupru periat',    hex: '#a05a3c' },   // doar Vent (foaia DB din Excel)
];

export const FINISAJE_CONFORT = [
  { id: 'ALUMINIU', label: 'Aluminiu', hex: '#c4c8ca' },
  { id: 'ALB',      label: 'Alb',      hex: '#eceeef' },
  { id: 'NEGRU',    label: 'Negru periat', hex: '#2a2a2c' },
  { id: 'SAMPANIE', label: 'Șampanie', hex: '#cabb92' },
  { id: 'AURIU',    label: 'Auriu periat', hex: '#b89a4e' },
  { id: 'CUPRU',    label: 'Cupru',    hex: '#a05a3c' },
];

// ── Finisaje efectiv disponibile, derivate din CATALOG ──────────────────────
// Lista declarată în `meta.finishes` spune ce culori există în gamă; catalogul
// spune pentru care avem coduri. Un finisaj pe care catalogul nu-l acoperă
// complet dădea „lipsă cod" la facturare şi rânduri fără cod în necesar — mai
// bine nu i se arată deloc swatch-ul.
//
// „Acoperit complet" = are cod pentru FIECARE tip de articol din catalogul
// sistemului (profil vertical, orizontal, şină, ...). Un finisaj populat pe
// jumătate (doar profilele, fără şină) rămâne ascuns.
// Catalog gol / niciun finisaj acoperit → cade pe lista declarată, ca app-ul
// să rămână folosibil cât timp catalogul e în lucru.

const _cache = new Map();

// Tipuri de articol OPŢIONALE — există doar în unele culori şi nu decid dacă o
// culoare se oferă (ex. divizarea H la Confort lipseşte la AURIU/CUPRU; acolo
// doar nu se oferă opţiunea H, vezi areCodH în lib/confort/confort.js).
// divizarea T lipseşte la cupru — culoarea se oferă oricum, doar divizarea T dă „lipsă cod"
const TIPURI_OPTIONALE = new Set(['divizare', 'divizare aplicata 10', 'divizare aplicata 20']);

function finisajeDinCatalog(meta, declarate) {
  const family = meta?.catalog ?? meta?.family;
  const rows   = family ? (catalog[family] ?? []) : [];
  if (!rows.length) return declarate;

  const tipuri = [...new Set(rows.map(a => a.tip))].filter(t => !TIPURI_OPTIONALE.has(t));
  const acopera = id => tipuri.every(tip =>
    rows.some(a => a.tip === tip && (a.finisaj == null || a.finisaj === id)));

  const ok = declarate.filter(f => acopera(f.id));
  return ok.length ? ok : declarate;
}

export function finishesOf(meta) {
  const declarate = meta?.finishes ?? FINISAJE_STANDARD;
  if (!meta?.id) return declarate;
  if (!_cache.has(meta.id)) _cache.set(meta.id, finisajeDinCatalog(meta, declarate));
  return _cache.get(meta.id);
}

// Finisajul curent (cu fallback pe primul din listă) — hex pentru randare.
export function finishHex(meta, state) {
  const list = finishesOf(meta);
  return (list.find(f => f.id === state.finish) ?? list[0]).hex;
}
