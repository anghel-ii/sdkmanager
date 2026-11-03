import catalog from '../../catalog/catalog.generated.json';

// rotunjire în sus la 0,01 (necesar de cumpărat, nu de subestimat). Întâi se
// taie zgomotul de virgulă mobilă sub 1e-6 — altfel 1.1 × 100 = 110.00000000000001
// şi o arie de exact 1,1 mp ieşea facturată 1,11.
const ceil2 = x => Math.ceil(Math.round(x * 1e6) / 1e4) / 100;

// ═══════════════════════════════════════════════════════════════════════════
//  GEAM / OGLINDĂ — catalog UNIC, comun tuturor sistemelor (nu e per familie).
//  Sursă: js/catalog/geam.seed.sql → js/catalog/geam.sqlite → catalog.generated.json["geam"].
//  Utilizatorul alege un model (cod) în UI; restul (garnitură, folie de
//  securizare la oglinzi) rezultă automat din `grosime` / `oglinda`.
// ═══════════════════════════════════════════════════════════════════════════

export const geamList  = () => catalog.geam ?? [];
export const geamCount = () => geamList().length;
// Sticla ADUSĂ DE CLIENT, pe care o montăm NOI (userul, 2026-11-03): se alege din aceeaşi listă, ca un
// „model" fals (ADUS4 / ADUS8) — de grosimea ei depinde garnitura. Nu se facturează şi nu se comandă la
// furnizor; garnitura şi manopera se facturează ca la sticla noastră. Ce grosimi are voie fiecare gamă
// hotărăşte filtrul ei (LUX şi ramele: doar 4 mm).
export const GEAM_ADUS = {
  ADUS4: { cod: 'ADUS4', denumire: 'Aduce clientul sticla 4mm', grosime: 4, oglinda: 0, adus: true },
  ADUS8: { cod: 'ADUS8', denumire: 'Aduce clientul sticla 8mm', grosime: 8, oglinda: 0, adus: true },
};
export const geamAdusList = () => Object.values(GEAM_ADUS);
export const findGeam  = cod => GEAM_ADUS[cod] ?? geamList().find(g => g.cod === cod) ?? null;


// Folie de securizare — doar la oglinzi. Formulă: (aria sticlei / 25) × 1.15.
export const FOLIE_COD = '283';
export const folieCantitate = ariaMp => ceil2((ariaMp / 25) * 1.15);
