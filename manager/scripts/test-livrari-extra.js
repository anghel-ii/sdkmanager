// ═══════════════════════════════════════════════════════════════════════════
//  COMENZI PUSE DE MÂNĂ PE LISTA DE LIVRAT (userul, 2026-11-05): „Livrează din nou o comandă"
//  (deja livrată, cost 0) şi „Adaugă o comandă la livrare" (în lucru / finalizată, orice mod de
//  livrare). Pe pagină id negativ; intră în plan, în livrare, pe borderou, se întorc la anulare.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'manager-livrari-extra-'));
Object.assign(process.env, { MANAGER_DB: path.join(TEMP, 'manager.sqlite'), MANAGER_BACKUP: path.join(TEMP, 'backup'), MANAGER_RAPORTARE: '0', MANAGER_RELEU_URL: '' });

const { deschide, db, inchide } = require('../server/db.js');
const { creeazaUtilizator } = require('../server/auth.js');
const { rute } = require('../server/livrari.js');

let treceri = 0, caderi = 0;
function verifica(nume, conditie, detaliu = '') {
  if (conditie) { treceri++; console.log(`  ✓ ${nume}`); }
  else          { caderi++;  console.log(`  ✗ ${nume}${detaliu ? ` — ${detaliu}` : ''}`); }
}

let eu = null;
async function cheama(metoda, cale, { corp, id, query = '' } = {}) {
  const spec = rute.find(([m, c]) => m === metoda && c === cale)[2];
  const brut = corp === undefined ? '' : JSON.stringify(corp);
  const iese = { cod: 0, date: null };
  const req = { url: cale + query, on(e, f) { if (e === 'data' && brut) f(Buffer.from(brut)); if (e === 'end') f(); return this; } };
  const res = { writeHead(c) { iese.cod = c; }, setHeader() {}, end(t) { iese.date = t ? JSON.parse(t) : null; } };
  try { await spec.handler({ req, res, params: { id: String(id ?? '') }, utilizator: eu }); }
  catch (e) { iese.cod = e.cod ?? 500; iese.date = { eroare: e.message }; }
  return iese;
}
const candidati = async () => (await cheama('GET', '/api/livrari/candidati')).date.comenzi;
const livrari = async () => (await cheama('GET', '/api/livrari')).date.livrari;
const cauta = async (fel, q = '') => (await cheama('GET', '/api/livrari/cauta', { query: `?fel=${fel}&q=${encodeURIComponent(q)}` })).date.comenzi.map(c => c.id);
const pune = (comanda_id, din_nou = false) => cheama('POST', '/api/livrari/extra', { corp: { comanda_id, din_nou } });
const zi = dif => db().prepare(`SELECT date('now', 'localtime', ?) AS d`).get(`${dif} days`).d;

let nr = 0;
function comanda({ client, adresa = 'Str. Mare 1, Sibiu, Sibiu', livrare = 'Cu masina noastra', tip = 'comanda', finalizata = false, produs = 'Confort Verona' }) {
  nr++;
  const id = Number(db().prepare(`INSERT INTO comanda (numar, tip, client_nume, client_adresa, livrare, creat_de, confirmat_la, finalizat_la)
    VALUES (?, ?, ?, ?, ?, ?, '2026-10-01 10:00:00', ?)`).run(`OF-2026-${String(nr).padStart(4, '0')}`, tip, client, adresa, livrare, eu.id,
    finalizata ? '2026-10-20 10:00:00' : null).lastInsertRowid);
  db().prepare(`INSERT INTO pozitie (comanda_id, idx, sistem, eticheta, finisaj, latime, inaltime, nr_usi, config_json)
    VALUES (?, 1, 'confortVerona', ?, 'ALUMINIU', 2400, 2600, 2, '{}')`).run(id, produs);
  return id;
}

