// Ajutoare comune pentru functions/ (în afara lui functions/, ca să nu devină rută).
import pagina from '../public/index.html';   // ca text (wrangler) — pt. versiunea paginii, mai jos

export const raspuns = (cod, date, antete = {}) =>
  Response.json(date, { status: cod, headers: { 'Cache-Control': 'no-store', ...antete } });

// text curăţat şi tăiat la o lungime rezonabilă; gol → null
export const text = (v, max) => (typeof v === 'string' && v.trim()) ? v.trim().slice(0, max) : null;

// câmp → lungime maximă (coloanele din Excel-ul de clienţi; vezi schema.sql)
export const CAMPURI = {
  nume: 120, cui: 20, judet: 40, localitate: 80, adresa_sediu: 300, adresa_livrare: 300,
  administrator: 120, telefon_administrator: 40, email: 120, delegat: 120, telefon_delegat: 40,
  discounturi: 1500, modalitate_plata: 120,
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

// agentul logat ({ id, nume, admin, rol }) sau null — admin = 1 dacă e adminul intrat în contul lui
export async function agentLogat(request, env) {
  const token = tokenDin(request);
  if (!token) return null;
  return env.DB.prepare(`SELECT a.id, a.nume, a.rol, s.admin FROM sesiune s JOIN agent a ON a.id = s.agent_id
    WHERE s.token_hash = ? AND s.expira_la > datetime('now') AND a.activ = 1`).bind(await sha256(token)).first();
}

// hash-ul tokenului sesiunii din cerere (ca în tabelul sesiune) — schimbarea parolei păstrează doar sesiunea asta
export const sesiuneaCurenta = async request => sha256(tokenDin(request) || '');

export async function stergeSesiunea(request, env) {
  const token = tokenDin(request);
  if (token) await env.DB.prepare('DELETE FROM sesiune WHERE token_hash = ?').bind(await sha256(token)).run();
}

// cererea vine de la manager? (Authorization: Bearer <CHEIE_MANAGER>)
export function eManager(request, env) {
  if (!env.CHEIE_MANAGER) return false;
  return egale(enc.encode(request.headers.get('Authorization') || ''), enc.encode(`Bearer ${env.CHEIE_MANAGER}`));
}

// Pagina /admin: parola = secretul PAROLA_ADMIN din Pages (wrangler pages secret put PAROLA_ADMIN),
// trimisă de pagină în antetul X-Parola (encodeURIComponent — poate avea diacritice).
// 10 parole greşite în 15 minute → blocat 15 minute, pentru oricine: parola nu se poate ghici încercând.
// null = e adminul; altfel răspunsul de eroare, gata de întors.
export async function nuEAdmin(request, env) {
  if (!env.PAROLA_ADMIN) return raspuns(503, { eroare: 'Parola de admin nu e pusă pe Cloudflare (wrangler pages secret put PAROLA_ADMIN).' });
  await env.DB.prepare('INSERT OR IGNORE INTO server (id) VALUES (1)').run();
  const acum = Date.now();
  const recente = JSON.parse((await env.DB.prepare('SELECT esecuri FROM server WHERE id = 1').first())?.esecuri || '[]')
    .filter(t => acum - t < 15 * 60e3);
  if (recente.length >= 10) return raspuns(429, { eroare: 'Prea multe parole greşite — mai încearcă peste 15 minute.' });
  let parola = '';
  try { parola = decodeURIComponent(request.headers.get('X-Parola') || ''); } catch { /* antet stricat = parolă greşită */ }
  if (egale(enc.encode(parola), enc.encode(env.PAROLA_ADMIN))) return null;
  await env.DB.prepare('UPDATE server SET esecuri = ? WHERE id = 1').bind(JSON.stringify([...recente, acum])).run();
  return raspuns(401, { eroare: 'Parolă greşită.' });
}

// următoarea versiune — la fiecare adăugare/modificare; managerul cere „după versiunea X"
export const VERSIUNE_NOUA = '(SELECT COALESCE(MAX(versiune), 0) + 1 FROM client)';

// ── Scriere DIRECTĂ, fără aprobare: managerul (pagina Clienţi) şi conturile de conducere ──
// Agentul unui client = numele unui cont de agent sau o valoare care e deja în coloana AGENT
// (BIROU, SITE…) — altfel o greşeală de scriere ar lăsa clientul fără nimeni care să-l vadă.
// Agenţii pe care îi poate primi un client: conturile de agent + ce e deja în coloana AGENT
export async function numeAgenti(env) {
  const { results } = await env.DB.prepare(`SELECT nume FROM agent WHERE rol = 'agent'
    UNION SELECT agent FROM client WHERE agent IS NOT NULL AND sters_la IS NULL ORDER BY 1`).all();
  return results.map(r => r.nume);
}
const agentGresit = async (env, nume) => nume && !(await numeAgenti(env)).includes(nume)
  && `Agentul „${nume}" nu există — alege-l din listă.`;

// clientul (neşters) cu id-ul ăsta, sau null
export const clientul = (env, id) => env.DB.prepare('SELECT * FROM client WHERE id = ? AND sters_la IS NULL').bind(+id || 0).first();

// Câmpurile din cerere (+ agent) → client modificat (id) sau nou (id null). Clientul care
// schimbă agentul trece la cel nou; modificarea în aşteptare a celui vechi pe el se pierde.
// → { client } sau { cod, eroare }
export async function scrieDirect(request, env, id) {
  const { v, eroare } = await clientDinCerere(request.clone(), !id);
  if (eroare) return { cod: 400, eroare };
  const agent = text((await request.json()).agent, 120);
  const gresit = await agentGresit(env, agent);
  if (gresit) return { cod: 400, eroare: gresit };
  const col = Object.keys(CAMPURI);
  if (!id) {
    const c = await env.DB.prepare(`INSERT INTO client (agent, ${col.join(', ')}, creat_la, modificat_la, versiune)
      VALUES (?${', ?'.repeat(col.length)}, datetime('now'), datetime('now'), ${VERSIUNE_NOUA}) RETURNING *`)
      .bind(agent, ...col.map(k => v[k])).first();
    await anunta(env, { agenti: [agent], conducere: true });
    return { client: c };
  }
  const vechi = await clientul(env, id);
  if (!vechi) return { cod: 404, eroare: 'Clientul nu mai există — l-a şters cineva între timp.' };
  await env.DB.batch([
    env.DB.prepare(`UPDATE client SET agent = ?, ${col.map(k => `${k} = ?`).join(', ')}, modificat_la = datetime('now'),
        versiune = ${VERSIUNE_NOUA} WHERE id = ?`).bind(agent, ...col.map(k => v[k]), vechi.id),
    ...(agent === vechi.agent ? [] : [env.DB.prepare('DELETE FROM propunere WHERE client_id = ?').bind(vechi.id)]),
  ]);
  await anunta(env, { agenti: [vechi.agent, agent], conducere: true });
  return { client: await clientul(env, id) };
}

// O propunere (client nou / modificare în aşteptarea aprobării) aşa cum o vede agentul:
// clientul cu valorile propuse peste cele de acum + cum se recunoaşte.
export const vedereAgent = (p, client = null) => ({
  ...(client ?? { id: null, agent: p.agent, creat_la: null }), ...JSON.parse(p.date_json),
  propunere_id: p.id, inAsteptare: p.stergere ? 'stergere' : p.client_id ? 'modificare' : 'nou', trimis_la: p.creat_la,
});

// „S-a schimbat ceva?" — un singur rând, ieftin: MAX(versiune) merge pe index, propunerile sunt puţine.
// Agentul: clienţii (aprobări, conducerea) + cererile lui (respinse, trimise de pe alt telefon); conducerea:
// doar clienţii; managerul (agent = null): clienţii + TOATE cererile — îl întreabă la 30 s / 10 min
// (manager/server/clienti.js) şi abia când e altul preia clienţii şi cererile.
// Pagina îl întreabă doar la reconectarea legăturii live (ce s-a pierdut cât era închisă).
export async function semn(env, agent) {
  const toate = agent === null;
  const r = await env.DB.prepare(`SELECT (SELECT COALESCE(MAX(versiune), 0) FROM client) AS v,
      (SELECT COUNT(*) || ':' || COALESCE(MAX(id), 0) || ':' || COALESCE(MAX(creat_la), '') FROM propunere
        WHERE ? OR agent = ?) AS p`)
    .bind(toate ? 1 : 0, toate || agent.rol === 'conducere' ? '' : agent.nume).first();
  return `${r.v}|${r.p}`;
}

// Versiunea paginii de acum = amprenta lui public/index.html (userul, 2026-10-30: pagina deschisă înainte
// de o publicare să se actualizeze singură). Merge în răspunsurile listei şi ale semnului; pagina o ţine
// minte pe prima şi se reîncarcă când vede alta. (Doar index.html: o schimbare numai în reduceri.js
// nu reîncarcă paginile — atinge şi index.html atunci.)
let _versiune = null;
export const versiunePagina = async () => (_versiune ??= (await sha256(pagina)).slice(0, 12));

// O publicare nouă = instanţe noi: prima cerere din fiecare îi spune obiectului de anunţuri versiunea
// (functions/_middleware.js); dacă e alta decât ştia, el anunţă toate paginile deschise („versiune"),
// iar ele întreabă o dată ce versiune e acum şi se reîncarcă dacă e alta decât a lor.
export async function anuntaVersiunea(env) {
  if (!env.ANUNTURI) return;
  try {
    await env.ANUNTURI.get(env.ANUNTURI.idFromName('portal')).fetch('https://anunturi/versiune', {
      method: 'POST', body: JSON.stringify({ versiune: await versiunePagina() }),
    });
  } catch (e) { console.error('Anunţul versiunii a eşuat:', e.message); }
}

// Anunţă paginile deschise că s-a schimbat ceva la ele (anunturi/worker.js): agenţii atinşi şi,
// dacă s-au schimbat clienţi (nu doar cereri), conducerea. Nu strică niciodată cererea care a
// făcut schimbarea — fără legătura live, paginile văd la refresh, ca înainte.
export async function anunta(env, { agenti = [], conducere = false }) {
  if (!env.ANUNTURI) return;
  try {
    await env.ANUNTURI.get(env.ANUNTURI.idFromName('portal')).fetch('https://anunturi/anunta', {
      method: 'POST', body: JSON.stringify({ agenti: [...new Set(agenti.filter(Boolean))], conducere }),
    });
  } catch (e) { console.error('Anunţul live a eşuat:', e.message); }
}

// Ştergerea unui client (rândul rămâne, cu versiune nouă — vezi api/clienti/[id].js) + cererea de pe el
export async function stergeClient(env, id) {
  const [c] = (await env.DB.batch([
    env.DB.prepare(`UPDATE client SET sters_la = datetime('now'), versiune = ${VERSIUNE_NOUA} WHERE id = ? RETURNING agent`).bind(id),
    env.DB.prepare('DELETE FROM propunere WHERE client_id = ?').bind(id),
  ]))[0].results;
  await anunta(env, { agenti: [c?.agent], conducere: true });
}
