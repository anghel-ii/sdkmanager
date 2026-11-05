// ═══════════════════════════════════════════════════════════════════════════
//  LIVRĂRI DIN AFARA MANAGERULUI (userul, 2026-11-05): adăugate de mână la Organizează
//  livrări, cu id negativ pe pagină; intră în plan, în livrare, pe borderou, se întorc la anulare.
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
async function cheama(metoda, cale, { corp, id } = {}) {
  const spec = rute.find(([m, c]) => m === metoda && c === cale)[2];
  const brut = corp === undefined ? '' : JSON.stringify(corp);
  const iese = { cod: 0, date: null };
  const req = { url: cale, on(e, f) { if (e === 'data' && brut) f(Buffer.from(brut)); if (e === 'end') f(); return this; } };
  const res = { writeHead(c) { iese.cod = c; }, setHeader() {}, end(t) { iese.date = t ? JSON.parse(t) : null; } };
  try { await spec.handler({ req, res, params: { id: String(id ?? '') }, utilizator: eu }); }
  catch (e) { iese.cod = e.cod ?? 500; iese.date = { eroare: e.message }; }
  return iese;
}
const candidati = async () => (await cheama('GET', '/api/livrari/candidati')).date.comenzi;
const livrari = async () => (await cheama('GET', '/api/livrari')).date.livrari;
const adauga = corp => cheama('POST', '/api/livrari/extra', { corp });
const BUN = { client_nume: 'Mobila Design SRL', client_telefon: '0740 000 000', client_adresa: 'Str. Fabricii 12, Turda, Cluj',
  descriere: '2 uşi Confort Verona — trimise greşit', plata: 'fara', incasare: 'fara' };

