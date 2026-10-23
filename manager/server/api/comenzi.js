const { json, eroare, corpJson } = require('../http.js');
const { db, tranzactie, ACUM, copiaCurenta, comenziDemo, peBune } = require('../db.js');
const { acumMs } = require('../ora.js');
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
//          oferta → aşteaptă plata (tip 'plata') → (plată primită = acceptare) → în lucru
//  Din configurator se poate sări direct în „aşteaptă plata" sau „în lucru"
//  (oferta se salvează, apoi se cheamă ruta de trecere).
//  Finalizarea: automat la scanarea „Coletare" (vezi scanare.js) sau manual.
//
//  Numerotarea: un singur contor pe an (OF-2026-0042, intern — codul de bare).
//  Pe ecran, ofertele ŞI comenzile poartă nr. de ofertă scris de mână (oferta_nr);
//  numărul de comandă CMD- nu se mai generează (userul, 2026-10-05) — coloana
//  numar_comanda rămâne doar pt. comenzile acceptate înainte.
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
  // zero-padding pe 4 cifre → sortarea ca text e şi sortare numerică.
  // În demo numerele pornesc de la 9001 (birou) / 9501 (admin), ca să nu se bată cu ofertele
  // care intră în copie din sursa ei (numărul e unic). ponytail: ajunge cât firma face sub 9000
  // de oferte pe an şi biroul sub 500 de oferte de probă.
  const start = { colegi: 9000, admin: 9500 }[copiaCurenta()] ?? 0;
  return String(Math.max(Number(ultim?.numar.slice(-4) ?? 0), start) + 1).padStart(4, '0');
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
  // mai multe produse pe o ofertă (userul, 2026-10-01): ex. rame + Confort + sertare
  if (pozitii.length > MAX_POZITII) return gresit(`O ofertă are cel mult ${MAX_POZITII} produse.`);
  for (const [i, p] of pozitii.entries()) {
    const v = valideazaPozitia(p);
    if (v) return gresit(pozitii.length > 1 ? `Produsul ${i + 1}: ${v}` : v);
  }
  return { ok: true };
}

const MAX_POZITII = 20;

// null = poziţia e bună; altfel mesajul pentru UI
function valideazaPozitia(p) {
  const gresit = m => m;
  if (!p || typeof p !== 'object')            return gresit('Configuraţie lipsă.');
  if (!String(p.sistem || '').trim())         return gresit('Sistemul lipseşte.');
  // oferta cu amănuntul (configurator_usi/amanunt.html): produse la bucată, fără gol
  const faraCote = p.sistem === 'amanunt';
  if (!faraCote && (!Number.isFinite(+p.latime)  || +p.latime  <= 0)) return gresit('Lăţime invalidă.');
  if (!faraCote && (!Number.isFinite(+p.inaltime)|| +p.inaltime<= 0)) return gresit('Înălţime invalidă.');
  if (faraCote && !p.linii?.facturare?.length) return gresit('Oferta n-are niciun produs.');

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
  return null;
}

// Scrie o poziţie (un produs al ofertei: sistem de uşi, rame, amănunt) + liniile ei.
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

// text liber de la client (câmpuri din configurator): tăiat şi limitat
const text = (v, max = 200) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, max));
// Metodele de plată (userul, 2026-09-28) — vin din configurator (bara clientului,
// pe ofertă) şi / sau la acceptare. Comenzile mai vechi pot avea 'op' / 'factura'
// — rămân în DB şi se afişează, dar nu se mai pot alege.
const PLATI = ['oferta', 'proforma', 'proforma_amanunt', 'fiscala', 'bon', 'avans'];   // oferta: userul, 2026-10-22

const campuriClient = (client, detalii = {}, ofertaNr) => [
  String(client.nume).trim(),
  text(client.telefon),
  text(client.email),
  text(client.adresa, 300),
  text(detalii?.livrare, 60),
  text(detalii?.agent, 60),
  text(detalii?.facturare, 60),   // tip_facturare — doar ofertele vechi îl mai trimit
  text(ofertaNr, 40),
  PLATI.includes(detalii?.plata) ? detalii.plata : null,
];

// ── Creare ───────────────────────────────────────────────────────────────────

async function creeaza(ctx) {
  const { res, utilizator } = ctx;
  const corp = await corpJson(ctx.req);

  const v = validează(corp);
  if (v.gresit) return eroare(res, 400, v.gresit);

  const an = new Date(acumMs()).getFullYear();

  const rezultat = tranzactie(d => {
    const numar = urmatorulNumar(d, an);

    const comandaId = Number(d.prepare(`
      INSERT INTO comanda (numar, client_nume, client_telefon, client_email, client_adresa, livrare, agent, tip_facturare, oferta_nr, plata, observatii, creat_de, creat_la)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${ACUM()})
    `).run(
      `OF-${an}-${numar}`,
      ...campuriClient(corp.client, corp.detalii, corp.ofertaNr),
      corp.observatii ? String(corp.observatii).trim() : null,
      utilizator.id,
    ).lastInsertRowid);

    // un singur cod de bare pe comandă, pe prima poziţie
    const [pozitieId] = corp.pozitii.map(p => scriePozitia(d, comandaId, p));
    const cod = codBare(an, numar);
    d.prepare('INSERT INTO usa (pozitie_id, idx, cod_bare) VALUES (?, 1, ?)').run(pozitieId, cod);

    // `coduri` — configuratorul îl pune pe fişa de comandă
    return { id: comandaId, numar: `OF-${an}-${numar}`, ...(config.scanare && { coduri: [{ cod_bare: cod }] }) };
  });

  anunta({ comanda: rezultat.id });
  json(res, 201, { comanda: rezultat });
}

