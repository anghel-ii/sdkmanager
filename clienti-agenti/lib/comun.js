// Ajutoare comune pentru functions/ (în afara lui functions/, ca să nu devină rută).

export const raspuns = (cod, date, antete = {}) =>
  Response.json(date, { status: cod, headers: { 'Cache-Control': 'no-store', ...antete } });

// text curăţat şi tăiat la o lungime rezonabilă; gol → null
export const text = (v, max) => (typeof v === 'string' && v.trim()) ? v.trim().slice(0, max) : null;

// câmp → lungime maximă (coloanele din Excel-ul de clienţi; vezi schema.sql)
export const CAMPURI = {
  nume: 120, cui: 20, judet: 40, localitate: 80, adresa_sediu: 300, adresa_livrare: 300,
  administrator: 120, telefon_administrator: 40, email: 120, delegat: 120, telefon_delegat: 40,
  discounturi: 500,
};

// Corpul cererii → câmpurile clientului validate, sau { eroare }. Telefonul /
// e-mailul se cer doar la clientul NOU: mulţi din Excel n-au niciunul, iar
// agentul trebuie să le poată completa restul fără să fie blocat.
export async function clientDinCerere(request, nou) {
  let c;
  try { c = await request.json(); } catch { return { eroare: 'Date invalide.' }; }
  const v = Object.fromEntries(Object.entries(CAMPURI).map(([k, max]) => [k, text(c?.[k], max)]));
  if (!v.nume) return { eroare: 'Numele clientului e obligatoriu.' };
  if (nou && !v.telefon_administrator && !v.telefon_delegat && !v.email) {
    return { eroare: 'Completează cel puţin un telefon sau e-mailul.' };
  }
  return { v };
}

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const din64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const egale = (a, b) => a.length === b.length && crypto.subtle.timingSafeEqual(a, b);

export const sha256 = async t => hex(await crypto.subtle.digest('SHA-256', enc.encode(t)));

// PBKDF2-SHA256; 100 000 = maximul permis de Workers.
async function pbkdf2(parola, sare, iteratii) {
  const cheie = await crypto.subtle.importKey('raw', enc.encode(parola), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sare, iterations: iteratii }, cheie, 256));
}

export async function verificaParola(parola, stocat) {
  const [tip, it, sare, hash] = String(stocat).split('$');
  if (tip !== 'pbkdf2') return false;
  return egale(await pbkdf2(parola, din64(sare), +it), din64(hash));
}

const IT = 100000;
export async function hashParola(parola) {
  const sare = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${IT}$${b64(sare)}$${b64(await pbkdf2(parola, sare, IT))}`;
}

// 10 caractere fără cele care se confundă (0/O, 1/l/I) ≈ 50 biţi — de ghicit
// doar online, câte un PBKDF2 pe încercare
export function parolaNoua() {
  const L = 'abcdefghjkmnpqrstuvwxyz23456789';
  return [...crypto.getRandomValues(new Uint8Array(10))].map(x => L[x % L.length]).join('');
}

// ── Sesiuni: cookie HttpOnly cu un token aleator; în DB stă doar SHA-256 lui ──
const COOKIE = 's';
const ZILE = 90;          // agentul se loghează o dată pe telefon
const ORE_ADMIN = 8;      // adminul intrat în contul unui agent (din /admin-ul managerului)

const tokenNou = () => b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));

export async function creeazaSesiune(env, agentId, admin = false) {
  const token = tokenNou(), durata = admin ? ORE_ADMIN * 3600 : ZILE * 86400;
  await env.DB.prepare(`INSERT INTO sesiune (token_hash, agent_id, expira_la, admin) VALUES (?, ?, datetime('now', '+${durata} seconds'), ?)`)
    .bind(await sha256(token), agentId, admin ? 1 : 0).run();
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${durata}`;
}

// Bilet de intrare pt. „Intră ca acest agent" din /admin: o singură folosire, 60 s.
// Doar hash-ul lui stă în DB; biletul în sine călătoreşte o dată, în link.
export async function creeazaBilet(env, agentId) {
  const bilet = tokenNou();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM bilet WHERE expira_la <= datetime('now')"),
    env.DB.prepare("INSERT INTO bilet (token_hash, agent_id, expira_la) VALUES (?, ?, datetime('now', '+60 seconds'))")
      .bind(await sha256(bilet), agentId),
  ]);
  return bilet;
}

// biletul → agent_id (şi biletul e consumat), sau null
export async function folosesteBilet(env, bilet) {
  const r = await env.DB.prepare(`DELETE FROM bilet WHERE token_hash = ? AND expira_la > datetime('now') RETURNING agent_id`)
    .bind(await sha256(bilet || '')).first();
  return r?.agent_id ?? null;
}

export const stergeCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

const tokenDin = request => request.headers.get('Cookie')?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1];

// agentul logat ({ id, nume, admin }) sau null — admin = 1 dacă e adminul intrat în contul lui
export async function agentLogat(request, env) {
  const token = tokenDin(request);
  if (!token) return null;
  return env.DB.prepare(`SELECT a.id, a.nume, s.admin FROM sesiune s JOIN agent a ON a.id = s.agent_id
    WHERE s.token_hash = ? AND s.expira_la > datetime('now') AND a.activ = 1`).bind(await sha256(token)).first();
}

export async function stergeSesiunea(request, env) {
  const token = tokenDin(request);
  if (token) await env.DB.prepare('DELETE FROM sesiune WHERE token_hash = ?').bind(await sha256(token)).run();
}

// cererea vine de la manager? (Authorization: Bearer <CHEIE_MANAGER>)
export function eManager(request, env) {
  if (!env.CHEIE_MANAGER) return false;
  return egale(enc.encode(request.headers.get('Authorization') || ''), enc.encode(`Bearer ${env.CHEIE_MANAGER}`));
}

// următoarea versiune — la fiecare adăugare/modificare; managerul cere „după versiunea X"
export const VERSIUNE_NOUA = '(SELECT COALESCE(MAX(versiune), 0) + 1 FROM client)';
