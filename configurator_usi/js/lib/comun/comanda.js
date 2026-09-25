// ═══════════════════════════════════════════════════════════════════════════
//  Detaliile COMENZII — aceleaşi la toate gamele (userul, 2026-09-25): modul de
//  livrare, agentul şi tipul de facturare. Listele sunt cele din formularul de
//  comandă al ramelor. Stau în state.comanda (intră în configuraţia ofertei) şi
//  pleacă la manager în coloanele comenzii.
// ═══════════════════════════════════════════════════════════════════════════

export const LIVRARE = ['Ridicare personala', 'Curier ramburs', 'Curier op avans', 'Curier op la termen', 'Cu masina noastra'];
export const AGENTI = ['Birou', 'Site', 'Serban Dragos', 'Bondrea Oliver', 'Coroma Ciprian',
                       'Cucolas Catalin', 'Moise Razvan', 'Tanvuia Adrian'];
export const FACTURARE = ['BF', 'Factura fiscala', 'Oferta'];

// Ofertele de rame salvate înainte le aveau în state.rame — se citesc şi de acolo.
export const detaliiComanda = state => ({
  livrare:   state.comanda?.livrare   ?? state.rame?.livrare   ?? null,
  agent:     state.comanda?.agent     ?? state.rame?.agent     ?? null,
  facturare: state.comanda?.facturare ?? state.rame?.facturare ?? null,
});

// Transportul se facturează la TOATE gamele când marfa nu e ridicată personal
// (userul, 2026-09-25; înainte doar la rame, ca în formularul Excel).
const TRANSPORT = { cod: 'CHLTTRMANIP', denumire: 'Cheltuieli de Transport si Manipulare', um: 'buc', cantitate: 1 };
export const liniaTransport = state => {
  const livrare = detaliiComanda(state).livrare;
  return livrare && livrare !== 'Ridicare personala' ? TRANSPORT : null;
};
