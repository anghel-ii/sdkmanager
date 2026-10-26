// ═══════════════════════════════════════════════════════════════════════════
//  SUGESTII SUB UN CÂMP DE TEXT, FĂRĂ DIACRITICE (userul, 2026-10-26: „ramnicu valcea"
//  să găsească „Râmnicu Vâlcea"). Înlocuieşte <datalist>: browserul îşi filtra singur
//  lista după textul scris, cu tot cu diacritice, deci ascundea exact ce căutai.
//  Aici ce se potriveşte hotărăşte pagina (`cauta`) — de regulă cu Sugestii.normal.
//
//    Sugestii.leaga(input, { cauta, alege })
//      cauta(text) → [{ text, sub? , ... }] (sau Promise) — ce se arată, în ordine
//      alege(element) → ce face pagina la alegere (clic, Enter, Tab pe cel ales)
//    Sugestii.normal(text) → fără diacritice (ş/ș, ţ/ț, ă, â, î), litere mici
//
//  Tastatura: ↑ ↓ prin listă, Enter / Tab alege, Esc o închide. Lista stă lipită
//  sub câmp (deasupra, dacă jos nu e loc) — şi într-un <dialog> deschis, unde se
//  pune în dialog, altfel n-ar fi deasupra lui.
// ═══════════════════════════════════════════════════════════════════════════
(() => {
  const normal = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const s = document.createElement('style');
  s.textContent = `.sugestii-lista { position: fixed; z-index: 3500; margin: 0; padding: 4px; list-style: none; max-height: 300px; overflow-y: auto;
      overscroll-behavior: contain; box-sizing: border-box; background: var(--panel, #1b1e24); color: var(--text, #e9ebee);
      border: 1px solid var(--line-2, #3a4049); border-radius: 9px; box-shadow: 0 12px 32px rgba(0, 0, 0, .35);
      font: 13.5px/1.35 'Inter', system-ui, sans-serif; text-transform: none; letter-spacing: 0; }
    .sugestii-lista[hidden] { display: none; }
    .sugestii-lista li { padding: 6px 9px; border-radius: 6px; cursor: pointer; }
    .sugestii-lista li small { display: block; font-size: 11.5px; color: var(--text-dim, #8b92a0); }
    .sugestii-lista li[aria-selected="true"] { background: var(--accent-dim, #1f6fd1); color: #fff; }
    .sugestii-lista li[aria-selected="true"] small { color: #dbe7f7; }`;
  document.head.appendChild(s);

  function leaga(input, { cauta, alege }) {
    if (!input || input._sugestii) return;
    input._sugestii = true;
    input.removeAttribute('list');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-autocomplete', 'list');
    const ul = document.createElement('ul');
    ul.className = 'sugestii-lista';
    ul.setAttribute('role', 'listbox');
    ul.hidden = true;
    let gasite = [], ales = -1, cerere = 0;

    const inchide = () => { ul.hidden = true; ales = -1; };
    const aseaza = () => {
      (input.closest('dialog[open]') ?? document.body).appendChild(ul);   // într-un dialog: în el, altfel e sub el
      const r = input.getBoundingClientRect();
      ul.style.left = `${r.left}px`;
      ul.style.minWidth = `${Math.max(r.width, 220)}px`;
      ul.style.maxWidth = `${Math.max(r.width, 420)}px`;
      const jos = innerHeight - r.bottom;
      if (jos < 220 && r.top > jos) { ul.style.top = ''; ul.style.bottom = `${innerHeight - r.top + 4}px`; }
      else { ul.style.bottom = ''; ul.style.top = `${r.bottom + 4}px`; }
    };
    const marcheaza = i => {
      ales = i;
      [...ul.children].forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
      ul.children[i]?.scrollIntoView({ block: 'nearest' });
    };
    const arata = async () => {
      const nr = ++cerere;
      const r = await cauta(input.value);
      if (nr !== cerere || document.activeElement !== input) return;   // între timp s-a mai scris / s-a plecat
      gasite = r ?? [];
      if (!gasite.length) return inchide();
      ul.innerHTML = gasite.map((g, k) => `<li role="option" data-k="${k}">${esc(g.text)}${g.sub ? `<small>${esc(g.sub)}</small>` : ''}</li>`).join('');
      aseaza();
      ul.hidden = false;
      marcheaza(input.value.trim() ? 0 : -1);   // cu text scris, primul e gata de ales (Enter)
    };
    const alegeK = k => { const g = gasite[k]; inchide(); if (g) alege(g); };

    input.addEventListener('input', e => { if (e.isTrusted) arata(); });   // nu şi la ce scrie pagina singură (ex. alegerea)
    input.addEventListener('focus', arata);
    input.addEventListener('blur', () => setTimeout(inchide, 120));
    input.addEventListener('keydown', e => {
      if (ul.hidden) { if (e.key === 'ArrowDown') { e.preventDefault(); arata(); } return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        marcheaza(Math.max(0, Math.min(gasite.length - 1, ales + (e.key === 'ArrowDown' ? 1 : -1))));
      } else if ((e.key === 'Enter' || e.key === 'Tab') && ales >= 0) {
        if (e.key === 'Enter') e.preventDefault();   // Enter alege — nu trimite formularul, nu trece la câmpul următor
        alegeK(ales);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();   // Esc închide lista, nu fereastra în care e câmpul
        inchide();
      }
    });
    // mousedown, nu click: câmpul nu pierde focusul înainte de alegere
    ul.addEventListener('mousedown', e => {
      const li = e.target.closest('li[data-k]');
      e.preventDefault();
      if (li) alegeK(+li.dataset.k);
    });
    addEventListener('scroll', () => { if (!ul.hidden) aseaza(); }, true);
    addEventListener('resize', () => { if (!ul.hidden) aseaza(); });
  }

  window.Sugestii = { leaga, normal };
})();
