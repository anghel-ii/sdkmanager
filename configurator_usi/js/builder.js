import { state }        from './state.js';
import { systems }       from './systems/registry.js';
import { clearGroup, conturGol } from './lib/comun/geo.js';
import { familia }       from './familii.js';
import { liniaTransport } from './lib/comun/comanda.js';

// Culorile oferite pt. un sistem (filtrate după catalog) — expuse aici ca
// testele să nu depindă de unde stau bibliotecile familiilor.
export { finishesOf } from './familii.js';

let _doorGroup;
let _controls;
let _spec = null;   // spec-ul modelului curent (calculat o singură dată / rebuild)

export function initBuilder(doorGroup, controls) {
  _doorGroup = doorGroup;
  _controls  = controls;
}

export function buildConfig() {
  clearGroup(_doorGroup);

  const sys = systems[state.system];
  if (!sys) { console.warn(`Sistem necunoscut: ${state.system}`); return null; }

  // Flow per model:  spec(state) → build(spec).  Aceeaşi sursă şi pentru readout/BOM.
  _spec = sys.spec(state);
  // nr. de uşi încă neales (Confort): doar conturul golului, nu uşi „implicite"
  if (sys.meta.doorsRange && !(state.doors > 0)) conturGol(_doorGroup, state.width, state.height);
  else sys.build(_doorGroup, state, _spec);

  // gama rame n-are gol: ţinta camerei = jumătatea celei mai înalte rame
  _controls.target.set(0, (sys.meta.rame ? Math.max(_spec.opening.h, 800) : state.height) / 2000, 0);
  return _spec;
}

export const currentSpec = () => _spec;

export function currentBom() {
  const sys = systems[state.system];
  return (sys && _spec) ? sys.bom(state, _spec) : [];
}

// Necesarul CLIENTULUI — panourile pe care şi le procură singur (PAL la orice
// uşă, geam la uşile pe care le asamblează el). Generic pentru toate sistemele,
// derivat doar din spec.glass + state, deci nu trece prin bom()-ul sistemului.
export function currentClientPanels() {
  if (!_spec) return [];
  const sys = systems[state.system];
  return sys?.clientPanels ? sys.clientPanels(state, _spec) : (familia(sys)?.clientPanelRows(_spec, state) ?? []);
}

// Sticla pe care o COMANDĂM noi la furnizor (doar uşile / ramele asamblate de
// noi — la cele asamblate de client, geamul şi-l ia el): { cod, denumire, h, l,
// buc }, grupat pe cod + cotă. Merge la manager la salvarea ofertei (lista
// „sticla") şi de acolo în pagina „Comandă sticlă".
export function currentSticla() {
  const sys = systems[state.system];
  if (!sys || !_spec) return [];
  if (sys.sticlaComanda) return sys.sticlaComanda(state, _spec);
  return familia(sys)?.sticlaDeComandat(_spec, state) ?? [];
}

// Linii de facturare pentru grila NeoManager: { lines, errors, mode }
// Cotele greşite de panouri (opţiuni avansate: suma înălţimilor nu dă uşa)
// intră la erori: cu ele, geamul facturat şi cotele din atelier ar fi greşite,
// deci blochează la fel ca un cod lipsă — copierea în NeoManager şi salvarea.
export function currentBilling() {
  const sys = systems[state.system];
  if (!(sys && _spec && familia(sys))) return { lines: [], errors: [], mode: null };
  let f = familia(sys).billingLines(sys, state, _spec);
  // transportul — al comenzii, la toate gamele (doar dacă există ce factura)
  const transport = liniaTransport(state);
  if (transport && f.lines.length) f = { ...f, lines: [...f.lines, { ...transport }] };
  const panouri = (_spec.glass?.panels ?? [])
    .map((p, i) => p.eroare && `uşa ${i + 1}: ${p.eroare}`).filter(Boolean);
  return panouri.length ? { ...f, errors: [...f.errors, ...panouri] } : f;
}
