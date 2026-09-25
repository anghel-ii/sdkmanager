import { state } from './state.js';
import { systems } from './systems/registry.js';
import { ORIZONTALE_U, stareUtilGoala } from './lib/util/util.js';

// ═══════════════════════════════════════════════════════════════════════════
//  UI UTIL — opţiunea comună tuturor uşilor: profilul orizontal U (comutator,
//  acelaşi stil ca la Confort). Montajul, amortizările, divizările, înălţimile
//  panourilor şi divizările aplicate sunt pe cardul fiecărei uşi (renderWheels
//  în ui.js, ca la Confort).
// ═══════════════════════════════════════════════════════════════════════════

export function renderUtil(box, { rebuild }) {
  if (!box || systems[state.system]?.meta.family !== 'util') return;
  const u = (state.util = { ...stareUtilGoala(), ...(state.util ?? {}) });

  box.innerHTML = `
    <div class="rame-camp"><span class="rame-et">Orizontal U</span>
      <div class="segmented mini util-u">${ORIZONTALE_U.map(([v, t]) =>
        `<button data-v="${v}"${u.orizontale === v ? ' class="active"' : ''}>${t}</button>`).join('')}</div></div>`;

  box.querySelectorAll('.util-u button').forEach(btn => btn.addEventListener('click', () => {
    u.orizontale = btn.dataset.v;
    box.querySelectorAll('.util-u button').forEach(b => b.classList.toggle('active', b === btn));
    rebuild();
  }));
}
