// ═══════════════════════════════════════════════════════════════════════════
//  Reducerile unui client — câmpul `discounturi`, text („Lux 15%, Confort 12,5%, notiţă").
//  Comun: pagina (index.html, o coloană pe grupă) şi curata-reduceri.mjs (curăţenia din bază).
//  Script simplu, fără import / export: în pagină şi în Node pune `Reduceri` pe globalThis.
// ═══════════════════════════════════════════════════════════════════════════
(() => {
  const normal = t => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // grupele de produse pe care se dau reduceri — „GrupaProdus" din NeoManager (userul, 2026-10-29;
  // înainte: LUX, CONFORT, UTIL, Usi, GOLA, MANER, Sertare, Hairpin, Jolly, Dressing, Rehau, Acc SDK, Lamele).
  // Textul vechi se citeşte fără să ţină cont de majuscule: „LUX 15%" intră la Lux, „GOLA" la Gola.
  const GAME = ['Accesorii bucatarie', 'Accesorii diverse', 'Balamale pentru rame', 'Balamale pentru rame speciale',
    'Capete pentru profile LED', 'Confort', 'Dressing', 'Elemente de imbinare', 'Geam/Oglinda', 'Gola', 'HAFELE', 'Leduri',
    'Lux', 'Manere mobilier', 'OPK', 'Picioare mobilier si masa', 'Prize electrice', 'Produse Accesoria',
    'Produse finite Gama Confort', 'Produse finite Gama Lux', 'Produse finite rame', 'Produse finite rame speciale',
    'Produse finite usi suspendate', 'Produse la oferta', 'Profil cabina dus', 'Profil maner', 'Rafturi modulare', 'RAME',
    'Sertare SM/TB', 'Sertare ST/SP', 'Usi aplicate/pliante', 'Usi hambar', 'Usi suspendate', 'UTIL'];
  // gamele vechi fără grupă nouă — nu mai sunt relevante (userul, 2026-10-29): la citire se aruncă (nici în
  // „Alte"), deci dispar la următoarea salvare; curata-reduceri.mjs le scoate din toată baza deodată.
  const GAME_SCOASE = ['Usi', 'MANER', 'Sertare', 'Hairpin', 'Jolly', 'Rehau', 'Acc SDK', 'Lamele'];

  // „LUX 15%, CONFORT 12,5%, Usi 10%, ceva" → { pe: { Lux: '15', Confort: '12,5' }, alte: 'ceva' }
  function desfaReduceri(text) {
    const pe = {}, alte = [];
    // virgula din „12,5%" nu desparte (o virgulă urmată de cifră e zecimală)
    for (const parte of String(text ?? '').split(/,(?!\d)/).map(s => s.trim()).filter(Boolean)) {
      const m = parte.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*%$/);
      const gama = m && GAME.find(g => normal(g) === normal(m[1]));
      if (gama && !(gama in pe)) pe[gama] = m[2];
      else if (!(m && GAME_SCOASE.some(g => normal(g) === normal(m[1])))) alte.push(parte);
    }
    return { pe, alte: alte.join(', ') };
  }
  const compuneReduceri = (pe, alte) =>
    [...GAME.filter(g => pe[g]).map(g => `${g} ${pe[g]}%`), ...(alte ? [alte] : [])].join(', ') || '';

  globalThis.Reduceri = { GAME, GAME_SCOASE, desfaReduceri, compuneReduceri };
})();
