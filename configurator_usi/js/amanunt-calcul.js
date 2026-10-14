// Calculele ofertei cu amănuntul — căutarea în produse (js/catalog/amanunt.json)
// şi debitarea pe bare — separate de pagină, ca să le verifice şi testul (fără browser).

import MiniSearch from 'minisearch';

// fără diacritice şi litere mari: „mâner" găseşte „Maner"
export const normal = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Cuvintele: litere sau cifre — ghilimelele şi semnele nu contează („Gola ''C''" → gola, c),
// „57X26" = 57 + 26, „4,2" = 4 + 2, iar literele se despart de cifre („TB500" = tb + 500, „L128" = l + 128).
const cuvinte = t => normal(t).split(/[^a-z0-9]+|(?<=\d)x(?=\d)|(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])/).filter(Boolean);

// Căutarea în produse (userul, 2026-10-14: „un search care e deja bun") — MiniSearch: ordonare
// BM25 pe cuvinte, început de cuvânt („gol c" → Gola „C") şi greşeli de tastare („manr" → mâner).
// Toate cuvintele scrise trebuie găsite, în orice ordine; codul scris exact vine primul.
export function cautator(produse) {
  const primul = produse.map(p => cuvinte(p.denumire)[0] ?? '');
  const ms = new MiniSearch({
    // codul rămâne întreg („731ALB"), ca „alb" să nu conteze de două ori; litere/cifre se despart doar în denumire
    idField: 'i', fields: ['denumire', 'cod'], processTerm: t => t,
    tokenize: (t, camp) => (camp === 'cod' ? normal(t).split(/[^a-z0-9]+/).filter(Boolean) : cuvinte(t)),
    searchOptions: {
      // început de cuvânt de la 2 caractere: „c" singur e exact „C" (nu „cu", „canal", „cod"…)
      combineWith: 'AND', prefix: t => t.length >= 2, boost: { cod: 2 },
      // greşeli de tastare doar la cuvintele de litere, de la 4 în sus (la cifre „600" nu e „500")
      fuzzy: t => (/^[a-z]{4,}$/.test(t) ? 0.2 : 0),
      // lungimea denumirii nu contează (altfel „Gola C cu canal pentru led" ar trece, fiind scurtă,
      // înaintea lui Gola „C" 4,2 m); urcă produsele a căror denumire ÎNCEPE cu un cuvânt scris
      // („gola c" → Gola „C" înaintea capetelor şi colţurilor pentru gola C)
      bm25: { k: 1.2, b: 0, d: 0.5 },
      // (doar cuvinte de 3+ litere: „c" din „gola c" nu urcă „Capăt…")
      boostDocument: (id, termen) => (termen.length >= 3 && primul[id].startsWith(termen) ? 2 : 1),
    },
  });
  ms.addAll(produse.map((p, i) => ({ i, denumire: p.denumire, cod: p.cod })));
  return (q, max = 30) => {
    if (!cuvinte(q).length) return [];
    const tot = normal(q).trim();
    const exact = produse.filter(p => normal(p.cod) === tot);
    // la scor egal, ordinea alfabetică a listei
    const gasite = ms.search(q).sort((a, b) => b.score - a.score || a.id - b.id).map(r => produse[r.id]);
    return [...exact, ...gasite.filter(p => !exact.includes(p))].slice(0, max);
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
