// Produsele pentru „Ofertă cu amănuntul" (amanunt.html), din exportul NeoManager.
//   node scripts/amanunt.mjs ["../materiale/baza de date completa.xlsx"] ["../materiale/Toata baza de date 21.10.2026 (1).xlsx"]
// Scrie js/catalog/amanunt.json — se rulează din nou la fiecare export nou.
//
// De vânzare = mărfurile (cont 371 — cumpărate ca să fie revândute) + din ce
// producem noi (345) sertarele Smart Box şi gama Lux (userul, 2026-10-01), doar
// cele cu preţ de vânzare în NeoManager. Fără mostre, „de verificat" şi obiecte
// de inventar. Denumirile rămân exact ca în NeoManager.
//
// `bara` = lungimea barei în mm, când denumirea are una peste 1,5 m („4,2 m",
// „3,5 ml", „5500mm") — la produsele astea pagina are DEBITARE: bucăţile
// clientului → din câte bare ies.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { citesteXlsx } from '../../clienti-agenti/xlsx.mjs';

const GRUPE_EXCLUSE = new Set(['Mostre', 'de verificat', 'de verificat prod finite', 'Obiecte de inventar']);
const PRODUSE_PROPRII = new Set(['Sertare SM/TB', 'Produse finite Gama Lux']);   // din 345 — se vând ca atare

// Lungimea barei din denumire: prima cotă de peste 1,5 m. Nu sunt bare: cablul
// prizelor („cablu de 1,8m"), intervalele („H1900-2100 mm", „1001-1100mm") şi
// cotele de secţiune („32x20000 mm", „50x05ml").
const BARA_MIN_MM = 1500;
function lungimeBara(denumire) {
  for (const m of denumire.matchAll(/(\d+(?:[.,]\d+)?)\s*(mm|ml|m)\b/gi)) {
    const inainte = denumire.slice(Math.max(0, m.index - 12), m.index);
    // „x" doar lipit de o cifră („32x"), altfel „inox 4 m" ar trece drept secţiune
    if (/\d\s*[x×*-]\s*$/i.test(inainte) || /cablu/i.test(inainte)) continue;
    if (/^\s*[-x×]/.test(denumire.slice(m.index + m[0].length))) continue;
    const mm = parseFloat(m[1].replace(',', '.')) * (m[2].toLowerCase() === 'mm' ? 1 : 1000);
    if (mm > BARA_MIN_MM) return Math.round(mm);
  }
  return null;
}

// Bare cu lungimea lipsă sau ascunsă în denumirea din NeoManager (userul, 2026-10-21):
// Initio auriu / inox au „4 m" doar la celelalte culori; la Neo „42x18x3 m" lungimea e
// lipită de secţiune. Codul → lungimea barei în mm.
const BARA_PE_COD = {
  13352261007: 4000, 13352261021: 4000, 13440191007: 4000, 13352271007: 4000,   // Plinta Initio auriu / inox
  775: 3000, 776: 3000, 777: 3000, 778: 3000,                                      // Profil maner Neo
  800: 3000,                                                                       // „usi pliante 30000 mm" — 3 m
};

