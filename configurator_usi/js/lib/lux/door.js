import * as THREE from 'three';
import { mm, box } from '../comun/geo.js';

// ── Uşă (cadru de aluminiu + sticlă) ───────────────────────────────────────
// Construită DIN tabelul de profile al modelului — nu există profile "globale".
//
//   profiles = { montant, traversaSus, traversaJos, divizare }  (fiecare { w } în mm)
//   outerW, outerH = cotele exterioare ale uşii (m)
//   yBase          = centrul vertical al uşii (m)
//   divisions      = nr. bare orizontale interioare → divisions+1 panouri
//   panelMaterials = array (lungime divisions+1) cu 'sticla'|'pal' per panou;
//                    implicit toate 'sticla' dacă lipseşte
//   paneHeights    = opţional, cotele de debitare per panou (mm, jos→sus) —
//                    panourile se desenează PROPORŢIONAL cu ele (Confort, înălţimi
//                    custom); lipsă = toate egale, ca înainte
//   paneThickness  = opţional, grosimea fiecărui panou (mm) → panoul devine o
//                    placă de grosimea asta, CENTRATĂ în adâncimea ramei; lipsă =
//                    plan subţire lângă faţă, ca înainte (Suspendată)
//   barShapes      = opţional, per bară { fata, spate, slot? } (mm) — înălţimea
//                    vizibilă a profilului pe faţă / pe spate; cu `slot` (golul
//                    dintre panouri, ex. H: 1mm) se desenează ca buze lipite pe
//                    panouri; lipsă = bara din profiles.divizare, ca înainte
//   aplicate       = opţional, divizări aplicate ale uşii { latime, parte,
//                    verticale, orizontale } — benzi de 1,4mm lipite pe panouri
//   mats           = { aluMat, glassMat, palMat }
//
// Traversele şi barele de divizare intră ÎNTRE montanţi.

export const DOOR_D = 0.035;   // grosime cadru uşii (m) — folosită şi la poziţionarea faţă de perete

