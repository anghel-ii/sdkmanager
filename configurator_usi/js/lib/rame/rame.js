import catalog from '../../catalog/catalog.generated.json';
import { line } from './bom.js';
import { findGeam, FOLIE_COD, folieCantitate } from './geam.js';
import { detaliiComanda } from '../comun/comanda.js';

// ═══════════════════════════════════════════════════════════════════════════
//  RAME — rame de aluminiu pt. uşi de mobilier (cu balamale), gama „rame".
//  Totul de aici e citit din formularele de comandă ale userului (2026-09-21):
//    „Rame 820,822,824- Formular comanda 17.09.xlsm"
//    „Rame 831,841,842- Formular comanda 17.09.xlsm"
//  (formule, liste de validare, foile ascunse şi macro-urile VBA). Denumirile
//  accesoriilor sunt copiate EXACT din Excel.
//
//  O comandă = un model + o culoare + oricâte RÂNDURI (H, L, nr. rame, nr.
//  găuri pt. balamale). Rama se vinde GATA DIMENSIONATĂ: H şi L se rotunjesc în
//  sus la mărimile standard ale modelului, codul = model + sufix culoare + HxL.
// ═══════════════════════════════════════════════════════════════════════════

// rotunjire în sus la 0,01 (necesar de cumpărat, nu de subestimat). Întâi se
// taie zgomotul de virgulă mobilă sub 1e-6 — altfel 1.1 × 100 = 110.00000000000001
// şi o arie de exact 1,1 mp ieşea facturată 1,11.
const ceil2 = x => Math.ceil(Math.round(x * 1e6) / 1e4) / 100;

// ── Culori ───────────────────────────────────────────────────────────────────
export const FINISAJE_RAME = {
  'ALUMINIU':     { label: 'Aluminiu',     hex: '#c4c8ca', sufix: 'A' },
  'ALB MAT':      { label: 'Alb mat',      hex: '#eceeef', sufix: 'ALB' },
  'NEGRU PERIAT': { label: 'Negru periat', hex: '#2a2a2c', sufix: 'N' },
  'AURIU PERIAT': { label: 'Auriu periat', hex: '#b89a4e', sufix: 'AURIU' },
  'CUPRU PERIAT': { label: 'Cupru periat', hex: '#a05a3c', sufix: 'CUPRU' },
};
const finisaje = ids => ids.map(id => ({ id, label: FINISAJE_RAME[id].label, hex: FINISAJE_RAME[id].hex }));

// ── Mărimi standard (rotunjire în sus) ──────────────────────────────────────
const H_820 = [350, 400, 450, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800];
const L_820 = [350, 400, 450, 500, 600, 700, 800, 900, 1000, 1100, 1200];
const H_831 = [400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600];
const L_831 = [400, 450, 500, 600, 800];
const H_841 = [400, 450, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000];
const L_841 = [400, 450, 500, 600, 700];

// ── Modelele ─────────────────────────────────────────────────────────────────
//  profil     — secţiunea din denumirea profilului (mm); prima cifră = faţa
//               ramei (folosită doar la desen)
//  scadereGeam — cota geamului/oglinzii = ramă − atât, pe H şi pe L
//  grup       — '820' (balamale + plăcuţe pe găuri, colţare, 8 şuruburi) sau
//               '831' (balama ascunsă INVISIO pe ramă, manşon, set colţare, 16 şur.)
//  manopera   — 'rotunjit' (820: H rotunjit > 1200) / 'real' (831: H real ≥ 1200)
export const MODELE_RAME = {
  820: { profil: '45x21.5x8',    fata: 45,   scadereGeam: 5,  H: H_820, L: L_820, grup: '820', manopera: 'rotunjit',
         culori: ['ALUMINIU', 'ALB MAT', 'NEGRU PERIAT', 'AURIU PERIAT', 'CUPRU PERIAT'] },
  822: { profil: '19x20x19',     fata: 19,   scadereGeam: 29, H: H_820, L: L_820, grup: '820', manopera: 'rotunjit',
         culori: ['ALUMINIU', 'ALB MAT', 'NEGRU PERIAT', 'AURIU PERIAT', 'CUPRU PERIAT'] },
  824: { profil: '19x20x8',      fata: 19,   scadereGeam: 5,  H: H_820, L: L_820, grup: '820', manopera: 'rotunjit',
         culori: ['ALUMINIU', 'ALB MAT', 'NEGRU PERIAT', 'AURIU PERIAT'] },
  831: { profil: '19.5x26x19.5', fata: 19.5, scadereGeam: 40, H: H_831, L: L_831, grup: '831', manopera: 'real',
         culori: ['NEGRU PERIAT', 'AURIU PERIAT', 'CUPRU PERIAT'] },
  841: { profil: '22.3x30x8',    fata: 22.3, scadereGeam: 6,  H: H_841, L: L_841, grup: '831', manopera: 'real',
         culori: ['NEGRU PERIAT', 'AURIU PERIAT', 'CUPRU PERIAT'] },
  842: { profil: '22.3x30x8',    fata: 22.3, scadereGeam: 6,  H: H_841, L: L_841, grup: '831', manopera: 'real',
         culori: ['NEGRU PERIAT', 'AURIU PERIAT', 'CUPRU PERIAT'] },
};
export const finisajeModel = model => finisaje(MODELE_RAME[model].culori);

