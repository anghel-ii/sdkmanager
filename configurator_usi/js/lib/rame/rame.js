import catalog from '../../catalog/catalog.generated.json';
import { line } from './bom.js';
import { findGeam, FOLIE_COD, folieCantitate } from './geam.js';

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
export const GAURIRE_820 = ['100 mm de margini sus/jos', '100 mm sus/jos si la mijloc',
                            '100 mm sus/jos si impartite egal', 'vezi schita pe spate'];
export const GAURIRE_831 = ['Fara gaurire', 'Gaurire Standard'];
export const LIVRARE = ['Ridicare personala', 'Curier ramburs', 'Curier op avans', 'Curier op la termen', 'Cu masina noastra'];
export const AGENTI = ['Birou', 'Site', 'Serban Dragos', 'Bondrea Oliver', 'Coroma Ciprian',
                       'Cucolas Catalin', 'Moise Razvan', 'Tanvuia Adrian'];
export const FACTURARE = ['BF', 'Factura fiscala', 'Oferta'];
const LIVRARE_COD = 'CHLTTRMANIP';

// ── Accesorii grup 820 (820 / 822 / 824) ────────────────────────────────────
// Balamale şi plăcuţe: lista diferă între 820 şi 822/824 (Sheet3!I120:K170).
export const BALAMALE = {
  820: [
    ['71B3550 NICHEL', '820 BALAMA APLICATA CU AMORTIZARE INCORPORATA FINISAJ NICHEL DESCHIDERE 110 GRADE COD 71B3550 NICHEL'],
    ['70T3550.TL NICHEL', '820 BALAMA APLICATA FARA ARC FINISAJ NICHEL DESCHIDERE 110 GRADE COD 70T3550.TL NICHEL'],
    ['71B3650 NICHEL', '820 BALAMA SEMIAPLICATA CU AMORTIZARE FINISAJ NICHEL DESCHIDERE 110 GRADE COD 71B3650 NICHEL'],
    ['70T3650.TL NICHEL', '820 BALAMA SEMIAPLICATA FARA ARC FINISAJ NICHEL DESCHIDERE 110 GRADE COD 71B3650 NICHEL COD 70T3650.TL NICHEL'],
    ['71B3750 NICHEL', '820 BALAMA INCADRATA CU AMORTIZARE FINISAJ NICHEL DESCHIDERE 110 GRADE COD 71B3750 NICHEL'],
    ['70T3750.TL NICHEL', '820 BALAMA INCADRATA FARA ARC FINISAJ NICHEL DESCHIDERE 110 GRADE COD 70T3750.TL NICHEL'],
    ['71B3550 ONYX', '820 BALAMA APLICATA CU AMORTIZARE INCORPORATA FINISAJ NEGRU DESCHIDERE 110 GRADE COD 71B3550 ONYX'],
    ['71B7550 ONYX', '820 BALAMA APLICATA CU AMORTIZARE CU PATRUNDERE 0 DESCHIDERE 155 GRADE FINISAJ NEGRU COD 71B7550 ONYX'],
    ['70T3550.TL ONYX', '820 BALAMA APLICATA FARA ARC FINISAJ NEGRU DESCHIDERE 110 GRADE COD 70T3550.TL ONYX'],
    ['71B3650 ONYX', '820 BALAMA SEMIAPLICATA CU AMORTIZARE FINISAJ NEGRU DESCHIDERE 110 GRADE COD 71B3650 ONYX'],
    ['70T3650.TL ONYX', '820 BALAMA SEMIAPLICATA FARA ARC FINISAJ NEGRU DESCHIDERE 110 GRADE COD 70T3650.TL ONYX'],
    ['71B3750 ONYX', '820 BALAMA INCADRATA CU AMORTIZARE FINISAJ NEGRU DESCHIDERE 110 GRADE COD 71B3750 ONYX'],
    ['70T3750.TL ONYX', '820 BALAMA INCADRATA FARA ARC FINISAJ NEGRU DESCHIDERE 110 GRADE COD 70T3750.TL ONYX'],
  ],
  822: [
    ['9072524', '822/824 BALAMA APLICATA CU AMORTIZARE FINISAJ NICHEL COD 9072524'],
    ['9072527', '822/824 BALAMA APLICATA CU ARC FINISAJ NICHEL COD 9072527'],
    ['9072530', '822/824 BALAMA APLICATA FARA ARC FINISAJ NICHEL COD 9072530'],
    ['9072525', '822/824 BALAMA SEMIAPLICATA CU AMORTIZARE FINISAJ NICHEL COD 9072525'],
    ['9072528', '822/824 BALAMA SEMIAPLICATA CU ARC FINISAJ NICHEL COD 9072528'],
    ['9072531', '822/824 BALAMA SEMIAPLICATA FARA ARC FINISAJ NICHEL COD 9072531'],
    ['9072526', '822/824 BALAMA INCADRATA CU AMORTIZARE FINISAJ NICHEL COD 9072526'],
    ['9072529', '822/824 BALAMA INCADRATA CU ARC FINISAJ NICHEL COD 9072529'],
    ['9072532', '822/824 BALAMA INCADRATA FARA ARC FINISAJ NICHEL COD 9072532'],
    ['9091744', '822/824 BALAMA APLICATA CU AMORTIZARE FINISAJ NEGRU COD 9091744'],
    ['9350389', '822/824 BALAMA APLICATA FARA ARC FINISAJ NEGRU COD 9350389'],
    ['9350390', '822/824 BALAMA SEMIAPLICATA FARA ARC FINISAJ NEGRU COD 9350390'],
    ['9091992', '822/824 BALAMA SEMIAPLICATA CU AMORTIZARE FINISAJ NEGRU COD 9091992'],
    ['9350421', '822/824 BALAMA INCADRATA FARA ARC FINISAJ NEGRU COD 9350421'],
    ['9091993', '822/824 BALAMA INCADRATA CU AMORTIZARE FINISAJ NEGRU COD 9091993'],
    ['BSV001', '822/824 Balama SV aplicata cu amortizare, finisaj nichel pt rama 822 si 824 cu placuta in cruce inclusa cod BSV001'],
    ['BSV002', '822/824 Balama SV aplicata cu amortizare, finisaj negru pt rama 822 si 824 cu placuta in cruce inclusa cod BSV002'],
    ['SDK32D221A0', '822/824 Balama SDK aplicata 3D pentru rama ingusta 822/824 , nichel , placuta cu excentric inclusa cod SDK32D221A0'],
    ['SDK32D221B0', '822/824 Balama SDK aplicata 3D pentru rama ingusta 822/824 , negru , placuta cu excentric inclusa cod SDK32D221B0'],
  ],
};
BALAMALE[824] = BALAMALE[822];