export function buildDoor(group, { profiles, outerW, outerH, yBase, divisions = 0, panelMaterials, paneHeights, paneThickness, barShapes, aplicate, mats }) {
  const vert = mm(profiles.montant.w);
  const top  = mm(profiles.traversaSus.w);
  const bot  = mm(profiles.traversaJos.w);
  const div  = mm(profiles.divizare.w);
  const { aluMat, glassMat, palMat } = mats;

  const innerW = outerW - vert * 2;   // lumina pe orizontală, între montanţi

  // montanţi verticali — pe toată înălţimea uşii
  const left  = box(vert, outerH, DOOR_D, aluMat);
  left.position.set(-outerW / 2 + vert / 2, yBase, 0);
  const right = box(vert, outerH, DOOR_D, aluMat);
  right.position.set(outerW / 2 - vert / 2, yBase, 0);

  // traverse orizontale — sus mai subţire, jos mai lată
  const topBar = box(innerW, top, DOOR_D, aluMat);
  topBar.position.set(0, yBase + outerH / 2 - top / 2, 0);
  const botBar = box(innerW, bot, DOOR_D, aluMat);
  botBar.position.set(0, yBase - outerH / 2 + bot / 2, 0);

  group.add(left, right, topBar, botBar);

  // panouri de sticlă + bare de divizare (tot între montanţi)
  const panes    = divisions + 1;
  const innerH   = outerH - top - bot;          // lumina pe verticală
  const forma    = i => barShapes?.[i];
  // `slot` = golul real dintre panouri; lipsă = cât e profilul (bara plină).
  const slot     = i => (forma(i) ? mm(forma(i).slot ?? Math.max(forma(i).fata, forma(i).spate)) : div);
  let sloturi = 0;
  for (let i = 0; i < divisions; i++) sloturi += slot(i);
  const glassH   = innerH - sloturi;
  const innerBot = yBase - outerH / 2 + bot;
  const sumaH    = paneHeights?.length === panes ? paneHeights.reduce((a, h) => a + h, 0) : 0;
  const inaltime = i => (sumaH > 0 ? glassH * paneHeights[i] / sumaH : glassH / panes);

  let y = innerBot;
  for (let i = 0; i < panes; i++) {
    const paneH   = inaltime(i);
    const isPal   = panelMaterials?.[i] === 'pal';
    const grosime = paneThickness?.[i] ? mm(paneThickness[i]) : 0;
    const pane    = grosime
      ? box(innerW, paneH, grosime, isPal ? palMat : glassMat, { cast: isPal })
      : new THREE.Mesh(new THREE.PlaneGeometry(innerW, paneH), isPal ? palMat : glassMat);
    pane.position.set(0, y + paneH / 2, grosime ? 0 : 0.015);
    group.add(pane);
    if (aplicate) benziAplicate(group, { aplicate, innerW, paneH, y0: y, grosime, mat: aluMat });
    y += paneH;

    if (i < panes - 1) {
      const s = slot(i);
      if (forma(i)?.slot != null) {
        // Profil cu buze (ex. H): panourile aproape se ating (golul = slot), iar
        // profilul le prinde cu câte o buză lipită pe faţa şi pe spatele lor —
        // din faţă se vede doar buza din faţă (8mm la H), nu tot profilul.
        const tAdj  = Math.max(mm(paneThickness?.[i] ?? 18), mm(paneThickness?.[i + 1] ?? 18));
        const buza  = mm(2);
        const inima = box(innerW, s, tAdj, aluMat);
        const fata  = box(innerW, mm(forma(i).fata), buza, aluMat);
        const spate = box(innerW, mm(forma(i).spate), buza, aluMat);
        inima.position.set(0, y + s / 2, 0);
        fata.position.set(0, y + s / 2, tAdj / 2 + buza / 2);
        spate.position.set(0, y + s / 2, -(tAdj / 2 + buza / 2));
        group.add(inima, fata, spate);
      } else if (forma(i)) {
        // Profil plin cu faţă şi spate diferite — două jumătăţi pe adâncime.
        const ad    = 0.03;
        const fata  = box(innerW, mm(forma(i).fata), ad / 2, aluMat);
        const spate = box(innerW, mm(forma(i).spate), ad / 2, aluMat);
        fata.position.set(0, y + s / 2, ad / 4);
        spate.position.set(0, y + s / 2, -ad / 4);
        group.add(fata, spate);
      } else {
        const bar = box(innerW, div, 0.03, aluMat);
        bar.position.set(0, y + div / 2, 0.001);
        group.add(bar);
      }
      y += s;
    }
  }
}

// Divizări aplicate pe UN panou: verticalele întregi pe toată înălţimea lui,
// orizontalele tăiate între verticale (ca în realitate), la distanţe egale;
// pe faţă (+z), pe spate (−z) sau pe ambele, lipite de suprafaţa panoului.
const GROSIME_BANDA = mm(1.4);

function benziAplicate(group, { aplicate: a, innerW, paneH, y0, grosime, mat }) {
  if (!a || a.latime === 'fara') return;
  const lat  = mm(+a.latime);
  const V    = a.verticale ?? 0, O = a.orizontale ?? 0;
  const seg  = (innerW - V * lat) / (V + 1);   // bucata de orizontală dintre două verticale
  const fete = a.parte === 'ambele' ? [1, -1] : a.parte === 'spate' ? [-1] : [1];
  if (seg <= 0) return;

  for (const sens of fete) {
    const z = sens * (grosime / 2 + GROSIME_BANDA / 2);
    for (let j = 1; j <= V; j++) {
      const v = box(lat, paneH, GROSIME_BANDA, mat, { cast: false });
      v.position.set(-innerW / 2 + j * seg + (j - 1) * lat + lat / 2, y0 + paneH / 2, z);
      group.add(v);
    }
    for (let r = 1; r <= O; r++) {
      const yy = y0 + paneH * r / (O + 1);
      for (let j = 0; j <= V; j++) {
        const h = box(seg, lat, GROSIME_BANDA, mat, { cast: false });
        h.position.set(-innerW / 2 + j * (seg + lat) + seg / 2, yy, z);
        group.add(h);
      }
    }
  }
}