// ── Modificare: oferte şi comenzi în lucru ───────────────────────────────────
// „Modifică oferta" / „Modifică comanda" din manager redeschide configuratorul cu
// configuraţia salvată; la salvare vine aici. Numărul şi codul de bare rămân aceleaşi.
// La o comandă în lucru (userul, 2026-10-23) contează ce s-a făcut deja pe ea: produsele
// NESCHIMBATE rămân aceleaşi rânduri (fişa printată, sticla comandată, scanările); doar
// cele schimbate / noi se scriu din nou — fişa lor e de printat din nou. Sticla comandată
// la un produs schimbat rămâne comandată dacă aceeaşi linie e şi în varianta nouă.

// cheile sortate — ordinea lor nu face un produs „schimbat"
const canonic = v => (Array.isArray(v) ? v.map(canonic)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonic(v[k])])) : v);
const linieCanonica = l => [l.cod != null ? String(l.cod) : null, String(l.denumire), l.um != null ? String(l.um) : null,
  +l.cantitate, l.debitare != null ? String(l.debitare) : null];
// ce se scrie dintr-un produs (vezi scriePozitia) — din corpul cererii sau din bază. Fără livrare / plată /
// agent (config.comanda) şi fără transport: sunt ale comenzii (fişa le ia din ea), nu schimbă produsul.
const faraComanda = config => (config && typeof config === 'object'
  ? { ...config, comanda: undefined, ...(config.rame && { rame: { ...config.rame, livrare: undefined } }) } : config);
const semnatura = (p, config, linii) => JSON.stringify([String(p.sistem), String(p.eticheta || p.sistem), String(p.finisaj || ''),
  Math.round(+p.latime), Math.round(+p.inaltime), +(p.nrUsi ?? p.nr_usi), canonic(faraComanda(config)),
  LISTE.map(lista => (linii[lista] ?? []).filter(l => !(lista === 'facturare' && l.cod === TRANSPORT.cod)).map(linieCanonica))]);
const cheieSticla = l => JSON.stringify(linieCanonica(l));

