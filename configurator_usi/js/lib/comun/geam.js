import catalog from '../../catalog/catalog.generated.json';

// ── Geam / oglindă — catalogul comun, DOAR pt. afişare în UI şi pe fişă ─────
// (lista din dropdown, denumirea unui cod). Regulile de facturare/necesar ale
// geamului (garnitură, folie, cote) stau în lib/<familie>/geam.js, separat la
// fiecare familie.
export const geamList  = () => catalog.geam ?? [];
export const geamCount = () => geamList().length;
export const findGeam  = cod => geamList().find(g => g.cod === cod) ?? null;

// Uşi asamblate de CLIENT: alege doar grosimea (de ea depinde garnitura).
export const GROSIMI_CLIENT = [4, 8];
export const clientGeamLabel = g => `Clientul asamblează cu geam de ${g}mm`;
