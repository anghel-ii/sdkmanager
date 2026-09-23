// ── Copiere STRICT text simplu (fără HTML) ───────────────────────────────────
// Confirmat: dacă relayezi prin Notepad (care pune pe clipboard DOAR text,
// niciun HTML), paste-ul în NeoManager merge. Deci flavour-ul text/html pe care
// îl puneam pe clipboard (ca să imite Excel) era exact ce încurca NeoManager —
// nu textul propriu-zis. Aici NU mai punem deloc text/html, doar text/plain,
// la fel ca Notepad.
//
// Merge şi peste HTTP simplu (fără HTTPS/localhost) — fallback-ul cu textarea +
// execCommand nu are nevoie de context securizat.

export async function copyRows(rows) {
  const plain = rows.map(r => r.join('\t')).join('\r\n') + '\r\n';

  // 1) API modern — DOAR text/plain (context securizat: HTTPS/localhost)
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(plain);
      return true;
    } catch (e) {
      // cade pe fallback
    }
  }

  // 2) fallback: textarea ascuns, selectat şi copiat cu execCommand — produce
  //    tot text simplu, fără HTML, la fel ca un copy din Notepad.
  const ta = document.createElement('textarea');
  ta.value = plain;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, plain.length);

  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  document.body.removeChild(ta);
  return ok;
}
