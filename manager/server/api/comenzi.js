const { json, eroare, corpJson } = require('../http.js');
const { db, tranzactie } = require('../db.js');
const { config } = require('../config.js');
const { anunta, anuntaUtilizator } = require('../evenimente.js');

// ═══════════════════════════════════════════════════════════════════════════
//  Oferte şi comenzi
//
//  O ofertă confirmată în configurator ajunge aici cu tot ce s-a calculat
//  acolo: configuraţia şi cele trei liste (facturare, necesar atelier, necesar
//  client). Liniile se COPIAZĂ, nu se recalculează — o editare ulterioară a
//  catalogului nu trebuie să rescrie retroactiv o ofertă deja dată clientului.
//
//  O comandă = UN SINGUR sistem (o singură poziţie) şi UN SINGUR cod de bare,
//  oricâte uşi / rame ar avea (userul, 2026-09-22). Tabelele `pozitie` şi `usa`
//  rămân (un rând fiecare), ca să nu rescriem schema.
//
//  Stări:  oferta → (acceptare) → comanda în lucru → (finalizare) → finalizată
//  Finalizarea: automat la scanarea „Coletare" (vezi scanare.js) sau manual.
//
//  Numerotarea: un singur contor pe an. Oferta OF-2026-0042 devine, la
//  acceptare, comanda CMD-2026-0042 — aceleaşi cifre, alt prefix. De-aia
//  codul de bare tipărit rămâne valabil după acceptare.
// ═══════════════════════════════════════════════════════════════════════════

// `sticla` = sticla de comandat la furnizor (pagina Comandă sticlă, server/sticla.js)
const LISTE = ['facturare', 'necesar', 'client', 'sticla'];

// ── Numerotare ───────────────────────────────────────────────────────────────
// Se cheamă din interiorul tranzacţiei de creare, deci nu se pot strecura două
// oferte cu acelaşi număr chiar dacă doi utilizatori confirmă în aceeaşi clipă.

function urmatorulNumar(d, an) {
  const ultim = d.prepare(
    'SELECT numar FROM comanda WHERE numar LIKE ? ORDER BY numar DESC LIMIT 1'
  ).get(`OF-${an}-%`);
  // zero-padding pe 4 cifre → sortarea ca text e şi sortare numerică
  return String(Number(ultim?.numar.slice(-4) ?? 0) + 1).padStart(4, '0');
}

// Codul de bare al comenzii: <an2><numar4>, ex. "260042" — scurt, uşor de
// tastat de mână dacă scanarea dă greş. (Comenzile vechi au coduri pe uşă,
// ex. "260007-1-02"; se găsesc în continuare la scanare.)
const codBare = (an, numar) => `${String(an).slice(-2)}${numar}`;

// ── Validare ─────────────────────────────────────────────────────────────────
// Verificăm tot ce vine de la client înainte să atingem baza. Mesajele sunt
// scrise ca să apară direct în UI, nu ca să fie citite dintr-un log.

function validează(corp) {
  const gresit = m => ({ gresit: m });

  const client = corp.client || {};
  if (!String(client.nume || '').trim()) return gresit('Completează numele clientului.');

  const pozitii = corp.pozitii;
  if (!Array.isArray(pozitii) || !pozitii.length) return gresit('Oferta n-are nicio configuraţie.');
  if (pozitii.length > 1) return gresit('O ofertă are un singur sistem de uşi / rame.');

  const p = pozitii[0];
  if (!p || typeof p !== 'object')            return gresit('Configuraţie lipsă.');
  if (!String(p.sistem || '').trim())         return gresit('Sistemul lipseşte.');
  if (!Number.isFinite(+p.latime)  || +p.latime  <= 0) return gresit('Lăţime invalidă.');
  if (!Number.isFinite(+p.inaltime)|| +p.inaltime<= 0) return gresit('Înălţime invalidă.');

  const nrUsi = +p.nrUsi;
  // gama rame: numărul de rame — pot fi zeci într-o comandă
  const maxUsi = /^rama/.test(String(p.sistem)) ? 500 : 20;
  if (!Number.isInteger(nrUsi) || nrUsi < 1 || nrUsi > maxUsi) {
    return gresit(`Număr de uşi invalid (${p.nrUsi}).`);
  }
  if (!p.config || typeof p.config !== 'object') return gresit('Configuraţia lipseşte.');

  for (const lista of LISTE) {
    const linii = p.linii?.[lista];
    if (linii != null && !Array.isArray(linii)) return gresit(`Lista „${lista}" e invalidă.`);
    for (const l of linii ?? []) {
      if (!String(l?.denumire || '').trim())  return gresit(`O linie din „${lista}" n-are denumire.`);
      if (!Number.isFinite(+l.cantitate))     return gresit(`Cantitate invalidă în „${lista}".`);
    }
  }
  return { ok: true };
}

