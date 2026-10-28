const { db, tranzactie, ACUM } = require('./db.js');
const { json, eroare, corpJson } = require('./http.js');
const { anunta } = require('./evenimente.js');

// ═══════════════════════════════════════════════════════════════════════════
//  RECLAMAŢII — userul, 2026-10-28. La o comandă finalizată, „Deschide reclamaţie":
//  motivul, ce se înlocuieşte (produse alese ca la oferta cu amănuntul —
//  configurator_usi/amanunt.html?reclamatie=<id>) şi explicaţiile pentru atelier.
//  Se printează obligatoriu o fişă (se capsează la foile comenzii); abia după
//  „Da, am printat" comanda apare în „În lucru", marcată cu galben, până la
//  „Reclamaţie rezolvată". Comanda rămâne finalizată (finalizat_la, factura) —
//  doar listele o arată în lucru cât are o reclamaţie activă.
//  Pagina /reclamatii (conducere + admin): ce produse s-au folosit la remedieri.
// ═══════════════════════════════════════════════════════════════════════════

// Reclamaţia activă (printată, nerezolvată) a comenzii `c` — în WHERE-ul listelor (alias `c` = comanda)
const ACTIVA = `EXISTS (SELECT 1 FROM reclamatie rc WHERE rc.comanda_id = c.id
  AND rc.fisa_printata_la IS NOT NULL AND rc.rezolvata_la IS NULL)`;

const CAMPURI = `r.*, uc.nume AS creat_de_nume, up.nume AS fisa_printata_de_nume, ur.nume AS rezolvata_de_nume`;
const DIN = `FROM reclamatie r JOIN utilizator uc ON uc.id = r.creat_de
  LEFT JOIN utilizator up ON up.id = r.fisa_printata_de LEFT JOIN utilizator ur ON ur.id = r.rezolvata_de`;

const cuLinii = rs => {
  const linii = rs.length ? db().prepare(`SELECT * FROM reclamatie_linie WHERE reclamatie_id IN (${rs.map(() => '?').join(',')})
    ORDER BY reclamatie_id, idx`).all(...rs.map(r => r.id)) : [];
  return rs.map(r => ({ ...r, linii: linii.filter(l => l.reclamatie_id === r.id) }));
};

// toate reclamaţiile comenzii, cea mai nouă prima — pt. pagina comenzii (/api/comenzi/:id)
const reclamatiiComenzii = id => cuLinii(db().prepare(`SELECT ${CAMPURI} ${DIN} WHERE r.comanda_id = ? ORDER BY r.id DESC`).all(id));
// cea încă nerezolvată (printată sau nu) — una singură pe comandă
const nerezolvata = id => db().prepare('SELECT * FROM reclamatie WHERE comanda_id = ? AND rezolvata_la IS NULL').get(id);

const text = (v, max) => String(v ?? '').trim().slice(0, max);

async function deschide(ctx) {
  const id = Number(ctx.params.id);
  const corp = await corpJson(ctx.req);
  const c = db().prepare('SELECT * FROM comanda WHERE id = ?').get(id);
  if (!c)                                       return eroare(ctx.res, 404, 'Comanda nu există.');
  if (c.anulat)                                 return eroare(ctx.res, 409, 'Comanda e anulată.');
  if (c.tip !== 'comanda' || !c.finalizat_la)  return eroare(ctx.res, 409, 'Reclamaţia se deschide doar la o comandă finalizată.');
  if (nerezolvata(id))                          return eroare(ctx.res, 409, 'Comanda are deja o reclamaţie nerezolvată.');
  const motiv = text(corp.motiv, 2000), explicatii = text(corp.explicatii, 2000);
  if (motiv.length < 3)      return eroare(ctx.res, 400, 'Scrie motivul reclamaţiei.');
  if (explicatii.length < 3) return eroare(ctx.res, 400, 'Scrie explicaţiile pentru atelier — ce trebuie făcut cu comanda.');
  const linii = Array.isArray(corp.linii) ? corp.linii.slice(0, 200) : [];
  if (!linii.length) return eroare(ctx.res, 400, 'Adaugă cel puţin un produs care se înlocuieşte.');
  for (const [i, l] of linii.entries()) {
    if (!text(l?.cod, 40) || !text(l?.denumire, 300)) return eroare(ctx.res, 400, `Rândul ${i + 1}: produsul lipseşte.`);
    if (!(Number(l.cantitate) > 0))                   return eroare(ctx.res, 400, `Rândul ${i + 1}: cantitatea trebuie să fie mai mare de 0.`);
  }
  let rid;
  tranzactie(d => {
    rid = Number(d.prepare(`INSERT INTO reclamatie (comanda_id, motiv, explicatii, creat_de, creat_la) VALUES (?, ?, ?, ?, ${ACUM()})`)
      .run(id, motiv, explicatii, ctx.utilizator.id).lastInsertRowid);
    const pune = d.prepare('INSERT INTO reclamatie_linie (reclamatie_id, idx, cod, denumire, um, cantitate, debitare) VALUES (?, ?, ?, ?, ?, ?, ?)');
    linii.forEach((l, i) => pune.run(rid, i + 1, text(l.cod, 40), text(l.denumire, 300), text(l.um, 20) || null,
                                     Math.round(Number(l.cantitate) * 1000) / 1000, text(l.debitare, 500) || null));
  });
  anunta({ comanda: id });
  json(ctx.res, 201, { reclamatie: { id: rid } });
}

