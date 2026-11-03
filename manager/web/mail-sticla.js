// Mail de comandă sticlă către un furnizor (mailto:) — folosit din pagina
// „Comandă sticlă" şi din pagina unei comenzi. Cere /copiaza.js.
//
// Corpul (userul, 2026-11-03): pe fiecare rând modelul, cota „HxLxBuc" şi numele clientului —
// „Model | 1144x384x2 | Client". Aceeaşi cotă, acelaşi model, LA ACELAŞI CLIENT se adună pe un rând;
// la clienţi diferiţi — rânduri separate. Rândurile aceluiaşi model stau unul sub altul. Fără salut.
// (Până atunci, 2026-09-22: modelul, dedesubt cotele, fără client.) Un link mailto: prea lung e tăiat de
// unele programe (Outlook ~2000 caractere) — atunci lista merge în clipboard şi o lipeşti tu.
//   furnizor = { nume, email }, linii = [{ denumire, h, l, buc, debitare, client_nume }]

// Denumirea fără codurile NOASTRE interne (userul, 2026-09-22): scoate „cod HD012",
// „cod: TG002", „OVI001", „CS 010" şi prescurtarea furnizorului („4mm GG").
// Verificat pe toate denumirile din catalogul de geam.
const FURNIZORI_PREFIX = 'CG|CS|CT|GG|HD|OVI|TG';
const denumireFaraCod = d => String(d ?? '')
  .replace(/[,\s]*\bcod\b\s*:?\s*[A-Z]{2,3}\s*\d{3}\b/gi, '')
  .replace(new RegExp(`\\b(${FURNIZORI_PREFIX})\\s*\\d{3}\\b`, 'g'), '')
  .replace(new RegExp(`\\b(${FURNIZORI_PREFIX})\\b`, 'g'), '')
  .replace(/\s{2,}/g, ' ').replace(/[\s,]+$/, '').trim();

// Rândurile mailului: „Model | HxLxBuc | Client", grupate pe model (în ordinea în care apar)
function randuriMailSticla(linii) {
  const peModel = new Map();   // model → Map(cota|client → { cota, client, buc })
  for (const l of linii) {
    const model = denumireFaraCod(l.denumire);
    const cota = l.h && l.l ? `${l.h}x${l.l}` : String(l.debitare ?? '').replace(/\s*mm$/, '').replace(/\s*×\s*/, 'x');
    const client = String(l.client_nume ?? '').replace(/\s+/g, ' ').trim();
    const m = peModel.get(model) ?? new Map();
    const k = `${cota}|${client.toLowerCase()}`;
    const e = m.get(k) ?? { cota, client, buc: 0 };
    e.buc += l.buc;
    m.set(k, e);
    peModel.set(model, m);
  }
  return [...peModel].flatMap(([model, m]) => [...m.values()].map(e => [model, `${e.cota}x${e.buc}`, e.client].filter(Boolean).join(' | ')));
}

async function trimiteMailSticla(furnizor, linii) {
  // modul test (bara.js pune window.modTest): mailul se deschide, dar spune clar că e de test
  const test = window.modTest ? 'COMANDĂ DE TEST — NU SE EXECUTĂ\r\n\r\n' : '';
  const corp = test + randuriMailSticla(linii).join('\r\n');
  const subiect = `${test ? '[TEST] ' : ''}Comandă sticlă — ${dataOra(new Date()).slice(0, 10)}`;   // zz/ll/aaaa, din /data.js
  const catre = encodeURIComponent(furnizor.email || '');
  let url = `mailto:${catre}?subject=${encodeURIComponent(subiect)}&body=${encodeURIComponent(corp)}`;
  if (url.length > 1900) {
    await copiazaText(corp);
    url = `mailto:${catre}?subject=${encodeURIComponent(subiect)}&body=${encodeURIComponent(
      'Lista e în clipboard — lipeşte-o aici (Ctrl+V).')}`;
    await alerta('Lista e prea lungă pentru un link de mail — am copiat-o în clipboard. În mail dă Ctrl+V.');
  }
  location.href = url;
}

// testele (scripts/test.js) — în pagină `module` nu există
if (typeof module === 'object' && module.exports) module.exports = { randuriMailSticla, denumireFaraCod };
