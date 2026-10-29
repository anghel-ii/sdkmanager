const { db, peBune, esteTest, ACUM, faraDiacritice } = require('./db.js');
const { json, eroare, corpJson } = require('./http.js');

// ═══════════════════════════════════════════════════════════════════════════
//  JURNALUL DE ACTIVITATE (userul, 2026-10-21) — tot ce face fiecare om în aplicaţie,
//  cu data, ora, cine, operaţia, detaliile şi (dacă e cazul) comanda.
//
//  • Schimbările se scriu SINGURE: orice cerere reuşită care nu e GET trece pe la
//    `dupaCerere` (server/index.js) şi primeşte un nume din OPERATII (ruta → ce înseamnă).
//    O rută nouă fără nume tot se scrie, cu metoda şi calea — dar dă-i un nume aici.
//  • Ce doar SE VEDE (comandă deschisă, fişă văzută, pagină deschisă, coduri copiate)
//    îl trimite pagina: POST /api/activitate { operatie, comanda_id, detalii }.
//  • fel: 'schimbare' | 'cont' (intrări, ieşiri, parolă) | 'vizualizare'. „Doar schimbări"
//    = schimbare + cont; „Tot" = şi vizualizările.
//  • Se scrie mereu în baza REALĂ (peBune), şi din modul test (cu test = 1).
//  Citit: secţiunea „Activitate" din pagina comenzii (oricine) şi pagina /activitate
//  (admin + conducere), cu filtre şi grafic.
// ═══════════════════════════════════════════════════════════════════════════