export const PLACUTE = {
  820: [
    ['173H7100 NICHEL', '820 PLACUTA IN CRUCE REGLAJ CU EXCENTRIC FINISAJ NICHEL COD 173H7100 NICHEL'],
    ['175H3100 NICHEL', '820 PLACUTA IN LINIE REGLAJ CU EXCENTRIC FINISAJ NICHEL COD 175H3100 NICHEL'],
    ['173H7100 ONYX', '820 PLACUTA IN CRUCE REGLAJ CU EXCENTRIC FINISAJ NEGRU COD 173H7100 ONYX'],
    ['175H3100 ONYX', '820 PLACUTA IN LINIE REGLAJ CU EXCENTRIC FINISAJ NEGRU COD 175H3100 ONYX'],
  ],
  822: [
    ['9071576', '822/824 PLACUTA IN CRUCE 1.5MM REGLAJ SIMPLU FINISAJ NICHEL COD 9071576'],
    ['9071671', '822/824 PLACUTA IN CRUCE 1.5 MM REGLAJ CU EXCENTRIC FINISAJ NICHEL COD 9071671'],
    ['9117341', '822/824 PLACUTA IN LINIE 1.5 MM REGLAJ CU EXCENTRIC FINISAJ NICHEL COD 9117341'],
    ['9091800', '822/824 PLACUTA IN CRUCE 1.5MM REGLAJ SIMPLU FINISAJ NEGRU COD 9091800'],
    ['9359652', '822/824 PLACUTA IN CRUCE 1.5 MM REGLAJ CU EXCENTRIC FINISAJ NEGRU COD 9359652'],
    ['9117471', '822/824 PLACUTA IN LINIE 1.5 MM REGLAJ CU EXCENTRIC FINISAJ NEGRU COD 9117471'],
    ['9075087', '822/824 PLACUTA IN CRUCE 3 MM REGLAJ CU EXCENTRIC,FINISAJ NICHEL, DOAR PT BALAMA INCADRATA COD 9075087'],
    ['9075007', '822/824 PLACUTA IN CRUCE 3MM REGLAJ FARA EXCENTRIC, FINISAJ NICHEL DOAR PT BALAMA INCADRATA COD 9075007'],
    ['9091805', '822/824 PLACUTA IN CRUCE 3 MM REGLAJ CU EXCENTRIC,FINISAJ NEGRU, DOAR PT BALAMA INCADRATA COD 9091805'],
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
  alb:   ['828', 'Surub cu cap inecat imbus 4x10 zincat alb  cod 828'],
};
// Şuruburile pt. balamale: la 820 se facturează (830); la 822/824 vin în cutia
// cu balamale — apar doar la „de pregătit", cu mesajul din formular.
const SURUB_BALAMA = {
  820: ['830', 'Pentru rama model 820 - Surub autoforant cu cap inecat otel zincat 3.5x13mm DIN 7504P pt prinderea balamalelor cod 830'],
  822: [null, 'Pentru rama model 822 sau 824 - Surub autoforant pentru balamale la ramele inguste(in cutia cu balamele) Nu facturam'],
  824: [null, 'Pentru rama model 822 sau 824 - Surub autoforant pentru balamale la ramele inguste(in cutia cu balamele) Nu facturam'],
};

// Profil mâner (doar grupul 820) — bare, bucăţile se aşază pe bare de 2500mm
// (macro-ul CalculeazaNrBare din formular).
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
  ['779', 'Profil maner L 40 mm, finisaj aluminiu 3m cod 779'],
  ['778', 'Profil maner Neo 40x18x3 m, finisaj auriu periat cod 778'],
  ['776', 'Profil maner Neo 42x18x3 m, finisaj alb cod 776'],
  ['775', 'Profil maner Neo 42x18x3 m, finisaj aluminiu cod 775'],
  ['777', 'Profil maner Neo 42x18x3 m, finisaj negru periat cod 777'],
];
export const FARA_MANER = 'Fara profil maner';
const BARA_MANER_MM = 2500;

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
export const stareRameGoala = () => ({
  randuri: [randGol()],
  asamblare: null, geam: null, gaurire: null,
  balama: null, placuta: null, manson: true,
  maner: { profil: FARA_MANER, randuri: [{ lungime: null, buc: 1 }] },
  ral: '', vopsitCant: 0,
  livrare: null, agent: null, facturare: null,
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

  const randuri = (r.randuri ?? []).map((x, i) => {
    const h = +x.h || 0, l = +x.l || 0, buc = Math.max(0, Math.round(+x.buc || 0));
    const gauri = m.grup === '820' ? Math.max(0, Math.round(+x.gauri || 0)) : 0;
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

  // mâner (grupul 820)
  let bareManer = 0;
  const maner = r.maner ?? {};
  if (m.grup === '820' && maner.profil && maner.profil !== FARA_MANER) {
    const bucati = (maner.randuri ?? []).flatMap(x => Array(Math.max(0, Math.round(+x.buc || 0))).fill(+x.lungime || 0)).filter(L => L > 0);
    const b = bareNecesare(bucati, BARA_MANER_MM);
    if (b.eroare) erori.push(b.eroare); else bareManer = b.nr;
  }

  // validări (ca macro-ul Valideaza — câmpurile „Alege" blochează salvarea)
  if (!nrRame) erori.push('completează cel puţin un rând de rame (H, L, nr. buc)');
  if (!r.asamblare) erori.push('alege cine asamblează');
  if (r.asamblare === 'noi' && !r.geam) erori.push('alege geamul/oglinda (asamblăm noi)');
  if (!r.gaurire) erori.push('alege cotele de găurire');
  if (m.grup === '820' && !r.balama) erori.push('alege balamaua');
  if (m.grup === '820' && !r.placuta) erori.push('alege plăcuţa');
  if (!r.livrare) erori.push('alege modul de livrare');
  if (!r.agent) erori.push('alege agentul');
  if (!r.facturare) erori.push('alege tipul de facturare');

  const maxH = Math.max(0, ...pline.map(x => x.h)), maxL = Math.max(0, ...pline.map(x => x.l));
  return {
    model, m, randuri, pline, nrRame, nrGauri, ariaGeam, bareManer, erori,
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
    const gaurire = r.gaurire && r.gaurire !== 'Fara gaurire';
    if (gaurire) rows.push(line(...inv.balama, s.nrRame, 'set'));
    if (gaurire && r.manson) rows.push(line(...inv.manson, s.nrRame, 'set'));
    rows.push(line(...inv.coltar, s.nrRame, 'set'));
    rows.push(line(...SURUB_RAMA[esteNegru(state.finish) ? 'negru' : 'alb'], 16 * s.nrRame, 'buc'));
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
export function clientPanelsRame(state, s) {
  if ((state.rame ?? {}).asamblare !== 'client') return [];
  return s.pline.map(x => ({ label: 'Geam / oglindă', qty: x.buc, unit: 'buc', cut: `${x.geamH} × ${x.geamL} mm` }));
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
    const gaurire = r.gaurire && r.gaurire !== 'Fara gaurire';
    if (gaurire) add(inv.balama[0], inv.balama[1], s.nrRame, 'set');
    if (gaurire && r.manson) add(inv.manson[0], inv.manson[1], s.nrRame, 'set');
  }

  if (r.asamblare === 'noi') {
    const geam = findGeam(r.geam);
    if (geam) {
      add(geam.cod, geam.denumire, s.ariaGeam, 'mp');
      if (geam.oglinda) add(FOLIE_COD, 'Folie securizare', folieCantitate(s.ariaGeam));
    }
    // manopera: la 820 după H rotunjit (> 1200), la 831 după H real (≥ 1200)
    const peste = x => (s.m.manopera === 'rotunjit' ? x.hR > 1200 : x.h >= 1200);
    add('Manop >H1200', 'Manopera asamblare rama >H1200', s.pline.filter(peste).reduce((a, x) => a + x.buc, 0));
    add('Manop <H1200', 'Manopera asamblare rama <H1200', s.pline.filter(x => !peste(x)).reduce((a, x) => a + x.buc, 0));
  }

  const maner = r.maner ?? {};
  if (s.m.grup === '820' && s.bareManer) {
    const p = MANERE.find(x => x[0] === maner.profil);
    if (p) add(p[0], p[1], s.bareManer);
  }
  // cantitatea o trece omul manual (ca în formular); codul RAL apare pe fişă
  if (+r.vopsitCant > 0) add('Manop vopsit', 'Manopera pentru vopsit (daca este cazul)', +r.vopsitCant);
  if (r.livrare && r.livrare !== 'Ridicare personala') add(LIVRARE_COD, `Mod de livrare-${r.livrare}`, 1);

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

export function buildRame(group, state, s, { THREE, box, mm, aluColor }) {
  const r = state.rame ?? {};
  const fata = s.m.fata, adanc = +s.m.profil.split('x')[1];
  const alu = new THREE.MeshStandardMaterial({ color: aluColor, metalness: 0.65, roughness: 0.35 });
  const geam = r.asamblare === 'noi' ? findGeam(r.geam) : null;
  const sticla = geam?.oglinda
    // fără hartă de mediu, un metal „perfect" iese negru — oglindă mată, luminată
    ? new THREE.MeshStandardMaterial({ color: 0xc3ced6, metalness: 0.25, roughness: 0.15, emissive: 0x20282e })
    : new THREE.MeshPhysicalMaterial({ color: 0xbfd6e0, transparent: true, opacity: 0.28, roughness: 0.05, side: THREE.DoubleSide });
  const gaura = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.4, roughness: 0.5 });

  // toate exemplarele, cât încap; peste MAX_RAME_3D câte una din fiecare rând
  let rame = s.pline.flatMap(x => Array(x.buc).fill(x));
  if (rame.length > MAX_RAME_3D) rame = s.pline;
  const total = rame.reduce((a, x) => a + x.l, 0) + GOL_INTRE_RAME_MM * Math.max(0, rame.length - 1);
  let x0 = -total / 2;

  for (const x of rame) {
    const W = mm(x.l), H = mm(x.h), f = mm(fata), d = mm(adanc);
    const cx = mm(x0 + x.l / 2);
    const add = (m, px, py, pz = 0) => { m.position.set(cx + px, py, pz); group.add(m); };
    add(box(f, H, d, alu), -W / 2 + f / 2, H / 2);            // stânga
    add(box(f, H, d, alu),  W / 2 - f / 2, H / 2);            // dreapta
    add(box(W - 2 * f, f, d, alu), 0, H - f / 2);             // sus
    add(box(W - 2 * f, f, d, alu), 0, f / 2);                 // jos
    add(box(W - 2 * f + mm(4), H - 2 * f + mm(4), mm(4), sticla), 0, H / 2);
    if (s.m.grup === '820') {
      for (const y of pozitiiGauri(x.h, x.gauri, r.gaurire)) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(mm(17.5), mm(17.5), mm(2), 24), gaura);
        c.rotation.x = Math.PI / 2;
        add(c, -W / 2 + f / 2, mm(y), -d / 2 - mm(1));
      }
    }
    x0 += x.l + GOL_INTRE_RAME_MM;
  }
}
