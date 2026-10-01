import { cautaClienti } from './manager.js';
import { AGENTI } from './lib/comun/comanda.js';

const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ── Sugestii de clienţi (baza din manager) ──────────────────────────────────
// Câmpul rămâne LIBER: lista doar propune — se vinde şi celor care nu sunt în
// ea (userul, 2026-09-30). La ALEGEREA din listă se completează telefonul,
// adresa şi agentul clientului; tastat de mână nu se completează nimic.
export function initSugestiiClienti(laAgent) {
  const camp = $('clientNume'), lista = $('clientiLista');
  if (!camp || !lista) return;
  let gasiti = [], completat = null;   // completat = ce am pus noi la ultima alegere
  const CONTACT = ['clientTelefon', 'clientAdresa'];
  // „Catalin Cucolas" din bază = „Cucolas Catalin" din lista de agenţi
  const cuvinte = t => String(t ?? '').toLowerCase().split(/\s+/).sort().join(' ');
  camp.addEventListener('input', async e => {
    // alegerea din listă nu e tastare: fără inputType (Chrome) sau insertReplacementText (Firefox)
    if (!e.inputType || e.inputType === 'insertReplacementText') {
      // ponytail: la nume identice (13 din 5300) ia primul; listă proprie în loc de <datalist> dacă deranjează
      const c = gasiti.find(c => c.nume === camp.value);
      if (!c) return;
      completat = { nume: c.nume,
        clientTelefon: c.telefon_delegat || c.telefon_administrator || '',
        clientAdresa:  [c.adresa_livrare || c.adresa_sediu, c.localitate, c.judet].filter(Boolean).join(', ') };
      for (const id of CONTACT) $(id).value = completat[id];
      const agent = AGENTI.find(a => cuvinte(a) === cuvinte(c.agent));
      if (agent) laAgent(agent);
      return;
    }
    // alt nume decât cel ales: telefonul / adresa puse de noi nu mai sunt ale lui
    // (ce a scris omul de mână rămâne)
    if (completat && !camp.value.startsWith(completat.nume)) {
      for (const id of CONTACT) if ($(id).value === completat[id]) $(id).value = '';
      completat = null;
    }
    const q = camp.value.trim();
    const clienti = await cautaClienti(q);
    if (camp.value.trim() !== q) return;   // între timp s-a mai tastat
    gasiti = clienti;
    lista.innerHTML = clienti.map(c =>
      `<option value="${esc(c.nume)}" label="${esc([c.localitate, c.cui].filter(Boolean).join(' · '))}"></option>`).join('');
  });
}