// ── Opţiuni din formular (liste de validare) ────────────────────────────────
export const ASAMBLARE = [['noi', 'NOI ASAMBLAM'], ['client', 'CLIENTUL ASAMBLEAZA']];
export const FARA_GAURIRE = 'Fara gaurire';   // la toate modelele (userul, 2026-09-25)
// găuri doar sus şi jos, la 100 mm de margini = mereu 2 pe ramă (userul, 2026-09-25):
// nr. de găuri nu se mai scrie pe rând
export const DOUA_GAURI = '100 mm de margini sus/jos';
export const GAURIRE_820 = [FARA_GAURIRE, DOUA_GAURI, '100 mm sus/jos si la mijloc',
                            '100 mm sus/jos si impartite egal', 'vezi schita pe spate'];
export const GAURIRE_831 = ['Fara gaurire', 'Gaurire Standard'];
// livrare / agent / facturare: acum ale comenzii, la toate gamele (lib/comun/comanda.js)
export { LIVRARE, AGENTI, PLATI } from '../comun/comanda.js';

// ── Accesorii grup 820 (820 / 822 / 824) ────────────────────────────────────
// Balamale şi plăcuţe: lista diferă între 820 şi 822/824 (Sheet3!I120:K170).
export const BALAMALE = {
  820: [
    ['71B3550 NICHEL', 'Balama CLIP TOP usa aplicata BLUMOTION incorporat deschidere 110 grade,nichel(fara placuta) cod 71B3550 NICHEL'],
    ['70T3550.TL NICHEL', 'Balama BLUM CLIP top, 110°, aplicata, fara arc, suruburi rama 820 cod 70T3550.TL NICHEL'],
    ['71B3650 NICHEL', 'Balama BLUM CLIP top BLUMOTION, 110°, 9,5mm, semiaplicata, cu arc, suruburi cod 71B3650 NICHEL'],
    ['70T3650.TL NICHEL', 'Balama BLUM CLIP top, 110°, 9,5mm, semiaplicata, fara arc, suruburi cod 70T3650.TL NICHEL'],
    ['71B3750 NICHEL', 'Balama BLUM CLIP top BLUMOTION, 110°, 18mm, incadrata, cu arc, suruburi cod 71B3750 NICHEL'],
    ['70T3750.TL NICHEL', 'Balama BLUM CLIP top, 110°, 18mm, incadrata, fara arc, suruburi cod 70T3750.TL NICHEL'],
    ['71B3550 ONYX', 'Balama CLIP top BLUMOTION 110°, usa aplicata, suruburi, Onyx negru cod 71B3550 ONYX'],
    ['71B7550 ONYX', 'Balama BLUM CLIP top BLUMOTION ONYX155° aplicata patrundere 0 cu arc suruburi cod 71B7550 ONYX'],
    ['70T3550.TL ONYX', 'Balama BLUM CLIP top, 110°, aplicata, fara arc, suruburi cod 70T3550.TL ONYX'],
    ['71B3650 ONYX', 'Balama BLUM CLIP top BLUMOTION ONYX, 110, semiaplicata, cu arc,suruburi cod 71B3650 ONYX'],
    ['70T3650.TL ONYX', 'Balama BLUM CLIP top ONYX 110, semiaplicata,(faraplacute)  fara arc cod 70T3650.TL ONYX'],
    ['71B3750 ONYX', 'Balama BLUM CLIP top BLUMOTION ONYX, 110°, 18mm, incadrata, cu arc, suruburi cod 71B3750 ONYX'],
    ['70T3750.TL ONYX', 'Balama BLUM CLIP top ONYX, 110°, 18mm, incadrata, fara arc, suruburi , cod 70T3750.TL ONYX'],
  ],
  822: [
    ['9072524', 'Balama Sensys 8638i, pentru rama de aluminiu, deschidere 95°, cu Silent System, APLICATA cu amortizare cod 9072524'],
    ['9072527', 'Balama Sensys 8638, pentru rama de aluminiu, deschidere 95°, fara Silent System, APLICATA cod 9072527'],
    ['9072530', 'Balama Sensys 8638, pentru rama de aluminiu, deschidere 95°, fara arc, APLICATA cod 9072530'],
    ['9072525', 'Balama Sensys 8638i, pentru rama de aluminiu, deschidere 95°, cu Silent System, SEMIAPLICATA  cod 9072525'],
    ['9072528', 'Balama Sensys 8638, pentru rama de aluminiu, deschidere 95°, fara Silent System,SEMIAPLICATA cod 9072528'],
    ['9072531', 'Balama Sensys 8638, pentru rama de aluminiu, deschidere 95, fara arc, SEMIAPLICATA cod 9072531'],
    ['9072526', 'Balama Sensys 8638i, pentru rama de aluminiu, deschidere 95°, cu Silent System, INCADRATA cod 9072526'],
    ['9072529', 'Balama Sensys 8638, pentru rama de aluminiu, deschidere 95°, fara Silent System, INCADRATA cod 9072529'],
    ['9072532', 'Balama Sensys 8638, pentru rama de aluminiu, deschidere 95°, fara arc, INCADRATA cod 9072532'],
    ['9091744', 'Balama Sensys 8638i negru aplicata cu amortizare, pentru rama de aluminiu, deschidere 95°, cu Silent System cod 9091744'],
    ['9350389', 'Balama Sensys pentru rama din aluminiu, 95°, fara arc, negru, aplicata, montare prin insurubare cod 9350389'],
    ['9350390', 'Balama Sensys pentru rama din aluminiu 95°, fara arc, negru, semiaplicata, montare prin insurubare cod 9350390'],
    ['9091992', 'Balama Sensys, pentru rama de aluminiu, cu amortizare, negru, semiaplicata, 95°, montare prin insurubare cod 9091992'],
    ['9350421', 'Balama Sensys pentru rama din aluminiu 95°, fara arc, negru, incadrata, montare prin insurubare cod 9350421'],
    ['9091993', 'Balama Sensys, pentru rama de aluminiu, cu amortizare, negru, incadrata, 95°, montare prin insurubare cod 9091993'],
    ['BSV001', 'Balama SV aplicata cu amortizare, finisaj nichel pt rama 822 si 824 cu placuta in cruce inclusa cod BSV001'],
    ['BSV002', 'Balama SV aplicata cu amortizare, finisaj negru pt rama 822 si 824 cu placuta in cruce inclusa cod BSV002'],
    ['SDK32D221A0', 'Balama SDK aplicata 3D pentru rama ingusta 822/824 , nichel , placuta cu excentric inclusa cod SDK32D221A0'],
    ['SDK32D221B0', 'Balama SDK aplicata 3D pentru rama ingusta 822/824 , negru , placuta cu excentric inclusa cod SDK32D221B0'],
  ],
};
BALAMALE[824] = BALAMALE[822];