// Scrie configuraţia (poziţia unică) + liniile ei.
function scriePozitia(d, comandaId, p) {
  const pozitieId = Number(d.prepare(`
    INSERT INTO pozitie (comanda_id, idx, sistem, eticheta, finisaj, latime, inaltime, nr_usi, config_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    comandaId,
    // idx liber (UNIQUE pe comandă) — la modificare, cea veche se şterge după
    (d.prepare('SELECT MAX(idx) AS m FROM pozitie WHERE comanda_id = ?').get(comandaId).m ?? 0) + 1,
    String(p.sistem),
    String(p.eticheta || p.sistem),
    String(p.finisaj || ''),
    Math.round(+p.latime), Math.round(+p.inaltime), +p.nrUsi,
    JSON.stringify(p.config),
  ).lastInsertRowid);

  const insLinie = d.prepare(`
    INSERT INTO pozitie_linie (pozitie_id, lista, idx, cod, denumire, um, cantitate, debitare)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const lista of LISTE) {
    (p.linii?.[lista] ?? []).forEach((l, j) => insLinie.run(
      pozitieId, lista, j + 1,
      l.cod != null ? String(l.cod) : null,
      String(l.denumire),
      l.um != null ? String(l.um) : null,
      +l.cantitate,
      l.debitare != null ? String(l.debitare) : null,
    ));
  }
  return pozitieId;
}

const campuriClient = client => [
  String(client.nume).trim(),
  client.telefon ? String(client.telefon).trim() : null,
  client.email   ? String(client.email).trim()   : null,
];

// ── Creare ───────────────────────────────────────────────────────────────────

async function creeaza(ctx) {
  const { res, utilizator } = ctx;
  const corp = await corpJson(ctx.req);

  const v = validează(corp);
  if (v.gresit) return eroare(res, 400, v.gresit);

  const an = new Date().getFullYear();

  const rezultat = tranzactie(d => {
    const numar = urmatorulNumar(d, an);

    const comandaId = Number(d.prepare(`
      INSERT INTO comanda (numar, client_nume, client_telefon, client_email, observatii, creat_de)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `OF-${an}-${numar}`,
      ...campuriClient(corp.client),
      corp.observatii ? String(corp.observatii).trim() : null,
      utilizator.id,
    ).lastInsertRowid);

    const pozitieId = scriePozitia(d, comandaId, corp.pozitii[0]);
    const cod = codBare(an, numar);
    d.prepare('INSERT INTO usa (pozitie_id, idx, cod_bare) VALUES (?, 1, ?)').run(pozitieId, cod);

    // `coduri` — configuratorul îl pune pe fişa de comandă
    return { id: comandaId, numar: `OF-${an}-${numar}`, ...(config.scanare && { coduri: [{ cod_bare: cod }] }) };
  });

  anunta({ comanda: rezultat.id });
  json(res, 201, { comanda: rezultat });
}

// ── Modificare (doar oferte) ─────────────────────────────────────────────────
// „Modifică oferta" din manager redeschide configuratorul cu configuraţia
// salvată; la salvare vine aici. Numărul şi codul de bare rămân aceleaşi.

async function modifica(ctx) {
  const id = Number(ctx.params.id);
  const corp = await corpJson(ctx.req);
  const c = db().prepare('SELECT * FROM comanda WHERE id = ?').get(id);
  if (!c)                  return eroare(ctx.res, 404, 'Oferta nu există.');
  if (c.anulat)            return eroare(ctx.res, 400, 'Oferta e anulată.');
  if (c.tip !== 'oferta')  return eroare(ctx.res, 409, 'Oferta a fost deja acceptată — nu se mai modifică.');

  const v = validează(corp);
  if (v.gresit) return eroare(ctx.res, 400, v.gresit);

  const rezultat = tranzactie(d => {
    d.prepare('UPDATE comanda SET client_nume = ?, client_telefon = ?, client_email = ? WHERE id = ?')
      .run(...campuriClient(corp.client), id);

    const vechi = d.prepare('SELECT id FROM pozitie WHERE comanda_id = ?').all(id);
    const cod = d.prepare(`SELECT a.cod_bare FROM usa a JOIN pozitie p ON p.id = a.pozitie_id
                            WHERE p.comanda_id = ? ORDER BY p.idx, a.idx LIMIT 1`).get(id)?.cod_bare;

    // poziţia nouă întâi, apoi mutăm codul de bare pe ea (scanările rămân legate
    // de rândul lui din `usa`), abia apoi ştergem poziţia veche cu tot ce ţine de ea
    const pozitieId = scriePozitia(d, id, corp.pozitii[0]);
    if (cod) d.prepare('UPDATE usa SET pozitie_id = ?, idx = 1 WHERE cod_bare = ?').run(pozitieId, cod);
    for (const p of vechi) d.prepare('DELETE FROM pozitie WHERE id = ?').run(p.id);   // CASCADE: linii, coduri vechi pe uşă
    d.prepare('UPDATE pozitie SET idx = 1 WHERE id = ?').run(pozitieId);

    return { id, numar: c.numar, ...(config.scanare && { coduri: cod ? [{ cod_bare: cod }] : [] }) };
  });

  anunta({ comanda: id });
  json(ctx.res, 200, { comanda: rezultat });
}

// ── Citire ───────────────────────────────────────────────────────────────────

// tab: 'oferta' | 'comanda' (în lucru) | 'finalizata'
const FILTRE = {
  oferta:     "c.tip = 'oferta'",
  comanda:    "c.tip = 'comanda' AND c.finalizat_la IS NULL",
  finalizata: "c.tip = 'comanda' AND c.finalizat_la IS NOT NULL",
};

// Ultima operaţie scanată a comenzii — coloana „Status" din liste.
const ULTIMA_SCANARE = `
  SELECT o.nume || '|' || s.moment || '|' || u.nume
    FROM scanare s JOIN operatie o ON o.id = s.operatie_id JOIN utilizator u ON u.id = s.utilizator_id
    JOIN usa a ON a.id = s.usa_id JOIN pozitie p ON p.id = a.pozitie_id
   WHERE p.comanda_id = c.id AND s.anulat = 0
   ORDER BY s.moment DESC, s.id DESC LIMIT 1`;

// Starea comenzii de sticlă a unei comenzi (lista „sticla", vezi server/sticla.js):
// câte linii are, câte s-au comandat, ultima comandare (când + cine).
const STICLA = `
  SELECT COUNT(*) || '|' || COUNT(l.comandat_la) || '|' ||
         COALESCE((SELECT l2.comandat_la || '|' || u.nume FROM pozitie_linie l2
                     JOIN pozitie p2 ON p2.id = l2.pozitie_id LEFT JOIN utilizator u ON u.id = l2.comandat_de
                    WHERE p2.comanda_id = c.id AND l2.lista = 'sticla' AND l2.comandat_la IS NOT NULL
                    ORDER BY l2.comandat_la DESC LIMIT 1), '|')
    FROM pozitie_linie l JOIN pozitie p ON p.id = l.pozitie_id
   WHERE p.comanda_id = c.id AND l.lista = 'sticla'`;

function stareSticla(brut) {
  const [total, comandate, moment, cine] = String(brut ?? '0|0||').split('|');
  return +total ? { total: +total, comandate: +comandate, moment: moment || null, cine: cine || null } : null;
}

function listeaza(ctx) {
  const uid = ctx.utilizator.id;
  const tab = new URL(ctx.req.url, 'http://x').searchParams.get('tip');
  const filtru = FILTRE[tab] ?? FILTRE.oferta;

  const randuri = db().prepare(`
    SELECT c.id, c.numar, c.numar_comanda, c.tip, c.client_nume, c.creat_la, c.confirmat_la, c.finalizat_la,
           c.factura_nr, c.facturat_la, c.plata, c.avans,
           u.nume AS creat_de_nume,
           (SELECT p.eticheta FROM pozitie p WHERE p.comanda_id = c.id ORDER BY p.idx LIMIT 1) AS sistem,
           ${config.scanare ? `(${ULTIMA_SCANARE})` : 'NULL'} AS ultima,
           (${STICLA}) AS sticla_brut,
           EXISTS (SELECT 1 FROM fixare f WHERE f.comanda_id = c.id AND f.utilizator_id = ?) AS fixat
      FROM comanda c
      JOIN utilizator u ON u.id = c.creat_de
     WHERE ${filtru} AND c.anulat = 0
     ORDER BY COALESCE(c.finalizat_la, c.creat_la) DESC
  `).all(uid);

  json(ctx.res, 200, {
    comenzi: randuri.map(({ ultima, sticla_brut, ...r }) => {
      const [operatie, moment, cine] = ultima ? ultima.split('|') : [];
      return { ...r, fixat: !!r.fixat,
               ...(config.scanare && { status: ultima ? { operatie, moment, cine } : null }),
               sticla: stareSticla(sticla_brut) };
    }),
  });
}

function detaliu(ctx) {
  const id = Number(ctx.params.id);
  const comanda = db().prepare(`
    SELECT c.*, u.nume AS creat_de_nume
      FROM comanda c JOIN utilizator u ON u.id = c.creat_de
     WHERE c.id = ?
  `).get(id);
  if (!comanda) return eroare(ctx.res, 404, 'Comandă inexistentă.');

  const pozitii = db().prepare('SELECT * FROM pozitie WHERE comanda_id = ? ORDER BY idx').all(id);
  const linii   = db().prepare(`
    SELECT l.* FROM pozitie_linie l JOIN pozitie p ON p.id = l.pozitie_id
     WHERE p.comanda_id = ? ORDER BY l.pozitie_id, l.lista, l.idx
  `).all(id);
  const coduri = db().prepare(`
    SELECT a.cod_bare FROM usa a JOIN pozitie p ON p.id = a.pozitie_id
     WHERE p.comanda_id = ? ORDER BY p.idx, a.idx
  `).all(id).map(a => a.cod_bare);

  const sticla = stareSticla(db().prepare(`SELECT (${STICLA}) AS s FROM comanda c WHERE c.id = ?`).get(id).s);

  json(ctx.res, 200, {
    comanda,
    sticla,                          // null = comanda n-are sticlă de comandat
    sticlaLinii: require('../sticla.js').sticlaComenzii(id),   // pe furnizor: mail + bifă
    // codul de bare + istoricul din atelier — doar cu scanarea pornită
    ...(config.scanare && { coduri, scanari: require('../scanare.js').scanariComanda(id) }),
    pozitii: pozitii.map(p => ({
      ...p,
      config: JSON.parse(p.config_json),
      linii: Object.fromEntries(LISTE.map(nume =>
        [nume, linii.filter(l => l.pozitie_id === p.id && l.lista === nume)])),
    })),
  });
}

// Modalităţile de plată alese la acceptare (userul, 2026-09-23).
const PLATI = ['op', 'bon', 'factura'];   // OP (ordin de plată) | bon fiscal | factură

// Acceptarea unei oferte: acelaşi rând, alt tip, plus numărul de comandă cu
// ACELEAŞI cifre — ca etichetele deja tipărite să rămână valabile. Cere
// obligatoriu modalitatea de plată; avansul (lei) e opţional, implicit 0.
async function accepta(ctx) {
  const id = Number(ctx.params.id);
  const corp = await corpJson(ctx.req);
  const c = db().prepare('SELECT * FROM comanda WHERE id = ?').get(id);

  if (!c)                  return eroare(ctx.res, 404, 'Comandă inexistentă.');
  if (c.anulat)            return eroare(ctx.res, 400, 'Oferta e anulată.');
  if (c.tip === 'comanda') return eroare(ctx.res, 409, `Oferta e deja comandă (${c.numar_comanda}).`);

  if (!PLATI.includes(corp.plata)) return eroare(ctx.res, 400, 'Alege modalitatea de plată: OP, bon fiscal sau factură.');
  const avans = corp.avans == null || String(corp.avans).trim() === '' ? 0 : Number(String(corp.avans).replace(',', '.'));
  if (!Number.isFinite(avans) || avans < 0) return eroare(ctx.res, 400, 'Avansul trebuie să fie un număr (0 = fără avans).');

  const numarComanda = c.numar.replace(/^OF-/, 'CMD-');
  db().prepare(`
    UPDATE comanda SET tip = 'comanda', numar_comanda = ?, confirmat_la = datetime('now'), plata = ?, avans = ?
     WHERE id = ?
  `).run(numarComanda, corp.plata, Math.round(avans * 100) / 100, id);

  anunta({ comanda: id });
  json(ctx.res, 200, { comanda: db().prepare('SELECT * FROM comanda WHERE id = ?').get(id) });
}

// Finalizare manuală / redeschidere (automat: la scanarea „Coletare").
function schimbaFinalizare(finalizata) {
  return ctx => {
    const id = Number(ctx.params.id);
    const c = db().prepare('SELECT * FROM comanda WHERE id = ?').get(id);
    if (!c)                  return eroare(ctx.res, 404, 'Comandă inexistentă.');
    if (c.tip !== 'comanda') return eroare(ctx.res, 409, 'Doar o comandă acceptată se poate finaliza.');
    db().prepare(`UPDATE comanda SET finalizat_la = ${finalizata ? "datetime('now')" : 'NULL'} WHERE id = ?`).run(id);
    anunta({ comanda: id });
  json(ctx.res, 200, { comanda: db().prepare('SELECT * FROM comanda WHERE id = ?').get(id) });
  };
}

// Facturare: nr. facturii se trece de mână (vine din NeoManager). Fără număr
// comanda NU se poate marca facturată; `numar` gol = anulează facturarea.
async function factura(ctx) {
  const id = Number(ctx.params.id);
  const corp = await corpJson(ctx.req);
  const c = db().prepare('SELECT * FROM comanda WHERE id = ?').get(id);
  if (!c)                  return eroare(ctx.res, 404, 'Comandă inexistentă.');
  if (c.tip !== 'comanda') return eroare(ctx.res, 409, 'Doar o comandă acceptată se poate factura.');
  const numar = String(corp.numar ?? '').trim().slice(0, 40);
  if (!numar && !corp.anuleaza) return eroare(ctx.res, 400, 'Completează numărul facturii.');
  db().prepare(`UPDATE comanda SET factura_nr = ?, facturat_la = ${numar ? "datetime('now')" : 'NULL'} WHERE id = ?`)
    .run(numar || null, id);
  anunta({ comanda: id });
  json(ctx.res, 200, { comanda: db().prepare('SELECT * FROM comanda WHERE id = ?').get(id) });
}

// Fixare (pin) — per utilizator: fiecare îşi vede sus doar comenzile LUI
// fixate. Nu se anunţă celorlalţi (nu-i priveşte).
async function fixeaza(ctx) {
  const id = Number(ctx.params.id);
  const corp = await corpJson(ctx.req);
  if (!db().prepare('SELECT 1 FROM comanda WHERE id = ?').get(id)) return eroare(ctx.res, 404, 'Comandă inexistentă.');
  if (corp.fixat) db().prepare('INSERT OR IGNORE INTO fixare (utilizator_id, comanda_id) VALUES (?, ?)').run(ctx.utilizator.id, id);
  else            db().prepare('DELETE FROM fixare WHERE utilizator_id = ? AND comanda_id = ?').run(ctx.utilizator.id, id);
  anuntaUtilizator(ctx.utilizator.id, { fixare: id });
  json(ctx.res, 200, { fixat: !!corp.fixat });
}

// Preferinţe per utilizator (azi: `sortare` = 'data' | 'facturare') — ţinute
// pe server, ca să-l urmeze pe om pe orice calculator / telefon.
const PREFERINTE = { sortare: ['data', 'facturare'] };

function preferinte(ctx) {
  const rows = db().prepare('SELECT cheie, valoare FROM preferinta WHERE utilizator_id = ?').all(ctx.utilizator.id);
  json(ctx.res, 200, { sortare: 'data', ...Object.fromEntries(rows.map(r => [r.cheie, r.valoare])) });
}

async function salveazaPreferinte(ctx) {
  const corp = await corpJson(ctx.req);
  const pune = db().prepare(`INSERT INTO preferinta (utilizator_id, cheie, valoare) VALUES (?, ?, ?)
    ON CONFLICT(utilizator_id, cheie) DO UPDATE SET valoare = excluded.valoare`);
  for (const [cheie, valori] of Object.entries(PREFERINTE)) {
    if (corp[cheie] === undefined) continue;
    if (!valori.includes(corp[cheie])) return eroare(ctx.res, 400, `Valoare invalidă pentru ${cheie}.`);
    pune.run(ctx.utilizator.id, cheie, corp[cheie]);
  }
  anuntaUtilizator(ctx.utilizator.id, { preferinte: true });
  preferinte(ctx);
}

// Numerele pentru pagina principală. COUNT-uri în loc de listele întregi:
// acum, cu câteva comenzi, n-ar conta — peste un an, da.
const sumar = ctx => json(ctx.res, 200, {
  ...db().prepare(`
  SELECT SUM(tip = 'oferta')                              AS oferte,
         SUM(tip = 'comanda' AND finalizat_la IS NULL)     AS comenzi,
         SUM(tip = 'comanda' AND finalizat_la IS NOT NULL) AS finalizate
    FROM comanda WHERE anulat = 0
`).get(),
  sticla: require('../sticla.js').sumarSticla(),   // bucăţi de sticlă de comandat
});

module.exports = {
  rute: [
    ['GET',  '/api/sumar',                   { handler: sumar }],
    ['GET',  '/api/comenzi',                 { handler: listeaza }],
    ['POST', '/api/comenzi',                 { handler: creeaza }],
    ['GET',  '/api/comenzi/:id',             { handler: detaliu }],
    ['PUT',  '/api/comenzi/:id',             { handler: modifica }],
    ['POST', '/api/comenzi/:id/accepta',     { handler: accepta }],
    ['POST', '/api/comenzi/:id/finalizeaza', { handler: schimbaFinalizare(true) }],
    ['POST', '/api/comenzi/:id/redeschide',  { handler: schimbaFinalizare(false) }],
    ['POST', '/api/comenzi/:id/factura',     { handler: factura }],
    ['POST', '/api/comenzi/:id/fixare',      { handler: fixeaza }],
    ['GET',  '/api/preferinte',              { handler: preferinte }],
    ['PUT',  '/api/preferinte',              { handler: salveazaPreferinte }],
  ],
};