// ── Modul de facturare (userul, 2026-10-22) ────────────────────────────────
// Fişierul „Toata baza de date 21.10.2026" (Grupa, Denumire, Cod, UM, Mod facturare) ACTUALIZEAZĂ
// exportul: denumirea, UM-ul şi grupa de acolo, plus codurile noi; ce lipseşte din el rămâne ca
// în export. Ultima coloană → `fact` pe produs (citit de js/amanunt-calcul.js):
//   „1", „x", gol, „1 buc = 3000 mm"           → fără `fact`: bucăţi întregi
//   „0.5 1", „<2750 = 0.5 buc, >2750 = 1 buc"  → { pas: 0.5 }  întreg sau jumătate (la bare: jumătatea de bară)
//   „(cant necesara/5800)*115%"                → { procent: 1.15 }  lungimea totală / bara lui × 115 %, în sus la 0,5
//   „<1400 = 0.25, 1401-1600 = 0.28, …"        → { trepte: [[max mm, cât], …] }  fiecare bucată după lungimea ei
//   „multiplu de 10 buc", „… (1 set = 6 buc)"  → { multiplu: n, set? }
//   geamurile cu UM mp                         → { arie: true }  mp = H × L × buc
const SINA_UTIL = [[2000, 0.35], [3000, 0.52], [4000, 0.69], [5800, 1]];   // „0.35, 0.52, 0.69, 1" — ca în js/lib/util/util.js
function modFacturare(text, p) {
  const t = String(text ?? '').trim().toLowerCase();
  if (p.um.toLowerCase() === 'mp' && p.grupa === 'Geam/Oglinda') return { arie: true };
  if (/115\s*%/.test(t)) return { procent: 1.15 };
  const m = t.match(/multiplu de (\d+)/);
  if (m) return { multiplu: +m[1], ...(/set/.test(t) && { set: true }) };
  if (/^<\s*\d+\s*=\s*0[.,]5\s*buc/.test(t) || /^0[.,]5\b/.test(t)) return { pas: 0.5 };
  if (/^0[.,]35\s*,\s*0[.,]52/.test(t)) return { trepte: SINA_UTIL };
  if (t.startsWith('<')) {
    const trepte = [...t.matchAll(/([<>])?\s*(\d+)(?:\s*-\s*(\d+))?\s*=\s*(\d+(?:[.,]\d+)?)/g)]
      .map(([, semn, a, b, v]) => [semn === '>' ? p.bara : +(b ?? a), parseFloat(v.replace(',', '.'))]);
    if (!p.bara || trepte.some(([max, v]) => !(max > 0 && v > 0))) throw new Error(`Trepte de neînţeles la ${p.cod}: ${text}`);
    return { trepte };
  }
  return null;
}
// La Lux şi UTIL regula e scrisă doar la prima culoare — merge la toată familia (userul, 2026-10-22).
const REGULA_DE_LA = {
  135: ['101', '126', '146', '115', '134', '100', '125', '180', '145', '114', '153'],   // Profil maner Breda + Vent
  171: ['170'],                                                                       // profilele ramei Lux
  122: ['111', '121', '110', '142', '141'],                                           // şinele duble Lux
  124: ['113', '123', '112', '144', '143'],                                           // şinele simple Lux
  321: ['301', '331', '311', '320', '300', '330', '310'],                             // şinele UTIL
};

const fisier = process.argv[2] ?? fileURLToPath(new URL('../../materiale/baza de date completa.xlsx', import.meta.url));
const [cap, ...randuri] = citesteXlsx(fisier);
const col = nume => { const i = cap.indexOf(nume); if (i < 0) throw new Error(`Lipseşte coloana „${nume}"`); return i; };
const [CAT, GRUPA, DEN, COD, UM, PRET] = ['Categorie', 'Grupa', 'Denumire', 'Cod', 'UM', 'Pret vanzare'].map(col);

// fişierul cu modul de facturare: cod → { grupa, denumire, um, mod }
const fisierFact = process.argv[3] ?? fileURLToPath(new URL('../../materiale/Toata baza de date 21.10.2026 (1).xlsx', import.meta.url));
const [capF, ...randuriF] = citesteXlsx(fisierFact);
const colF = inceput => { const i = capF.findIndex(c => String(c).trim() === inceput) >= 0 ? capF.findIndex(c => String(c).trim() === inceput)
  : capF.findIndex(c => String(c).startsWith(inceput)); if (i < 0) throw new Error(`Lipseşte coloana „${inceput}"`); return i; };
const [FG, FD, FC, FU, FM] = ['Denumire grupa', 'Denumire', 'Cod', 'UM', 'Mod facturare'].map(colF);
const actual = new Map(randuriF.filter(r => String(r[FC] ?? '').trim()).map(r => [String(r[FC]).trim(),
  { grupa: String(r[FG] ?? '').trim(), denumire: String(r[FD] ?? '').trim(), um: String(r[FU] ?? '').trim(), mod: r[FM] }]));

