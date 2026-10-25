// ── Fişele de atelier: VEZI (oricând) şi PRINTEAZĂ (doar comenzi) — userul, 2026-10-21 ──
// „Printează fişa" a devenit peste tot „Vezi fişa": o previzualizare în aplicaţie, fără print.
// Fişa se printează doar când oferta devine comandă („Acceptă comanda şi printează", „Plată primită
// şi printează", „Salvează comanda şi printează") şi, la comenzi, cu „Printează din nou".
//
// Fişa o face configuratorul, într-un cadru: /configurator/?fisa=<id>&poz=<k>[&vezi=1]. Mesajele lui
// (postMessage, aceeaşi origine): {tip:'fisa', eroare} = fişa e gata (sau n-a mers); {tip:'fisa-tiparita'}
// = s-a închis dialogul de print; {tip:'fisa-inchide'} = s-a închis previzualizarea.
// Folosit de pagina principală a managerului şi de configurator (/configurator, /configurator/amanunt.html);
// întrebările — din /dialog.js.
(() => {
  // `extra` = {plata, telefon, adresa} aleşi la acceptare, încă nesalvaţi — fişa îi pune peste ai comenzii
  const cadru = (id, poz, vezi, extra = {}) => {
    document.getElementById('cadruFisa')?.remove();
    const f = document.createElement('iframe');
    f.id = 'cadruFisa';
    f.setAttribute('aria-hidden', 'true');
    // nu display:none — configuratorul are nevoie de un cadru „viu" (3D, print)
    f.style.cssText = 'position:fixed; left:-10000px; top:0; width:1200px; height:900px; border:0; visibility:hidden';
    const alese = new URLSearchParams(Object.entries(extra).filter(([, v]) => v)).toString();
    f.src = `/configurator/?fisa=${encodeURIComponent(id)}&poz=${poz}${vezi ? '&vezi=1' : ''}${alese ? '&' + alese : ''}`;
    document.body.appendChild(f);
    return f;
  };
  // următorul mesaj de unul din `tipuri` (de la configurator / fişă)
  const mesaj = tipuri => new Promise(gata => {
    const h = e => {
      if (e.origin !== location.origin || !tipuri.includes(e.data?.tip)) return;
      removeEventListener('message', h);
      gata(e.data);
    };
    addEventListener('message', h);
  });
  const ocupat = (buton, da) => {
    if (!buton) return;
    if (da) { buton.dataset.text ??= buton.textContent; buton.disabled = true; buton.textContent = 'Se pregăteşte…'; }
    else { buton.disabled = false; buton.textContent = buton.dataset.text; }
  };
  const spune = text => (typeof alerta === 'function' ? alerta(text) : alert(text));

  // Previzualizarea: cadrul configuratorului se face vizibil peste toată pagina (fişa e acolo, în fereastra
  // de previzualizare); „Închide" / Esc din ea îl scoate.
  async function vezi(id, poz = 0, buton = null) {
    ocupat(buton, true);
    const f = cadru(id, poz, true);
    const r = await mesaj(['fisa']);
    ocupat(buton, false);
    if (r.eroare) { f.remove(); return spune(r.eroare); }
    f.removeAttribute('aria-hidden');
    f.style.cssText = 'position:fixed; inset:0; width:100%; height:100%; border:0; z-index:3000; background:transparent';
    f.focus();
    window.noteazaVazut?.('A văzut fişa', id, poz > 0 ? `produsul ${poz + 1}` : null);
    await mesaj(['fisa-inchide']);
    f.remove();
  }

  // Dialogul de print pt. o fişă; null după ce s-a închis dialogul, sau textul erorii.
  async function printeaza(id, poz = 0, extra = {}) {
    // „s-a închis dialogul" se ascultă de la început: poate veni şi înaintea lui „fişa e gata"
    const tiparita = mesaj(['fisa-tiparita']);
    const f = cadru(id, poz, false, extra);
    const r = await mesaj(['fisa']);
    if (r.eroare) { f.remove(); return r.eroare; }
    await tiparita;
    f.remove();
    return null;
  }

  // `fise` = câte fişe (0..n-1) sau lista produselor (poz) de printat — ex. doar cele adăugate după
  // primul print (userul, 2026-10-22)
  const lista = fise => (Array.isArray(fise) ? fise : Array.from({ length: fise }, (_, k) => k));

  // Fişele comenzii (una pe produs), apoi O întrebare. true doar la „Da, am printat".
  async function printeazaToate(id, fise = 1, buton = null, extra = {}) {
    const poz = lista(fise), n = poz.length;
    ocupat(buton, true);
    try {
      for (const k of poz) {
        const eroare = await printeaza(id, k, extra);
        if (eroare) { await spune(eroare); return false; }
      }
    } finally { ocupat(buton, false); }
    const ce = n > 1 ? `toate cele ${n} fişe` : 'fişa';
    const da = await intreabaObligatoriu(`Ai printat ${ce}?\n\nDacă da, rămâne notat la comandă că ${n > 1 ? 'au fost printate' : 'a fost printată'} acum, de tine.`,
      'Da, am printat', 'Nu, n-am printat');
    if (!da) window.noteazaVazut?.('Print neconfirmat — a răspuns „Nu, n-am printat"', id);   // „Da" îl notează serverul (Fişa printată)
    return da;
  }

  // Notează la comandă printarea fişelor (0..n-1 sau lista lor) — rândul „Fişa printată"
  const noteaza = (id, fise = 1) => Promise.all(lista(fise).map(poz =>
    fetch(`/api/comenzi/${id}/fisa`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poz }) })));

  window.Fise = { vezi, printeaza, printeazaToate, noteaza };
})();