async function modifica(ctx) {
  const id = Number(ctx.params.id);
  const corp = await corpJson(ctx.req);
  const c = db().prepare('SELECT * FROM comanda WHERE id = ?').get(id);
  if (!c)                  return eroare(ctx.res, 404, 'Oferta nu există.');
  if (c.anulat)            return eroare(ctx.res, 400, 'Oferta e anulată.');
  const eComanda = c.tip === 'comanda';
  if (eComanda && c.finalizat_la) return eroare(ctx.res, 409, 'Comanda e finalizată — nu se mai modifică.');
  if (c.tip !== 'oferta' && !eComanda) return eroare(ctx.res, 409, 'Oferta a fost deja acceptată — nu se mai modifică.');

  const v = validează(corp);
  if (v.gresit) return eroare(ctx.res, 400, v.gresit);

  const rezultat = tranzactie(d => {
    d.prepare(`UPDATE comanda SET client_nume = ?, client_telefon = ?, client_email = ?, client_adresa = ?,
                 livrare = ?, agent = ?, tip_facturare = ?, oferta_nr = ?, plata = ? WHERE id = ?`)
      .run(...campuriClient(corp.client, corp.detalii, corp.ofertaNr), id);
    // la o comandă plata rămâne cea aleasă la acceptare dacă din configurator nu vine alta
    if (eComanda && (!PLATI.includes(corp.detalii?.plata) || corp.detalii.plata === 'oferta')) d.prepare('UPDATE comanda SET plata = ? WHERE id = ?').run(c.plata, id);
    // livrarea / adresa schimbate pe o comandă — ca la „Modifică livrarea": fişele printate deja se completează de mână
    const nou = d.prepare('SELECT livrare, client_adresa FROM comanda WHERE id = ?').get(id);
    if (eComanda && (nou.livrare !== c.livrare || nou.client_adresa !== c.client_adresa)) {
      d.prepare(`UPDATE comanda SET livrare_modificata_la = ${ACUM()} WHERE id = ?`).run(id);
    }

    const vechi = d.prepare('SELECT * FROM pozitie WHERE comanda_id = ? ORDER BY idx').all(id);
    const liniiVechi = d.prepare(`SELECT l.* FROM pozitie_linie l JOIN pozitie p ON p.id = l.pozitie_id
                                   WHERE p.comanda_id = ? ORDER BY l.lista, l.idx`).all(id);
    for (const p of vechi) {
      p.linii = Object.fromEntries(LISTE.map(lista => [lista, liniiVechi.filter(l => l.pozitie_id === p.id && l.lista === lista)]));
      p.semn = semnatura(p, JSON.parse(p.config_json || 'null'), p.linii);
    }
    const cod = d.prepare(`SELECT a.cod_bare FROM usa a JOIN pozitie p ON p.id = a.pozitie_id
                            WHERE p.comanda_id = ? ORDER BY p.idx, a.idx LIMIT 1`).get(id)?.cod_bare;

    // fiecare produs nou: acelaşi produs vechi (întâi pe acelaşi loc) → rămâne rândul lui; altfel unul nou.
    // (La ofertă la fel — n-are nimic de păstrat, dar nici nu strică.)
    const folosite = new Set();
    const potrivit = corp.pozitii.map((p, k) => {
      const s = semnatura(p, p.config, p.linii ?? {});
      const v = [vechi[k], ...vechi].find(x => x && !folosite.has(x.id) && x.semn === s);
      if (v) folosite.add(v.id);
      return v ?? null;
    });
    // idx temporar peste cele finale (UNIQUE pe comandă), apoi poziţiile noi
    d.prepare('UPDATE pozitie SET idx = idx + 10000 WHERE comanda_id = ?').run(id);
    const ids = corp.pozitii.map((p, k) => potrivit[k]?.id ?? scriePozitia(d, id, p));
    const schimbate = ids.map((_, k) => k).filter(k => !potrivit[k]);
    // la cele păstrate: livrarea din configuraţie şi transportul (pe primul produs) — ca în varianta nouă
    for (const [k, v] of potrivit.entries()) {
      if (!v) continue;
      d.prepare('UPDATE pozitie SET config_json = ? WHERE id = ?').run(JSON.stringify(corp.pozitii[k].config), v.id);
      d.prepare("DELETE FROM pozitie_linie WHERE pozitie_id = ? AND lista = 'facturare' AND cod = ?").run(v.id, TRANSPORT.cod);
      for (const l of (corp.pozitii[k].linii?.facturare ?? []).filter(l => l.cod === TRANSPORT.cod)) {
        d.prepare(`INSERT INTO pozitie_linie (pozitie_id, lista, idx, cod, denumire, um, cantitate)
          VALUES (?, 'facturare', (SELECT COALESCE(MAX(idx), 0) + 1 FROM pozitie_linie WHERE pozitie_id = ? AND lista = 'facturare'), ?, ?, ?, ?)`)
          .run(v.id, v.id, String(l.cod), String(l.denumire), l.um != null ? String(l.um) : null, +l.cantitate);
      }
    }

    // sticla comandată a produselor scoase / schimbate: trece pe aceeaşi linie din varianta nouă
    const comandata = vechi.filter(p => !folosite.has(p.id)).flatMap(p => p.linii.sticla.filter(l => l.comandat_la));
    const ramasa = [];
    for (const l of comandata) {
      const noua = d.prepare(`SELECT l.* FROM pozitie_linie l JOIN pozitie p ON p.id = l.pozitie_id
        WHERE p.comanda_id = ? AND l.lista = 'sticla' AND l.comandat_la IS NULL AND l.pozitie_id IN (${schimbate.map(k => ids[k]).join(',') || 'NULL'})
        ORDER BY l.pozitie_id, l.idx`).all(id).find(x => cheieSticla(x) === cheieSticla(l));
      if (noua) d.prepare('UPDATE pozitie_linie SET comandat_la = ?, comandat_de = ? WHERE id = ?').run(l.comandat_la, l.comandat_de, noua.id);
      else ramasa.push({ cod: l.cod, denumire: l.denumire, cantitate: l.cantitate, debitare: l.debitare });
    }

    // printările fişelor: rămân la produsele neschimbate (pe locul lor nou); ale celor schimbate se şterg
    const pozNou = new Map(vechi.map(p => [p.idx - 1, ids.indexOf(p.id)]));
    for (const f of d.prepare('SELECT id, poz FROM fisa_printare WHERE comanda_id = ?').all(id)) {
      const k = pozNou.get(f.poz) ?? -1;
      if (k < 0) d.prepare('DELETE FROM fisa_printare WHERE id = ?').run(f.id);
      else d.prepare('UPDATE fisa_printare SET poz = ? WHERE id = ?').run(k, f.id);
    }

    // codul de bare pe primul produs (scanările rămân legate de rândul lui din `usa`), apoi
    // ştergem produsele vechi rămase nefolosite, cu tot ce ţine de ele (CASCADE)
    if (cod) d.prepare('UPDATE usa SET pozitie_id = ?, idx = 1 WHERE cod_bare = ?').run(ids[0], cod);
    for (const p of vechi) if (!folosite.has(p.id)) d.prepare('DELETE FROM pozitie WHERE id = ?').run(p.id);
    // renumerotare 1..N, în ordine (toate sunt acum peste N)
    ids.forEach((pid, k) => d.prepare('UPDATE pozitie SET idx = ? WHERE id = ?').run(k + 1, pid));

    return { comanda: { id, numar: c.numar, ...(config.scanare && { coduri: cod ? [{ cod_bare: cod }] : [] }) },
             // la comandă: produsele de printat din nou (poz) + sticla comandată care nu mai e în ea
             ...(eComanda && { pozitii: schimbate, sticlaRamasa: ramasa }) };
  });

  anunta({ comanda: id });
  json(ctx.res, 200, rezultat);
}

