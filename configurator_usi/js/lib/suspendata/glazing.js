import { ceilHalf } from './num.js';

// ── Formulă standard sticlă / garnitură / perie ──────────────────────────────
// Toate lungimile în MM la intrare; întoarce cotele geamului per uşă
// (fiecare uşă poate avea alt nr. de divizări → altă cotă de panou),
// plus totalurile agregate (arie, garnitură, perie) pentru facturare.
//
// Constantele au ca valoare implicită comportamentul folosit până acum. Un model
// cu altă prindere a sticlei le suprascrie la apel:
//   glazing({ ..., glassInset: 30, headFoot: { sticla: 50, pal: 48 } })
//
// glassInset / palInset – cât se scade din lăţimea uşii pt. cota panoului:
//                 sticlă 25, PAL 23 (userul, 2026-09-21)
// headFoot      – scăderea pe înălţime la traverse (sus + jos), după material:
//                 sticlă 45, PAL 43; fiecare margine ia jumătate din valoarea
//                 panoului care o atinge → sus PAL + jos sticlă = 44 (userul)
// deduceri      – scădere per bară de divizare, după cele două materiale de
//                 o parte şi de alta (userul, 2026-09-21): sticlă-sticlă 14mm
//                 (7 din fiecare panou), PAL-PAL 11mm, PAL-sticlă 12mm
//
// divisionsPerDoor – array, o intrare per uşă (nr. bare orizontale la uşa aia).
// panelsPerDoor    – array, o intrare per uşă: lista materialelor panourilor
//                    ('sticla' | 'pal', vezi state.panels). Panourile PAL NU
//                    intră în aria de sticlă, în garnitură sau în nr. de geamuri
//                    — nu le vindem, le aduce clientul (dăm doar cota, vezi
//                    clientPanelRows în lib/suspendata/bom.js). Lipsa listei = totul sticlă.

const DEDUCERE_DIVIZARE = { 'sticla-sticla': 14, 'pal-pal': 11, 'pal-sticla': 12 };

export function glazing({
  doorW, doorH, divisionsPerDoor,
  panelsPerDoor,
  inaltimiPerDoor,
  glassInset    = 25,
  palInset      = 23,
  headFoot      = { sticla: 45, pal: 43 },
  deduceri      = DEDUCERE_DIVIZARE,
}) {
  const glassW  = doorW - glassInset;
  const palW    = doorW - palInset;
  const doors  = divisionsPerDoor.length;

  // Un panou per uşă/divizare. Stiva (înălţimea din care se scot panourile)
  // scade la fiecare bară după perechea de materiale (vezi `deduceri`). `inaltimiPerDoor[i][k]` = înălţimea introdusă de
  // user pt. panoul k (opţiuni avansate) sau null = automat: panourile automate
  // împart EGAL ce rămâne după cele fixate — fără nicio valoare fixată,
  // rezultatul e identic cu formula de dinainte (stivă / nr. panouri).
  const panels = divisionsPerDoor.map((divisions, i) => {
    const panes  = divisions + 1;
    const mats   = (panelsPerDoor?.[i] ?? []).slice(0, panes);
    while (mats.length < panes) mats.push('sticla');
    let stackH = doorH - headFoot[mats[0]] / 2 - headFoot[mats[panes - 1]] / 2;
    for (let k = 0; k < divisions; k++) stackH -= deduceri[[mats[k], mats[k + 1]].sort().join('-')];
    const palPanes = mats.filter(m => m === 'pal').length;

    const fixe     = inaltimiPerDoor?.[i];
    const eFix     = k => Number.isFinite(fixe?.[k]) && fixe[k] > 0;
    const sumaFixe = mats.reduce((a, _, k) => a + (eFix(k) ? fixe[k] : 0), 0);
    const libere   = mats.filter((_, k) => !eFix(k)).length;
    const hLiber   = libere ? (stackH - sumaFixe) / libere : 0;
    const heights  = mats.map((_, k) => Math.max(0, eFix(k) ? fixe[k] : hLiber));
    let eroare = null;
    if (libere && !(hLiber > 0)) {
      eroare = `panourile introduse depăşesc uşa — mai rămân ${Math.round(stackH - sumaFixe)} mm pt. ${libere} panou(ri)`;
    } else if (!libere && Math.abs(stackH - sumaFixe) >= 0.5) {
      eroare = `suma panourilor e ${Math.round(sumaFixe)} mm, trebuie ${Math.round(stackH)} mm (diferenţă ${Math.round(sumaFixe) - Math.round(stackH)} mm)`;
    }

    return {
      divisions, panes, palPanes,
      glassPanes: panes - palPanes,
      paneH: heights[0],
      mats, heights, eroare,
      profil: Array(divisions).fill('std'),   // un singur tip de divizare la suspendate
    };
  });

  const sticle = p => p.heights.filter((_, k) => p.mats[k] !== 'pal');
  const glassCount  = panels.reduce((s, p) => s + p.glassPanes, 0);
  const glassAreaM2 = panels.reduce((s, p) => s + sticle(p).reduce((a, h) => a + (glassW / 1000) * (h / 1000), 0), 0);
  const gasketM     = ceilHalf(panels.reduce((s, p) => s + sticle(p).reduce((a, h) => a + 2 * (glassW + h) / 1000, 0), 0));
  const brushM      = ceilHalf(doors * 2 * doorH / 1000);

  return { glassW, palW, glassCount, glassAreaM2, gasketM, brushM, panels };
}