// Produse care nu sunt încă în exporturi — date de user (2026-10-26), denumirea exact ca în NeoManager.
// Un export nou care le conţine are întâietate.
const PRODUSE_ADAUGATE = {
  '20K1301T': 'Mecanism BLUM AVENTOS HK-XS/TIP-ON, FP 500-1200, cod 20K1301T',
  '956A1004 ALB': 'TIP-ON BLUM pt. usi,versiune lunga cu magnet,alb matase, cod 956A1004 ALB',
  '20K1501T': 'Mecanism BLUM AVENTOS HK-XS/TIP-ON, FP 800-1600, cod 20K1501T',
};
for (const [cod, denumire] of Object.entries(PRODUSE_ADAUGATE))
  if (!actual.has(cod)) actual.set(cod, { grupa: 'Balamale pentru rame', denumire, um: 'Buc', mod: '' });

// de vânzare: regula exportului (371 + produsele proprii, cu preţ) SAU trecut în fişierul cu modul de facturare
const dinExport = new Map(randuri.filter(r => String(r[COD] ?? '').trim()).map(r => [String(r[COD]).trim(), r]));
const deVanzare = r => {
  const cat = String(r[CAT] ?? ''), grupa = String(r[GRUPA] ?? '');
  return (cat.startsWith('371') || (cat.startsWith('345') && PRODUSE_PROPRII.has(grupa))) && !GRUPE_EXCLUSE.has(grupa) && +r[PRET] > 0;
};
const coduri = [...new Set([...[...dinExport].filter(([, r]) => deVanzare(r)).map(([c]) => c), ...actual.keys()])];

const produse = coduri.map(cod => {
  const r = dinExport.get(cod), a = actual.get(cod);
  const p = { cod, denumire: a?.denumire || String(r[DEN]), um: a?.um || String(r?.[UM] ?? ''), grupa: a?.grupa || String(r?.[GRUPA] ?? '') };
  const bara = p.um.toLowerCase() === 'buc' ? BARA_PE_COD[p.cod] ?? lungimeBara(p.denumire) : null;   // nu seturile („Sistem de ramforsare 2248 mm")
  return bara ? { ...p, bara } : p;
}).sort((a, b) => a.denumire.localeCompare(b.denumire, 'ro'));

const peCod = new Map(produse.map(p => [p.cod, p]));
for (const p of produse) {
  const fact = modFacturare(actual.get(p.cod)?.mod, p);
  if (fact) p.fact = fact;
}
for (const [sursa, familia] of Object.entries(REGULA_DE_LA))
  for (const cod of familia) {
    const p = peCod.get(cod), f = peCod.get(sursa)?.fact;
    if (!p || !f) throw new Error(`REGULA_DE_LA: lipseşte ${p ? sursa : cod}`);
    p.fact = f.trepte ? { trepte: f.trepte.map(([max, v]) => [max === peCod.get(sursa).bara ? p.bara : max, v]) } : { ...f };
  }

const dubluri = produse.filter((p, i) => produse.findIndex(x => x.cod === p.cod) !== i);
if (dubluri.length) throw new Error(`Coduri duble: ${dubluri.map(p => p.cod).join(', ')}`);

const iesire = new URL('../js/catalog/amanunt.json', import.meta.url);
fs.writeFileSync(iesire, JSON.stringify(produse, null, 0).replace(/\},\{/g, '},\n{') + '\n');
const pe = {};
for (const p of produse) pe[p.grupa] = (pe[p.grupa] ?? 0) + 1;
console.log(`${produse.length} produse → js/catalog/amanunt.json (${produse.filter(p => p.bara).length} cu debitare)`);
const feluri = {};
for (const p of produse) { const f = Object.keys(p.fact ?? { intreg: 1 })[0]; feluri[f] = (feluri[f] ?? 0) + 1; }
console.log('mod de facturare:', feluri);
for (const [g, n] of Object.entries(pe).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${g}`);
