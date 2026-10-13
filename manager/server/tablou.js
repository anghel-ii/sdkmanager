const fs = require('node:fs');
const path = require('node:path');
const { db, ACUM } = require('./db.js');
const { json } = require('./http.js');
const { config } = require('./config.js');

// ═══════════════════════════════════════════════════════════════════════════
//  TABLOUL ADMINULUI (/admin — userul, 2026-10-13: „să văd mai bine informaţiile"):
//  activitatea din ultimele 7 zile, cine a lucrat, serverul şi coada jurnalului.
//  Versiunea, backup-ul şi update-ul vin ca înainte din /api/actualizare.
// ═══════════════════════════════════════════════════════════════════════════

const ZILE = 7;

// ultimele rânduri din jurnalul lunii (server/jurnal.js) — citim doar coada fişierului
function coadaJurnal(randuri = 40) {
  const f = path.join(path.dirname(config.db), 'jurnal', `server-${new Date().toISOString().slice(0, 7)}.log`);
  let fd;
  try {
    fd = fs.openSync(f, 'r');
    const { size } = fs.fstatSync(fd), cat = Math.min(size, 64 * 1024);
    const buf = Buffer.alloc(cat);
    fs.readSync(fd, buf, 0, cat, size - cat);
    return buf.toString('utf8').split('\n').filter(Boolean).slice(-randuri).join('\n');
  } catch { return ''; } finally { if (fd !== undefined) fs.closeSync(fd); }
}

const mb = f => { try { return fs.statSync(f).size / 1e6; } catch { return 0; } };

function tablou(ctx) {
  const din = `datetime(${ACUM()}, '-${ZILE} days')`;
  const activitate = db().prepare(`SELECT
      COALESCE(SUM(creat_la > ${din}), 0) AS oferte, COALESCE(SUM(confirmat_la > ${din}), 0) AS acceptate,
      COALESCE(SUM(finalizat_la > ${din}), 0) AS finalizate, COALESCE(SUM(fisa_printata_la > ${din}), 0) AS fise
    FROM comanda`).get();
  activitate.anulate = db().prepare(`SELECT COUNT(*) AS n FROM cerere WHERE stare = 'aprobata' AND decis_la > ${din}`).get().n;
  // pe om: ce a făcut în ultimele 7 zile (conturile active)
  const peOm = db().prepare(`SELECT u.id, u.nume, u.rol,
      (SELECT COUNT(*) FROM comanda c WHERE c.creat_de = u.id AND c.creat_la > ${din}) AS oferte,
      (SELECT COUNT(*) FROM comanda c WHERE c.confirmat_de = u.id AND c.confirmat_la > ${din}) AS acceptate,
      (SELECT COUNT(*) FROM comanda c WHERE c.finalizat_de = u.id AND c.finalizat_la > ${din}) AS finalizate
    FROM utilizator u WHERE u.activ = 1`).all();
  json(ctx.res, 200, {
    zile: ZILE, activitate, peOm,
    server: {
      pornit: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      node: process.version,
      bazaMb: Math.round((mb(config.db) + mb(config.db + '-wal')) * 10) / 10,
    },
    jurnal: coadaJurnal(),
  });
}

module.exports = { rute: [['GET', '/api/admin/tablou', { handler: tablou, rol: 'admin' }]] };