(async () => {
  deschide();
  creeazaUtilizator({ nume: 'Ana Birou', user: 'ana', parola: 'parola-ana-123', rol: 'birou' });
  eu = db().prepare("SELECT id, nume, rol FROM utilizator WHERE user = 'ana'").get();
  const cmd = Number(db().prepare(`INSERT INTO comanda (numar, tip, client_nume, client_adresa, livrare, creat_de, confirmat_la)
    VALUES ('OF-2026-0001', 'comanda', 'Popescu Ion', 'Str. Mare 1, Sibiu, Sibiu', 'Cu masina noastra', ?, datetime('now'))`).run(eu.id).lastInsertRowid);

  console.log('\nAdăugarea');
  verifica('fără client → 400', (await adauga({ ...BUN, client_nume: ' ' })).cod === 400);
  verifica('fără adresă → 400', (await adauga({ ...BUN, client_adresa: '' })).cod === 400);
  verifica('fără ce se livrează → 400', (await adauga({ ...BUN, descriere: '' })).cod === 400);
  verifica('facturare / încasare lipsă sau aiurea → 400', (await adauga({ ...BUN, plata: '' })).cod === 400 && (await adauga({ ...BUN, incasare: 'x' })).cod === 400);
  verifica('preţ aiurea → 400', (await adauga({ ...BUN, de_incasat: 'mult' })).cod === 400);
  const a = await adauga(BUN);
  verifica('adăugată — „Fără facturare" / „Fără încasare"', a.cod === 201 && a.date.comanda.plata === 'fara' && a.date.comanda.incasare === 'fara', JSON.stringify(a));
  const x = a.date.comanda;
  verifica('id negativ, marcată extra, judeţul din adresă, produsul = ce se livrează',
    x.id < 0 && x.extra === true && x.judet === 'Cluj' && x.produse[0] === BUN.descriere && x.creat_de_nume === 'Ana Birou', JSON.stringify(x));
  const b = (await adauga({ ...BUN, client_nume: 'Ionescu', nr: 'OF-1188', plata: 'fiscala', incasare: 'cash_ch_sofer', de_incasat: '1.200,50', coloana_borderou: 'factura' })).date.comanda;
  verifica('cu nr., preţ şi coloană', b.numar === 'OF-1188' && b.de_incasat === 1200.5 && b.coloana_borderou === 'factura', JSON.stringify(b));
  verifica('nu e o comandă (tabelul comanda neatins)', db().prepare('SELECT COUNT(*) AS n FROM comanda').get().n === 1);
  let c = await candidati();
  verifica('apar la comenzile de livrat, lângă comanda reală', c.some(k => k.id === x.id) && c.some(k => k.id === b.id) && c.some(k => k.id === cmd));

  console.log('\nModificări pe pagină (preţ, coloană, observaţii, judeţ, punct pe hartă)');
  verifica('preţ', (await cheama('PUT', '/api/livrari/comanda/:id', { id: x.id, corp: { de_incasat: '300' } })).cod === 200);
  verifica('coloană + observaţii + judeţ', (await cheama('PUT', '/api/livrari/comanda/:id', { id: x.id, corp: { coloana_borderou: 'bon', observatii_livrare: 'sună', judet: 'Alba' } })).cod === 200);
  verifica('punct pe hartă', (await cheama('PUT', '/api/livrari/comanda/:id', { id: x.id, corp: { lat: 46.57, lon: 23.78, geo_adresa: 'Turda' } })).cod === 200);
  c = await candidati();
  const x2 = c.find(k => k.id === x.id);
  verifica('salvate pe livrarea externă', x2.de_incasat === 300 && x2.coloana_borderou === 'bon' && x2.observatii_livrare === 'sună' && x2.judet === 'Alba' && x2.lat === 46.57, JSON.stringify(x2));
  verifica('comanda reală neatinsă', db().prepare('SELECT de_incasat FROM comanda WHERE id = ?').get(cmd).de_incasat === null);
  verifica('inexistentă → 404', (await cheama('PUT', '/api/livrari/comanda/:id', { id: -999, corp: { de_incasat: '1' } })).cod === 404);

  console.log('\nProgramarea');
  const p = await cheama('POST', '/api/livrari', { corp: { data: '2026-11-20', comenzi: [b.id, cmd, x.id] } });
  verifica('livrare cu comanda reală + 2 externe', p.cod === 201, JSON.stringify(p));
  let ls = await livrari();
  verifica('în livrare, în ordinea traseului', ls.length === 1 && ls[0].comenzi.map(k => k.id).join() === [b.id, cmd, x.id].join(), JSON.stringify(ls[0]?.comenzi.map(k => k.id)));
  verifica('nu mai sunt de organizat', !(await candidati()).some(k => k.extra));
  verifica('programată → nu se poate şterge', (await cheama('DELETE', '/api/livrari/extra/:id', { id: x.id })).cod === 409);
  verifica('a doua oară în altă livrare → refuzat', (await cheama('POST', '/api/livrari', { corp: { data: '2026-11-21', comenzi: [x.id] } })).cod === 409);
  verifica('preţ fără coloană → refuzat la programare', (await adauga({ ...BUN, client_nume: 'Fără coloană' })).cod === 201
    && await (async () => { const n = (await candidati()).find(k => k.client_nume === 'Fără coloană');
      await cheama('PUT', '/api/livrari/comanda/:id', { id: n.id, corp: { de_incasat: '50' } });
      return (await cheama('POST', '/api/livrari', { corp: { data: '2026-11-21', comenzi: [n.id] } })).cod === 400; })());

  console.log('\nAnularea şi ştergerea');
  verifica('livrarea anulată', (await cheama('DELETE', '/api/livrari/:id', { id: ls[0].id })).cod === 200);
  c = await candidati();
  verifica('externele se întorc de organizat', c.some(k => k.id === x.id) && c.some(k => k.id === b.id) && c.some(k => k.id === cmd));
  verifica('ştearsă', (await cheama('DELETE', '/api/livrari/extra/:id', { id: x.id })).cod === 200 && !(await candidati()).some(k => k.id === x.id));
  verifica('ştearsă de două ori → 404', (await cheama('DELETE', '/api/livrari/extra/:id', { id: x.id })).cod === 404);

  inchide();
  try { fs.rmSync(TEMP, { recursive: true, force: true }); } catch {}
  console.log(`\n${treceri} trecute, ${caderi} căzute\n`);
  process.exit(caderi ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
