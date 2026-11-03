import catalog from '../../catalog/catalog.generated.json';

// ── Geam / oglindă — catalogul comun, DOAR pt. afişare în UI şi pe fişă ─────
// (lista din dropdown, denumirea unui cod). Regulile de facturare/necesar ale
// geamului (garnitură, folie, cote) stau în lib/<familie>/geam.js, separat la
// fiecare familie.
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

// Uşi asamblate de CLIENT: alege doar grosimea (de ea depinde garnitura).
export const GROSIMI_CLIENT = [4, 8];
export const clientGeamLabel = g => `Clientul asamblează cu geam de ${g}mm`;