export const PLACUTE = {
  820: [
    ['173H7100 NICHEL', 'Placuta fixare balama CLIP TOP reglaj din excentric,montare cu surub, nichel cod 173H7100 NICHEL'],
    ['175H3100 NICHEL', 'Placuta de montaj in linie BLUM CLIP, otel, excentric, surub, dist 0mm cod 175H3100 NICHEL'],
    ['173H7100 ONYX', 'Placuta de montaj in cruce BLUM CLIP ONYX surub lemn regl inalt excentric dist 0mm cod 173H7100 ONYX'],
    ['175H3100 ONYX', 'Placuta de montaj in linie BLUM CLIP ONYX, excentric, surub, dist 0mm cod 175H3100 ONYX'],
  ],
  822: [
    ['9071576', 'Placuta Sensys/ Intermat (nichel) H1.5, cruce, eco cod 9071576'],
    ['9071671', 'Placuta de montare balama Sensys si Intermat 1,5 mm, excentric, prindere cu suruburi premontate cod 9071671'],
    ['9117341', 'Placuta Sensys/ Intermat (nichel) H1.5, in linie, excentric cod 9117341'],
    ['9091800', 'Placuta Sensys (negru) H1.5,cruce, eco cod 9091800'],
    ['9359652', 'Placuta de montare in cruce D=1.5 negru, excentric, prindere cu suruburi PAL premontate'],
    ['9117471', 'Placuta Sensys (negru) H1.5, linie, excentric cod 9117471'],
    ['9075087', 'Placuta de montare balama Sensys si Intermat 3,0 mm, excentric(numai pt balamale incadrate) cod 9075087'],
    ['9075007', 'Placuta de montare balama Sensys si Intermat 3,0 mm, prindere cu surub(numai pt balamale incadrate 822) cod 9075007'],
    ['9091805', 'Placuta Sensys (negru) H3, cruce, excentric,prindere cu eurosuruburi,premontate ,cod:9091805'],
  ],
};
PLACUTE[824] = PLACUTE[822];
export const FARA_BALAMALE = 'Fara balamale de la noi';
export const FARA_PLACUTE  = 'Fara placute de la noi';

const COLTAR_820 = {
  820: ['827', 'Coltar de imbinare pentru rama 820 SDK 45x21.5x8 mm cod 827'],
  822: ['826', 'Coltar de imbinare pentru rama 822 si 824 SDK 19x20 mm cod 826'],
  824: ['826', 'Coltar de imbinare pentru rama 822 si 824 SDK 19x20 mm cod 826'],
};
const SURUB_RAMA = {
  negru: ['829', 'Surub cu cap inecat imbus 4x10 negru cod 829'],
  alb:   ['828', 'Surub cu cap inecat imbus 4x10 zincat alb cod 828'],
};
// Şuruburile pt. balamale: la 820 se facturează (830); la 822/824 vin în cutia
// cu balamale — apar doar la „de pregătit", cu mesajul din formular.
const SURUB_BALAMA = {
  820: ['830', 'Surub autoforant cu cap inecat otel zincat 3.5x13mm DIN 7504P pt prinderea balamalelor cod 830'],
  822: [null, 'Pentru rama model 822 sau 824 - Surub autoforant pentru balamale la ramele inguste(in cutia cu balamele) Nu facturam'],
  824: [null, 'Pentru rama model 822 sau 824 - Surub autoforant pentru balamale la ramele inguste(in cutia cu balamele) Nu facturam'],
};

// Profil mâner (doar grupul 820) — bare de 3000 mm (userul, 2026-09-25: ca în denumire;
// macro-ul CalculeazaNrBare din formular folosea 2500), bucăţile se aşază pe bare.
export const MANERE = [
  ['771', 'Profil maner L 32 mm, finisaj alb mat 3 m cod 771'],
  ['770', 'Profil maner L 32 mm, finisaj aluminiu 3 m cod 770'],
  ['774', 'Profil maner L 32 mm, finisaj auriu periat 3 m cod 774'],
  ['772', 'Profil maner L 32 mm, finisaj negru periat 3 m cod 772'],
  ['773', 'Profil maner L 32 mm, finisaj sampanie 3 m cod 773'],
  ['780', 'Profil maner L 40 mm, finisaj alb mat 3 m cod 780'],
  ['782', 'Profil maner L 40 mm, finisaj auriu periat 3 m cod 782'],
  ['784', 'Profil maner L 40 mm, finisaj cupru 3m cod 784'],
  ['781', 'Profil maner L 40 mm, finisaj negru mat 3 m cod 781'],
  ['779', 'Profil maner L 40 mm, finisaj aluminiu 3 m cod 779'],
  ['778', 'Profil maner Neo 40x18x3 m, finisaj auriu periat cod 778'],
  ['776', 'Profil maner Neo 42x18x3 m, finisaj alb cod 776'],
  ['775', 'Profil maner Neo 42x18x3 m, finisaj aluminiu cod 775'],
  ['777', 'Profil maner Neo 42x18x3 m, finisaj negru periat cod 777'],
];
export const FARA_MANER = 'Fara profil maner';
export const BARA_MANER_MM = 3000;