const scurt = (t, n = 160) => { const s = String(t ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const lei = v => (v == null || v === '' ? null : `${String(v).replace('.', ',')} lei`);
const lista = (...x) => x.filter(v => v != null && v !== '' && v !== false).join(' · ') || null;
const COLOANE_BORDEROU = { bon: 'Bon', factura: 'Factură + chitanţă', op: 'OP' };
const PLATI = { oferta: 'ofertă', proforma: 'proformă', proforma_amanunt: 'proformă cu amănuntul', fiscala: 'factură fiscală', bon: 'bon fiscal', avans: 'factură de avans' };
const INCASARI = { op_avans: 'OP avans', op_termen: 'OP la termen', bo_termen: 'BO la termen', bo_ramburs: 'BO ramburs', cash_ramburs: 'Cash ramburs',
                   cash_bf: 'Cash BF', cash_ch: 'Cash chitanta', cash_bf_sofer: 'Cash BF la sofer', cash_ch_sofer: 'Cash CH la sofer', card: 'Card' };
const ROLURI = { admin: 'administrator', conducere: 'conducere', birou: 'birou' };

// comanda unei linii de sticlă / a unei cereri de anulare / a unui task — pt. operaţiile care n-o au în adresă
const comandaLiniei = id => db().prepare('SELECT p.comanda_id AS c FROM pozitie_linie l JOIN pozitie p ON p.id = l.pozitie_id WHERE l.id = ?').get(id)?.c;
const comandaCererii = id => db().prepare('SELECT comanda_id AS c FROM cerere WHERE id = ?').get(id)?.c;
const cererea = id => db().prepare('SELECT tip, numar_nou FROM cerere WHERE id = ?').get(id);
const decizie = da => (b, p) => (cererea(p.id)?.tip === 'factura' ? `Schimbarea facturii ${da ? 'aprobată' : 'respinsă'}` : `Anulare ${da ? 'aprobată' : 'respinsă'}`);
const numeClient = id => db().prepare('SELECT nume, cui FROM client WHERE extern_id = ?').get(id)?.nume ?? `client #${id}`;
const comandaTaskului = id => db().prepare('SELECT comanda_id AS c FROM task WHERE id = ?').get(id)?.c;

// „METODĂ /cale" → [operaţie, fel, detalii(corp, răspuns, params), comenzi(corp, răspuns, params)]
// operaţia poate fi şi o funcţie (ex. factura: trecută / anulată); `comenzi` — când nu e :id din /api/comenzi/:id
const S = 'schimbare', C = 'cont', V = 'vizualizare';
const OPERATII = {
  'POST /api/login':                         ['A intrat în cont', C],
  'POST /api/logout':                        ['A ieşit din cont', C],
  'POST /api/eu/parola':                     ['Şi-a schimbat parola', C],
  'POST /api/utilizatori':                   ['Cont nou', S, b => lista(b.nume, b.user, ROLURI[b.rol])],
  'PATCH /api/utilizatori/:id':              ['Cont modificat', S, (b, r) => lista(r?.utilizator?.nume ?? r?.nume, b.rol && `rol: ${ROLURI[b.rol] ?? b.rol}`,
                                               'activ' in b && (b.activ ? 'reactivat' : 'dezactivat'), b.parola !== undefined && 'parolă nouă',
                                               'mod_test' in b && `mod test: ${b.mod_test ? 'da' : 'nu'}`)],
  'POST /api/test/reface':                   ['Copia de test refăcută', S],

  'POST /api/comenzi':                       ['Ofertă nouă', S, b => lista(b.nume, b.ofertaNr, Array.isArray(b.pozitii) && `${b.pozitii.length} ${b.pozitii.length === 1 ? 'produs' : 'produse'}`),
                                               null, (b, r) => [r?.comanda?.id]],
  'PUT /api/comenzi/:id':                    [(b, p) => (db().prepare('SELECT tip FROM comanda WHERE id = ?').get(p.id)?.tip !== 'oferta' ? 'Comandă modificată' : 'Ofertă modificată'), S,
                                               (b, r) => lista(b.nume, Array.isArray(b.pozitii) && `${b.pozitii.length} ${b.pozitii.length === 1 ? 'produs' : 'produse'}`,
                                                 Array.isArray(r?.pozitii) && (r.pozitii.length ? `de printat din nou: ${r.pozitii.map(k => `fişa ${k + 1}`).join(', ')}` : 'fişele rămân aceleaşi'),
                                                 r?.sticlaRamasa?.length && `sticlă comandată scoasă: ${r.sticlaRamasa.map(l => l.cod).join(', ')}`)],
  'POST /api/comenzi/:id/accepta':           ['Acceptată — comandă în lucru', S, (b, r) => lista(PLATI[b.plata] ?? b.plata, INCASARI[r?.comanda?.incasare],
                                               Number(b.avans) > 0 && `${r?.comanda?.achitat_la ? 'achitată' : 'avans'} ${lei(b.avans)}`)],
  'POST /api/comenzi/:id/asteapta-plata':    ['Trimisă la „Aşteaptă plata"', S, b => lista(PLATI[b.plata] ?? b.plata, b.numar && `nr. ${scurt(b.numar, 40)}`)],
  'POST /api/comenzi/:id/livrare':           ['Livrarea / adresa modificată', S, b => lista(b.livrare, b.adresa && scurt(b.adresa, 80))],
  'POST /api/comenzi/:id/adauga':            ['Produse adăugate la comandă', S, b => Array.isArray(b.pozitii) && `${b.pozitii.length} ${b.pozitii.length === 1 ? 'produs' : 'produse'}`],
  'POST /api/comenzi/:id/inapoi-oferta':     ['Întoarsă în oferte', S],
  'POST /api/comenzi/:id/finalizeaza':       ['Marcată finalizată', S],
  'POST /api/comenzi/:id/redeschide':        ['Redeschisă (nu mai e finalizată)', S],
  'POST /api/comenzi/:id/factura':           [b => (String(b.numar ?? '').trim() ? 'Facturată' : 'Factura anulată'), S,
                                               (b, r) => lista(scurt(b.numar, 40), r?.finalizata && 'şi finalizată')],
  'POST /api/comenzi/:id/fixare':            [b => (b.fixat ? 'A fixat-o sus (pin)' : 'A scos-o de sus (pin)'), V],
  'POST /api/comenzi/:id/fisa':              ['Fişa printată', S, b => (b.poz > 0 ? `produsul ${+b.poz + 1}` : null)],
  'POST /api/comenzi/:id/anulare':           ['Anulare cerută', S, b => scurt(b.motiv)],
  'POST /api/comenzi/:id/schimba-factura':   ['Schimbarea facturii cerută', S, b => lista(b.numar && `nr. nou: ${scurt(b.numar, 40)}`, scurt(b.motiv))],
  'POST /api/comenzi/:id/numar':             ['Numărul documentului schimbat', S, b => scurt(b.numar, 40) || null],
  'POST /api/comenzi/:id/schimba-numar':     ['Schimbarea numărului cerută', S, b => lista(b.numar && `nr. nou: ${scurt(b.numar, 40)}`, scurt(b.motiv))],
  'PUT /api/preferinte':                     ['Setări personale', V, b => lista(...Object.entries(b).map(([k, v]) => `${k}: ${v}`))],

  'POST /api/sticla/comanda':                ['Sticlă comandată', S, b => `${(b.ids ?? []).length} ${(b.ids ?? []).length === 1 ? 'linie' : 'linii'}`,
                                               null, b => (b.ids ?? []).map(comandaLiniei)],
  'POST /api/sticla/anuleaza':               ['Comanda de sticlă anulată', S, b => `${(b.ids ?? []).length} ${(b.ids ?? []).length === 1 ? 'linie' : 'linii'}`,
                                               null, b => (b.ids ?? []).map(comandaLiniei)],
  'PUT /api/sticla/furnizori/:cod':          ['Mailul furnizorului de sticlă modificat', S, (b, r, p) => lista(p.cod, b.email)],

  'PUT /api/livrari/comanda/:id':            ['Livrare: preţ / observaţii / loc', S, b => lista(b.de_incasat != null && b.de_incasat !== '' && `preţ ${lei(b.de_incasat)}`,
                                               'coloana_borderou' in b && `pe borderou: ${COLOANE_BORDEROU[b.coloana_borderou] ?? 'nealeasă'}`,
                                               b.observatii_livrare && scurt(b.observatii_livrare, 80), b.judet), null, (b, r, p) => [p.id]],
  'POST /api/livrari':                       ['Livrare programată', S, b => lista(b.data, Array.isArray(b.comenzi) && `${b.comenzi.length} comenzi`),
                                               null, b => b.comenzi ?? []],
  'DELETE /api/livrari/:id':                 ['Livrare anulată', S, (b, r, p) => `livrarea ${p.id}`],

  'POST /api/taskuri':                       ['Task nou', S, b => scurt(b.text), null, b => [b.comanda_id]],
  'PATCH /api/taskuri/:id':                  [b => ('facut' in b ? (b.facut ? 'Task făcut' : 'Task redeschis') : 'asteptare' in b ? 'Task pus în aşteptare' : 'Task modificat'), S,
                                               b => b.text && scurt(b.text), null, (b, r, p) => [comandaTaskului(p.id)]],
  'DELETE /api/taskuri/:id':                 ['Task şters', S],
  'POST /api/taskuri/:id/raspuns':           ['Răspuns la task', S, b => scurt(b.text), null, (b, r, p) => [comandaTaskului(p.id)]],
  'POST /api/taskuri/:id/citit':             ['Task citit', V],

  'POST /api/cereri/:id/aproba':             [decizie(true), S, (b, r, p) => { const c = cererea(p.id);
                                               return lista(c?.tip === 'factura' && `nr. nou: ${c.numar_nou}`, scurt(b.raspuns)); }, null, (b, r, p) => [comandaCererii(p.id)]],
  'POST /api/cereri/:id/respinge':           [decizie(false), S, b => scurt(b.raspuns), null, (b, r, p) => [comandaCererii(p.id)]],

  'POST /api/tichete':                       ['Tichet nou', S, b => lista(b.tip, scurt(b.text, 120)), null, b => [b.comanda_id]],
  'POST /api/tichete/vazute':                ['Tichete văzute', V],
  'PATCH /api/tichete/:id':                  ['Tichet actualizat', S, b => lista(b.stare, b.raspuns && scurt(b.raspuns, 120))],
  'POST /api/tichete/:id/raspuns':           ['Mesaj în tichet', S, (b, r, p) => lista(`tichetul ${p.id}`, scurt(b.text, 120),
                                               Array.isArray(b.poze) && b.poze.length && `${b.poze.length} ${b.poze.length === 1 ? 'poză' : 'poze'}`)],
  'POST /api/tichete/:id/citit':             ['A citit conversaţia unui tichet', V, (b, r, p) => `tichetul ${p.id}`],
  'POST /api/notificari/:id/inchide':        ['Notificare închisă', V],

  'POST /api/actualizare/verifica':          ['A verificat dacă e o versiune nouă', S],
  'POST /api/actualizare':                   ['A pornit actualizarea aplicaţiei', S],
  'PUT /api/actualizare/cheie':              ['Cheia GitHub schimbată', S],
  'POST /api/clienti/preia':                 ['Clienţii aduşi din Cloudflare', S],
  'POST /api/clienti/propuneri/:id/:actiune':[(b, p) => `Client propus de agent: ${p.actiune === 'aproba' ? 'aprobat' : p.actiune === 'respinge' ? 'respins' : p.actiune}`, S],
  'PUT /api/clienti/cheie':                  ['Cheia Cloudflare schimbată', S],
  'PUT /api/clienti/:id':                    ['Client modificat', S, b => lista(b.nume, b.agent && `agent: ${b.agent}`)],
  'DELETE /api/clienti/:id':                 ['Client şters', S, (b, r, p) => numeClient(p.id)],
  'POST /api/agenti':                        ['Agent nou', S, b => scurt(b.nume)],
  'PATCH /api/agenti':                       ['Agent modificat', S, b => scurt(b.nume)],
  'POST /api/agenti/intra':                  ['A intrat ca agent', S],
};

// Un rând în jurnal. `comanda` = id; numărul ofertei şi clientul se iau acum (din baza în care
// lucrează omul — reală sau de test), apoi rândul se scrie în baza reală.
function noteaza({ utilizator, fel, operatie, detalii = null, comanda = null }) {
  const c = comanda ? db().prepare('SELECT oferta_nr, numar, client_nume FROM comanda WHERE id = ?').get(comanda) : null;
  const test = esteTest() ? 1 : 0;
  peBune(() => db().prepare(`INSERT INTO activitate (la, utilizator_id, utilizator_nume, fel, operatie, detalii, comanda_id, comanda_nr, client_nume, test)
    VALUES (${ACUM()}, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(utilizator?.id ?? null, utilizator?.nume ?? null, fel, scurt(operatie, 120), detalii ? scurt(detalii, 400) : null,
         comanda ?? null, c ? (c.oferta_nr || c.numar) : null, c?.client_nume ?? null, test));
}

// După fiecare cerere API (server/index.js): schimbările reuşite + încercările de intrare greşite.
function dupaCerere(ctx, metoda, sablon) {
  try {
    if (metoda === 'GET' || sablon === '/api/activitate') return;
    const cheie = `${metoda} ${sablon}`, cod = ctx.res.statusCode;
    const b = ctx.req.corpCitit ?? {}, r = ctx.res.corpTrimis, p = ctx.params ?? {};
    if (cheie === 'POST /api/login') {
      if (cod === 200) return noteaza({ utilizator: r?.utilizator, fel: C, operatie: 'A intrat în cont' });
      if (cod === 401) return noteaza({ utilizator: null, fel: C, operatie: 'Intrare greşită (parolă sau utilizator)', detalii: `utilizator: ${scurt(b.user, 40)}` });
      return;
    }
    if (cod >= 400) return;
    const [op, fel, det, , com] = OPERATII[cheie] ?? [`${metoda} ${sablon}`, S];
    const operatie = typeof op === 'function' ? op(b, p) : op;
    const detalii = det ? det(b, r, p) || null : null;
    const peComanda = /^\/api\/comenzi\/:id\b/.test(sablon) ? [+p.id] : [];
    const comenzi = [...new Set([...peComanda, ...(com ? com(b, r, p) : [])].map(Number).filter(n => Number.isInteger(n) && n > 0))];
    if (!comenzi.length) return noteaza({ utilizator: ctx.utilizator, fel, operatie, detalii });
    for (const comanda of comenzi) noteaza({ utilizator: ctx.utilizator, fel, operatie, detalii, comanda });
  } catch (e) {
    console.error('Jurnalul de activitate:', e.message);   // jurnalul nu strică niciodată cererea
  }
}

// ── Vizualizările, trimise de pagini ──
async function postVazut(ctx) {
  const b = await corpJson(ctx.req);
  const operatie = scurt(b.operatie, 120);
  if (!operatie) return eroare(ctx.res, 400, 'Lipseşte operaţia.');
  const comanda = Number.isInteger(+b.comanda_id) && +b.comanda_id > 0 ? +b.comanda_id : null;
  noteaza({ utilizator: ctx.utilizator, fel: V, operatie, detalii: b.detalii ? scurt(b.detalii, 300) : null, comanda });
  json(ctx.res, 200, { ok: true });
}

// ── Citire ──
const COLOANE = 'id, la, utilizator_id, utilizator_nume, fel, operatie, detalii, comanda_id, comanda_nr, client_nume, test';
const doarSchimbari = tot => (tot ? '' : " AND fel IN ('schimbare', 'cont')");

// secţiunea „Activitate" din pagina comenzii (oricine o vede)
function getComanda(ctx) {
  const tot = new URL(ctx.req.url, 'http://x').searchParams.get('tot') === '1';
  const randuri = peBune(() => db().prepare(`SELECT ${COLOANE} FROM activitate WHERE comanda_id = ?${doarSchimbari(tot)}
    ORDER BY la DESC, id DESC LIMIT 1000`).all(+ctx.params.id));
  json(ctx.res, 200, { randuri });
}

// pagina /activitate (admin + conducere): filtre, pagini de câte 200, numărătoarea pe zile pt. grafic
function getToate(ctx) {
  const q = new URL(ctx.req.url, 'http://x').searchParams;
  const cond = ['1 = 1'], val = [];
  if (q.get('de'))   { cond.push('la >= ?'); val.push(q.get('de')); }     // 'AAAA-LL-ZZ HH:MM:SS', UTC (pagina le face din ora locală)
  if (q.get('pana')) { cond.push('la < ?');  val.push(q.get('pana')); }
  if (q.get('utilizator')) { cond.push('utilizator_id = ?'); val.push(+q.get('utilizator')); }
  if (q.get('operatie'))   { cond.push('operatie = ?'); val.push(q.get('operatie')); }
  if (q.get('cauta')) {
    // fără diacritice şi majuscule (userul, 2026-10-26)
    const t = `%${faraDiacritice(q.get('cauta').trim())}%`;
    cond.push(`(fara_diacritice(operatie) LIKE ? OR fara_diacritice(IFNULL(detalii, '')) LIKE ? OR fara_diacritice(IFNULL(comanda_nr, '')) LIKE ?
                OR fara_diacritice(IFNULL(client_nume, '')) LIKE ? OR fara_diacritice(IFNULL(utilizator_nume, '')) LIKE ?)`);
    val.push(t, t, t, t, t);
  }
  const unde = cond.join(' AND ') + doarSchimbari(q.get('tot') === '1');
  const pagina = Math.max(0, +q.get('pagina') || 0);
  const r = peBune(() => {
    const d = db();
    return {
      randuri: d.prepare(`SELECT ${COLOANE} FROM activitate WHERE ${unde} ORDER BY la DESC, id DESC LIMIT 200 OFFSET ?`).all(...val, pagina * 200),
      total:   d.prepare(`SELECT COUNT(*) AS n FROM activitate WHERE ${unde}`).get(...val).n,
      // pe zile (ora locală a serverului = a României) şi pe om — graficul
      peZi:    d.prepare(`SELECT date(la, 'localtime') AS zi, IFNULL(utilizator_nume, '—') AS cine, COUNT(*) AS n
                          FROM activitate WHERE ${unde} GROUP BY zi, cine ORDER BY zi`).all(...val),
      // pt. filtre: cine apare în jurnal şi ce operaţii există
      oameni:   d.prepare(`SELECT DISTINCT utilizator_id AS id, utilizator_nume AS nume FROM activitate
                           WHERE utilizator_id IS NOT NULL ORDER BY nume`).all(),
      operatii: d.prepare('SELECT operatie, COUNT(*) AS n FROM activitate GROUP BY operatie ORDER BY operatie').all(),
    };
  });
  json(ctx.res, 200, r);
}

module.exports = {
  noteaza, dupaCerere, OPERATII,
  rute: [
    ['POST', '/api/activitate',               { handler: postVazut }],
    ['GET',  '/api/activitate',               { rol: ['admin', 'conducere'], handler: getToate }],
    ['GET',  '/api/comenzi/:id/activitate',   { handler: getComanda }],
  ],
};
