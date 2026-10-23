// node test/amanunt.test.mjs — produsele ofertei cu amănuntul + căutarea din pagină
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cautator, normal, debitare, sePoatePeJumatate, laBara, arie, rotunjeste } from '../js/amanunt-calcul.js';
import { liniaTransport, LIVRARE } from '../js/lib/comun/comanda.js';

const produse = JSON.parse(fs.readFileSync(new URL('../js/catalog/amanunt.json', import.meta.url)));
assert.ok(produse.length > 500, `prea puţine produse: ${produse.length}`);
assert.ok(produse.every(p => p.cod && p.denumire && p.um), 'fiecare produs are cod, denumire şi UM');
assert.equal(new Set(produse.map(p => p.cod)).size, produse.length, 'coduri unice');

const cauta = cautator(produse);
const gasite = cauta('maner auriu');
assert.ok(gasite.length > 0 && gasite.every(p => ['maner', 'auriu'].every(c => normal(p.denumire + ' ' + p.cod).includes(c))),
  'toate cuvintele, în orice ordine');
assert.deepEqual(cauta('mâner AURIU').map(p => p.cod), gasite.map(p => p.cod), 'fără diacritice şi majuscule');
const cuCod = produse.find(p => /^\d{3}$/.test(p.cod));
assert.equal(cauta(cuCod.cod)[0].cod, cuCod.cod, 'codul exact vine primul');
assert.deepEqual(cauta('   '), [], 'nimic scris → nicio sugestie');
// „gola c" → întâi Gola „C" (cuvântul întreg „c"), nu Gola corp… / capete / colţuri; ghilimelele nu contează
const golaC = /^Gola ("C"|''C'')/;
assert.ok(cauta('gola c').slice(0, 8).every(p => golaC.test(p.denumire)), cauta('gola c').slice(0, 8).map(p => p.denumire).join(' | '));
assert.deepEqual(cauta('gola "c"').map(p => p.cod), cauta('gola c').map(p => p.cod), 'cu sau fără ghilimele');
assert.ok(cauta('gola j alb').slice(0, 3).every(p => /^Gola ("J"|''J'').*alb/.test(p.denumire)), 'gola j alb → Gola „J" alb');
assert.ok(cauta('gola j alb 26').slice(0, 3).some(p => p.cod === '411'), '26 găseşte „57X26"');
assert.equal(cauta('tandembox alb 500')[0]?.cod, 'TB500A', 'mărimea din cod: 500 în „TB500"');
assert.ok(/^Gola ''C'' 4,2 m finisaj negru/.test(cauta('gol c negru')[0].denumire), 'început de cuvânt: „gol" → Gola');
assert.ok(cauta('manr auriu 128').length && cauta('manr auriu 128').every(p => /^maner/i.test(p.denumire)), 'greşeală de tastare: manr → maner');

// produsele la bară: lungimea din denumire, peste 1,5 m
const bara = cod => produse.find(p => p.cod === cod)?.bara;
assert.ok(produse.some(p => p.bara === 4200 && /4,2 ?m/.test(p.denumire)), '„4,2 m" → bară de 4200 mm');
assert.ok(produse.every(p => !p.bara || (p.bara > 1500 && p.um.toLowerCase() === 'buc')), 'doar bare peste 1,5 m, la bucată');
assert.ok(!produse.some(p => p.bara && /cablu/i.test(p.denumire) && /1,[58] ?m/.test(p.denumire)), 'cablul prizelor nu e bară');
assert.equal(bara('13440191021'), 4000, '„inox 4 m" — „x"-ul din inox nu e o secţiune');
assert.ok(['13352261007', '13352261021', '13352271007', '778'].every(c => bara(c)), 'Initio auriu / inox şi Neo — bara pe cod');
assert.ok(produse.some(p => p.grupa === 'Produse finite Gama Lux'), 'gama Lux inclusă');

