const { db, ACUM } = require('./db.js');
const auth = require('./auth.js');
const { json, redirect } = require('./http.js');
const { anunta } = require('./evenimente.js');

// ═══════════════════════════════════════════════════════════════════════════
//  SCANARE DIN ATELIER
//
//  Pagina de scanare stă pe Cloudflare Pages (HTTPS — altfel camera nu porneşte
//  pe iPhone), serverul ăsta în reţeaua locală (HTTP). Safari blochează fetch-ul
//  https → http, dar NU navigarea — testat pe iPhone 2026-09-22 (testscanare):
//
//    popup (implicit) — pagina deschide o fereastră spre /scan/inregistreaza;
//                       răspundem cu o pagină care trimite rezultatul înapoi
//                       (postMessage) şi se închide singură — camera rămâne pornită
//    nav  (rezervă)   — pagina navighează aici; răspundem cu redirect înapoi
//
//  Autentificarea: cookie-ul de sesiune al serverului (SameSite=Lax — pleacă la
//  navigările de nivel superior, deci şi în fereastra deschisă de pagină). Fără
//  sesiune → /login, apoi înapoi aici, apoi se înregistrează.
//
//  Scanările sunt un log append-only (tabelul `scanare`); aceeaşi uşă + aceeaşi
//  operaţie + acelaşi om în 30 s = una singură (reîncărcări, dublu-tap).
// ═══════════════════════════════════════════════════════════════════════════

// Paginile de scanare de unde acceptăm întoarcerea (redirect / postMessage).
const ORIGINI = [
  /^https:\/\/([a-z0-9-]+\.)?scanare-atelier\.pages\.dev$/,
  /^http:\/\/localhost(:\d+)?$/,
];
const originePermisa = o => ORIGINI.some(r => r.test(o || ''));

const esc = t => String(t ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ora = () => new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });

function inregistreaza(utilizator, codBrut, opCod) {
  const cod = String(codBrut || '').trim().toUpperCase();
  if (!cod) return { ok: false, mesaj: 'Cod gol.' };

  const op = db().prepare('SELECT * FROM operatie WHERE cod = ? AND activ = 1').get(String(opCod || ''));
  if (!op) return { ok: false, mesaj: `Operaţie necunoscută: ${opCod}.` };

  const u = db().prepare(`
    SELECT a.id, a.cod_bare, p.eticheta,
           c.id AS comanda_id, c.tip, c.numar, c.oferta_nr, c.client_nume, c.anulat, c.finalizat_la
      FROM usa a JOIN pozitie p ON p.id = a.pozitie_id JOIN comanda c ON c.id = p.comanda_id
     WHERE UPPER(a.cod_bare) = ?`).get(cod);
  if (!u)        return { ok: false, mesaj: `Codul ${cod} nu există în manager.` };
  if (u.anulat)  return { ok: false, mesaj: `Comanda ${u.oferta_nr || u.numar} e anulată.` };

  const ce = `${u.oferta_nr || u.numar} · ${u.eticheta} · ${u.client_nume}`;

  const recent = db().prepare(`
    SELECT id FROM scanare WHERE usa_id = ? AND operatie_id = ? AND utilizator_id = ? AND anulat = 0
       AND moment >= datetime(${ACUM()}, '-30 seconds')`).get(u.id, op.id, utilizator.id);
  if (!recent) {
    db().prepare(`INSERT INTO scanare (usa_id, operatie_id, utilizator_id, moment) VALUES (?, ?, ?, ${ACUM()})`)
      .run(u.id, op.id, utilizator.id);
  }
  // „Coletare" = ultima etapă: comanda (acceptată) trece la finalizate
  let finalizata = false;
  if (op.cod === 'COLETARE' && u.tip === 'comanda' && !u.finalizat_la) {
    db().prepare(`UPDATE comanda SET finalizat_la = ${ACUM()}, finalizat_de = ? WHERE id = ?`).run(utilizator.id, u.comanda_id);
    finalizata = true;
  }
  if (!recent) anunta({ comanda: u.comanda_id });
  console.log(`[scanare] ${cod} ${op.cod} — ${utilizator.nume}${recent ? ' (dublură ignorată)' : ''}`);
  return { ok: true, cod, operatie: op.nume, ce, cine: utilizator.nume, ora: ora(), dublura: !!recent, finalizata };
}

