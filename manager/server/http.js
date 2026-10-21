const fs   = require('node:fs');
const path = require('node:path');

// ── Ajutoare HTTP ────────────────────────────────────────────────────────────
// Un router minimal peste node:http. Nu folosim Express fiindcă tot ce ne
// trebuie încape aici, iar proiectul n-are nicio dependenţă de runtime.

const LIMITA_CORP = 8 * 1024 * 1024;   // 8 MB — o ofertă cu multe poziţii + pozele schiţelor de găurire (rame 820, ~0,5 MB fiecare)

function json(res, cod, date, antete = {}) {
  res.corpTrimis = date;   // pt. jurnalul de activitate (server/activitate.js): ex. id-ul ofertei nou create
  const corp = JSON.stringify(date);
  res.writeHead(cod, {
    'Content-Type':  'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(corp),
    'Cache-Control': 'no-store',
    ...antete,
  });
  res.end(corp);
}

const eroare = (res, cod, mesaj) => json(res, cod, { eroare: mesaj });

const redirect = (res, catre, cod = 302) => {
  res.writeHead(cod, { Location: catre, 'Cache-Control': 'no-store' });
  res.end();
};

// Citeşte corpul cererii ca JSON. Respinge corpurile prea mari înainte să le
// acumuleze în memorie.
function corpJson(req) {
  return new Promise((resolve, reject) => {
    let brut = '', marime = 0;
    req.on('data', bucata => {
      marime += bucata.length;
      if (marime > LIMITA_CORP) {
        reject(Object.assign(new Error('Corp prea mare'), { cod: 413 }));
        req.destroy();
        return;
      }
      brut += bucata;
    });
    req.on('end', () => {
      if (!brut) return resolve({});
      try { resolve(req.corpCitit = JSON.parse(brut)); }   // corpCitit — pt. detaliile din jurnalul de activitate
      catch { reject(Object.assign(new Error('JSON invalid'), { cod: 400 })); }
    });
    req.on('error', reject);
  });
}

// ── Fişiere statice ──────────────────────────────────────────────────────────

const TIPURI = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.map':  'application/json; charset=utf-8',
};

// Serveşte `caleUrl` din `radacina`. Întoarce true dacă a servit ceva.
// Verificarea de traversare (`..`) se face pe calea REZOLVATĂ, nu pe şirul din
// URL — singura formă în care e de încredere.
//
// Cache: `no-cache` peste tot, adică „poţi păstra copia, dar întreabă-mă
// înainte s-o foloseşti". NU e acelaşi lucru cu `no-store` — cu un ETag,
// revalidarea costă un 304 gol, deci e ieftină. Alternativa (`max-age`) a
// produs deja un bug real: bundle-ul configuratorului se schimbă la fiecare
// build, iar un browser cu copia veche rula cod vechi fără să ştie nimeni.
function serveste(req, res, radacina, caleUrl, { index = 'index.html' } = {}) {
  let rel;
  try { rel = decodeURIComponent(caleUrl.split('?')[0]); }
  catch { return false; }

  let fisier = path.resolve(radacina, '.' + rel);
  if (fisier !== radacina && !fisier.startsWith(radacina + path.sep)) return false;

  if (fs.existsSync(fisier) && fs.statSync(fisier).isDirectory()) {
    fisier = path.join(fisier, index);
  }
  if (!fs.existsSync(fisier) || !fs.statSync(fisier).isFile()) return false;

  const st  = fs.statSync(fisier);
  const ext = path.extname(fisier).toLowerCase();
  const etag = `"${st.size.toString(16)}-${st.mtimeMs.toString(16)}"`;

  if (req?.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' });
    res.end();
    return true;
  }

  res.writeHead(200, {
    'Content-Type': TIPURI[ext] || 'application/octet-stream',
    'Content-Length': st.size,
    'Cache-Control': 'no-cache',
    ETag: etag,
  });
  fs.createReadStream(fisier).pipe(res);
  return true;
}

// ── Router ───────────────────────────────────────────────────────────────────
// Rutele se declară ca `['GET', '/api/comenzi/:id', handler]`. Segmentele cu
// `:` ajung în `ctx.params`.

function compileaza(sablon) {
  const parti = sablon.split('/').filter(Boolean);
  return {
    parti,
    potrivire(caleParti) {
      if (caleParti.length !== parti.length) return null;
      const params = {};
      for (let i = 0; i < parti.length; i++) {
        if (parti[i].startsWith(':')) params[parti[i].slice(1)] = decodeURIComponent(caleParti[i]);
        else if (parti[i] !== caleParti[i]) return null;
      }
      return params;
    },
  };
}

function router(rute) {
  const compilate = rute.map(([metoda, sablon, handler]) =>
    ({ metoda, handler, sablon, ...compileaza(sablon) }));

  return function potriveste(metoda, cale) {
    const parti = cale.split('?')[0].split('/').filter(Boolean);
    let caleExista = false;

    for (const r of compilate) {
      const params = r.potrivire(parti);
      if (!params) continue;
      caleExista = true;
      if (r.metoda === metoda) return { handler: r.handler, params, sablon: r.sablon };
    }
    // Calea există dar cu altă metodă → 405, nu 404. Ajută la depanare.
    return caleExista ? { metodaGresita: true } : null;
  };
}

module.exports = { json, eroare, redirect, corpJson, serveste, router };