// ── Adaugă la comandă (userul, 2026-10-12) ───────────────────────────────────
// La o comandă ÎN LUCRU se mai pot adăuga produse din configurator: poziţiile noi
// se pun după cele existente (cele vechi, codul de bare, scanările, sticla, factura
// rămân neatinse). Clientul şi livrarea sunt ale comenzii; transportul e deja pe ea —
// de pe produsele noi se scoate.
async function adauga(ctx) {
  const id = Number(ctx.params.id);
  const corp = await corpJson(ctx.req);
  const c = db().prepare('SELECT * FROM comanda WHERE id = ?').get(id);
  if (!c) return eroare(ctx.res, 404, 'Comanda nu există.');
  if (c.anulat) return eroare(ctx.res, 400, 'Comanda e anulată.');
  if (c.tip !== 'comanda' || c.finalizat_la) return eroare(ctx.res, 409, 'Se pot adăuga produse doar la o comandă în lucru.');
  const pozitii = corp.pozitii;
  if (!Array.isArray(pozitii) || !pozitii.length) return eroare(ctx.res, 400, 'Nu e niciun produs de adăugat.');
  const are = db().prepare('SELECT COUNT(*) AS n FROM pozitie WHERE comanda_id = ?').get(id).n;
  if (are + pozitii.length > MAX_POZITII) return eroare(ctx.res, 400, `O comandă are cel mult ${MAX_POZITII} produse (are deja ${are}).`);
  for (const [i, p] of pozitii.entries()) {
    const v = valideazaPozitia(p);
    if (v) return eroare(ctx.res, 400, pozitii.length > 1 ? `Produsul ${i + 1}: ${v}` : v);
  }
  tranzactie(d => {
    for (const p of pozitii) {
      const facturare = (p.linii?.facturare ?? []).filter(l => l?.cod !== TRANSPORT.cod);
      scriePozitia(d, id, { ...p, linii: { ...p.linii, facturare } });
    }
  });
  anunta({ comanda: id });
  // `pozitii` = produsele noi (poz, în ordinea fişelor) — configuratorul le printează fişele (userul, 2026-10-22)
  json(ctx.res, 200, { comanda: { id, numar: c.oferta_nr || c.numar }, adaugate: pozitii.length,
                       pozitii: pozitii.map((_, k) => are + k) });
}

// ── Citire ───────────────────────────────────────────────────────────────────

