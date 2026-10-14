// Calculele ofertei cu amănuntul — căutarea în produse (js/catalog/amanunt.json)
// şi debitarea pe bare — separate de pagină, ca să le verifice şi testul (fără browser).

// fără diacritice şi litere mari: „mâner" găseşte „Maner"
export const normal = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ghilimelele şi semnele nu contează: „Gola ''C''" → „gola c" (cifrele cu virgulă rămân: „4,2")
const curat = t => normal(t).replace(/[^a-z0-9,.]+/g, ' ').trim();

// Fiecare cuvânt scris trebuie să apară în denumire sau în cod, în orice ordine:
// „maner auriu 128" găseşte „Maner … finisaj auriu periat, 128 mm". Ordinea: codul exact;
// apoi câte cuvinte scrise sunt cuvinte ÎNTREGI din denumire („gola c" → Gola „C" înaintea lui
// „Gola corp…", unde „c" doar începe „corp"); apoi câte încep un cuvânt; apoi denumirile care
// încep cu primul cuvânt scris; în rest, ordinea alfabetică a listei (userul, 2026-10-14).
export function cautator(produse) {
  const index = produse.map((p, i) => {
    const text = curat(`${p.denumire} ${p.cod}`);
    return { p, i, text, cuvinte: text.split(' '), cod: normal(p.cod) };
  });
  return (q, max = 30) => {
    const tot = normal(q).trim();
    const cerute = curat(q).split(' ').filter(Boolean);
    if (!cerute.length) return [];
    const scor = x => [
      x.cod === tot ? 0 : 1,
      -cerute.filter(c => x.cuvinte.includes(c)).length,
      -cerute.filter(c => x.cuvinte.some(w => w.startsWith(c))).length,
      x.cuvinte[0].startsWith(cerute[0]) ? 0 : 1,
      x.i,
    ];
    const compara = (a, b) => { for (let k = 0; k < a.s.length; k++) if (a.s[k] !== b.s[k]) return a.s[k] - b.s[k]; return 0; };
    return index
      .filter(x => cerute.every(c => x.text.includes(c)))
      .map(x => ({ x, s: scor(x) }))
      .sort(compara)
      .slice(0, max)
      .map(({ x }) => x.p);
  };
}

// ── Debitare: bucăţile clientului → din câte bare ies ───────────────────────
// `bucati` = [{ l: mm, buc }]. Aşezare „cea mai lungă întâi, în prima bară în
// care încape" (First Fit Decreasing — aceeaşi ca la divizările aplicate UTIL).
// `taiere` = lăţimea pânzei: fiecare bucată ia l + taiere, iar bara B + taiere
// (ultima bucată dintr-o bară nu mai are tăietură după ea).
// Ce se vinde şi pe jumătate de bară (userul, 2026-10-14): profilele Gola la bară, fără cele cupru.
export const sePoatePeJumatate = p => !!p.bara && /^gola\b/i.test(p.denumire) && !/cupru/i.test(p.denumire);

// `peJumatate` (ex. Gola, userul 2026-10-14): bara se vinde şi pe jumătate — o bară
// începută din care se foloseşte cel mult jumătate se numără 0,5 (restul ei = din jumătate).
// Întoarce null când nu e nicio bucată completată.
export function debitare(bucati, bara, taiere = 0, peJumatate = false) {
  const toate = (bucati ?? [])
    .flatMap(({ l, buc }) => Array(Math.max(0, Math.floor(+buc || 0))).fill(+l || 0))
    .filter(l => l > 0)
    .sort((a, b) => b - a);
  if (!toate.length) return null;
  const preaLungi = [...new Set(toate.filter(l => l > bara))];
  const rest = [];   // ce rămâne din fiecare bară începută
  for (const l of toate) {
    if (l > bara) continue;
    const k = rest.findIndex(r => r >= l + taiere);
    if (k >= 0) rest[k] -= l + taiere; else rest.push(bara + taiere - l - taiere);
  }
  const jumatate = r => peJumatate && bara - r <= bara / 2;   // bara - r = cât s-a folosit din ea
  return { nr: rest.reduce((s, r) => s + (jumatate(r) ? 0.5 : 1), 0),
    resturi: rest.map(r => Math.max(0, Math.round((jumatate(r) ? r - bara / 2 : r) - taiere))), preaLungi, bucati: toate.length };
}
