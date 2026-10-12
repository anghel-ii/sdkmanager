// ═══════════════════════════════════════════════════════════════════════════
//  Legătura cu MANAGERUL DE COMENZI — doar cererile HTTP, fără nimic din
//  configuraţia uşilor, ca să le folosească şi oferta cu amănuntul
//  (amanunt.html) fără să împacheteze 3D-ul.
//
//  Configuratorul rămâne folosibil şi SINGUR, deschis direct de pe disc, fără
//  server (aşa a fost gândit de la început). De-aia tot panoul se ascunde când
//  nu găseşte un API: `stare` rămâne 'fara-server' şi nu se randează nimic.
// ═══════════════════════════════════════════════════════════════════════════

let stare = 'necunoscut';       // 'fara-server' | 'nelogat' | 'logat'
let utilizator = null;
let laSchimbare = () => {};

export const stareOferta = () => ({ stare, utilizator });

export function initOferta(onSchimbare) {
  laSchimbare = onSchimbare || (() => {});
  return verificaSesiunea();
}

// Un singur apel decide totul: eroare de reţea → suntem pe disc, fără server;
// 401 → server există dar nu suntem logaţi; 200 → putem trimite oferte.
async function verificaSesiunea() {
  try {
    const r = await fetch('/api/eu', { headers: { Accept: 'application/json' } });
    if (r.status === 401) { stare = 'nelogat'; utilizator = null; }
    else if (r.ok)        { stare = 'logat'; utilizator = (await r.json()).utilizator; }
    else                  { stare = 'fara-server'; }
  } catch {
    stare = 'fara-server';
  }
  laSchimbare();
  return stare;
}

// Sugestii pt. câmpul „Nume client", din baza de clienţi a managerului.
// Fără manager (sau nelogat) nu se caută nimic — câmpul rămâne unul simplu.
export async function cautaClienti(q) {
  if (stare !== 'logat' || q.length < 2) return [];
  try {
    const r = await fetch('/api/clienti/cauta?q=' + encodeURIComponent(q), { headers: { Accept: 'application/json' } });
    return r.ok ? (await r.json()).clienti : [];
  } catch {
    return [];
  }
}

// Oferta deschisă din manager („Modifică oferta" → ?oferta=<id>): configuraţia
// salvată + clientul + codul de bare. null dacă nu se poate citi.
export async function incarcaOferta(id) {
  try {
    const r = await fetch('/api/comenzi/' + encodeURIComponent(id), { headers: { Accept: 'application/json' } });
    if (!r.ok) return { eroare: r.status === 401 ? 'Autentifică-te ca să modifici oferta.' : 'Oferta nu există.' };
    return await r.json();
  } catch {
    return { eroare: 'Managerul nu răspunde.' };
  }
}

// Salvează produsele ofertei (poziţiile gata făcute, vezi js/cos.js). `id` = oferta
// deschisă pt. modificare (PUT, acelaşi număr şi cod de bare); fără id → ofertă nouă (POST).
export async function salveaza({ nume, telefon, adresa, email, observatii, detalii, ofertaNr, id = null, pozitii }) {
  let r;
  try {
    r = await fetch(id ? `/api/comenzi/${id}` : '/api/comenzi', {
      method:  id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        client: { nume, telefon, adresa, email },
        observatii,
        detalii,   // livrare / agent / facturare (coloanele comenzii)
        ofertaNr,  // nr. de ofertă scris de mână
        pozitii,
      }),
    });
  } catch {
    return { eroare: 'Serverul nu răspunde. Verifică legătura la reţea.' };
  }

  if (r.status === 401) {
    stare = 'nelogat'; utilizator = null; laSchimbare();
    return { eroare: 'Sesiunea a expirat. Autentifică-te din nou.' };
  }

  const date = await r.json().catch(() => ({}));
  if (!r.ok) return { eroare: date.eroare || `Trimiterea a eşuat (${r.status}).` };

  return { ok: true, comanda: date.comanda };
}

// „Adaugă la comandă" (comandă în lucru): produsele se pun după cele existente.
export async function adaugaLaComanda(id, pozitii) {
  let r;
  try {
    r = await fetch(`/api/comenzi/${id}/adauga`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pozitii }) });
  } catch {
    return { eroare: 'Serverul nu răspunde. Verifică legătura la reţea.' };
  }
  const date = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, ...date } : { eroare: date.eroare || `Adăugarea a eşuat (${r.status}).` };
}

// După salvare, oferta trece mai departe: 'comanda' (în lucru — cere plata +
// avansul, ca Acceptă din manager) sau 'plata' (tabul „Aşteaptă plata").
export async function treceIn(id, unde, plata = {}) {
  let r;
  try {
    r = await fetch(`/api/comenzi/${id}/${unde === 'comanda' ? 'accepta' : 'asteapta-plata'}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plata),
    });
  } catch {
    return { eroare: 'Serverul nu răspunde. Verifică legătura la reţea.' };
  }
  const date = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, comanda: date.comanda } : { eroare: date.eroare || `Operaţia a eşuat (${r.status}).` };
}