// „Da, am printat" — prima printare o pune în lucru; retipăririle nu schimbă nimic (rămâne prima)
function fisaPrintata(ctx) {
  const id = Number(ctx.params.id);
  const r = nerezolvata(id);
  if (!r) return eroare(ctx.res, 404, 'Comanda n-are o reclamaţie deschisă.');
  db().prepare(`UPDATE reclamatie SET fisa_printata_la = COALESCE(fisa_printata_la, ${ACUM()}),
                                      fisa_printata_de = COALESCE(fisa_printata_de, ?) WHERE id = ?`).run(ctx.utilizator.id, r.id);
  anunta({ comanda: id });
  json(ctx.res, 200, { ok: true });
}

function rezolvata(ctx) {
  const id = Number(ctx.params.id);
  const r = nerezolvata(id);
  if (!r)                    return eroare(ctx.res, 404, 'Comanda n-are o reclamaţie deschisă.');
  if (!r.fisa_printata_la)   return eroare(ctx.res, 409, 'Fişa reclamaţiei nu s-a printat încă — reclamaţia nu e în lucru.');
  db().prepare(`UPDATE reclamatie SET rezolvata_la = ${ACUM()}, rezolvata_de = ? WHERE id = ?`).run(ctx.utilizator.id, r.id);
  anunta({ comanda: id });
  json(ctx.res, 200, { ok: true });
}

// Salvată din greşeală, neprintată: se şterge (una printată e deja la atelier — se rezolvă)
function renunta(ctx) {
  const id = Number(ctx.params.id);
  const r = nerezolvata(id);
  if (!r)                  return eroare(ctx.res, 404, 'Comanda n-are o reclamaţie deschisă.');
  if (r.fisa_printata_la)  return eroare(ctx.res, 409, 'Fişa reclamaţiei s-a printat — e în atelier; marcheaz-o rezolvată.');
  db().prepare('DELETE FROM reclamatie WHERE id = ?').run(r.id);
  anunta({ comanda: id });
  json(ctx.res, 200, { ok: true });
}

// O reclamaţie, cu datele comenzii — pt. fişa ei (amanunt.html?reclamatie_fisa=<id>)
function una(ctx) {
  const r = db().prepare(`SELECT ${CAMPURI} ${DIN} WHERE r.id = ?`).get(Number(ctx.params.id));
  if (!r) return eroare(ctx.res, 404, 'Reclamaţia nu există.');
  const comanda = db().prepare(`SELECT id, numar, oferta_nr, client_nume, client_telefon, client_adresa, livrare, agent, factura_nr,
    finalizat_la FROM comanda WHERE id = ?`).get(r.comanda_id);
  json(ctx.res, 200, { reclamatie: cuLinii([r])[0], comanda });
}

// Pagina /reclamatii: toate (de/pana = zile YYYY-MM-DD, după data deschiderii), cu produsele folosite
function toate(ctx) {
  const q = new URL(ctx.req.url, 'http://x').searchParams;
  const zi = v => (/^\d{4}-\d{2}-\d{2}$/.test(v ?? '') ? v : null);
  const de = zi(q.get('de')), pana = zi(q.get('pana'));
  const rs = db().prepare(`SELECT ${CAMPURI}, COALESCE(c.oferta_nr, c.numar) AS comanda_nr, c.client_nume, c.factura_nr
    ${DIN} JOIN comanda c ON c.id = r.comanda_id
    WHERE (? IS NULL OR date(r.creat_la) >= ?) AND (? IS NULL OR date(r.creat_la) <= ?)
    ORDER BY r.id DESC`).all(de, de, pana, pana);
  json(ctx.res, 200, { reclamatii: cuLinii(rs) });
}

module.exports = {
  ACTIVA, reclamatiiComenzii,
  rute: [
    ['POST',   '/api/comenzi/:id/reclamatie',           { handler: deschide }],
    ['DELETE', '/api/comenzi/:id/reclamatie',           { handler: renunta }],
    ['POST',   '/api/comenzi/:id/reclamatie-fisa',      { handler: fisaPrintata }],
    ['POST',   '/api/comenzi/:id/reclamatie-rezolvata', { handler: rezolvata }],
    ['GET',    '/api/reclamatii',                       { rol: ['admin', 'conducere'], handler: toate }],
    ['GET',    '/api/reclamatii/:id',                   { handler: una }],
  ],
};