// Mânerul (secţiunea lui, cu rânduri lungime × buc): se alege doar MODELUL —
// codul vine în culoarea ramei. L 40 negru există doar negru MAT (781): merge şi
// la rama negru periat (userul). Un model fără cod în culoarea ramei nu se oferă.
export const MODELE_MANER = [['L32', 'L 32'], ['L40', 'L 40'], ['Neo', 'Neo']];
const COD_MANER = {
  L32: { 'ALB MAT': '771', 'ALUMINIU': '770', 'AURIU PERIAT': '774', 'NEGRU PERIAT': '772' },
  L40: { 'ALB MAT': '780', 'ALUMINIU': '779', 'AURIU PERIAT': '782', 'NEGRU PERIAT': '781', 'CUPRU PERIAT': '784' },
  Neo: { 'ALB MAT': '776', 'ALUMINIU': '775', 'AURIU PERIAT': '778', 'NEGRU PERIAT': '777' },
};
export const codManer = (model, culoare) => COD_MANER[model]?.[culoare] ?? null;
export const manereInCuloare = culoare => MODELE_MANER.filter(([m]) => codManer(m, culoare));
// ofertele salvate cu vechiul `maner.profil` (un cod) → modelul lui
const modelDinCod = cod => Object.keys(COD_MANER).find(m => Object.values(COD_MANER[m]).includes(cod)) ?? null;

// ── Accesorii grup 831 (831 / 841 / 842) ───────────────────────────────────
const INVISIO = {
  831: {
    balama:  ['SDK-INV-20', 'Set balama ascunsa SDK INVISIO 20 stanga/dreapta 3D, cu amortizare, 20kg, negru, set 2 buc,SDK-INV-20'],
    manson:  ['SDK-INV-20 MANSON', 'Set manson montare balama ascunsa SDK INVISIO 20 , zinc , negru, set 2 buc, SDK-INV-20 MANSON'],
    coltar:  ['SDK-INV-20 COLTAR', 'Set coltare pentru montaj profil si balama ascunsa SDK INVISIO 20, zinc , set 4 buc,SDK-INV-20 COLTAR'],
  },
  841: {
    balama:  ['SDK-INV-30', 'Set balama ascunsa SDK INVISIO 30 stanga/dreapta 3D, cu amortizare, 30kg, negru, set 2 buc,SDK-INV-30'],
    manson:  ['SDK-INV-30 MANSON', 'Set manson montare balama ascunsa SDK INVISIO 30 , zinc , negru, set 2 buc, SDK-INV-30 MANSON'],
    coltar:  ['SDK-INV-30 COLTAR', 'Set coltare pentru montaj profil si balama ascunsa SDK INVISIO 30, zinc , set 4 buc, SDK-INV-30 COLTAR'],
  },
};
INVISIO[842] = INVISIO[841];

// ── Stare implicită (state.rame) ────────────────────────────────────────────
export const randGol = () => ({ h: null, l: null, buc: 1, gauri: 0 });
export const randManerGol = () => ({ model: null, lungime: null, buc: 1 });
export const stareRameGoala = () => ({
  randuri: [randGol()],
  asamblare: null, geam: null, gaurire: null,
  balama: null, placuta: null, manson: true,
  maner: { randuri: [randManerGol()] },
  ral: '', vopsitCant: 0,
  livrare: null, agent: null, plata: null,
});

// ── Calcule ─────────────────────────────────────────────────────────────────
const rotunjeste = (val, lista) => lista.find(x => x >= val) ?? null;

const codRamaIndex = new Map((catalog.rame ?? []).map(a => [a.cod.toUpperCase(), a]));
export const gasesteRama = cod => codRamaIndex.get(String(cod).toUpperCase()) ?? null;

// Bucăţi (mm) pe bare (First Fit Decreasing) — ca macro-ul CalculeazaNrBare.
function bareNecesare(bucati, bara) {
  const bare = [];
  for (const L of [...bucati].sort((a, b) => b - a)) {
    if (L > bara) return { nr: null, eroare: `profil mâner: bucata de ${L} mm e mai lungă decât bara de ${bara} mm` };
    const i = bare.findIndex(rest => rest >= L);
    if (i >= 0) bare[i] -= L; else bare.push(bara - L);
  }
  return { nr: bare.length };
}

