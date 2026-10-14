// Calculele ofertei cu amănuntul — căutarea în produse (js/catalog/amanunt.json)
// şi debitarea pe bare — separate de pagină, ca să le verifice şi testul (fără browser).

// fără diacritice şi litere mari: „mâner" găseşte „Maner"
export const normal = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Fiecare cuvânt scris trebuie să apară în denumire sau în cod, în orice ordine:
// „maner auriu 128" găseşte „Maner … finisaj auriu periat, 128 mm". Primele vin
// codul exact, apoi denumirile care încep cu ce ai scris, apoi restul (alfabetic).
export function cautator(produse) {
  const index = produse.map(p => ({ p, text: normal(`${p.denumire} ${p.cod}`), den: normal(p.denumire), cod: normal(p.cod) }));
  return (q, max = 30) => {
    const tot = normal(q).trim();
    const cuvinte = tot.split(/\s+/).filter(Boolean);
    if (!cuvinte.length) return [];
    const loc = x => (x.cod === tot ? 0 : x.den.startsWith(tot) ? 1 : 2);
    return index
      .filter(x => cuvinte.every(c => x.text.includes(c)))
      .sort((a, b) => loc(a) - loc(b))   // sortarea e stabilă: în rest rămâne ordinea alfabetică a listei
      .slice(0, max)
      .map(x => x.p);
  };
}

// ── Debitare: bucăţile clientului → din câte bare ies ───────────────────────
// `bucati` = [{ l: mm, buc }]. Aşezare „cea mai lungă întâi, în prima bară în
// care încape" (First Fit Decreasing — aceeaşi ca la divizările aplicate UTIL).
// `taiere` = lăţimea pânzei: fiecare bucată ia l + taiere, iar bara B + taiere
// (ultima bucată dintr-o bară nu mai are tăietură după ea).
// `peJumatate` (ex. codul 412, userul 2026-10-14): bara se vinde şi pe jumătate — o bară
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