(async () => {
  deschide();
  creeazaUtilizator({ nume: 'Ana Birou', user: 'ana', parola: 'parola-ana-123', rol: 'birou' });
  eu = db().prepare("SELECT id, nume, rol FROM utilizator WHERE user = 'ana'").get();

  const livrata = comanda({ client: 'Mobila Design SRL', finalizata: true, produs: 'Ramă 820' });
  const deLivrat = comanda({ client: 'Popescu Ion' });                                   // cu maşina, neprogramată
  const curier = comanda({ client: 'Ionescu Ştefan', livrare: 'Curier', adresa: 'Str. Lungă 3, Turda, Cluj' });
  const oferta = comanda({ client: 'Doar ofertă', tip: 'oferta' });
  const faraLivrare = comanda({ client: 'Fără mod de livrare', livrare: null });
  // livrata a fost într-o livrare de acum 3 zile
  const l0 = Number(db().prepare(`INSERT INTO livrare (data, creat_la, creat_de) VALUES (?, datetime('now'), ?)`).run(zi(-3), eu.id).lastInsertRowid);
  db().prepare('INSERT INTO livrare_comanda (livrare_id, comanda_id, ordine) VALUES (?, ?, 1)').run(l0, livrata);

  console.log('\nFerestrele de căutare');
  let r = await cauta('din_nou');
  verifica('„din nou": doar cele deja livrate', r.length === 1 && r[0] === livrata, JSON.stringify(r));
  r = await cauta('adauga');
  verifica('„adaugă": în lucru + finalizate, fără cele deja pe listă şi fără oferte', r.includes(curier) && r.includes(livrata)
    && !r.includes(deLivrat) && !r.includes(oferta) && r.includes(faraLivrare), JSON.stringify(r));
  verifica('caută după client, fără diacritice', (await cauta('adauga', 'stefan')).join() === String(curier));
  verifica('după produs', (await cauta('adauga', 'rama 820')).join() === String(livrata));
  verifica('după nr.', (await cauta('adauga', 'OF-2026-0003')).join() === String(curier));
  verifica('după adresă', (await cauta('adauga', 'turda')).join() === String(curier));
  verifica('după dată (zz.ll.aaaa, şi cu „/")', (await cauta('adauga', '20.10.2026')).join() === String(livrata) && (await cauta('adauga', '20/10')).join() === String(livrata));
  const [a, l, z] = zi(-3).split('-');
  verifica('„din nou" după data livrării', (await cauta('din_nou', `${z}.${l}.${a}`)).join() === String(livrata));
  verifica('cuvinte care nu se potrivesc → nimic', (await cauta('adauga', 'popescu turda')).length === 0);

  console.log('\nPuse pe lista de livrat');
  verifica('ofertă → 404', (await pune(oferta)).cod === 404);
  const dn = await pune(livrata, true);
  verifica('livrată din nou — cost 0', dn.cod === 201 && dn.date.comanda.din_nou === true && dn.date.comanda.de_incasat === 0
    && dn.date.comanda.id < 0 && dn.date.comanda.client_nume === 'Mobila Design SRL' && dn.date.comanda.produse[0].startsWith('Ramă 820'), JSON.stringify(dn.date));
  verifica('a doua oară cât e pe listă → 409', (await pune(livrata, true)).cod === 409);
  const ad = await pune(curier);
  verifica('comanda cu curier adăugată, judeţul din adresă', ad.cod === 201 && ad.date.comanda.judet === 'Cluj' && ad.date.comanda.din_nou === false);
  let c = await candidati();
  verifica('apar la comenzile de livrat', c.some(k => k.id === dn.date.comanda.id) && c.some(k => k.id === ad.date.comanda.id) && c.some(k => k.id === deLivrat));
  verifica('nu mai apar în ferestre', !(await cauta('din_nou')).includes(livrata) && !(await cauta('adauga')).includes(curier));
  verifica('comanda nu se schimbă (livrare = Curier)', db().prepare('SELECT livrare FROM comanda WHERE id = ?').get(curier).livrare === 'Curier');

  console.log('\nPe pagină');
  verifica('la „din nou" preţul nu se schimbă', (await cheama('PUT', '/api/livrari/comanda/:id', { id: dn.date.comanda.id, corp: { de_incasat: '100' } })).cod === 400);
  verifica('la cea adăugată: preţ + coloană + observaţii', (await cheama('PUT', '/api/livrari/comanda/:id', { id: ad.date.comanda.id,
    corp: { de_incasat: '250', coloana_borderou: 'bon', observatii_livrare: 'sună' } })).cod === 200);
  c = await candidati();
  const ad2 = c.find(k => k.id === ad.date.comanda.id);
  verifica('salvate pe rândul ei, comanda neatinsă', ad2.de_incasat === 250 && ad2.coloana_borderou === 'bon' && ad2.observatii_livrare === 'sună'
    && db().prepare('SELECT de_incasat FROM comanda WHERE id = ?').get(curier).de_incasat === null);

  console.log('\nProgramarea');
  const p = await cheama('POST', '/api/livrari', { corp: { data: zi(2), comenzi: [ad.date.comanda.id, deLivrat, dn.date.comanda.id] } });
  verifica('livrare cu cea normală + cele două puse de mână', p.cod === 201, JSON.stringify(p));
  let ls = (await livrari()).filter(x => x.id !== l0);
  verifica('în ordinea traseului', ls[0].comenzi.map(k => k.id).join() === [ad.date.comanda.id, deLivrat, dn.date.comanda.id].join());
  verifica('pe borderou: cea din nou cu 0', ls[0].comenzi.find(k => k.din_nou).de_incasat === 0);
  verifica('nu mai sunt de organizat', !(await candidati()).some(k => k.extra));
  verifica('programată → nu se poate scoate', (await cheama('DELETE', '/api/livrari/extra/:id', { id: ad.date.comanda.id })).cod === 409);
  verifica('aceeaşi comandă se poate livra din nou şi a treia oară (altă intrare)', (await pune(livrata, true)).cod === 201);

  console.log('\nAnularea şi scoaterea');
  verifica('livrarea anulată', (await cheama('DELETE', '/api/livrari/:id', { id: ls[0].id })).cod === 200);
  c = await candidati();
  verifica('cele puse de mână se întorc de organizat', c.some(k => k.id === ad.date.comanda.id) && c.some(k => k.id === dn.date.comanda.id));
  verifica('scoasă de pe listă, comanda rămâne', (await cheama('DELETE', '/api/livrari/extra/:id', { id: ad.date.comanda.id })).cod === 200
    && !(await candidati()).some(k => k.id === ad.date.comanda.id) && !!db().prepare('SELECT 1 FROM comanda WHERE id = ?').get(curier));
  verifica('scoasă de două ori → 404', (await cheama('DELETE', '/api/livrari/extra/:id', { id: ad.date.comanda.id })).cod === 404);

  inchide();
  try { fs.rmSync(TEMP, { recursive: true, force: true }); } catch {}
  console.log(`\n${treceri} trecute, ${caderi} căzute\n`);
  process.exit(caderi ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
