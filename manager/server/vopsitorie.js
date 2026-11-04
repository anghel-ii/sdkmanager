const { db, ACUM, comenziDemo } = require('./db.js');
const { json, eroare, corpJson } = require('./http.js');
const { anunta, anuntaUtilizator } = require('./evenimente.js');
const { FARA_CERERE } = require('./cereri.js');

// ═══════════════════════════════════════════════════════════════════════════
//  VOPSITORIE (userul, 2026-11-04) — comenzile în lucru cu vopsire în cod RAL.
//
//  Sursa: configuraţia salvată a fiecărui produs (pozitie.config_json): la rame
//  `rame.ral`, la uşile culisante `vopsire.ral` (configuratorul, ca la rame). Intră
//  comenzile acceptate (tip „comanda"), neanulate, nefinalizate, fără anulare cerută;
//  la finalizare ies singure din listă (în „În lucru" rămân ca orice comandă).
//
//  Pe fiecare: data la care s-a dus la vopsit şi vopsitorul (tabelul `vopsire`, v42).
//  Cine le scrie primeşte o notificare la 5, 10, 15… zile de la data aia: să sune
//  la vopsitor (verificaNotificari, din oră în oră; `notificat_pas` = ultimul multiplu
//  de 5 anunţat, ca să nu vină de două ori). Vopsitorii scrişi o dată apar ca sugestii.
// ═══════════════════════════════════════════════════════════════════════════

const ZILE_NOTIFICARE = 5;

// RAL-ul unui produs: ramele îl ţin în `rame`, uşile în `vopsire` (sistemele ramelor: rama820 …)
const RAL = `NULLIF(TRIM(CASE WHEN p.sistem LIKE 'rama%' THEN json_extract(p.config_json, '$.rame.ral')
                              ELSE json_extract(p.config_json, '$.vopsire.ral') END), '')`;

const IN_LUCRU = `c.tip = 'comanda' AND c.anulat = 0 AND c.finalizat_la IS NULL AND ${FARA_CERERE}`;
// azi (ziua din România, ca data scrisă de om) minus data dusă la vopsit
const ZILE = `CAST(julianday(date(${ACUM()}, 'localtime')) - julianday(v.dus_la) AS INTEGER)`;

function comenzi() {
  const randuri = db().prepare(`
    SELECT c.id, COALESCE(c.oferta_nr, c.numar) AS numar, c.client_nume, c.confirmat_la,
           p.idx, p.eticheta, ${RAL} AS ral,
           v.dus_la, v.vopsitor, v.modificat_la, u.nume AS dus_de_nume,
           CASE WHEN v.dus_la IS NULL THEN NULL ELSE ${ZILE} END AS zile
      FROM comanda c
      JOIN pozitie p ON p.comanda_id = c.id
      LEFT JOIN vopsire v ON v.comanda_id = c.id
      LEFT JOIN utilizator u ON u.id = v.dus_de
     WHERE ${IN_LUCRU} AND ${RAL} IS NOT NULL
     ORDER BY v.dus_la IS NOT NULL, v.dus_la, c.confirmat_la, c.id, p.idx`).all();
  const m = new Map();
  for (const r of randuri) {
    const c = m.get(r.id) ?? { id: r.id, numar: r.numar, client_nume: r.client_nume, confirmat_la: r.confirmat_la,
      dus_la: r.dus_la, vopsitor: r.vopsitor, dus_de_nume: r.dus_de_nume, modificat_la: r.modificat_la, zile: r.zile, produse: [] };
    c.produse.push({ idx: r.idx, eticheta: r.eticheta, ral: r.ral });
    m.set(r.id, c);
  }
  return [...m.values()];
}

