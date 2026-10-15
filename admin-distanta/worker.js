import { DurableObject } from 'cloudflare:workers';

// ═══════════════════════════════════════════════════════════════════════════
//  TABLOUL DE ADMIN DE ORIUNDE (userul, 2026-10-15) — tot managerul din firmă, ca admin.
//  Serverul din firmă nu primeşte nimic din internet: el se leagă AICI (WebSocket pe
//  /_releu, cu cheia managerului — manager/server/releu.js). Orice altă cerere, după
//  parola de admin, pleacă pe legătura aia, se execută pe server ca o cerere a contului
//  de admin şi răspunsul se întoarce aici. Paginile, datele şi butoanele sunt deci exact
//  cele din firmă. Un singur Durable Object ţine legătura şi paginile live (/api/live).
// ═══════════════════════════════════════════════════════════════════════════

const ZILE = 30;                     // cât ţine intrarea pe un dispozitiv
const COOKIE = 'adm';
const ANTETE = ['content-type', 'accept', 'if-none-match', 'if-modified-since'];
const enc = new TextEncoder();

const b64 = buf => {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const din64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const sha = async t => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(t)));
const egale = async (a, b) => crypto.subtle.timingSafeEqual(await sha(a), await sha(b));
async function semnatura(cheie, text) {
  const k = await crypto.subtle.importKey('raw', enc.encode(cheie), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', k, enc.encode(text)));
}

const eroare = (cod, mesaj, api) => api
  ? Response.json({ eroare: mesaj }, { status: cod, headers: { 'Cache-Control': 'no-store' } })
  : new Response(mesaj, { status: cod, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

// intrarea = „<expiră>.<HMAC cu parola>" — schimbarea parolei scoate pe toată lumea
const cookie = (url, valoare, secunde) =>
  `${COOKIE}=${valoare}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${secunde}${url.protocol === 'https:' ? '; Secure' : ''}`;

export class Releu extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.asteapta = new Map();   // id cerere → rezolvarea ei, când vine răspunsul serverului
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request) {
    const url = new URL(request.url), cale = url.pathname, api = cale.startsWith('/api/');
    if (cale === '/_releu') return this.server(request);
    if (cale === '/login') return request.method === 'POST' ? this.intra(request, url) : login();
    if (!(await this.logat(request))) return api ? eroare(401, 'Trebuie să fii autentificat.', true) : Response.redirect(new URL('/login', url), 302);
    // „Ieşire" din meniul managerului: iese de aici (sesiunea adminului de pe server rămâne a releului)
    if (cale === '/api/logout') return Response.json({ ok: true }, { headers: { 'Set-Cookie': cookie(url, '', 0) } });
    if (cale === '/api/live' && request.headers.get('Upgrade') === 'websocket') return this.accepta('pagina');
    return this.trimite(request, url, api);
  }

  // serverul din firmă se leagă — cu cheia managerului; o legătură nouă o înlocuieşte pe cea veche
  async server(request) {
    const [tip, cheie] = (request.headers.get('Authorization') ?? '').split(' ');
    if (!this.env.CHEIE_MANAGER || tip !== 'Bearer' || !(await egale(cheie ?? '', this.env.CHEIE_MANAGER))) return eroare(401, 'Cheie greşită.');
    if (request.headers.get('Upgrade') !== 'websocket') return eroare(426, 'Doar WebSocket.');
    for (const v of this.ctx.getWebSockets('server')) v.close(1000, 'Înlocuită de o legătură nouă.');
    return this.accepta('server');
  }

  accepta(tip) {
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [tip]);
    return new Response(null, { status: 101, webSocket: client });
  }

  async trimite(request, url, api) {
    const [server] = this.ctx.getWebSockets('server');
    if (!server) return eroare(503, 'Serverul din firmă nu e legat acum (oprit, fără internet sau în repornire) — mai încearcă peste un minut.', api);
    const id = crypto.randomUUID(), antete = {};
    for (const k of ANTETE) if (request.headers.has(k)) antete[k] = request.headers.get(k);
    const corp = ['GET', 'HEAD'].includes(request.method) ? null : b64(await request.arrayBuffer());
    const r = await new Promise(gata => {
      this.asteapta.set(id, gata);
      setTimeout(() => gata(null), 30e3);
      try { server.send(JSON.stringify({ id, metoda: request.method, cale: url.pathname + url.search, antete, corp })); } catch { gata(null); }
    });
    this.asteapta.delete(id);
    if (!r) return eroare(504, 'Serverul din firmă n-a răspuns.', api);
    // corpul vine deja comprimat (Content-Encoding: gzip) de pe server → „manual" = trece aşa cum e
    return new Response(r.corp ? din64(r.corp) : null, { status: r.stare, headers: r.antete, encodeBody: 'manual' });
  }

  webSocketMessage(ws, mesaj) {
    if (!this.ctx.getTags(ws).includes('server')) return;   // paginile doar ascultă
    const m = JSON.parse(mesaj);
    if (m.live) {
      for (const p of this.ctx.getWebSockets('pagina')) try { p.send(JSON.stringify(m.live)); } catch {}
      return;
    }
    this.asteapta.get(m.id)?.(m);
  }

  webSocketClose(ws, cod) {
    try { ws.close(cod); } catch {}
    if (this.ctx.getTags(ws).includes('server')) for (const gata of this.asteapta.values()) gata(null);
  }

  async logat(request) {
    const v = (request.headers.get('Cookie') ?? '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
    const [expira, semn] = (v ?? '').split('.');
    return !!(this.env.PAROLA_ADMIN && semn && +expira > Date.now()
      && await egale(semn, await semnatura(this.env.PAROLA_ADMIN, expira)));
  }

  // 10 parole greşite în 15 minute → blocat 15 minute (oricine, de oriunde)
  async intra(request, url) {
    if (!this.env.PAROLA_ADMIN) return login('Parola de admin nu e pusă pe Cloudflare (npx wrangler secret put PAROLA_ADMIN).', 503);
    const acum = Date.now();
    const esecuri = ((await this.ctx.storage.get('esecuri')) ?? []).filter(t => acum - t < 15 * 60e3);
    if (esecuri.length >= 10) return login('Prea multe parole greşite — mai încearcă peste 15 minute.', 429);
    const parola = String((await request.formData().catch(() => null))?.get('parola') ?? '');
    if (!(await egale(parola, this.env.PAROLA_ADMIN))) {
      await this.ctx.storage.put('esecuri', [...esecuri, acum]);
      return login('Parolă greşită.', 401);
    }
    const expira = String(acum + ZILE * 864e5);
    return new Response(null, { status: 303, headers: { Location: '/admin',
      'Set-Cookie': cookie(url, `${expira}.${await semnatura(this.env.PAROLA_ADMIN, expira)}`, ZILE * 86400) } });
  }
}

export default {
  fetch: (request, env) => env.RELEU.get(env.RELEU.idFromName('server')).fetch(request),
};

const login = (mesaj = '', cod = 200) => new Response(`<!DOCTYPE html>
<html lang="ro"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Manager SDK — admin</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; margin: 0; }
  body { background: #14171c; color: #e6e8eb; font: 15px/1.45 system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; padding: 16px; }
  form { display: grid; gap: 12px; width: min(360px, 100%); background: #1d2127; border: 1px solid #2e343d; border-radius: 10px; padding: 20px; }
  h1 { font-size: 1.15rem; } p { color: #9aa3ad; font-size: .88rem; }
  input, button { font: inherit; padding: 10px 12px; border-radius: 8px; border: 1px solid #2e343d; }
  input { background: #14171c; color: inherit; }
  button { font-weight: 600; background: #1f6fd1; border-color: #1f6fd1; color: #fff; cursor: pointer; }
  .eroare { color: #e5605a; }
</style></head><body>
<form method="post" action="/login">
  <h1>Manager SDK — admin</h1>
  <p>Managerul din firmă, de oriunde. Parola de admin pusă pe Cloudflare.</p>
  <input type="password" name="parola" autocomplete="current-password" required autofocus>
  <button>Intră</button>
  ${mesaj ? `<div class="eroare">${mesaj}</div>` : ''}
</form></body></html>`, { status: cod, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
