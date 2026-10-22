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
// Ce se vinde şi pe jumătate de bară: „0.5 1" în modul de facturare (scripts/amanunt.mjs; înainte,
// 2026-10-14, doar profilele Gola fără cupru — fişierul userului din 2026-10-22 spune la fel la Gola).
export const sePoatePeJumatate = p => !!p.bara && p.fact?.pas === 0.5;

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

// ── Modul de facturare (userul, 2026-10-22) — `fact` pe produs, din scripts/amanunt.mjs ──
// lipsă = bucăţi întregi · { pas: 0.5 } = întreg sau jumătate · { procent } = lungimea totală / bară × procent,
// în sus la 0,5 · { trepte: [[max mm, cât], …] } = fiecare bucată după lungimea ei · { multiplu: n } · { arie } = mp.
const sus = (x, pas) => Math.round(Math.ceil(x / pas - 1e-9) * pas * 1000) / 1000;
const zecimale = (x, n) => Math.round(x * 10 ** n) / 10 ** n;

// Cantitatea scrisă de mână → cât se facturează („1" = să nu se poată pune 1,5).
export function rotunjeste(fact, q) {
  q = +q || 0;
  if (q <= 0) return 0;
  if (fact?.arie) return zecimale(q, 3);
  if (fact?.trepte) return zecimale(q, 2);
  if (fact?.multiplu) return sus(q, fact.multiplu);
  return sus(q, fact?.pas ?? (fact?.procent ? 0.5 : 1));
}

// Bucăţile clientului la un produs vândut la bară, după modul lui de facturare. `intreaga` = „Dă bara
// întreagă" (doar la cele pe jumătate). Ca debitare(): null când nu e nicio bucată completată.
export function laBara(fact, bucati, bara, taiere = 0, intreaga = false) {
  if (!fact?.procent && !fact?.trepte) return debitare(bucati, bara, taiere, fact?.pas === 0.5 && !intreaga);
  const toate = (bucati ?? [])
    .flatMap(({ l, buc }) => Array(Math.max(0, Math.floor(+buc || 0))).fill(+l || 0))
    .filter(l => l > 0)
    .sort((a, b) => b - a);
  if (!toate.length) return null;
  const preaLungi = [...new Set(toate.filter(l => l > bara))];
  const bune = toate.filter(l => l <= bara);
  const total = bune.reduce((s, l) => s + l, 0);
  const nr = fact.procent
    ? sus(total / bara * fact.procent, 0.5)
    : zecimale(bune.reduce((s, l) => s + (fact.trepte.find(([max]) => l <= max)?.[1] ?? 1), 0), 2);
  return { nr, preaLungi, bucati: toate.length, total, resturi: [] };
}

// Geamul la mp: bucăţile { h, l, buc } în mm → aria. null când nu e nicio bucată completată.
export function arie(bucati) {
  const bune = (bucati ?? []).filter(p => +p.h > 0 && +p.l > 0 && +p.buc > 0);
  if (!bune.length) return null;
  return { nr: zecimale(bune.reduce((s, p) => s + p.h * p.l * Math.floor(p.buc) / 1e6, 0), 3),
           bucati: bune.reduce((s, p) => s + Math.floor(p.buc), 0), preaLungi: [], resturi: [] };
}

// Scurt, lângă UM: cum se facturează produsul (nimic la bucăţile întregi)
export function textMod(fact, cantitate) {
  if (fact?.multiplu) return `multiplu de ${fact.multiplu}${fact.set && cantitate > 0 ? ` (${cantitate / fact.multiplu} ${cantitate / fact.multiplu === 1 ? 'set' : 'seturi'})` : ''}`;
  if (fact?.pas) return 'întreg sau jumătate';
  if (fact?.procent) return `lungimea + ${Math.round((fact.procent - 1) * 100)} %`;
  if (fact?.trepte) return 'după lungimea bucăţii';
  if (fact?.arie) return 'H × L × buc';
  return '';
}
