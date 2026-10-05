// Starea configuratorului — cotele de gol le introduce utilizatorul (mm).
// `divisions` = o intrare per uşă: nr. bare orizontale interioare (0 = niciuna) —
//               fiecare uşă poate avea alt nr. de divizări.
// `finish`    = id-ul finisajului (din meta.finishes al sistemului); intră în coduri.
// `wheels`    = o intrare per uşă: { left, right } ∈ 'simpla' | 'amortizor'.
// `assembly`  = o intrare per uşă: 'noi' | 'client' — cine asamblează uşa aia.
// `geam`      = o intrare per uşă: codul modelului de geam/oglindă ales
//               (catalog comun, js/lib/comun/geam.js) — fiecare uşă poate avea alt model.
//               Se foloseşte DOAR la uşile cu assembly 'noi'.
// `geamClient`= o intrare per uşă: grosimea (mm) declarată la uşile cu assembly
//               'client'. Acolo geamul nu circulă prin noi (nici livrat, nici
//               adus) — ne interesează doar grosimea, fiindcă de ea depinde
//               codul de garnitură. Ţinut separat de `geam`, ca alegerea de
//               model să nu se piardă la comutarea Noi ↔ Client.
// `hPanouri`  = o intrare per uşă: array (lungime divisions[i]+1) cu înălţimea de
//               debitare introdusă pt. fiecare panou, mm, de JOS în SUS — sau null =
//               automat (împart egal restul). Doar Confort (opţiuni avansate).
// `divProfil` = o intrare per uşă: array (lungime divisions[i]) cu 'confort' | 'H'
//               per bară. 'H' contează doar între două panouri PAL.
// `amortizare`= o intrare per uşă: { left, right } ∈ 'fara' | '35kg' | '60kg'.
//               DOAR la Confort (meta.family === 'confort') — accesoriu de amortizare
//               montat pe fiecare parte, opţional (implicit 'fara'). Fiecare parte
//               aleasă contează ca 0.5 set din clasa respectivă în necesar — vezi
//               confortAmortizareRows în lib/confort/confort.js.
// `divAplicate`= o intrare per uşă (Confort, opţiuni avansate): benzi decorative
//               lipite pe PAL/sticlă — NU separă panouri. { latime: 'fara'|'10'|'20',
//               parte: 'fata'|'spate'|'ambele', verticale: nr, orizontale: nr }.
//               Intră în necesar (bucăţi) şi facturare (bare de 3m) — vezi
//               segmenteAplicate în lib/confort/confort.js. Nu se desenează în 3D.
// `panels`    = o intrare per uşă: array de 'sticla' | 'pal', lungime = divisions[i]+1,
//               materialul fiecărui panou dintre bare, de JOS în SUS: `panels[i][0]`
//               e panoul de la baza uşii (aşa îl construieşte buildDoor, care urcă
//               de la innerBot). UI-ul le afişează invers, ca primul chip de sus să
//               fie panoul de sus — vezi renderWheels în ui.js.
//               Un panou 'pal' se randează opac
//               şi NU se facturează (nici geam, nici garnitură): PAL-ul nu-l vindem,
//               îl aduce clientul — dăm doar cota de debitare, în necesar.
//               Toate (divisions/wheels/assembly/geam/geamClient/panels/hPanouri/divProfil) au lungimea
//               sincronizată cu nr. de uşi curent (vezi syncDoors în ui.js); `panels[i]`
//               (şi hPanouri[i]/divProfil[i]) se resincronizează la schimbarea lui divisions[i] (vezi syncPanels).
// Nr. de uşi: fix pe model (meta.doors) — EXCEPTÂND sistemele cu meta.doorsRange
//             (Confort), unde `doors` e ales de utilizator (stepper UI, 1-7).
// `tracks`    = nr. piste de culisare (1 simplă | 2 dublă) — doar la Confort.
export const state = {
  system:    'suspendataA',
  width:     1200,   // mm — lăţime gol
  height:    2100,   // mm — înălţime gol
  finish:    'ALUMINIU',
  divisions: [0],
  doors:    2,       // relevant doar la sisteme cu meta.doorsRange (Confort)
  tracks:    2,       // relevant doar la sisteme cu meta.doorsRange (Confort)
  wheels:    [{ left: 'simpla', right: 'simpla' }],
  assembly:  ['client'],   // implicit asamblează clientul (userul, 2026-09-28)
  geam:       ['GG004'],  // Geam float transparent 4mm GG — doar la assembly 'noi'
  geamClient: [4],        // mm — doar la assembly 'client' (4 sau 8)
  hPanouri:  [[null]],
  divProfil: [[]],
  panels:    [['sticla']],
  amortizare: [{ left: 'fara', right: 'fara' }],
  divAplicate: [{ latime: 'fara', parte: 'fata', verticale: 0, orizontale: 0 }],
  // LUX: mânerul aplicat pe uşă — 'fara' | 'stanga' | 'dreapta' | 'ambele' (userul, 2026-10-05)
  manerAplicat: ['fara'],
  // detaliile comenzii — la toate gamele (js/lib/comun/comanda.js)
  comanda: { livrare: null, agent: null, plata: null },
};
