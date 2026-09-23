// Mail de comandă sticlă către un furnizor (mailto:) — folosit din pagina
// „Comandă sticlă" şi din pagina unei comenzi. Cere /copiaza.js.
//
// Corpul: doar modelul de sticlă şi dedesubt cotele „HxLxBuc" — fără client /
// comandă / salut (userul, 2026-09-22). Aceeaşi cotă din comenzi diferite se
// adună pe un rând. Un link mailto: prea lung e tăiat de unele programe
// (Outlook ~2000 caractere) — atunci lista merge în clipboard şi o lipeşti tu.
//   furnizor = { nume, email }, linii = [{ denumire, h, l, buc, debitare }]

// Denumirea fără codurile NOASTRE interne (userul, 2026-09-22): scoate „cod HD012",
// „cod: TG002", „OVI001", „CS 010" şi prescurtarea furnizorului („4mm GG").
// Verificat pe toate denumirile din catalogul de geam.
const FURNIZORI_PREFIX = 'CG|CS|CT|GG|HD|OVI|TG';
const denumireFaraCod = d => String(d ?? '')
  .replace(/[,\s]*\bcod\b\s*:?\s*[A-Z]{2,3}\s*\d{3}\b/gi, '')
  .replace(new RegExp(`\\b(${FURNIZORI_PREFIX})\\s*\\d{3}\\b`, 'g'), '')
  .replace(new RegExp(`\\b(${FURNIZORI_PREFIX})\\b`, 'g'), '')
  .replace(/\s{2,}/g, ' ').replace(/[\s,]+$/, '').trim();

async function trimiteMailSticla(furnizor, linii) {
  const peModel = new Map();
  for (const l0 of linii) {
    const l = { ...l0, denumire: denumireFaraCod(l0.denumire) };
    const m = peModel.get(l.denumire) ?? new Map();
    const cota = l.h && l.l ? `${l.h}x${l.l}` : String(l.debitare ?? '').replace(/\s*mm$/, '').replace(/\s*×\s*/, 'x');
    m.set(cota, (m.get(cota) ?? 0) + l.buc);
    peModel.set(l.denumire, m);
  }
  const corp = [...peModel].map(([model, cote]) =>
    [model, ...[...cote].map(([cota, buc]) => `${cota}x${buc}`)].join('\r\n')).join('\r\n\r\n');
  const subiect = `Comandă sticlă — ${dataOra(new Date()).slice(0, 10)}`;   // zz/ll/aaaa, din /data.js
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
