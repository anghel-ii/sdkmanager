import * as suspendata from './lib/suspendata/index.js';
import * as confort    from './lib/confort/index.js';
import * as rame       from './lib/rame/index.js';
import * as util       from './lib/util/index.js';
import * as lux        from './lib/lux/index.js';

// ── Familiile de sisteme ─────────────────────────────────────────────────────
// Fiecare familie (meta.family) îşi are TOT codul de calcul — facturare
// NeoManager, necesar, sticlă, culori, randare — în lib/<familie>/, iar
// sistemele ei (js/systems/) importă doar de acolo (plus lib/comun/geo.js).
// O schimbare la Confort nu poate atinge suspendatele sau ramele, şi invers;
// testul (npm test) verifică şi graniţele astea.
//
// Stratul comun (builder, UI, fişă) ajunge la o familie doar prin fişierul ei
// index.js, ales de aici după sistem.
export const familii = { suspendata, confort, rame, util, lux };

export const familia = sys => familii[sys?.meta?.family];

// Culorile oferite pt. un sistem (filtrate după catalogul familiei).
export const finishesOf = meta => familii[meta?.family]?.finishesOf(meta) ?? meta?.finishes ?? [];