// Spec-ul unei comenzi de rame. `model` = '820' | '822' | … Rândurile fără H/L/buc
// se ignoră (rânduri goale din UI). Întoarce şi erorile de validare — le arată
// facturarea (blochează oferta, ca macro-ul Valideaza din formular).
export function specRame(model, state) {
  const m = MODELE_RAME[model];
  const r = state.rame ?? stareRameGoala();
  const fin = FINISAJE_RAME[state.finish];
  const erori = [];
  if (!fin) erori.push('alege culoarea');
  // fără găurire: nicio gaură, deci nici balamale / plăcuţe / şuruburi de balama
  const faraGaurire = r.gaurire === FARA_GAURIRE;
  const douaGauri  = r.gaurire === DOUA_GAURI;

  const randuri = (r.randuri ?? []).map((x, i) => {
    const h = +x.h || 0, l = +x.l || 0, buc = Math.max(0, Math.round(+x.buc || 0));
    const gauri = m.grup !== '820' || faraGaurire ? 0 : douaGauri ? 2 : Math.max(0, Math.round(+x.gauri || 0));
    if (!h || !l || !buc) return { i, gol: true, h, l, buc, gauri };
    const hR = rotunjeste(h, m.H), lR = rotunjeste(l, m.L);
    let cod = null, eroare = null;
    if (!hR || !lR) {
      eroare = `rândul ${i + 1}: ${h}×${l} depăşeşte mărimea maximă ${m.H.at(-1)}×${m.L.at(-1)}`;
    } else if (fin) {
      const art = gasesteRama(`${model}${fin.sufix} ${hR}x${lR}`);
      if (art) cod = art.cod; else eroare = `rândul ${i + 1}: lipsă cod ramă ${model}${fin.sufix} ${hR}x${lR}`;
    }
    if (eroare) erori.push(eroare);
    return {
      i, gol: false, h, l, buc, gauri, hR, lR, cod, eroare,
      geamH: h - m.scadereGeam, geamL: l - m.scadereGeam,
    };
  });
  const pline = randuri.filter(x => !x.gol);
  const nrRame = pline.reduce((s, x) => s + x.buc, 0);
  const nrGauri = pline.reduce((s, x) => s + x.buc * x.gauri, 0);
  const ariaGeam = pline.reduce((s, x) => s + x.buc * Math.max(0, x.geamH) * Math.max(0, x.geamL) / 1e6, 0);

  // mânerele (grupul 820): fiecare rând are modelul lui, codul vine în culoarea
  // ramei; pe fiecare cod bucăţile (lungime × buc) se aşază pe bare de BARA_MANER_MM.
  // Ofertele vechi aveau modelul (sau codul, `profil`) pe toată secţiunea.
  const manere = [];
  const maner = r.maner ?? {};
  const modelSectiune = maner.model ?? (maner.profil && maner.profil !== FARA_MANER ? modelDinCod(maner.profil) : null);
  if (m.grup === '820') {
    const peCod = new Map();
    (maner.randuri ?? []).forEach((x, i) => {
      const L = +x.lungime || 0, buc = Math.max(0, Math.round(+x.buc || 0));
      if (!L || !buc) return;                                   // rând gol
      const model = x.model ?? modelSectiune;
      if (!model) { erori.push(`mânerul de pe rândul ${i + 1}: alege modelul`); return; }
      const cod = codManer(model, state.finish);
      if (!cod) { if (fin) erori.push(`mânerul ${model} (rândul ${i + 1}) nu există în culoarea ${fin.label}`); return; }
      const e = peCod.get(cod) ?? { cod, bucati: [] };
      e.bucati.push(...Array(buc).fill(L));
      peCod.set(cod, e);
    });
    for (const e of peCod.values()) {
      const b = bareNecesare(e.bucati, BARA_MANER_MM);
      if (b.eroare) erori.push(b.eroare); else manere.push({ ...e, bare: b.nr });
    }
  }

  // validări (ca macro-ul Valideaza — câmpurile „Alege" blochează salvarea)
  if (!nrRame) erori.push('completează cel puţin un rând de rame (H, L, nr. buc)');
  if (!r.asamblare) erori.push('alege cine asamblează');
  if (r.asamblare === 'noi' && !r.geam) erori.push('alege geamul/oglinda (asamblăm noi)');
  if (!r.gaurire) erori.push('alege cotele de găurire');
  if (m.grup === '820' && !faraGaurire && !r.balama) erori.push('alege balamaua');
  if (m.grup === '820' && !faraGaurire && !r.placuta) erori.push('alege plăcuţa');
  const det = detaliiComanda(state);
  if (!det.livrare) erori.push('alege modul de livrare');
  if (!det.agent) erori.push('alege agentul');
  if (!det.plata) erori.push('alege metoda de plată');

  const maxH = Math.max(0, ...pline.map(x => x.h)), maxL = Math.max(0, ...pline.map(x => x.l));
  return {
    model, m, randuri, pline, nrRame, nrGauri, ariaGeam, manere, erori,
    // compatibilitate cu restul aplicaţiei (ofertă, cameră): „uşile" sunt ramele
    opening: { w: maxL, h: maxH },
    door:    { w: maxL, h: maxH, count: nrRame },
    summary: [
      { label: 'Nr. rame',        value: `${nrRame}` },
      { label: 'Mărimi',          value: `${pline.length}` },
      ...(m.grup === '820' ? [{ label: 'Găuri balamale', value: `${nrGauri}` }] : []),
      { label: 'Suprafaţă geam',  value: `${ceil2(ariaGeam)} mp` },
    ],
  };
}

const esteNegru = finisaj => finisaj === 'NEGRU PERIAT';

