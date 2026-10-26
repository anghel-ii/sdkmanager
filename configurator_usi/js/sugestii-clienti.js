import { cautaClienti } from './manager.js';
import { AGENTI } from './lib/comun/comanda.js';

const $ = id => document.getElementById(id);

// ── Sugestii de clienţi (baza din manager) ──────────────────────────────────
// Câmpul rămâne LIBER: lista doar propune — se vinde şi celor care nu sunt în
// ea (userul, 2026-09-30). La ALEGEREA din listă se completează telefonul,
// adresa şi agentul clientului; tastat de mână nu se completează nimic.
// Lista e cea din /sugestii.js (managerul), nu <datalist>: browserul îşi filtra
// singur opţiunile cu tot cu diacritice şi le ascundea pe cele găsite de server
// fără ele (userul, 2026-10-26). Configuratorul deschis singur n-o are — şi nici
// clienţi de propus.
export function initSugestiiClienti(laAgent) {
  const camp = $('clientNume');
  if (!camp || !window.Sugestii) return;
  let completat = null;   // ce am pus noi la ultima alegere
  const CONTACT = ['clientTelefon', 'clientAdresa'];
  // „Catalin Cucolas" din bază = „Cucolas Catalin" din lista de agenţi
  const cuvinte = t => String(t ?? '').toLowerCase().split(/\s+/).sort().join(' ');
  // alt nume decât cel ales: telefonul / adresa puse de noi nu mai sunt ale lui (ce a scris omul de mână rămâne)
  camp.addEventListener('input', () => {
    if (completat && !camp.value.startsWith(completat.nume)) {
      for (const id of CONTACT) if ($(id).value === completat[id]) $(id).value = '';
      completat = null;
    }
  });
  // acelaşi client pe mai multe rânduri = mai multe adrese (ex. din lista FAN Courier) — adresa dedesubt le deosebeşte
  window.Sugestii.leaga(camp, {
    cauta: async text => (await cautaClienti(text.trim())).map(c => ({ ...c, text: c.nume,
      sub: [c.adresa_livrare || c.adresa_sediu, c.localitate, c.cui].filter(Boolean).join(' · ') })),
    alege: c => {
      camp.value = c.nume;
      completat = { nume: c.nume,
        clientTelefon: c.telefon_delegat || c.telefon_administrator || '',
        clientAdresa:  [c.adresa_livrare || c.adresa_sediu, c.localitate, c.judet].filter(Boolean).join(', ') };
      for (const id of CONTACT) $(id).value = completat[id];
      camp.dispatchEvent(new Event('input', { bubbles: true }));   // restul paginii (starea, câmpurile galbene) află de nume
      for (const id of CONTACT) $(id).dispatchEvent(new Event('input', { bubbles: true }));
      const agent = AGENTI.find(a => cuvinte(a) === cuvinte(c.agent));
      if (agent) laAgent(agent);
    },
  });
}
