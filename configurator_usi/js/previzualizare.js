// ═══════════════════════════════════════════════════════════════════════════
//  PREVIZUALIZAREA FIŞEI — „Vezi fişa" (userul, 2026-10-21): fişa apare într-o
//  fereastră din aplicaţie, pagină cu pagină (foi albe pe fundal gri), FĂRĂ print:
//  nu are buton de print, iar Ctrl+P scoate o pagină goală. Fişa se printează
//  doar când oferta devine comandă (vezi /fise.js din manager).
//
//  `html` = documentul fişei, întreg; `pagini` = selectorul foilor din el
//  (fiecare se desenează ca o foaie A4). Deschisă într-un cadru al managerului
//  (?vezi=1), „Închide" îi spune managerului să scoată cadrul.
// ═══════════════════════════════════════════════════════════════════════════

const STIL = `
#previzualizare { position: fixed; inset: 0; z-index: 5000; display: flex; flex-direction: column; background: rgba(10, 12, 15, .72); }
#previzualizare .pv-bara { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: var(--panel); border-bottom: 1px solid var(--line);
  font-family: 'Inter', sans-serif; font-size: 13px; color: var(--text-dim); }
#previzualizare .pv-bara b { color: var(--text); font-size: 14px; font-weight: 600; }
#previzualizare .pv-bara .pv-spatiu { flex: 1; }
#previzualizare .pv-bara button { font: inherit; font-size: 13px; padding: 7px 14px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--line); background: var(--panel-2); color: var(--text); }
#previzualizare .pv-bara button:hover { background: var(--hover); }
#previzualizare iframe { flex: 1; width: 100%; border: 0; background: transparent; }
@media print { body.pv-deschis > * { display: none !important; } }`;

// în documentul fişei: foile pe fundal gri, cu umbră; la print — nimic
const stilFoi = pagini => `<style>
@media screen {
  html { background: #6b717b; }
  body { width: 210mm; margin: 0 auto !important; padding: 8mm 0 !important; background: transparent !important; }
  ${pagini} { background: #fff; box-shadow: 0 2px 14px rgba(0, 0, 0, .35); margin: 0 0 8mm; min-height: 297mm; box-sizing: border-box; }
}
@media print { html { display: none !important; } }
</style>`;

export function arataPrevizualizare(html, { titlu = 'Fişa', pagini = 'body > div', nota = 'Doar de văzut — fişa se printează când oferta devine comandă.' } = {}) {
  if (!document.getElementById('stilPrevizualizare')) {
    const s = document.createElement('style');
    s.id = 'stilPrevizualizare';
    s.textContent = STIL;
    document.head.appendChild(s);
  }
  document.getElementById('previzualizare')?.remove();
  const el = document.createElement('div');
  el.id = 'previzualizare';
  el.innerHTML = `<div class="pv-bara"><b></b><span></span>
    <span class="pv-spatiu"></span><button type="button">Închide</button></div><iframe title="Previzualizarea fişei"></iframe>`;
  el.querySelector('b').textContent = titlu;
  el.querySelector('b + span').textContent = nota;
  const inchide = () => {
    el.remove();
    document.body.classList.remove('pv-deschis');
    removeEventListener('keydown', laEsc);
    if (window.parent !== window) window.parent.postMessage({ tip: 'fisa-inchide' }, location.origin);
  };
  const laEsc = e => { if (e.key === 'Escape') inchide(); };
  el.querySelector('button').addEventListener('click', inchide);
  addEventListener('keydown', laEsc);
  document.body.appendChild(el);
  document.body.classList.add('pv-deschis');
  const cadru = el.querySelector('iframe');
  const doc = cadru.contentWindow.document;
  doc.open();
  doc.write(html.replace('</head>', `${stilFoi(pagini)}</head>`));
  doc.close();
  // Esc şi din fişă (focusul e de obicei acolo)
  cadru.contentWindow.addEventListener('keydown', laEsc);
  el.querySelector('button').focus();
}
