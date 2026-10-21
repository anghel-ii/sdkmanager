// node test/amanunt.test.mjs — produsele ofertei cu amănuntul + căutarea din pagină
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cautator, normal, debitare, sePoatePeJumatate } from '../js/amanunt-calcul.js';

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
console.log(`✓ oferta cu amănuntul: ${produse.length} produse (${produse.filter(p => p.bara).length} la bară), căutarea şi debitarea merg`);
