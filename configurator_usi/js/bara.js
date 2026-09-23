// ═══════════════════════════════════════════════════════════════════════════
//  BARA LATERALĂ REDIMENSIONABILĂ (userul, 2026-09-23)
//
//  Mânerul de pe marginea din dreapta a barei: tragi cu mouse-ul (sau, cu el
//  selectat din tastatură, săgeţile stânga/dreapta); dublu-click = înapoi la
//  lăţimea implicită (cea din CSS, 40% din fereastră).
//
//  Lăţimea aleasă e a UTILIZATORULUI: deschis din manager şi logat, se ţine pe
//  contul lui (/api/preferinte, cheia latimeBara) şi îl urmează pe orice
//  calculator. Fără manager (pagina publică) nu există cont — atunci rămâne
//  în browser (localStorage).
// ═══════════════════════════════════════════════════════════════════════════

const CHEIE = 'configurator.latimeBara';
const MIN = 380;   // px — sub atât tabelele din bară ies în afară (verificat)
const max = () => Math.round(window.innerWidth * 0.7);
const limiteaza = w => Math.min(max(), Math.max(MIN, Math.round(w)));

const citesteLocal = () => { try { return Number(localStorage.getItem(CHEIE)) || null; } catch { return null; } };
const scrieLocal = w => { try { w ? localStorage.setItem(CHEIE, String(w)) : localStorage.removeItem(CHEIE); } catch {} };

// Preferinţa contului, sau `undefined` dacă nu suntem logaţi într-un manager.
async function citesteCont() {
  try {
    const r = await fetch('/api/preferinte', { headers: { Accept: 'application/json' } });
    if (!r.ok) return undefined;
    return (await r.json()).latimeBara ?? null;
  } catch { return undefined; }
}

export async function initBara() {
  const bara = document.getElementById('sidebar');
  const maner = document.getElementById('sidebarResize');
  if (!bara || !maner) return;

  const pune = w => {
    if (w == null) { bara.style.width = ''; bara.style.minWidth = ''; }
    else { bara.style.width = `${limiteaza(w)}px`; bara.style.minWidth = '0'; }
    maner.setAttribute('aria-valuenow', String(Math.round(bara.getBoundingClientRect().width)));
  };
  const deLaCont = await citesteCont();
  const peCont = deLaCont !== undefined;
  pune(peCont ? deLaCont : citesteLocal());

  // salvare: pe cont (o singură cerere după ce te-ai oprit) sau în browser
  let amanat = null;
  const scrie = w => {
    if (!peCont) return scrieLocal(w);
    clearTimeout(amanat);
    amanat = setTimeout(() => fetch('/api/preferinte', { method: 'PUT',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latimeBara: w }) }).catch(() => {}), 400);
  };

  // tras cu mouse-ul / degetul
  maner.addEventListener('pointerdown', e => {
    e.preventDefault();
    maner.setPointerCapture(e.pointerId);
    document.body.classList.add('redimensionare');
    const start = e.clientX, latimeStart = bara.getBoundingClientRect().width;
    const muta = ev => pune(latimeStart + ev.clientX - start);
    const gata = () => {
      maner.removeEventListener('pointermove', muta);
      document.body.classList.remove('redimensionare');
      scrie(limiteaza(bara.getBoundingClientRect().width));
    };
    maner.addEventListener('pointermove', muta);
    maner.addEventListener('pointerup', gata, { once: true });
    maner.addEventListener('pointercancel', gata, { once: true });
  });

  // dublu-click = lăţimea implicită
  maner.addEventListener('dblclick', () => { pune(null); scrie(null); });

  // tastatură (mânerul are tabindex): ←/→ câte 20 px
  maner.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const w = bara.getBoundingClientRect().width + (e.key === 'ArrowRight' ? 20 : -20);
    pune(w);
    scrie(limiteaza(w));
  });

  // fereastra micşorată → bara nu trece de 70% din ea
  window.addEventListener('resize', () => { if (bara.style.width) pune(bara.getBoundingClientRect().width); });
}