function lista(ctx) {
  const demo = comenziDemo();
  json(ctx.res, 200, {
    comenzi: comenzi().map(c => ({ ...c, ...(demo.has(c.id) && { demo: true }) })),
    // vopsitorii folosiţi până acum — sugestii, cei mai recenţi întâi
    vopsitori: db().prepare(`SELECT vopsitor FROM vopsire WHERE vopsitor IS NOT NULL
      GROUP BY vopsitor COLLATE NOCASE ORDER BY MAX(modificat_la) DESC`).all().map(r => r.vopsitor),
  });
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const ziValida = t => DATA.test(t) && !Number.isNaN(Date.parse(t + 'T00:00:00Z')) && new Date(t + 'T00:00:00Z').toISOString().slice(0, 10) === t;

// { dus_la: 'YYYY-MM-DD', vopsitor } — ambele, sau ambele goale (= nu s-a dus încă, se şterge)
async function salveaza(ctx) {
  const id = Number(ctx.params.id);
  const corp = await corpJson(ctx.req);
  const dusLa = String(corp.dus_la ?? '').trim(), vopsitor = String(corp.vopsitor ?? '').trim().replace(/\s+/g, ' ');
  const c = db().prepare(`SELECT c.id FROM comanda c WHERE c.id = ? AND ${IN_LUCRU}
    AND EXISTS (SELECT 1 FROM pozitie p WHERE p.comanda_id = c.id AND ${RAL} IS NOT NULL)`).get(id);
  if (!c) return eroare(ctx.res, 404, 'Comanda nu e în lucru cu vopsire RAL (poate s-a finalizat între timp).');

  if (!dusLa && !vopsitor) {
    db().prepare('DELETE FROM vopsire WHERE comanda_id = ?').run(id);
  } else {
    if (!ziValida(dusLa)) return eroare(ctx.res, 400, 'Scrie data la care s-a dus la vopsit.');
    const azi = db().prepare(`SELECT date(${ACUM()}, 'localtime') AS d`).get().d;
    if (dusLa > azi) return eroare(ctx.res, 400, 'Data dusă la vopsit nu poate fi în viitor.');
    if (!vopsitor) return eroare(ctx.res, 400, 'Scrie la ce vopsitor s-a dus.');
    if (vopsitor.length > 100) return eroare(ctx.res, 400, 'Numele vopsitorului e prea lung.');
    // altă dată → notificările o iau de la capăt (la 5 zile de data nouă)
    db().prepare(`INSERT INTO vopsire (comanda_id, dus_la, vopsitor, dus_de, modificat_la, notificat_pas)
        VALUES (?, ?, ?, ?, ${ACUM()}, 0)
      ON CONFLICT (comanda_id) DO UPDATE SET vopsitor = excluded.vopsitor, dus_de = excluded.dus_de,
        modificat_la = excluded.modificat_la,
        notificat_pas = CASE WHEN vopsire.dus_la IS excluded.dus_la THEN vopsire.notificat_pas ELSE 0 END,
        dus_la = excluded.dus_la`).run(id, dusLa, vopsitor, ctx.utilizator.id);
  }
  anunta({ vopsitorie: true });
  json(ctx.res, 200, { ok: true });
}

// Din oră în oră (şi la pornire): la fiecare 5 zile de la data dusă, o notificare celui care a scris-o.
// O dată ajunsă (ex. data scrisă cu 12 zile în urmă) → o singură notificare, nu câte una pe fiecare 5 zile sărite.
function verificaNotificari() {
  const { notifica } = require('./notificari.js');
  const deAnuntat = db().prepare(`
    SELECT v.comanda_id, v.dus_la, v.vopsitor, v.dus_de, v.notificat_pas, ${ZILE} AS zile,
           COALESCE(c.oferta_nr, c.numar) AS numar, c.client_nume
      FROM vopsire v JOIN comanda c ON c.id = v.comanda_id
      JOIN utilizator u ON u.id = v.dus_de AND u.activ = 1
     WHERE v.dus_la IS NOT NULL AND ${IN_LUCRU}
       AND ${ZILE} / ${ZILE_NOTIFICARE} > v.notificat_pas`).all();
  const marcheaza = db().prepare('UPDATE vopsire SET notificat_pas = ? WHERE comanda_id = ?');
  for (const v of deAnuntat) {
    const [a, l, z] = v.dus_la.split('-');
    notifica(v.dus_de, {
      titlu: `Sună la ${v.vopsitor} — vopsitorie`,
      text: `Comanda ${v.numar} (${v.client_nume}) e la vopsit de ${v.zile} zile (dusă pe ${z}.${l}.${a}). Întreabă cum stă.`,
      link: '/vopsitorie',
    });
    marcheaza.run(Math.floor(v.zile / ZILE_NOTIFICARE), v.comanda_id);
    anuntaUtilizator(v.dus_de);
  }
  return deAnuntat.length;
}

function porneste() {
  const tura = () => { try { verificaNotificari(); } catch (e) { console.error('Vopsitorie: verificarea notificărilor a eşuat:', e.message); } };
  setTimeout(tura, 60e3).unref();          // după pornire (ora exactă apucă să se sincronizeze)
  setInterval(tura, 3600e3).unref();
}

// pt. meniu: câte comenzi cu RAL nu s-au dus încă la vopsit
const nrNeduse = () => db().prepare(`SELECT COUNT(DISTINCT c.id) AS n FROM comanda c JOIN pozitie p ON p.comanda_id = c.id
  LEFT JOIN vopsire v ON v.comanda_id = c.id WHERE ${IN_LUCRU} AND ${RAL} IS NOT NULL AND v.dus_la IS NULL`).get().n;

module.exports = {
  porneste, verificaNotificari, nrNeduse,
  rute: [
    ['GET', '/api/vopsitorie',     { handler: lista }],
    ['PUT', '/api/vopsitorie/:id', { handler: salveaza }],
  ],
};
