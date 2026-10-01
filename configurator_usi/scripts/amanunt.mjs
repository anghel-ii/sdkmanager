// Produsele pentru „Ofertă cu amănuntul" (amanunt.html), din exportul NeoManager.
//   node scripts/amanunt.mjs ["../baza de date completa.xlsx"]
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
    if (/[x×*-]\s*$/i.test(inainte) || /cablu/i.test(inainte)) continue;
    if (/^\s*[-x×]/.test(denumire.slice(m.index + m[0].length))) continue;
    const mm = parseFloat(m[1].replace(',', '.')) * (m[2].toLowerCase() === 'mm' ? 1 : 1000);
    if (mm > BARA_MIN_MM) return Math.round(mm);
  }
  return null;
}

const fisier = process.argv[2] ?? fileURLToPath(new URL('../../baza de date completa.xlsx', import.meta.url));
const [cap, ...randuri] = citesteXlsx(fisier);
const col = nume => { const i = cap.indexOf(nume); if (i < 0) throw new Error(`Lipseşte coloana „${nume}"`); return i; };
const [CAT, GRUPA, DEN, COD, UM, PRET] = ['Categorie', 'Grupa', 'Denumire', 'Cod', 'UM', 'Pret vanzare'].map(col);

const produse = randuri
  .filter(r => {
    const cat = String(r[CAT] ?? ''), grupa = String(r[GRUPA] ?? '');
    return (cat.startsWith('371') || (cat.startsWith('345') && PRODUSE_PROPRII.has(grupa)))
      && !GRUPE_EXCLUSE.has(grupa) && +r[PRET] > 0 && String(r[COD] ?? '').trim();
  })
  .map(r => {
    const p = { cod: String(r[COD]).trim(), denumire: String(r[DEN]), um: String(r[UM] ?? ''), grupa: String(r[GRUPA]) };
    const bara = p.um.toLowerCase() === 'buc' ? lungimeBara(p.denumire) : null;   // nu seturile („Sistem de ramforsare 2248 mm")
    return bara ? { ...p, bara } : p;
  })
  .sort((a, b) => a.denumire.localeCompare(b.denumire, 'ro'));

const dubluri = produse.filter((p, i) => produse.findIndex(x => x.cod === p.cod) !== i);
if (dubluri.length) throw new Error(`Coduri duble: ${dubluri.map(p => p.cod).join(', ')}`);

const iesire = new URL('../js/catalog/amanunt.json', import.meta.url);
fs.writeFileSync(iesire, JSON.stringify(produse, null, 0).replace(/\},\{/g, '},\n{') + '\n');
const pe = {};
for (const p of produse) pe[p.grupa] = (pe[p.grupa] ?? 0) + 1;
console.log(`${produse.length} produse → js/catalog/amanunt.json (${produse.filter(p => p.bara).length} cu debitare)`);
for (const [g, n] of Object.entries(pe).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${g}`);