// `tinta` = originea paginii de scanare (verificată) — postMessage pleacă DOAR acolo.
function paginaPopup(res, rez, tinta) {
  const culoare = rez.ok ? '#6b9b7a' : '#b96a5b';
  res.writeHead(rez.ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(`<!DOCTYPE html><html lang="ro"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${rez.ok ? 'Înregistrat' : 'Eroare'}</title></head>
<body style="font-family:system-ui,sans-serif;background:#14161a;color:#e9ebee;display:grid;place-items:center;min-height:90vh;margin:0;padding:20px;text-align:center">
<div><div style="font-size:48px;color:${culoare}">${rez.ok ? '✓' : '⚠'}</div>
<div style="font-size:20px;margin:8px 0">${rez.ok ? `${esc(rez.operatie)} — ${esc(rez.cod)}` : esc(rez.mesaj)}</div>
<div style="color:#8b92a0">${rez.ok ? esc(rez.ce) : ''}</div>
<button onclick="window.close()" style="margin-top:20px;font:inherit;padding:10px 20px;border-radius:8px;border:1px solid #2c313a;background:#21252c;color:#e9ebee">Închide</button></div>
<script>
  var rez = ${JSON.stringify({ tip: 'scanare', ...rez }).replace(/</g, '\\u003c')};
  var trimis = false;
  var tinta = ${JSON.stringify(tinta || '')};
  try { if (window.opener && tinta) { window.opener.postMessage(rez, tinta); trimis = true; } } catch (e) {}
  // cu legătura spre pagina de scanare, fereastra se închide singură
  if (trimis) setTimeout(function () { window.close(); }, rez.ok ? 350 : 1800);
</script></body></html>`);
}

// GET /scan/inregistreaza?cod=…&op=…&m=popup|nav&inapoi=…
function trateazaScanare(req, res) {
  const url = new URL(req.url, 'http://x');
  const q = url.searchParams;
  const utilizator = auth.dinToken(auth.tokenDinCerere(req));
  if (!utilizator) return redirect(res, '/login?redirect=' + encodeURIComponent(url.pathname + url.search));

  const rez = inregistreaza(utilizator, q.get('cod'), q.get('op'));

  if (q.get('m') === 'nav') {
    let inapoi = null;
    try { const u = new URL(q.get('inapoi') || ''); if (originePermisa(u.origin)) inapoi = u; } catch {}
    if (inapoi) {
      inapoi.searchParams.set('rez', JSON.stringify(rez));
      return redirect(res, inapoi.href);
    }
  }
  const o = q.get('o');
  return paginaPopup(res, rez, originePermisa(o) ? o : null);
}

// ── Pentru manager: istoricul scanărilor unei comenzi ───────────────────────
function scanariComanda(comandaId) {
  return db().prepare(`
    SELECT s.id, s.usa_id, a.cod_bare, s.moment, o.nume AS operatie, o.ordine, u.nume AS cine
      FROM scanare s
      JOIN operatie o ON o.id = s.operatie_id
      JOIN utilizator u ON u.id = s.utilizator_id
      JOIN usa a ON a.id = s.usa_id JOIN pozitie p ON p.id = a.pozitie_id
     WHERE p.comanda_id = ? AND s.anulat = 0
     ORDER BY s.moment, s.id`).all(comandaId);
}

const operatii = ctx => json(ctx.res, 200, {
  operatii: db().prepare('SELECT cod, nume, ordine FROM operatie WHERE activ = 1 ORDER BY ordine').all(),
});

module.exports = {
  trateazaScanare, scanariComanda, inregistreaza,
  rute: [['GET', '/api/operatii', { handler: operatii }]],
};
