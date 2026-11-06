// ═══════════════════════════════════════════════════════════════════════════
//  FACTUREAZĂ SEPARAT (userul, 2026-11-06): la ridicare personală, produsele unei comenzi
//  se facturează pe bucăţi; facturată parţial = şi la În lucru, şi la Finalizate.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'manager-factura-separat-'));
Object.assign(process.env, { MANAGER_DB: path.join(TEMP, 'manager.sqlite'), MANAGER_BACKUP: path.join(TEMP, 'backup'), MANAGER_RAPORTARE: '0', MANAGER_RELEU_URL: '' });

const { deschide, db, inchide } = require('../server/db.js');
const { creeazaUtilizator } = require('../server/auth.js');
const { rute } = require('../server/api/comenzi.js');

let treceri = 0, caderi = 0;
const verifica = (nume, conditie, detaliu = '') => {
  if (conditie) { treceri++; console.log(`  ✓ ${nume}`); } else { caderi++; console.log(`  ✗ ${nume}${detaliu ? ` — ${detaliu}` : ''}`); }
};
let eu = null;
async function cheama(metoda, cale, { corp, params = {}, query = '' } = {}) {
  const spec = rute.find(([m, c]) => m === metoda && c === cale)[2];
  const brut = corp === undefined ? '' : JSON.stringify(corp);
  const iese = { cod: 0, date: null };
  const req = { url: cale + query, on(e, f) { if (e === 'data' && brut) f(Buffer.from(brut)); if (e === 'end') f(); return this; } };
  const res = { writeHead(c) { iese.cod = c; }, setHeader() {}, end(t) { iese.date = t ? JSON.parse(t) : null; } };
  try { await spec.handler({ req, res, params: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), utilizator: eu }); }
  catch (e) { iese.cod = e.cod ?? 500; iese.date = { eroare: e.message }; }
  return iese;
}
const separat = (id, pozitii, numar) => cheama('POST', '/api/comenzi/:id/factura-separat', { params: { id }, corp: { pozitii, numar } });
const lista = async tip => (await cheama('GET', '/api/comenzi', { query: `?tip=${tip}` })).date.comenzi;
const c = id => db().prepare('SELECT * FROM comanda WHERE id = ?').get(id);
const poz = id => db().prepare('SELECT idx, factura_nr FROM pozitie WHERE comanda_id = ? ORDER BY idx').all(id).map(p => p.factura_nr);

let n = 0;
function comanda(livrare = 'Ridicare personala', produse = ['Confort Verona', 'Ramă 820', 'UTIL Atena']) {
  n++;
  const id = Number(db().prepare(`INSERT INTO comanda (numar, oferta_nr, tip, client_nume, livrare, creat_de, confirmat_la, tip_schimbat_la)
    VALUES (?, ?, 'comanda', 'Client', ?, ?, datetime('now'), datetime('now'))`).run(`OF-2026-${String(n).padStart(4, '0')}`, `PF ${n}`, livrare, eu.id).lastInsertRowid);
  produse.forEach((e, k) => db().prepare(`INSERT INTO pozitie (comanda_id, idx, sistem, eticheta, finisaj, latime, inaltime, nr_usi, config_json)
    VALUES (?, ?, 'x', ?, 'ALUMINIU', 1, 1, 1, '{}')`).run(id, k + 1, e));
  return id;
}