// Necesar („DE PREGĂTIT URMĂTOARELE ACCESORII" din formular) + ramele şi
// cotele de geam/oglindă pt. atelier.
export function bomRame(state, s) {
  const r = state.rame ?? {};
  const rows = [];
  for (const x of s.pline) {
    rows.push(line(x.cod ?? '⚠ LIPSĂ COD', gasesteRama(x.cod)?.denumire ?? `Ramă ${s.model} ${x.h}×${x.l}`, x.buc, 'buc', `${x.h} × ${x.l} mm`));
  }
  if (s.m.grup === '820') {
    const lista = BALAMALE[s.model];
    const bal = r.balama && r.balama !== FARA_BALAMALE ? lista.find(b => b[0] === r.balama) : null;
    const pl  = r.placuta && r.placuta !== FARA_PLACUTE ? PLACUTE[s.model].find(p => p[0] === r.placuta) : null;
    if (bal && s.nrGauri) rows.push(line(bal[0], bal[1], s.nrGauri, 'buc'));
    if (bal && pl && s.nrGauri) rows.push(line(pl[0], pl[1], s.nrGauri, 'buc'));
    if (bal && s.nrGauri) {
      const [cod, den] = SURUB_BALAMA[s.model];
      rows.push(line(cod ?? '—', den, 2 * s.nrGauri, 'buc'));
    }
    if (s.nrRame) {
      rows.push(line(...COLTAR_820[s.model], 4 * s.nrRame, 'buc'));
      rows.push(line(...SURUB_RAMA[esteNegru(state.finish) ? 'negru' : 'alb'], 8 * s.nrRame, 'buc'));
    }
  } else if (s.nrRame) {
    const inv = INVISIO[s.model];
    const gaurire = r.gaurire && r.gaurire !== FARA_GAURIRE;
    if (gaurire) rows.push(line(...inv.balama, s.nrRame, 'set'));
    if (gaurire && r.manson) rows.push(line(...inv.manson, s.nrRame, 'set'));
    rows.push(line(...inv.coltar, s.nrRame, 'set'));
    rows.push(line(...SURUB_RAMA[esteNegru(state.finish) ? 'negru' : 'alb'], 16 * s.nrRame, 'buc'));
  }
  // mânerele: bare de BARA_MANER_MM, bucăţile de tăiat alături
  for (const e of s.manere) {
    const peL = new Map();
    for (const L of e.bucati) peL.set(L, (peL.get(L) ?? 0) + 1);
    rows.push(line(e.cod, MANERE.find(x => x[0] === e.cod)?.[1] ?? 'Profil mâner', e.bare, 'bară',
      [...peL].sort((a, b) => b[0] - a[0]).map(([L, n]) => `${n} × ${L} mm`).join(', ')));
  }
  // COMANDA STICLA / OGLINDA (asamblăm noi) — cotele de debitare ale
  // geamului ales. Când asamblează clientul, cotele merg în necesarul
  // clientului (clientPanelsRame), ca la uşi: „COTE STICLA / OGLINDA".
  if (r.asamblare === 'noi') {
    const geam = findGeam(r.geam);
    for (const x of s.pline) {
      rows.push(line(geam?.cod ?? '⚠ ALEGE GEAM', geam?.denumire ?? 'Geam/oglindă', x.buc, 'buc', `${x.geamH} × ${x.geamL} mm`));
    }
  }
  return rows;
}

// Sticla de comandat la furnizor (NOI ASAMBLAM) — vezi currentSticla în builder.js.
export function sticlaRame(state, s) {
  const r = state.rame ?? {};
  const geam = r.asamblare === 'noi' ? findGeam(r.geam) : null;
  if (!geam) return [];
  const m = new Map();
  for (const x of s.pline) {
    if (!(x.geamH > 0 && x.geamL > 0)) continue;
    const k = `${x.geamH}|${x.geamL}`;
    const e = m.get(k) ?? { cod: geam.cod, denumire: geam.denumire, h: x.geamH, l: x.geamL, buc: 0 };
    e.buc += x.buc;
    m.set(k, e);
  }
  return [...m.values()];
}

// Cotele de geam/oglindă pt. CLIENT (CLIENTUL ASAMBLEAZA) — şi le procură singur.
// Necesarul clientului când asamblează el: sticla de 4 mm (userul, 2026-09-25),
// grupată pe cotă, plus totalul (bucăţi şi mp) — tot ce are de comandat.
export const STICLA_CLIENT = 'Sticlă 4 mm';
export function clientPanelsRame(state, s) {
  if ((state.rame ?? {}).asamblare !== 'client') return [];
  const peCota = new Map();
  for (const x of s.pline) {
    if (!(x.geamH > 0 && x.geamL > 0)) continue;
    const cut = `${x.geamH} × ${x.geamL} mm`;
    peCota.set(cut, (peCota.get(cut) ?? 0) + x.buc);
  }
  const randuri = [...peCota].map(([cut, qty]) => ({ label: STICLA_CLIENT, qty, unit: 'buc', cut }));
  const buc = randuri.reduce((a, r) => a + r.qty, 0);
  if (buc) randuri.push({ label: `Total ${STICLA_CLIENT.toLowerCase()}`, qty: buc, unit: 'buc', cut: `${String(ceil2(s.ariaGeam)).replace('.', ',')} mp` });
  return randuri;
}

