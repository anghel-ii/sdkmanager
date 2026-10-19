// ═══════════════════════════════════════════════════════════════════════════
//  CERERI REPETATE (userul, 2026-10-19). Pagina (web/bara.js) retrimite singură o
//  cerere /api care pică pe drum — util cât serverul reporneşte la update. Dar dacă
//  reţeaua cade DUPĂ ce serverul a salvat (Wi-Fi slab), retrimiterea ar salva încă o
//  dată: ofertă dublă, task dublu. De-aia fiecare cerere care scrie vine cu o cheie
//  (antetul X-Cheie-Cerere), aceeaşi la toate retrimiterile ei; serverul ţine minte
//  10 minute răspunsul dat pe cheia aia (pe utilizator) şi, la a doua, îl dă din nou
//  fără să mai execute nimic. Dacă a doua vine cât prima încă rulează, o aşteaptă.
//  Fără cheie (alte programe, testele vechi) — totul ca înainte.
// ═══════════════════════════════════════════════════════════════════════════

const VIATA = 10 * 60e3;
const MAXIM = 5000;
const tinute = new Map();   // `${utilizator}|${cheie}` → { gata: Promise<{ stare, antete, corp }>, la }

// Map-ul ţine ordinea inserării: cele vechi sunt la început
function curata() {
  const prag = Date.now() - VIATA;
  for (const [k, v] of tinute) {
    if (v.la >= prag && tinute.size <= MAXIM) break;
    tinute.delete(k);
  }
}

async function oSinguraData(req, res, utilizatorId, executa) {
  const cheie = req.headers['x-cheie-cerere'];
  if (!cheie || ['GET', 'HEAD'].includes(req.method) || !/^[\w-]{8,64}$/.test(cheie)) return executa();
  curata();
  const k = `${utilizatorId ?? '-'}|${cheie}`;
  const dinainte = tinute.get(k);
  if (dinainte) {
    const r = await dinainte.gata;
    res.writeHead(r.stare, { ...r.antete, 'X-Cerere-Repetata': '1' });
    return res.end(r.corp);
  }

  let gata;
  tinute.set(k, { gata: new Promise(r => { gata = r; }), la: Date.now() });
  // ce trimite handlerul (starea, antetele, corpul) — ţinut minte pt. retrimiteri
  const bucati = [];
  let antete = {};
  const { writeHead, write, end } = res;
  res.writeHead = (stare, ...rest) => {
    const h = rest.find(x => x && typeof x === 'object');
    if (h) antete = { ...antete, ...h };
    return writeHead.call(res, stare, ...rest);
  };
  res.write = (b, ...rest) => { if (b != null && typeof b !== 'function') bucati.push(Buffer.from(b)); return write.call(res, b, ...rest); };
  res.end = (b, ...rest) => {
    if (b != null && typeof b !== 'function') bucati.push(Buffer.from(b));
    gata({ stare: res.statusCode, antete: { ...res.getHeaders(), ...antete }, corp: Buffer.concat(bucati) });
    return end.call(res, b, ...rest);
  };
  return executa();
}

module.exports = { oSinguraData };
