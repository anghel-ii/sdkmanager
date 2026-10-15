const zlib = require('node:zlib');
const { db } = require('./db.js');
const auth = require('./auth.js');
const { config } = require('./config.js');
const { ascultatori } = require('./evenimente.js');

// ═══════════════════════════════════════════════════════════════════════════
//  TABLOUL DE ADMIN DE PE CLOUDFLARE (userul, 2026-10-15: „să văd exact ce văd în
//  aplicaţie, tichetele, orice îmi trebuie ca admin" — şi când nu sunt în firmă).
//  Serverul nu primeşte nimic din internet: EL ţine deschisă o legătură WebSocket spre
//  Worker-ul admin-distanta/ (cu cheia managerului, aceeaşi ca la clienţi). Pe ea vin
//  cererile paginii de acolo (deja trecute de parola de admin de pe Cloudflare); fiecare
//  se execută aici ca o cerere obişnuită a contului de admin, iar răspunsul pleacă
//  înapoi. Deci acolo e TOT managerul — aceleaşi pagini, date şi butoane. Mesajele
//  live (evenimente.js) merg pe acelaşi drum, ca paginile să se actualizeze singure.
// ═══════════════════════════════════════════════════════════════════════════

const ANTETE = ['content-type', 'etag', 'cache-control', 'location', 'last-modified', 'content-disposition'];
const MAX = 900 * 1024;   // un mesaj spre Worker are cel mult 1 MiB; bundle-ul configuratorului comprimat ≈ 370 KB
let token = null;         // sesiunea adminului pt. cererile de pe Cloudflare (se reface dacă dispare)

// userul, 2026-10-15: de la distanţă DOAR tabloul de admin (cu tot ce e pe el) şi tichetele — nimic din comenzi
// şi operaţiuni, ca să nu se poată face ceva pe o comandă. Se verifică AICI, pe server, nu pe Cloudflare.
// Fişierele .js / .css din rădăcina web/ sunt doar cod (bara, stilurile), fără date.
const PERMIS = /^\/(admin|tichete)(\/.*)?$|^\/[\w-]+\.(js|css)$|^\/api\/(admin|actualizare|agenti|utilizatori|tichete|eu|sumar|test\/reface|clienti\/cheie)(\/|$)/;
const BLOCAT = '<!DOCTYPE html><meta charset="utf-8"><title>Doar tabloul de admin</title>'
  + '<body style="font:16px/1.5 system-ui,sans-serif;background:#14171c;color:#e6e8eb;padding:40px">'
  + 'De la distanţă sunt deschise doar <a href="/admin" style="color:#4da3ff">tabloul de admin</a> şi '
  + '<a href="/tichete" style="color:#4da3ff">tichetele</a>. Comenzile şi operaţiunile se fac din firmă.</body>';

// ponytail: primul admin activ — azi e unul singur; mai mulţi admini → contul ales la login pe Cloudflare
const admin = () => db().prepare("SELECT id FROM utilizator WHERE rol = 'admin' AND activ = 1 ORDER BY id LIMIT 1").get()?.id;

// o cerere de pe Cloudflare → aceeaşi cerere la serverul ăsta, cu sesiunea adminului → răspunsul de trimis înapoi
async function executa(baza, m) {
  const raspuns = (stare, tip, corp) => ({ id: m.id, stare, antete: { 'content-type': `${tip}; charset=utf-8`, 'x-distanta': '1' },
    corp: Buffer.from(corp).toString('base64') });
  const text = (stare, mesaj) => raspuns(stare, 'application/json', JSON.stringify({ eroare: mesaj }));
  const cale = m.cale.split('?')[0];
  if (cale === '/') return { id: m.id, stare: 302, antete: { location: '/admin' }, corp: null };
  if (!PERMIS.test(cale)) return cale.startsWith('/api/') ? text(403, 'De la distanţă e deschis doar tabloul de admin.') : raspuns(403, 'text/html', BLOCAT);
  if (!auth.dinToken(token)) {   // prima cerere, sau sesiunea ştearsă (parolă schimbată, cont resetat)
    const id = admin();
    if (!id) return text(503, 'Managerul nu are niciun cont de admin activ.');
    token = auth.sesiuneNoua(id);
  }
  const r = await fetch(baza + m.cale, { method: m.metoda, redirect: 'manual',
    headers: { ...m.antete, cookie: auth.cookieSesiune(token).split(';')[0] },
    body: m.corp ? Buffer.from(m.corp, 'base64') : undefined });
  const antete = { 'x-distanta': '1' };   // bara.js ascunde din meniu ce nu e deschis de aici
  for (const k of ANTETE) if (r.headers.has(k)) antete[k] = r.headers.get(k);
  let corp = Buffer.from(await r.arrayBuffer());
  if (corp.length > 1024) { corp = zlib.gzipSync(corp); antete['content-encoding'] = 'gzip'; }
  if (corp.length > MAX) return text(502, 'Răspunsul e prea mare pentru legătura cu Cloudflare.');
  return { id: m.id, stare: r.status, antete, corp: corp.length ? corp.toString('base64') : null };
}

function porneste(port) {
  if (!config.releuUrl) return;
  const { cheie } = require('./clienti.js');
  const baza = `http://127.0.0.1:${port}`;   // ponytail: doar HTTP — serverul firmei n-are certificat
  let pauza = 5e3;   // reconectare: 5 s, apoi tot mai rar, până la 1 minut (Worker oprit / cheie greşită)
  const conecteaza = () => {
    if (!cheie()) { setTimeout(conecteaza, 60e3).unref(); return; }   // cheia se lipeşte în /admin
    const ws = new WebSocket(config.releuUrl, { headers: { Authorization: `Bearer ${cheie()}` } });
    let ultim = Date.now();
    // nimic de aici nu are voie să arunce: live() rulează în cererile colegilor, ping-ul pe un timer
    const trimite = text => { if (ws.readyState === WebSocket.OPEN) try { ws.send(text); } catch {} };
    const live = (mesaj, uid) => { if (uid === undefined || uid === admin()) trimite(JSON.stringify({ live: mesaj })); };
    // „ping" la 30 s (Worker-ul răspunde „pong" fără să se trezească); 90 s fără nimic = legătură moartă
    const ping = setInterval(() => (Date.now() - ultim > 90e3 ? ws.close() : trimite('ping')), 30e3);
    ping.unref();
    ws.onopen = () => { pauza = 5e3; ascultatori.add(live); console.log('Releu Cloudflare: conectat.'); };
    ws.onmessage = async e => {
      ultim = Date.now();
      if (e.data === 'pong') return;
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      const r = await executa(baza, m).catch(err => ({ id: m.id, stare: 502, antete: { 'content-type': 'text/plain; charset=utf-8' },
        corp: Buffer.from(`Serverul din firmă: ${err.message}`).toString('base64') }));
      trimite(JSON.stringify(r));
    };
    ws.onerror = () => {};   // urmează „close"
    ws.onclose = () => {
      clearInterval(ping); ascultatori.delete(live);
      setTimeout(conecteaza, pauza).unref(); pauza = Math.min(pauza * 2, 60e3);
    };
  };
  conecteaza();
}

module.exports = { porneste, executa };