// Facturare („De facturat" din formular). Întoarce direct liniile finale.
export function facturareRame(state, s) {
  const r = state.rame ?? {};
  const lines = [];
  const add = (cod, denumire, cantitate, um = 'buc') => { if (cod && cantitate > 0) lines.push({ cod, denumire, um, cantitate: ceil2(cantitate) }); };

  // ramele — aceleaşi coduri se adună (UNIQUE + SUMIFS în formular)
  const peCod = new Map();
  for (const x of s.pline) if (x.cod) peCod.set(x.cod, (peCod.get(x.cod) ?? 0) + x.buc);
  for (const [cod, n] of peCod) add(cod, gasesteRama(cod)?.denumire, n);

  if (s.m.grup === '820') {
    const bal = r.balama && r.balama !== FARA_BALAMALE ? BALAMALE[s.model].find(b => b[0] === r.balama) : null;
    const pl  = r.placuta && r.placuta !== FARA_PLACUTE ? PLACUTE[s.model].find(p => p[0] === r.placuta) : null;
    if (bal) add(bal[0], bal[1], s.nrGauri);
    if (bal && pl) add(pl[0], pl[1], s.nrGauri);
    const [codSurub, denSurub] = SURUB_BALAMA[s.model];
    if (bal && codSurub) add(codSurub, denSurub, 2 * s.nrGauri);
  } else {
    const inv = INVISIO[s.model];
    const gaurire = r.gaurire && r.gaurire !== FARA_GAURIRE;
    if (gaurire) add(inv.balama[0], inv.balama[1], s.nrRame, 'set');
    if (gaurire && r.manson) add(inv.manson[0], inv.manson[1], s.nrRame, 'set');
  }

  if (r.asamblare === 'noi') {
    const geam = findGeam(r.geam);
    if (geam) {
      add(geam.cod, geam.denumire, s.ariaGeam, 'mp');
      if (geam.oglinda) add(FOLIE_COD, 'Folie pentru securizare 1 rola 50x05ml cod 283', folieCantitate(s.ariaGeam));
    }
    // manopera: la 820 după H rotunjit (> 1200), la 831 după H real (≥ 1200)
    const peste = x => (s.m.manopera === 'rotunjit' ? x.hR > 1200 : x.h >= 1200);
    add('Manop >H1200', 'Manopera asamblare rama >H1200', s.pline.filter(peste).reduce((a, x) => a + x.buc, 0));
    add('Manop <H1200', 'Manopera asamblare rama <H1200', s.pline.filter(x => !peste(x)).reduce((a, x) => a + x.buc, 0));
  }

  for (const e of s.manere) add(e.cod, MANERE.find(x => x[0] === e.cod)?.[1], e.bare);
  // cantitatea o trece omul manual (ca în formular); codul RAL apare pe fişă
  if (+r.vopsitCant > 0) add('Manop vopsit', 'Manopera pentru vopsit', +r.vopsitCant);
  // transportul (CHLTTRMANIP) îl adaugă builder.js, la toate gamele — lib/comun/comanda.js

  return { lines, errors: s.erori };
}

// ── Randare 3D — ramele din comandă, una lângă alta, pe podea ──────────────
// Faţa profilului = prima cotă din denumire (45 la 820, 19 la 822/824 …),
// adâncimea = a doua. Doar vizual. La grupul 820 se marchează pe spate
// găurile de balama (Ø35) pe latura stângă, după cotele de găurire alese.
const MAX_RAME_3D = 12;
const GOL_INTRE_RAME_MM = 120;

export function pozitiiGauri(h, n, regula) {
  if (n <= 0) return [];
  if (n === 1) return [h / 2];
  const sus = h - 100, jos = 100;
  if (regula === '100 mm sus/jos si la mijloc' && n === 3) return [jos, h / 2, sus];
  return Array.from({ length: n }, (_, k) => jos + (sus - jos) * k / (n - 1));
}

// ── Secţiunile profilelor (pt. 3D) ─────────────────────────────────────────
// 831, 841, 842: după desenele cotate din „schite rame"; 820, 822, 824: după
// pictograme, la cotele din denumire. APROXIMATIVE, doar pt. desen (userul,
// 2026-09-24). Coordonate în mm: u = de la muchia exterioară a ramei spre
// interior (faţa), z = adâncime de la FAŢĂ (0) spre spate. geamZ = mijlocul
// geamului (în falţul din spate). Pe fiecare latură profilul se extrudează şi
// se taie la 45° la colţuri.
//   820/824/841: corp + buză la muchia exterioară, pe spate, care ţine geamul
//     (geamul ajunge la 2,5–3 mm de muchie = scăderea 5 / 6 din formular)
//   822: falţ în L spre interior-spate (geamul la 14,5 mm = scăderea 29)
//   831: corp cu canal pt. balamaua INVISIO şi degajare rotunjită
//   842: 841 cu mâner (buză curbă de 10 mm, la muchie); doar pe o verticală
//   intors: la 841/842 partea cu buza (şi cu mânerul la 842) e FAŢA ramei (userul,
//     2026-09-24) — secţiunile sunt desenate invers, de-aia se întorc la randare.
const SECTIUNI_RAME = {
  820: { geamZ: 17.5, puncte: [[0, 0], [45, 0], [45, 15], [3, 15], [3, 19.5], [7, 19.5], [7, 21.5], [0, 21.5]] },
  822: { geamZ: 15.5, puncte: [[0, 0], [19, 0], [19, 11], [12, 11], [12, 20], [0, 20]] },
  824: { geamZ: 15.5, puncte: [[0, 0], [19, 0], [19, 12.5], [3, 12.5], [3, 18], [8, 18], [8, 20], [0, 20]] },
  841: { geamZ: 22, intors: true, puncte: [[0, 0], [22.3, 0], [22.3, 17], [2.2, 17], [2.2, 27.3], [7.2, 27.3], [7.2, 29.5], [0, 29.5]] },
  831: { geamZ: 13, desen: S => {   // desenul e rotit: orizontala = adâncimea, verticala = faţa (sus = muchia)
    const P = (x, y) => [19.5 - y, x];
    S.moveTo(...P(0, 0)); [[24.7, 0], [24.7, 1.8], [23.6, 1.8], [23.6, 6.6], [24.7, 6.6], [24.7, 8.4], [20.6, 8.4], [20.6, 10.8]]
      .forEach(p => S.lineTo(...P(...p)));
    for (let k = 1; k <= 8; k++) { const a = Math.PI - (Math.PI / 2) * k / 8; S.lineTo(...P(26.2 + 5.6 * Math.cos(a), 10.8 + 5.6 * Math.sin(a))); }
    [[26.2, 18.7], [25.4, 19.5], [0, 19.5]].forEach(p => S.lineTo(...P(...p)));
  } },
  // 842: desenul e TRANSPUS faţă de ramă (userul: „oglindit şi rotit 90 de grade",
  // apoi „încă o dată oglindit" = faţă ↔ spate): orizontala (40, cu mânerul) =
  // adâncimea, verticala (22,3) = faţa, jos = muchia. Corpul (x 17,7…40) stă în
  // planul celorlalte laturi, cu faţa la x = 40; mânerul iese 17,7 mm în SPATE.
  842: { geamZ: 22, intors: true, desen: S => {
    const P = (x, y) => [y, 40 - x];
    [[0, 0], [40, 0], [40, 22.3], [17.7, 22.3], [17.7, 1.6], [10.4, 1.6], [10.4, 5.7], [9.2, 5.7], [9.2, 1.6], [7, 1.6]]
      .forEach((p, i) => (i ? S.lineTo(...P(...p)) : S.moveTo(...P(...p))));
    S.quadraticCurveTo(...P(1.6, 1.6), ...P(1.6, 10)); S.lineTo(...P(0.6, 10.6)); S.lineTo(...P(0, 10));
  } },
};

