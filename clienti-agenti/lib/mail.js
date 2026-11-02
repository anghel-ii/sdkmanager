// Mailul „client nou de introdus în NeoManager": pleacă la fiecare client nou, ca un coleg să-l
// treacă în NeoManager. Îl trimite un Google Apps Script (mail-script.gs) de pe un cont Gmail al
// portalului; destinatarul stă în script, aici doar secretele MAIL_URL + MAIL_CHEIE din Pages.
// Fără importuri din comun.js (acela cere bundlerul wrangler), ca să meargă şi în testul cu node.

const CAMPURI_MAIL = [
  ['Nume', 'nume'], ['CUI', 'cui'], ['Agent', 'agent'], ['Judeţ', 'judet'], ['Localitate', 'localitate'],
  ['Adresă sediu', 'adresa_sediu'], ['Adresă livrare', 'adresa_livrare'], ['Administrator', 'administrator'],
  ['Telefon administrator', 'telefon_administrator'], ['E-mail', 'email'], ['Delegat', 'delegat'],
  ['Telefon delegat', 'telefon_delegat'], ['Reduceri', 'discounturi'], ['Modalitate de plată', 'modalitate_plata'],
];
const ASTEPT_MS = 15000;

export function mailClientNou(client, adaugatDe) {
  return {
    subiect: `Client nou de introdus în NeoManager: ${String(client.nume).replace(/\s+/g, ' ')}`,
    text: [
      'Client nou pe portalul agenţilor:', '',
      ...CAMPURI_MAIL.map(([eticheta, camp]) => `${eticheta}: ${client[camp] || '-'}`),
      '', `Adăugat de: ${adaugatDe}`,
    ].join('\n'),
  };
}

// Clientul e deja salvat când se ajunge aici: o problemă cu mailul nu are voie să strice
// cererea → undefined dacă a plecat, altfel textul avertismentului pentru cine a salvat.
export async function anuntaClientNou(env, client, adaugatDe) {
  try {
    if (!env.MAIL_URL || !env.MAIL_CHEIE) throw new Error('MAIL_URL / MAIL_CHEIE lipsesc');
    const r = await fetch(env.MAIL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cheie: env.MAIL_CHEIE, ...mailClientNou(client, adaugatDe) }),
      signal: AbortSignal.timeout(ASTEPT_MS),
    });
    const j = await r.json();   // Apps Script răspunde mereu 200: rezultatul e în JSON
    if (!r.ok || !j.ok) throw new Error(j.eroare || `HTTP ${r.status}`);
  } catch (err) {
    console.error('mail client nou:', err.message);
    return `„${client.nume}” e salvat, dar mailul pentru NeoManager nu a plecat — anunţă colegul.`;
  }
}
