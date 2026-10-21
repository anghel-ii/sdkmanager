// ═══════════════════════════════════════════════════════════════════════════
//  Detaliile COMENZII — aceleaşi la toate gamele (userul, 2026-09-25): modul de
//  livrare, agentul şi metoda de plată (înainte „tipul de facturare", înlocuit
//  2026-09-28). Listele sunt cele din formularul de
//  comandă al ramelor. Stau în state.comanda (intră în configuraţia ofertei) şi
//  pleacă la manager în coloanele comenzii.
// ═══════════════════════════════════════════════════════════════════════════

export const LIVRARE = ['Ridicare personala', 'Curier ramburs', 'Curier op avans', 'Curier op la termen', 'Cu masina noastra'];
export const AGENTI = ['Birou', 'Site', 'Serban Dragos', 'Bondrea Oliver', 'Coroma Ciprian',
                       'Cucolas Catalin', 'Moise Razvan', 'Tanvuia Adrian'];
// Metodele de plată — aceleaşi coduri ca PLATI din manager/server/api/comenzi.js
export const PLATI = [['proforma', 'Factură proformă'], ['proforma_amanunt', 'Factură proformă cu amănuntul'],
                      ['fiscala', 'Factură fiscală'], ['bon', 'Bon fiscal'], ['avans', 'Factură de avans']];
export const plataText = id => PLATI.find(p => p[0] === id)?.[1] ?? null;

// Ofertele de rame salvate înainte le aveau în state.rame — se citesc şi de acolo.
export const detaliiComanda = state => ({
  livrare:   state.comanda?.livrare   ?? state.rame?.livrare   ?? null,
  agent:     state.comanda?.agent     ?? state.rame?.agent     ?? null,
  plata:     state.comanda?.plata     ?? state.rame?.plata     ?? null,
});

// Transportul se facturează la TOATE gamele când marfa nu e ridicată personal
// (userul, 2026-09-25; înainte doar la rame, ca în formularul Excel).
const TRANSPORT = { cod: 'CHLTTRMANIP', denumire: 'Cheltuieli de Transport si Manipulare', um: 'buc', cantitate: 1 };
export const liniaTransport = state => {
  const livrare = detaliiComanda(state).livrare;
  return livrare && livrare !== 'Ridicare personala' ? TRANSPORT : null;
};

// Ce mai trebuie completat ca oferta să se poată salva (userul, 2026-10-05): numele
// clientului, modul de livrare, agentul şi nr. ofertei; la acceptarea pe loc
// („Salvează comanda") şi telefonul + adresa (în manager le cere fereastra de
// acceptare). → [{ id, text }], în ordinea câmpurilor din pagină. Doar în browser.
export function campuriLipsa({ laAcceptare = false } = {}) {
  const v = id => /** @type {HTMLInputElement | null} */ (document.getElementById(id))?.value?.trim();
  return [['clientNume', 'numele clientului'],
          ...(laAcceptare ? [['clientTelefon', 'telefonul'], ['clientAdresa', 'adresa']] : []),
          ['comandaLivrare', 'modul de livrare'], ['comandaAgent', 'agentul'], ['ofertaNr', 'numărul ofertei']]
    .filter(([id]) => !v(id)).map(([id, text]) => ({ id, text }));
}
// câmpul pe care-l vede omul (la meniul căutabil — caseta lui, <select>-ul e ascuns)
const vizibil = el => el?.hidden ? el.nextElementSibling?.querySelector('input') : el;
// cursorul în câmpul care lipseşte
export function focusCamp(id) { vizibil(document.getElementById(id))?.focus(); }
// Câmpurile obligatorii încă goale se colorează (galben, .de-completat în nou.css), ca să
// se vadă dintr-o privire ce mai e de completat (userul, 2026-10-21). Cheamă-l cu TOATE
// câmpurile goale de acum — marcajele vechi se scot.
export function marcheazaDeCompletat(elemente) {
  const noi = new Set(elemente.map(vizibil).filter(Boolean));
  document.querySelectorAll('.de-completat').forEach(el => { if (!noi.has(el)) el.classList.remove('de-completat'); });
  noi.forEach(el => el.classList.add('de-completat'));
}