// O latură de ramă de lungime L (cota exterioară), ca verticala din STÂNGA:
// x = u, y = de-a lungul laturii (centrat), z = adâncimea (faţa spre privitor).
// Tăietura la 45°: la adâncimea u de la muchie, latura are L − 2u.
function laturaRama(THREE, mm, model, L, d) {
  const sec = SECTIUNI_RAME[model];
  const S = new THREE.Shape();
  if (sec.desen) sec.desen(S); else sec.puncte.forEach((p, i) => (i ? S.lineTo(...p) : S.moveTo(...p)));
  const g = new THREE.ExtrudeGeometry(S, { depth: 1, bevelEnabled: false, curveSegments: 8 });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), z = p.getY(i), e = p.getZ(i);
    p.setXYZ(i, mm(u), mm((e - 0.5) * (L - 2 * Math.max(0, u))), mm(sec.intors ? z - d / 2 : d / 2 - z));
  }
  g.computeVertexNormals();
  return g;
}

export function buildRame(group, state, s, { THREE, box, mm, aluColor }) {
  const r = state.rame ?? {};
  const fata = s.m.fata, adanc = +s.m.profil.split('x')[1];
  // DoubleSide: laturile se obţin prin rotire, dar vârfurile sunt mutate de mână
  const alu = new THREE.MeshStandardMaterial({ color: aluColor, metalness: 0.65, roughness: 0.35, side: THREE.DoubleSide });
  const geam = r.asamblare === 'noi' ? findGeam(r.geam) : null;
  const sticla = geam?.oglinda
    // fără hartă de mediu, un metal „perfect" iese negru — oglindă mată, luminată
    ? new THREE.MeshStandardMaterial({ color: 0xc3ced6, metalness: 0.25, roughness: 0.15, emissive: 0x20282e })
    : new THREE.MeshPhysicalMaterial({ color: 0xbfd6e0, transparent: true, opacity: 0.28, roughness: 0.05, side: THREE.DoubleSide });
  const gaura = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.4, roughness: 0.5 });
  const e842 = s.model === '842';
  const prof = e842 ? '841' : s.model;               // 842: celelalte 3 laturi sunt din 841
  const d = SECTIUNI_RAME[prof] ? Math.max(...(SECTIUNI_RAME[prof].puncte ?? [[0, adanc]]).map(p => p[1])) : adanc;

  // toate exemplarele, cât încap; peste MAX_RAME_3D câte una din fiecare rând
  let rame = s.pline.flatMap(x => Array(x.buc).fill(x));
  if (rame.length > MAX_RAME_3D) rame = s.pline;
  const total = rame.reduce((a, x) => a + x.l, 0) + GOL_INTRE_RAME_MM * Math.max(0, rame.length - 1);
  let x0 = -total / 2;

  for (const x of rame) {
    const W = mm(x.l), H = mm(x.h), f = mm(fata), D = mm(d);
    const cx = mm(x0 + x.l / 2);
    const add = (m, px, py, pz = 0) => { m.position.set(cx + px, py, pz); group.add(m); };
    // laturile: aceeaşi geometrie „stânga", rotită în planul ramei
    const latura = (L, rot, px, py, model = prof) => {
      const m = new THREE.Mesh(laturaRama(THREE, mm, model, L, d), alu);
      m.rotation.z = rot;
      add(m, px, py);
    };
    latura(x.h, 0, -W / 2, H / 2);                                  // stânga
    if (e842) latura(x.h, Math.PI, W / 2, H / 2, '842');          // dreapta = profilul cu mâner
    else latura(x.h, Math.PI, W / 2, H / 2);                        // dreapta
    latura(x.l, -Math.PI / 2, 0, H);                                // sus
    latura(x.l, Math.PI / 2, 0, 0);                                 // jos
    // geamul la cota lui reală, în falţul din spate
    const gz = mm(SECTIUNI_RAME[prof]?.geamZ ?? d / 2);
    add(box(mm(x.geamL), mm(x.geamH), mm(4), sticla), 0, H / 2, SECTIUNI_RAME[prof]?.intors ? gz - D / 2 : D / 2 - gz);
    if (s.m.grup === '820') {
      for (const y of pozitiiGauri(x.h, x.gauri, r.gaurire)) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(mm(17.5), mm(17.5), mm(2), 24), gaura);
        c.rotation.x = Math.PI / 2;
        add(c, -W / 2 + f / 2, mm(y), -D / 2 - mm(1));
      }
    }
    x0 += x.l + GOL_INTRE_RAME_MM;
  }
}