// tab: 'oferta' | 'plata' (aşteaptă plata) | 'comanda' (în lucru) | 'finalizata'
const FILTRE = {
  oferta:     "c.tip = 'oferta'",
  plata:      "c.tip = 'plata'",
  comanda:    "c.tip = 'comanda' AND c.finalizat_la IS NULL",
  finalizata: "c.tip = 'comanda' AND c.finalizat_la IS NOT NULL",
  toate:      '1',   // căutarea globală din manager: toate stările la un loc
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
    SELECT c.id, c.numar, c.oferta_nr, c.tip, c.client_nume, c.client_telefon, c.creat_la, c.confirmat_la, c.finalizat_la, c.tip_schimbat_la,
           c.factura_nr, c.facturat_la, c.plata, c.avans,
           u.nume AS creat_de_nume,
           -- toate produsele ofertei, în ordine: „Ramă 820 + Confort Gamma + Ofertă cu amănuntul"
           (SELECT GROUP_CONCAT(eticheta, ' + ') FROM (SELECT p.eticheta FROM pozitie p WHERE p.comanda_id = c.id ORDER BY p.idx)) AS sistem,
           (SELECT COUNT(*) FROM pozitie p WHERE p.comanda_id = c.id) AS nr_pozitii,
           ${config.scanare ? `(${ULTIMA_SCANARE})` : 'NULL'} AS ultima,
           (${STICLA}) AS sticla_brut,
           EXISTS (SELECT 1 FROM fixare f WHERE f.comanda_id = c.id AND f.utilizator_id = ?) AS fixat,
           NOT ${require('../cereri.js').FARA_CERERE} AS pe_hold   -- anulare cerută, nedecisă
      FROM comanda c
      JOIN utilizator u ON u.id = c.creat_de
     WHERE ${filtru} AND c.anulat = 0
     ORDER BY COALESCE(c.finalizat_la, c.creat_la) DESC
  `).all(uid);

  const demo = comenziDemo();   // în modul test: cele care nu mai sunt ca pe bune
  json(ctx.res, 200, {
    comenzi: randuri.map(({ ultima, sticla_brut, ...r }) => {
      const [operatie, moment, cine] = ultima ? ultima.split('|') : [];
      return { ...r, fixat: !!r.fixat, ...(demo.has(r.id) && { demo: true }),
               ...(config.scanare && { status: ultima ? { operatie, moment, cine } : null }),
               sticla: stareSticla(sticla_brut) };
    }),
  });
}

function detaliu(ctx) {
  const id = Number(ctx.params.id);
  // cine a făcut fiecare pas — numele, pentru pagina comenzii
  const comanda = db().prepare(`
    SELECT c.*, u.nume AS creat_de_nume, ua.nume AS confirmat_de_nume,
           -- de cât timp a ieşit din oferte (pt. „Înapoi în ofertă"), după ora exactă a serverului
           CAST((julianday(${ACUM()}) - julianday(c.tip_schimbat_la)) * 86400 AS INTEGER) AS secunde_schimbat,
           uf.nume AS facturat_de_nume, ufi.nume AS finalizat_de_nume, ufp.nume AS fisa_printata_de_nume
      FROM comanda c JOIN utilizator u ON u.id = c.creat_de
      LEFT JOIN utilizator ua  ON ua.id  = c.confirmat_de
      LEFT JOIN utilizator uf  ON uf.id  = c.facturat_de
      LEFT JOIN utilizator ufi ON ufi.id = c.finalizat_de
      LEFT JOIN utilizator ufp ON ufp.id = c.fisa_printata_de
     WHERE c.id = ?
  `).get(id);
  if (!comanda) return eroare(ctx.res, 404, 'Comandă inexistentă.');
  if (comenziDemo().has(id)) comanda.demo = true;
  // livrarea / adresa schimbate după ce s-a printat fişa (vreun produs fără reprintare de atunci) — de completat de mână
  comanda.fisa_de_completat = !!comanda.livrare_modificata_la && !!db().prepare(`SELECT 1 FROM (SELECT MAX(la) AS ultima
    FROM fisa_printare WHERE comanda_id = ? GROUP BY poz) WHERE ultima < ? LIMIT 1`).get(id, comanda.livrare_modificata_la);

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
    cerere: require('../cereri.js').cerereComenzii(id),   // anularea cerută / decisă (tichetele conducerii)
    cerereFactura: require('../cereri.js').cerereFactura(id),   // schimbarea nr. facturii cerută / decisă
    sticla,                          // null = comanda n-are sticlă de comandat
    sticlaLinii: require('../sticla.js').sticlaComenzii(id),   // pe furnizor: mail + bifă
    fise: fiseComenzii(id),          // printările fişei (prima + retipăririle)
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


// Oferta trece în „aşteaptă plata" — încă nu e comandă (fără CMD-, fără sticlă
// de comandat, fără facturare); iese de acolo cu „Plată primită" = accepta.
// Modul de livrare al unei comenzi în lucru / care aşteaptă plata (userul, 2026-10-08); la ofertă
// se schimbă din „Modifică oferta". Odată cu el se potrivesc: linia de transport din facturare
// (o dată pe comandă, pe prima poziţie — ca în configurator, cos.js transportOData; la „Ridicare
// personala" nu se facturează) şi livrarea din configuraţiile salvate (de acolo o ia fişa).
const LIVRARI = ['Ridicare personala', 'Curier ramburs', 'Curier op avans', 'Curier op la termen', 'Cu masina noastra'];
const TRANSPORT = { cod: 'CHLTTRMANIP', denumire: 'Cheltuieli de Transport si Manipulare', um: 'buc', cantitate: 1 };
// Livrarea şi / sau adresa unei comenzi în lucru / care aşteaptă plata (userul, 2026-10-08; adresa 2026-10-19).
// { livrare?, adresa? } — ce lipseşte rămâne. O schimbare ţine minte când (livrare_modificata_la): dacă fişa
// era deja printată, pagina cere completarea ei de mână, şi întreabă din nou la finalizare.
async function schimbaLivrare(ctx) {
  const id = Number(ctx.params.id);
  const corp = await corpJson(ctx.req);
  const c = db().prepare('SELECT * FROM comanda WHERE id = ?').get(id);
  if (!c)                 return eroare(ctx.res, 404, 'Comandă inexistentă.');
  if (c.anulat)           return eroare(ctx.res, 400, 'Comanda e anulată.');
  if (c.tip === 'oferta') return eroare(ctx.res, 409, 'La o ofertă livrarea se schimbă din „Modifică oferta".');
  if (c.finalizat_la)     return eroare(ctx.res, 409, 'Comanda e finalizată.');
  const livrare = 'livrare' in corp ? corp.livrare : c.livrare;
  if (!LIVRARI.includes(livrare)) return eroare(ctx.res, 400, 'Alege modul de livrare.');
  const adresa = 'adresa' in corp ? text(corp.adresa, 300) : c.client_adresa;
  if ('adresa' in corp && !adresa) return eroare(ctx.res, 400, 'Completează adresa.');
  if (livrare === c.livrare && adresa === c.client_adresa) return json(ctx.res, 200, { comanda: c });   // nimic schimbat
  tranzactie(d => {
    d.prepare(`UPDATE comanda SET livrare = ?, client_adresa = ?, livrare_modificata_la = ${ACUM()} WHERE id = ?`).run(livrare, adresa, id);
    const poz = d.prepare('SELECT id, config_json FROM pozitie WHERE comanda_id = ? ORDER BY idx').all(id);
    for (const p of poz) {
      const cfg = JSON.parse(p.config_json);
      cfg.comanda = { ...cfg.comanda, livrare };
      if (cfg.rame && 'livrare' in cfg.rame) cfg.rame.livrare = livrare;   // ofertele vechi de rame o ţineau aici
      d.prepare('UPDATE pozitie SET config_json = ? WHERE id = ?').run(JSON.stringify(cfg), p.id);
    }
    if (!poz.length) return;
    const ids = poz.map(p => p.id), semne = ids.map(() => '?').join(',');
    const are = d.prepare(`SELECT 1 FROM pozitie_linie WHERE lista = 'facturare' AND cod = ? AND pozitie_id IN (${semne})`).get(TRANSPORT.cod, ...ids);
    const trebuie = livrare !== 'Ridicare personala';
    if (are && !trebuie) d.prepare(`DELETE FROM pozitie_linie WHERE lista = 'facturare' AND cod = ? AND pozitie_id IN (${semne})`).run(TRANSPORT.cod, ...ids);
    if (!are && trebuie) {
      const idx = (d.prepare("SELECT MAX(idx) AS m FROM pozitie_linie WHERE pozitie_id = ? AND lista = 'facturare'").get(ids[0]).m ?? 0) + 1;
      d.prepare(`INSERT INTO pozitie_linie (pozitie_id, lista, idx, cod, denumire, um, cantitate) VALUES (?, 'facturare', ?, ?, ?, ?, ?)`)
        .run(ids[0], idx, TRANSPORT.cod, TRANSPORT.denumire, TRANSPORT.um, TRANSPORT.cantitate);
    }
  });
  anunta({ comanda: id });
  json(ctx.res, 200, { comanda: db().prepare('SELECT * FROM comanda WHERE id = ?').get(id) });
}

function asteaptaPlata(ctx) {
  const id = Number(ctx.params.id);
  const c = db().prepare('SELECT * FROM comanda WHERE id = ?').get(id);
  if (!c)                 return eroare(ctx.res, 404, 'Comandă inexistentă.');
  if (c.anulat)           return eroare(ctx.res, 400, 'Oferta e anulată.');
  if (c.tip !== 'oferta') return eroare(ctx.res, 409, c.tip === 'plata' ? 'Comanda aşteaptă deja plata.' : 'Oferta e deja comandă în lucru.');
  db().prepare(`UPDATE comanda SET tip = 'plata', tip_schimbat_la = ${ACUM()} WHERE id = ?`).run(id);
  anunta({ comanda: id });
  json(ctx.res, 200, { comanda: db().prepare('SELECT * FROM comanda WHERE id = ?').get(id) });
}

// Acceptarea unei oferte (sau „Plată primită" din aşteaptă plata): acelaşi rând,
// alt tip, acelaşi număr (de ofertă) — etichetele deja tipărite rămân valabile.
// Cere obligatoriu modalitatea de plată; avansul (lei) e opţional, implicit 0.
async function accepta(ctx) {
  const id = Number(ctx.params.id);
  const corp = await corpJson(ctx.req);
  const c = db().prepare('SELECT * FROM comanda WHERE id = ?').get(id);

  if (!c)                  return eroare(ctx.res, 404, 'Comandă inexistentă.');
  if (c.anulat)            return eroare(ctx.res, 400, 'Oferta e anulată.');
  if (c.tip === 'comanda') return eroare(ctx.res, 409, 'Oferta e deja comandă în lucru.');

  if (!PLATI.includes(corp.plata)) return eroare(ctx.res, 400, 'Alege modalitatea de plată: ofertă, factură proformă, proformă cu amănuntul, factură fiscală, bon fiscal sau factură de avans.');
  const avans = corp.avans == null || String(corp.avans).trim() === '' ? 0 : Number(String(corp.avans).replace(',', '.'));
  if (!Number.isFinite(avans) || avans < 0) return eroare(ctx.res, 400, 'Avansul trebuie să fie un număr (0 = fără avans).');
  // telefonul şi adresa: pe ofertă erau opţionale, la acceptare se cer (userul, 2026-10-05) —
  // dacă lipsesc, vin din fereastra de acceptare
  const telefon = text(corp.telefon) ?? c.client_telefon, adresa = text(corp.adresa, 300) ?? c.client_adresa;
  if (!telefon || !adresa) return eroare(ctx.res, 400, 'Completează telefonul şi adresa clientului — se cer la acceptare.');

  db().prepare(`
    UPDATE comanda SET tip = 'comanda', confirmat_la = ${ACUM()}, confirmat_de = ?, plata = ?, avans = ?,
                       tip_schimbat_la = ${ACUM()}, client_telefon = ?, client_adresa = ?
     WHERE id = ?
  `).run(ctx.utilizator.id, corp.plata, Math.round(avans * 100) / 100, telefon, adresa, id);

  anunta({ comanda: id });
  json(ctx.res, 200, { comanda: db().prepare('SELECT * FROM comanda WHERE id = ?').get(id) });
}

// „Înapoi în ofertă" (userul, 2026-10-05): o ofertă trecută din greşeală în lucru
// sau la „aşteaptă plata" se întoarce în oferte (de acolo o duci unde trebuia) —
// doar în primele MINUTE_INAPOI minute şi doar cât nu s-a lucrat pe ea: fără
// factură, finalizare, sticlă comandată sau scanări. (numar_comanda = NULL: şi
// comenzile vechi, cu CMD-, rămân apoi doar cu nr. de ofertă.)
const MINUTE_INAPOI = 10;
function inapoiInOferta(ctx) {
  const id = Number(ctx.params.id);
  const c = db().prepare(`SELECT *, tip_schimbat_la >= datetime(${ACUM()}, '-${MINUTE_INAPOI} minutes') AS la_timp
                            FROM comanda WHERE id = ?`).get(id);
  if (!c)                   return eroare(ctx.res, 404, 'Comandă inexistentă.');
  if (c.tip === 'oferta')   return eroare(ctx.res, 409, 'E deja ofertă.');
  if (!c.la_timp)           return eroare(ctx.res, 409, `Înapoi în ofertă se poate doar în primele ${MINUTE_INAPOI} minute.`);
  if (c.factura_nr)         return eroare(ctx.res, 409, 'Comanda e deja facturată — anulează întâi factura.');
  if (c.finalizat_la)       return eroare(ctx.res, 409, 'Comanda e deja finalizată.');
  const lucrat = db().prepare(`
    SELECT EXISTS (SELECT 1 FROM pozitie_linie l JOIN pozitie p ON p.id = l.pozitie_id
                    WHERE p.comanda_id = ? AND l.comandat_la IS NOT NULL) AS sticla,
           EXISTS (SELECT 1 FROM scanare s JOIN usa a ON a.id = s.usa_id JOIN pozitie p ON p.id = a.pozitie_id
                    WHERE p.comanda_id = ?) AS scanat`).get(id, id);
  if (lucrat.sticla)        return eroare(ctx.res, 409, 'Sticla e deja comandată la furnizor.');
  if (lucrat.scanat)        return eroare(ctx.res, 409, 'S-a început lucrul în atelier (există scanări).');
  db().prepare(`UPDATE comanda SET tip = 'oferta', numar_comanda = NULL, confirmat_la = NULL, confirmat_de = NULL,
                                   avans = NULL, tip_schimbat_la = NULL WHERE id = ?`).run(id);
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
    db().prepare(`UPDATE comanda SET finalizat_la = ${finalizata ? ACUM() : 'NULL'}, finalizat_de = ? WHERE id = ?`)
      .run(finalizata ? ctx.utilizator.id : null, id);
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
  // Rolul „birou" doar TRECE numărul pe o comandă nefacturată — schimbarea sau
  // anularea unui număr existent e a conducerii / administratorului (biroul o cere: cereri.js).
  if (c.factura_nr && ctx.utilizator.rol === 'birou') {
    return eroare(ctx.res, 403, 'Numărul unei facturi deja trecute îl poate schimba sau anula doar conducerea sau administratorul — cere schimbarea din pagina comenzii.');
  }
  const numar = String(corp.numar ?? '').trim().slice(0, 40);
  if (!numar && !corp.anuleaza) return eroare(ctx.res, 400, 'Completează numărul facturii.');
  db().prepare(`UPDATE comanda SET factura_nr = ?, facturat_la = ${numar ? ACUM() : 'NULL'}, facturat_de = ? WHERE id = ?`)
    .run(numar || null, numar ? ctx.utilizator.id : null, id);
  anunta({ comanda: id });
  json(ctx.res, 200, { comanda: db().prepare('SELECT * FROM comanda WHERE id = ?').get(id) });
}

// Fişa de atelier a pornit la print (butonul „Fişă" din manager — userul, 2026-10-13:
// să se vadă la comandă când a fost printată). Fiecare printare rămâne (2026-10-19: prima
// + retipăririle); pe comandă stă şi ultima (tabloul de admin numără fişele după ea).
async function fisaPrintata(ctx) {
  const id = Number(ctx.params.id);
  const poz = Math.max(0, Math.trunc(Number((await corpJson(ctx.req)).poz) || 0));
  const r = db().prepare(`UPDATE comanda SET fisa_printata_la = ${ACUM()}, fisa_printata_de = ? WHERE id = ?`).run(ctx.utilizator.id, id);
  if (!r.changes) return eroare(ctx.res, 404, 'Comandă inexistentă.');
  db().prepare(`INSERT INTO fisa_printare (comanda_id, poz, la, de) VALUES (?, ?, ${ACUM()}, ?)`).run(id, poz, ctx.utilizator.id);
  anunta({ comanda: id });
  json(ctx.res, 200, { ok: true });
}

// printările fişelor unei comenzi, în ordine — pt. pagina comenzii şi întrebarea de la retipărire
const fiseComenzii = id => db().prepare(`SELECT f.poz, f.la, u.nume AS de_nume FROM fisa_printare f
  LEFT JOIN utilizator u ON u.id = f.de WHERE f.comanda_id = ? ORDER BY f.la, f.id`).all(id);
function fise(ctx) {
  const id = Number(ctx.params.id);
  if (!db().prepare('SELECT 1 FROM comanda WHERE id = ?').get(id)) return eroare(ctx.res, 404, 'Comandă inexistentă.');
  json(ctx.res, 200, { fise: fiseComenzii(id) });
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

// Preferinţe per utilizator — ţinute pe server, ca să-l urmeze pe om pe orice
// calculator / telefon:
//   sortare    — lista de comenzi: 'data' | 'facturare'
//   latimeBara — lăţimea barei laterale din configurator (px); null = implicită
// Fiecare cheie are validarea ei; valoarea null şterge preferinţa.
const PREFERINTE = {
  sortare:    v => ['data', 'facturare'].includes(v),
  latimeBara: v => Number.isInteger(v) && v >= 380 && v <= 4000,
  tema:       v => ['luminos', 'intunecat'].includes(v),   // tema aplicaţiei (bara.js), pe cont — 2026-10-21
};
const DIN_TEXT = { latimeBara: Number };   // în DB totul e text

function preferinte(ctx) {
  const rows = db().prepare('SELECT cheie, valoare FROM preferinta WHERE utilizator_id = ?').all(ctx.utilizator.id);
  json(ctx.res, 200, { sortare: 'data', latimeBara: null, tema: null,
    ...Object.fromEntries(rows.map(r => [r.cheie, (DIN_TEXT[r.cheie] ?? String)(r.valoare)])) });
}

async function salveazaPreferinte(ctx) {
  const corp = await corpJson(ctx.req);
  for (const [cheie, valid] of Object.entries(PREFERINTE)) {
    if (corp[cheie] !== undefined && corp[cheie] !== null && !valid(corp[cheie])) {
      return eroare(ctx.res, 400, `Valoare invalidă pentru ${cheie}.`);
    }
  }
  const pune = db().prepare(`INSERT INTO preferinta (utilizator_id, cheie, valoare) VALUES (?, ?, ?)
    ON CONFLICT(utilizator_id, cheie) DO UPDATE SET valoare = excluded.valoare`);
  const sterge = db().prepare('DELETE FROM preferinta WHERE utilizator_id = ? AND cheie = ?');
  for (const cheie of Object.keys(PREFERINTE)) {
    if (corp[cheie] === undefined) continue;
    if (corp[cheie] === null) sterge.run(ctx.utilizator.id, cheie);
    else pune.run(ctx.utilizator.id, cheie, String(corp[cheie]));
  }
  anuntaUtilizator(ctx.utilizator.id, { preferinte: true });
  preferinte(ctx);
}

// Numerele pentru pagina principală. COUNT-uri în loc de listele întregi:
// acum, cu câteva comenzi, n-ar conta — peste un an, da.
const sumar = ctx => json(ctx.res, 200, {
  ...db().prepare(`
  SELECT SUM(tip = 'oferta')                              AS oferte,
         SUM(tip = 'plata')                               AS plata,
         SUM(tip = 'comanda' AND finalizat_la IS NULL)     AS comenzi,
         SUM(tip = 'comanda' AND finalizat_la IS NOT NULL) AS finalizate
    FROM comanda WHERE anulat = 0
`).get(),
  sticla: require('../sticla.js').sumarSticla(),   // bucăţi de sticlă de comandat
  deAprobat: require('../clienti.js').nrDeAprobat(), // clienţi noi / modificări de la agenţi, de aprobat
  // anulări de decis — la admin cele reale (le decide pe bune, server/index.js), deşi în rest e în demo
  cereri: ctx.utilizator.rol === 'admin' ? peBune(() => require('../cereri.js').nrDeschise())
    : ctx.utilizator.rol === 'conducere' ? require('../cereri.js').nrDeschise() : 0,
  tichete: require('../tichete.js').deVazut(ctx.utilizator),   // admin: tichete noi; ceilalţi: răspunsuri nevăzute
});

module.exports = {
  rute: [
    ['GET',  '/api/sumar',                   { handler: sumar }],
    // ora exactă (server/ora.js), ms — configuratorul îşi corectează ceasul calculatorului pe fişă
    ['GET',  '/api/ora',                     { handler: ctx => json(ctx.res, 200, { acum: acumMs() }) }],
    ['GET',  '/api/comenzi',                 { handler: listeaza }],
    ['POST', '/api/comenzi',                 { handler: creeaza }],
    ['GET',  '/api/comenzi/:id',             { handler: detaliu }],
    ['PUT',  '/api/comenzi/:id',             { handler: modifica }],
    ['POST', '/api/comenzi/:id/accepta',     { handler: accepta }],
    ['POST', '/api/comenzi/:id/asteapta-plata', { handler: asteaptaPlata }],
    ['POST', '/api/comenzi/:id/livrare',        { handler: schimbaLivrare }],
    ['POST', '/api/comenzi/:id/adauga',         { handler: adauga }],
    ['POST', '/api/comenzi/:id/inapoi-oferta',  { handler: inapoiInOferta }],
    ['POST', '/api/comenzi/:id/finalizeaza', { handler: schimbaFinalizare(true) }],
    ['POST', '/api/comenzi/:id/redeschide',  { handler: schimbaFinalizare(false) }],
    ['POST', '/api/comenzi/:id/factura',     { handler: factura }],
    ['POST', '/api/comenzi/:id/fixare',      { handler: fixeaza }],
    ['POST', '/api/comenzi/:id/fisa',        { handler: fisaPrintata }],
    ['GET',  '/api/comenzi/:id/fise',        { handler: fise }],
    ['GET',  '/api/preferinte',              { handler: preferinte }],
    ['PUT',  '/api/preferinte',              { handler: salveazaPreferinte }],
  ],
};
