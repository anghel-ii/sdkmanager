// Copiere în clipboard pt. paginile managerului — doar text/plain (HTML-ul
// încurca NeoManager la paste; vezi configurator_usi/js/lib/clipboard.js).
// navigator.clipboard merge DOAR pe HTTPS / localhost — managerul rulează pe
// http://<IP din reţea>, deci acolo lipseşte şi cădem pe metoda veche
// (textarea + execCommand), care merge şi pe HTTP.
async function copiazaText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; } catch {}
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  ta.remove();
  return ok;
}