// debitarea: 4 × 1200 + 2 × 800 pe bare de 4200 → 2 bare (3 × 1200 | 1200 + 2 × 800)
assert.deepEqual(debitare([{ l: 1200, buc: 4 }, { l: 800, buc: 2 }], 4200), { nr: 2, resturi: [600, 1400], preaLungi: [], bucati: 6 });
assert.equal(debitare([{ l: 2100, buc: 2 }], 4200).nr, 1, 'fix cât bara → o bară');
assert.equal(debitare([{ l: 2100, buc: 2 }], 4200, 3).nr, 2, 'cu pânza de 3 mm nu mai încap două');
assert.deepEqual(debitare([{ l: 5000, buc: 1 }], 4200).preaLungi, [5000], 'bucata mai lungă decât bara');
assert.equal(debitare([{ l: '', buc: '' }], 4200), null, 'nicio bucată → fără debitare');
// pe jumătate de bară: toate profilele Gola la bară, fără cupru; accesoriile (capete, colţuri) nu sunt la bară
const peJum = new Set(produse.filter(sePoatePeJumatate).map(p => p.cod));
assert.ok(peJum.has('412') && peJum.has('733N') && peJum.has('410'), 'Gola C / verticală / corp suspendat — pe jumătate');
assert.ok(!['544', '543', '545', '435', '436'].some(c => peJum.has(c)), 'Gola cupru — doar bare întregi');
assert.ok(!peJum.has('455') && [...peJum].every(c => produse.find(p => p.cod === c).bara), 'accesoriile nu, doar ce e la bară');
// bara folosită cel mult pe jumătate = 0,5
assert.deepEqual(debitare([{ l: 1000, buc: 1 }], 4200, 0, true), { nr: 0.5, resturi: [1100], preaLungi: [], bucati: 1 });
assert.equal(debitare([{ l: 2000, buc: 3 }], 4200, 0, true).nr, 1.5, '3 × 2000: o bară + o jumătate');
assert.equal(debitare([{ l: 2100, buc: 1 }], 4200, 0, true).nr, 0.5, 'fix cât jumătatea → 0,5');
assert.equal(debitare([{ l: 3000, buc: 1 }], 4200, 0, true).nr, 1, 'bucata mai lungă decât jumătatea → bară întreagă');
// modul de facturare (userul, 2026-10-22 — „Toata baza de date 21.10.2026", ultima coloană)
const fact = cod => produse.find(p => p.cod === cod)?.fact;
assert.equal(fact('9200'), undefined, '„1" = bucăţi întregi (fără fact)');
assert.equal(rotunjeste(undefined, 1.5), 2, 'întregi: 1,5 → 2');
assert.deepEqual(fact('204'), { pas: 0.5 }, 'Profil maner Verona: întreg sau jumătate');
assert.equal(rotunjeste({ pas: 0.5 }, 1.2), 1.5);
assert.deepEqual(fact('146'), { pas: 0.5 }, 'Breda negru (gol în fişier) ia regula de la Breda alb mat');
assert.deepEqual(fact('207'), { procent: 1.15 }, 'Orizontal inferior Confort: lungimea + 15 %');
assert.deepEqual(fact('142'), { procent: 1.15 }, 'şina dublă Lux negru (gol) ia regula de la crom');
assert.equal(laBara({ procent: 1.15 }, [{ l: 4000, buc: 1 }], 5800).nr, 1, '4000 / 5800 × 1,15 = 0,79 → 1');
assert.equal(laBara({ procent: 1.15 }, [{ l: 2000, buc: 1 }], 5800).nr, 0.5, '2000 → 0,40 → 0,5');
assert.equal(laBara({ procent: 1.15 }, [{ l: 3000, buc: 1 }], 3500).nr, 1, 'cupru: împărţit la bara lui de 3500');
assert.equal(produse.find(p => p.cod === '294').bara, 3500);
assert.deepEqual(fact('300').trepte, [[2000, 0.35], [3000, 0.52], [4000, 0.69], [5800, 1]], 'şina UTIL: treptele din configurator');
assert.equal(laBara(fact('350'), [{ l: 1500, buc: 1 }, { l: 2500, buc: 2 }], 5800).nr, 1.18, 'şina suspendată: 0,28 + 2 × 0,45 —: fiecare bucată după lungimea ei');
assert.equal(laBara(fact('805'), [{ l: 3500, buc: 1 }], 5800).nr, 1, 'Ocean > 3400 → 1');
assert.deepEqual(laBara(fact('805'), [{ l: 6000, buc: 1 }], 5800).preaLungi, [6000]);
assert.deepEqual(fact('440'), { multiplu: 10 });
assert.equal(rotunjeste(fact('440'), 12), 20, 'colţar Gola: multiplu de 10');
assert.deepEqual(fact('SEP150'), { multiplu: 6, set: true });
assert.deepEqual(fact('GG004'), { arie: true }, 'geamul la mp: arie');
assert.equal(arie([{ h: 2500, l: 450, buc: 3 }]).nr, 3.375, 'exemplul din fişier: 2500 × 450 × 3 = 3,375 mp');
assert.equal(produse.find(p => p.cod === '800').bara, 3000, '„30000 mm" la usi pliante — bara de 3 m');
assert.ok(produse.some(p => p.cod === '395') && produse.some(p => p.cod === 'C10Auriu'), 'codurile din fişier intră şi ele');
assert.equal(produse.find(p => p.cod === '277').denumire, 'Garnitura pentru geam de 4 mm Confort/Usi suspendate cod 277', 'denumirea actualizată');

// transportul (la toate gamele): nu la ridicare personală şi nici la „Curier fara costuri" (userul, 2026-10-23)
const transport = livrare => liniaTransport({ comanda: { livrare } })?.cod ?? null;
assert.ok(LIVRARE.includes('Curier fara costuri'), '„Curier fara costuri" e în lista de livrări');
assert.equal(transport('Curier fara costuri'), null, 'curier fără costuri → fără transport facturat');
assert.equal(transport('Ridicare personala'), null, 'ridicare personală → fără transport');
assert.equal(transport('Curier ramburs'), 'CHLTTRMANIP', 'curier ramburs → transport');
assert.equal(transport('Cu masina noastra'), 'CHLTTRMANIP', 'maşina noastră → transport');

console.log(`✓ oferta cu amănuntul: ${produse.length} produse (${produse.filter(p => p.bara).length} la bară), căutarea şi debitarea merg`);
