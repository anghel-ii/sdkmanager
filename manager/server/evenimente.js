const crypto = require('node:crypto');
const auth = require('./auth.js');
const { copiaLui, copiaCurenta } = require('./db.js');

// ═══════════════════════════════════════════════════════════════════════════
//  ACTUALIZARE LIVE — serverul ÎMPINGE schimbările spre pagini (WebSocket)
//
//  Fiecare pagină a managerului deschide `ws://<server>/api/live` (web/live.js).
//  La orice schimbare serverul trimite un mesaj scurt; pagina îşi re-cere
//  datele. Mesajul spune DOAR că s-a schimbat ceva, nu trimite date (acelaşi
//  drum de citire, aceleaşi drepturi ca până acum).
//
//    {"tip":"schimbare"} — ofertă nouă / modificată / acceptată, scanare,
//                          finalizare, facturare, sticlă comandată (tuturor)
//    {"tip":"personal"}  — pin / sortare: DOAR conexiunilor aceluiaşi utilizator,
//                          ca toate taburile / dispozitivele lui să rămână la fel
//
//  De ce WebSocket şi nu SSE / întrebări repetate (istoric 2026-09-22): SSE ţine
//  o conexiune HTTP pe tab, iar pe HTTP simplu browserul permite doar 6 spre
//  acelaşi server — la 6 taburi deschise, orice pagină nouă se agăţa („a picat
//  serverul"). Conexiunile WebSocket NU intră în limita aia (Chrome: 255).
//
//  Implementare minimă pe node:http (proiectul n-are dependenţe de runtime):
//  handshake RFC 6455 + cadre text server→client + ping la 25 s. De la client
//  nu aşteptăm nimic în afară de „close".
// ═══════════════════════════════════════════════════════════════════════════

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const conexiuni = new Map();   // socket → id utilizator
const deTest = new WeakMap();  // socketurile celor în modul test → copia lor (colegi / admin)

// cadru WebSocket server→client (nemascat): text (0x1), ping (0x9), close (0x8)
function cadru(opcode, date = Buffer.alloc(0)) {
  const n = date.length;
  const cap = n < 126 ? Buffer.from([0x80 | opcode, n])
    : n < 65536 ? Buffer.from([0x80 | opcode, 126, n >> 8, n & 0xff])
    : (() => { const b = Buffer.alloc(10); b[0] = 0x80 | opcode; b[1] = 127; b.writeBigUInt64BE(BigInt(n), 2); return b; })();
  return Buffer.concat([cap, date]);
}

function trimite(socket, mesaj) {
  if (!socket.destroyed) socket.write(cadru(0x1, Buffer.from(JSON.stringify(mesaj))));
}

// server.on('upgrade', …) — doar /api/live, doar cu sesiune validă
function upgrade(req, socket) {
  const cale = req.url.split('?')[0];
  const utilizator = auth.dinToken(auth.tokenDinCerere(req));
  const cheie = req.headers['sec-websocket-key'];
  if (cale !== '/api/live' || !utilizator || !cheie ||
      String(req.headers.upgrade).toLowerCase() !== 'websocket') {
    socket.end(`HTTP/1.1 ${utilizator ? 400 : 401} ${utilizator ? 'Bad Request' : 'Unauthorized'}\r\n\r\n`);
    return;
  }
  const accept = crypto.createHash('sha1').update(cheie + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
               `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);
  conexiuni.set(socket, utilizator.id);
  if (utilizator.mod_test) deTest.set(socket, copiaLui(utilizator));

  const ping = setInterval(() => { if (!socket.destroyed) socket.write(cadru(0x9)); }, 25000);
  const inchide = () => { clearInterval(ping); conexiuni.delete(socket); };
  socket.on('data', buf => {
    if ((buf[0] & 0x0f) === 0x8) { socket.end(cadru(0x8)); inchide(); }   // clientul închide
  });
  socket.on('close', inchide);
  socket.on('error', inchide);
}

// o schimbare făcută într-o copie de test o află doar cei de pe copia aia (cele reale, toţi)
function anunta() {
  const test = copiaCurenta();
  for (const s of conexiuni.keys()) if (!test || deTest.get(s) === test) trimite(s, { tip: 'schimbare' });
  if (!test) for (const f of ascultatori) f({ tip: 'schimbare' });
}

function anuntaUtilizator(utilizatorId) {
  for (const [s, uid] of conexiuni) if (uid === utilizatorId) trimite(s, { tip: 'personal' });
  for (const f of ascultatori) f({ tip: 'personal' }, utilizatorId);
}

// paginile deschise prin releul de pe Cloudflare (server/releu.js) — aceleaşi mesaje, pe alt drum
const ascultatori = new Set();

// La oprirea serverului: cadru „close" şi socket închis pe fiecare conexiune —
// altfel server.close() aştepta la nesfârşit tab-urile deschise (ping la 25 s).
function inchideToate() {
  for (const s of conexiuni.keys()) { try { s.end(cadru(0x8)); } catch {} s.destroy(); }
  conexiuni.clear();
}

module.exports = { anunta, anuntaUtilizator, upgrade, inchideToate, ascultatori, rute: [] };