(async () => {
  deschide();
  creeazaUtilizator({ nume: 'Ana Birou', user: 'ana', parola: 'parola-ana-123', rol: 'birou' });
  creeazaUtilizator({ nume: 'Ion Conducere', user: 'ion', parola: 'parola-ion-123', rol: 'conducere' });
  const ana = db().prepare("SELECT id, nume, rol FROM utilizator WHERE user = 'ana'").get();
  const ion = db().prepare("SELECT id, nume, rol FROM utilizator WHERE user = 'ion'").get();
  eu = ana;

  const id = comanda();
  const curier = comanda('Curier ramburs');

  console.log('\nCând se poate');
  verifica('doar la ridicare personală', (await separat(curier, [0], 'F1')).cod === 409);
  verifica('fără număr → 400', (await separat(id, [0], ' ')).cod === 400);
  verifica('fără produse bifate → 400', (await separat(id, [], 'F1')).cod === 400);
  verifica('produs inexistent → 400', (await separat(id, [7], 'F1')).cod === 400);

  console.log('\nFacturată parţial');
  const r = await separat(id, [0, 2], 'F100');
  verifica('produsele 1 şi 3 facturate', r.cod === 200 && r.date.toata === false && poz(id).join() === 'F100,,F100', JSON.stringify(poz(id)));
  verifica('comanda: nefacturată ca întreg, nefinalizată', c(id).factura_nr === null && c(id).finalizat_la === null);
  verifica('apare la În lucru', (await lista('comanda')).some(x => x.id === id));
  const fin = (await lista('finalizata')).find(x => x.id === id);
  verifica('apare şi la Finalizate, cu 2/3 şi numărul', !!fin && fin.poz_facturate === 2 && fin.nr_pozitii === 3 && fin.facturi_produse === 'F100', JSON.stringify(fin));
  verifica('numărătoarea Finalizate o ia şi pe ea', (await cheama('GET', '/api/sumar')).date.finalizate === 1);
  verifica('un produs facturat nu se facturează a doua oară', (await separat(id, [0, 1], 'F101')).cod === 409);
  verifica('nu se mai întoarce în ofertă', (await cheama('POST', '/api/comenzi/:id/inapoi-oferta', { params: { id } })).cod === 409);
  const det = (await cheama('GET', '/api/comenzi/:id', { params: { id } })).date;
  verifica('pagina comenzii: cine a facturat fiecare produs', det.pozitii[0].factura_nr === 'F100' && det.pozitii[0].facturat_de_nume === 'Ana Birou' && !det.pozitii[1].factura_nr);

  console.log('\nAnularea facturii unui produs');
  verifica('biroul nu poate', (await cheama('DELETE', '/api/comenzi/:id/factura-separat/:poz', { params: { id, poz: 2 } })).cod === 403);
  eu = ion;
  verifica('conducerea anulează produsul 3', (await cheama('DELETE', '/api/comenzi/:id/factura-separat/:poz', { params: { id, poz: 2 } })).cod === 200
    && poz(id).join() === 'F100,,');
  eu = ana;

  console.log('\nUltimele produse — facturată ca întreg');
  const t = await separat(id, [1, 2], 'F101');
  verifica('facturată ca întreg şi finalizată', t.date.toata === true && c(id).factura_nr === 'F101' && !!c(id).finalizat_la && poz(id).join() === 'F100,F101,F101');
  verifica('doar la Finalizate', !(await lista('comanda')).some(x => x.id === id) && (await lista('finalizata')).find(x => x.id === id).facturi_produse.split(',').sort().join() === 'F100,F101');
  verifica('facturată → „Facturează separat" refuzat', (await separat(id, [0], 'F102')).cod === 409);

  console.log('\nFactura comenzii (conducerea) — anulare');
  eu = ion;
  await cheama('POST', '/api/comenzi/:id/factura', { params: { id }, corp: { anuleaza: true } });
  verifica('anulată: produsele facturate cu ea redevin nefacturate, cele separate rămân', c(id).factura_nr === null && poz(id).join() === 'F100,,');
  verifica('iar facturată parţial — şi la Finalizate (e deja finalizată)', (await lista('finalizata')).some(x => x.id === id));
  await cheama('POST', '/api/comenzi/:id/factura', { params: { id }, corp: { numar: 'F200' } });
  verifica('facturarea obişnuită a restului: comanda F200, produsul separat păstrează F100', c(id).factura_nr === 'F200' && poz(id)[0] === 'F100');
  eu = ana;

  console.log('\nModifică comanda');
  const id2 = comanda();
  await separat(id2, [0], 'F300');
  const pozitieDin = p => ({ sistem: p.sistem, eticheta: p.eticheta, finisaj: p.finisaj, latime: p.latime, inaltime: p.inaltime, nrUsi: p.nr_usi,
    config: JSON.parse(p.config_json), linii: { facturare: [], necesar: [], client: [] } });
  const vechi = db().prepare('SELECT * FROM pozitie WHERE comanda_id = ? ORDER BY idx').all(id2).map(pozitieDin);
  const corp = { client: { nume: 'Client' }, detalii: { livrare: 'Ridicare personala', agent: 'Birou' }, ofertaNr: 'PF 4' };
  verifica('fără produsul facturat → refuzat', (await cheama('PUT', '/api/comenzi/:id', { params: { id: id2 }, corp: { ...corp, pozitii: vechi.slice(1) } })).cod === 409);
  verifica('produsul facturat schimbat → refuzat', (await cheama('PUT', '/api/comenzi/:id', { params: { id: id2 },
    corp: { ...corp, pozitii: [{ ...vechi[0], latime: 999 }, ...vechi.slice(1)] } })).cod === 409);
  const m = await cheama('PUT', '/api/comenzi/:id', { params: { id: id2 }, corp: { ...corp, pozitii: [vechi[0], vechi[1]] } });
  verifica('scos doar unul nefacturat → merge, factura rămâne pe produsul ei', m.cod === 200 && poz(id2).join() === 'F300,', JSON.stringify(m.date));

  console.log('\nCe s-a schimbat (drumul comenzii: „Vezi detalii")');
  verifica('produsul scos e notat', m.date.schimbari.produse.some(x => x.fel === 'scos' && x.eticheta === 'UTIL Atena'), JSON.stringify(m.date.schimbari));
  const m2 = await cheama('PUT', '/api/comenzi/:id', { params: { id: id2 }, corp: { ...corp, client: { nume: 'Client Nou', adresa: 'Str. Nouă 5, Cluj-Napoca, Cluj' },
    pozitii: [vechi[0], { ...vechi[1], latime: 1500 }, { ...vechi[2], eticheta: 'Lux Vent' }] } });
  const sc = m2.date.schimbari;
  verifica('câmpurile schimbate: client + adresă', sc.campuri.some(x => x.camp === 'client_nume' && x.din === 'Client' && x.in === 'Client Nou')
    && sc.campuri.some(x => x.camp === 'client_adresa'), JSON.stringify(sc.campuri));
  verifica('produsul 2 modificat, al 3-lea adăugat', sc.produse.some(x => x.fel === 'modificat' && x.nr === 2) && sc.produse.some(x => x.fel === 'adaugat' && x.eticheta === 'Lux Vent'), JSON.stringify(sc.produse));
  const { OPERATII } = require('../server/activitate.js');
  const text = OPERATII['PUT /api/comenzi/:id'][2]({}, m2.date);
  verifica('jurnalul: textul detaliat', /Client: Client → Client Nou/.test(text) && /produsul 2 modificat/.test(text) && /produs adăugat: Lux Vent/.test(text), text);
  verifica('fără schimbări → „nimic schimbat"', /nimic schimbat/.test(OPERATII['PUT /api/comenzi/:id'][2]({}, { schimbari: { campuri: [], produse: [] } })));
  verifica('adăugare: numele produselor', OPERATII['POST /api/comenzi/:id/adauga'][2]({ pozitii: [{ eticheta: 'Ramă 820' }, { eticheta: 'UTIL Roma' }] }) === 'Ramă 820 · UTIL Roma');
  const { noteaza } = require('../server/activitate.js');
  noteaza({ utilizator: ana, fel: 'schimbare', operatie: 'Comandă modificată', detalii: text, comanda: id2 });
  noteaza({ utilizator: ana, fel: 'vizualizare', operatie: 'A deschis comanda', comanda: id2 });
  const mods = (await cheama('GET', '/api/comenzi/:id', { params: { id: id2 } })).date.modificari;
  verifica('pagina comenzii primeşte modificările (fără vizualizări)', mods.length === 1 && mods[0].operatie === 'Comandă modificată' && mods[0].utilizator_nume === 'Ana Birou', JSON.stringify(mods));

  console.log('\nArhivate (30 de zile de la facturare)');
  const zile = n => db().prepare(`SELECT datetime('now', ?) AS d`).get(`-${n} days`).d;
  const fact = (cid, n) => db().prepare(`UPDATE comanda SET factura_nr = 'FA', facturat_la = ?, finalizat_la = ? WHERE id = ?`).run(zile(n), zile(n), cid);
  const a29 = comanda(), a30 = comanda(), partial = comanda();
  fact(a29, 29); fact(a30, 30);
  await separat(partial, [0], 'FP');
  db().prepare('UPDATE pozitie SET facturat_la = ? WHERE comanda_id = ?').run(zile(90), partial);   // produs facturat demult, restul nu
  const arh = (await lista('arhivata')).map(x => x.id), fz = (await lista('finalizata')).map(x => x.id);
  verifica('facturată de 30 de zile → Arhivate, nu Finalizate', arh.includes(a30) && !fz.includes(a30), JSON.stringify({ arh, fz }));
  verifica('facturată de 29 de zile → încă la Finalizate', fz.includes(a29) && !arh.includes(a29));
  verifica('facturată parţial (chiar de 90 de zile) → nu se arhivează', !arh.includes(partial) && fz.includes(partial));
  const sum = (await cheama('GET', '/api/sumar')).date;
  verifica('numărătoarea Arhivate / Finalizate', sum.arhivate === arh.length && !fz.some(x => arh.includes(x)), JSON.stringify(sum));
  verifica('pagina comenzii ştie că e arhivată', (await cheama('GET', '/api/comenzi/:id', { params: { id: a30 } })).date.comanda.arhivata === 1
    && (await cheama('GET', '/api/comenzi/:id', { params: { id: a29 } })).date.comanda.arhivata === 0);
  verifica('căutarea „în toate secţiunile" NU găseşte arhivate', !(await lista('toate')).some(x => x.id === a30) && (await lista('toate')).some(x => x.id === a29));

  inchide();
  try { fs.rmSync(TEMP, { recursive: true, force: true }); } catch {}
  console.log(`\n${treceri} trecute, ${caderi} căzute\n`);
  process.exit(caderi ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
